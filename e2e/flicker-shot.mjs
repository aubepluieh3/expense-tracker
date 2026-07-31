import { mkdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { chromium } from 'playwright'
import {
  APP,
  EMAIL,
  PASSWORD,
  SHOTS,
  SUPABASE_ANON as ANON,
  SUPABASE_URL as URL,
} from './config.mjs'

/**
 * 한 경로만 본다 — 2026-04 를 보다가 월 선택 시트에서 2027-08 을 누른 순간.
 *
 *   node e2e/flicker-shot.mjs
 *
 * flicker.mjs 가 훑는 네 경로에 없는 조합이라 따로 찍는다. 두 가지가 겹친다:
 *
 *   1. 프리페치 밖. 양옆 한 칸만 미리 받으므로(usePrefetchMonths) 16개월 뒤는 캐시가 없다.
 *   2. **대상 달이 비어 있다.** 기록이 없는 달은 MonthSummary 가 hero 를 아예 그리지
 *      않는다(24px "0원 · 수입 0 · 지출 0" 은 알려주는 게 없다). 그래서 대표 자리가
 *      "스켈레톤 → 없음" 으로 끝나 자리를 지킨 것이 도리어 무너진다 — 스켈레톤이
 *      실제 대표 숫자와 높이를 맞춰 둔 것이 이 경우에는 맞출 대상이 없다.
 *
 * 시간은 지연 0 회차에서 재고, 사진은 지연을 크게 준 회차에서 찍는다. 한 회차로
 * 합치면 둘 다 못 얻는다 — 스크린샷 한 장이 100ms 이상 걸려서 짧은 전환을 찍으려
 * 하면 그 자체가 시간을 흐트리고, 반대로 지연을 준 회차의 ms 는 실제 값이 아니다.
 */

const VIEW = { width: 390, height: 844 }
/**
 * 사진용 지연. MonthNavigator 의 WAIT_MAX(1500ms) 보다 **낮아야** 한다.
 *
 * 처음에 1500 으로 두었더니 시트가 기다리다 지쳐 넘어간 뒤를 찍었다 — 그건
 * 폴백 경로이고, 보려던 것은 시트가 기다리는 화면이었다. 문턱과 같은 값을
 * 고른 것이 실수였다.
 */
const SHOT_LATENCY = 700
const FROM = '2026-04'
const TO = '2027-08'

/** 소크에서 건너뛸 달. 씨앗 데이터가 있는 달을 피해 캐시 미스를 확실하게 한다. */
const SOAK_TARGETS = ['2025-02', '2025-07', '2025-11', '2027-03', '2027-06', '2027-10']
const SOAK_LATENCIES = [0, 200, 500, 900]

mkdirSync(SHOTS, { recursive: true })

/* ───────────────────────────────────────────────────────────────── 데이터 준비 */

let token = ''

async function api(p, i = {}) {
  const r = await fetch(URL + p, {
    ...i,
    headers: {
      apikey: ANON,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(i.headers ?? {}),
    },
  })
  const t = await r.text()
  return { status: r.status, body: t ? JSON.parse(t) : null }
}

/**
 * 출발 달에는 거래가 있어야 하고 도착 달은 비어 있어야 한다.
 *
 * 출발이 비어 있으면 "목록이 자리를 지킨다" 를 볼 수 없고(지킬 내용이 없다),
 * 도착에 거래가 있으면 이 경로의 핵심인 hero 붕괴가 안 나온다.
 */
async function prepare() {
  const s = await api('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (s.status !== 200 || !s.body?.access_token) {
    throw new Error(`테스트 계정 로그인 실패 (${s.body?.error_code ?? s.status})`)
  }
  token = s.body.access_token
  const uid = s.body.user.id

  const cats = await api('/rest/v1/categories?select=id,name,type&deleted_at=is.null')
  const expense = cats.body.find((c) => c.type === 'expense')

  const from = await api(
    `/rest/v1/transactions?select=id&occurred_on=gte.${FROM}-01&occurred_on=lt.${FROM}-30`,
  )
  if ((from.body?.length ?? 0) < 3) {
    const rows = Array.from({ length: 3 - (from.body?.length ?? 0) }, (_, i) => ({
      user_id: uid,
      category_id: expense.id,
      type: 'expense',
      amount: 23_000 + i * 4_000,
      occurred_on: `${FROM}-${String(i + 7).padStart(2, '0')}`,
      memo: '깜빡임 측정용',
    }))
    await api('/rest/v1/transactions', { method: 'POST', body: JSON.stringify(rows) })
  }

  const to = await api(
    `/rest/v1/transactions?select=id&occurred_on=gte.${TO}-01&occurred_on=lt.2027-09-01`,
  )
  return { fromRows: Math.max(from.body?.length ?? 0, 3), toRows: to.body?.length ?? 0 }
}

/* ─────────────────────────────────────────────────────────────────── 프레임 */

const SAMPLER = () => {
  window.__frames = []
  window.__sampling = true
  const tick = () => {
    if (!window.__sampling) return
    const section = document.querySelector('section')
    const hero = [...document.querySelectorAll('.text-hero')].find(
      (el) => !el.closest('[aria-hidden]'),
    )
    // 대표 자리가 스켈레톤으로 잡혀 있는가 — 실제 hero 와 구분해서 센다.
    const heroSkeleton = !!document.querySelector('[aria-hidden] .text-hero')
    window.__frames.push({
      t: Math.round(performance.now()),
      rows: document.querySelectorAll('section li').length,
      empty: !!document.body.innerText.includes('기록이 없어요'),
      hero: hero?.textContent?.replace(/\s+/g, '') ?? '',
      heroSkeleton,
      dim: !!document.querySelector('[aria-busy="true"]'),
      h: section ? Math.round(section.getBoundingClientRect().height) : 0,
    })
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

function timeline(frames) {
  const key = (f) => `${f.rows}|${f.empty}|${f.hero}|${f.heroSkeleton}|${f.dim}`
  const out = []
  for (const f of frames) {
    const last = out[out.length - 1]
    if (last && key(last.first) === key(f)) {
      last.last = f
      last.hMin = Math.min(last.hMin, f.h)
      last.hMax = Math.max(last.hMax, f.h)
    } else out.push({ first: f, last: f, hMin: f.h, hMax: f.h })
  }
  return out
}

/* ──────────────────────────────────────────────────────────────────── 조작 */

async function login(page) {
  await page.goto(`${APP}?month=${FROM}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('text=로그인', { timeout: 30000 })
  await page.getByLabel('이메일').fill(EMAIL)
  await page.getByLabel('비밀번호').fill(PASSWORD)
  await page.getByRole('button', { name: '로그인' }).click()
  await page.getByRole('button', { name: '거래 추가' }).waitFor({ timeout: 30000 })
  // URL 의 month 는 로그인 리다이렉트에 씻겨 나간다. 로그인 뒤에 다시 넣는다.
  await page.goto(`${APP}?month=${FROM}`, { waitUntil: 'domcontentloaded' })
  await settled(page)
}

/**
 * 화면이 실제로 다 그려진 상태. 프리페치까지 돌도록 한 박자 더 준다.
 *
 * "펄스가 없다" 만으로는 안 된다. goto 직후에는 아직 아무것도 시작하지 않아
 * 펄스도 없으므로 이 조건이 즉시 통과한다 — 소크에서 지연 900ms 를 주었을 때
 * 그 틈으로 **초기 로딩 중인 화면 위에 월 선택 시트를 열어 버렸고**, 탐지기가
 * 그 대표 자리 스켈레톤을 "시트 아래가 샜다" 로 8건 보고했다. 앱이 아니라
 * 하네스 결함이었다. 그래서 내용이 왔는지까지 확인한다.
 */
async function settled(page) {
  await page.getByRole('button', { name: '거래 추가' }).waitFor({ timeout: 40000 })
  await page.waitForFunction(
    () => {
      if (document.querySelectorAll('.animate-pulse').length) return false
      if (document.querySelector('[aria-busy="true"]')) return false
      const rows = document.querySelectorAll('section li').length
      return rows > 0 || document.body.innerText.includes('기록이 없어요')
    },
    null,
    { timeout: 40000 },
  )
  await page.waitForTimeout(700)
}

/** 월 선택 시트를 열고 목표 연도까지 옮긴다. 클릭 자체는 호출부가 한다. */
async function openPicker(page, target) {
  await page.getByRole('button', { name: /다른 달 선택/ }).click()
  const dlg = page.getByRole('dialog')
  await dlg.waitFor({ timeout: 10000 })
  const want = Number(target.slice(0, 4))
  for (let i = 0; i < 12; i += 1) {
    const shown = Number((await dlg.getByText(/^\d{4}년$/).textContent()).slice(0, 4))
    if (shown === want) return
    await page.getByRole('button', { name: shown > want ? '이전 해' : '다음 해' }).click()
  }
  throw new Error(`${target} 의 해로 못 갔습니다`)
}

const pickMonth = (page, m) =>
  page
    .getByRole('dialog')
    .getByRole('button', { name: `${Number(m.slice(5, 7))}월`, exact: true })
    .click()

/* ──────────────────────────────────────────────────────────────────── 실행 */

console.log('── 준비')
const { fromRows, toRows } = await prepare()
console.log(`   ${FROM} 거래 ${fromRows}건 · ${TO} 거래 ${toRows}건`)
if (toRows > 0) console.log(`   ⚠ ${TO} 이 비어 있지 않습니다 — hero 붕괴는 안 나옵니다`)

const browser = await chromium.launch()

/** `node e2e/flicker-shot.mjs soak` 이면 소크만 돈다 — 원인을 좁히는 동안 빠르게 돌린다. */
const ONLY_SOAK = process.argv[2] === 'soak'

/* ── 1회차: 지연 없이 시간만 잰다 ───────────────────────────────────────── */

if (!ONLY_SOAK) {
  const context = await browser.newContext({ viewport: VIEW })
  const page = await context.newPage()
  await login(page)
  await openPicker(page, TO)

  await page.evaluate(SAMPLER)
  const t0 = await page.evaluate(() => performance.now())
  await pickMonth(page, TO)

  const deadline = Date.now() + 20000
  for (;;) {
    const done = await page.evaluate(() => {
      const f = window.__frames
      if (f.length < 20) return false
      return f.slice(-20).every((x) => !x.dim && !x.heroSkeleton)
    })
    if (done || Date.now() > deadline) break
    await new Promise((s) => setTimeout(s, 30))
  }
  const frames = await page.evaluate(() => {
    window.__sampling = false
    return window.__frames
  })

  console.log(`\n── ${FROM} → ${TO} · 지연 없음 (실제 시간)`)
  for (const p of timeline(frames.map((f) => ({ ...f, t: f.t - Math.round(t0) })))) {
    const f = p.first
    const list = f.rows > 0 ? `목록 ${f.rows}행${f.dim ? ' 흐림' : ''}` : f.empty ? '빈 상태' : '—'
    const hero = f.heroSkeleton ? '대표 스켈레톤' : f.hero ? `대표 ${f.hero}` : '대표 없음'
    const h = p.hMin === p.hMax ? `${p.hMin}px` : `${p.hMin}~${p.hMax}px`
    console.log(
      `   ${String(f.t).padStart(5)}ms  ${String(p.last.t - f.t).padStart(4)}ms 유지  ` +
        `${list.padEnd(16)} ${hero.padEnd(15)} 높이 ${h}`,
    )
  }
  const hs = frames.map((f) => f.h)
  console.log(
    `   ⇒ 높이 ${Math.min(...hs)} → ${Math.max(...hs)}px (변동 ${Math.max(...hs) - Math.min(...hs)}px)`,
  )
  await context.close()
}

/* ── 2회차: 지연을 크게 주고 각 단계를 찍는다 ───────────────────────────── */

const shots = []
if (!ONLY_SOAK) {
  const context = await browser.newContext({
    viewport: VIEW,
    recordVideo: { dir: SHOTS, size: VIEW },
  })
  const page = await context.newPage()
  await login(page)

  const shoot = async (name) => {
    const path = join(SHOTS, `jump-${name}.png`)
    await page.screenshot({ path })
    shots.push(relative(process.cwd(), path))
  }

  await shoot('1-before')
  await openPicker(page, TO)
  await shoot('2-picker')

  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: SHOT_LATENCY,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })

  await pickMonth(page, TO)
  // 시트가 기다리는 중임을 스스로 말하기 시작할 때 (MonthPicker 의 SPINNER_AFTER)
  await page.getByRole('dialog').getByText('불러오는 중…').waitFor({ timeout: 20000 })

  /*
    이때 아래 화면이 무엇을 보이고 있는지가 이 변경의 핵심이다 — 시트가 기다리는
    동안 아래는 **손대지 않은 이전 달**이어야 한다. 사진만으로는 흐림이 아주
    옅게 걸린 것과 구분이 안 되므로 값을 읽어 함께 남긴다.
  */
  const under = await page.evaluate(() => {
    const outside = (sel) =>
      [...document.querySelectorAll(sel)].filter((el) => !el.closest('[role="dialog"]'))
    return {
      label: document.querySelector('[aria-label*="다른 달 선택"]')?.textContent ?? '',
      rows: outside('section li').length,
      dim: outside('[aria-busy="true"]').length,
      heroSkeleton: outside('[aria-hidden] .text-hero').length,
    }
  })
  console.log(
    `\n   시트 대기 중 아래 화면: ${under.label} · 목록 ${under.rows}행 · ` +
      `흐림 ${under.dim} · 대표 스켈레톤 ${under.heroSkeleton}`,
  )
  await shoot('3-sheet-loading')
  await settled(page)
  await shoot('4-after')

  await context.close()
  console.log(`\n── 스크린샷\n   ${shots.join('\n   ')}`)
  console.log(`   영상: ${relative(process.cwd(), SHOTS)}/*.webm`)
}

/* ── 3회차: 소크 — 간헐적으로 새는지 반복해서 본다 ─────────────────────── */

/**
 * "간헐적으로 깜빡인다" 는 한 번 재서는 답할 수 없다. 두 가지를 바꾼다.
 *
 * 반복. 지연 네 단계 × 목표 달 여섯 = 24회를 돌린다. 매 단계 시작에 새로고침해서
 * 캐시를 비우므로 24회가 모두 캐시 미스다.
 *
 * 탐지기. requestAnimationFrame 샘플러는 메인 스레드가 막히면 프레임을 건너뛰어
 * **1프레임 반짝임을 구조적으로 놓친다.** MutationObserver 는 DOM 이 바뀔 때마다
 * 동기로 불리므로 프레임과 무관하게 전부 잡는다. 무는 것은 하나다 —
 * 시트가 열려 있는 동안 아래 화면이 반쪽 상태를 보였는가.
 */
const OBSERVER = () => {
  window.__leaks = []
  const outside = (sel) =>
    [...document.querySelectorAll(sel)].filter((el) => !el.closest('[role="dialog"]'))
  const look = () => {
    if (!document.querySelector('[role="dialog"]')) return
    const dim = outside('[aria-busy="true"]').length
    const heroSkeleton = outside('[aria-hidden] .text-hero').length
    const rows = outside('section li').length
    if (dim || heroSkeleton)
      window.__leaks.push({ t: Math.round(performance.now()), dim, heroSkeleton, rows })
  }
  new MutationObserver(look).observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
  })
}

{
  const context = await browser.newContext({ viewport: VIEW })
  const page = await context.newPage()
  await login(page)

  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')

  console.log('\n── 소크 (시트로 건너뛰기 · 캐시 미스 24회)')
  let leaked = 0
  let slowest = 0
  const details = []

  for (const latency of SOAK_LATENCIES) {
    // 새로고침으로 캐시를 비운다 — gcTime 30분이라 안 비우면 두 번째 단계부터 캐시 히트다.
    await page.goto(`${APP}?month=${FROM}`, { waitUntil: 'domcontentloaded' })
    await settled(page)
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      latency,
      downloadThroughput: -1,
      uploadThroughput: -1,
    })

    const marks = []
    for (const target of SOAK_TARGETS) {
      await page.evaluate(OBSERVER)
      await openPicker(page, target)
      const t0 = Date.now()
      await pickMonth(page, target)
      // 시트가 닫히면 커밋된 것이다.
      await page.getByRole('dialog').waitFor({ state: 'detached', timeout: 20000 })
      const ms = Date.now() - t0
      slowest = Math.max(slowest, ms)
      const leaks = await page.evaluate(() => window.__leaks)
      if (leaks.length) {
        leaked += 1
        // 무엇이 샜는지 그대로 남긴다 — 추측하면 엉뚱한 곳을 고친다.
        const f = leaks[0]
        const l = leaks[leaks.length - 1]
        details.push(
          `${target} 시트열림 ${ms}ms · ${leaks.length}건 · ` +
            `첫 ${f.t}ms(흐림 ${f.dim} 대표스켈레톤 ${f.heroSkeleton} 목록 ${f.rows}행) ` +
            `끝 ${l.t}ms(흐림 ${l.dim} 대표스켈레톤 ${l.heroSkeleton} 목록 ${l.rows}행)`,
        )
      }
      marks.push(`${target.slice(2)}:${String(ms).padStart(4)}ms${leaks.length ? '⚠' : ''}`)
      await settled(page)
      // 다음 회차도 캐시 미스여야 하므로 돌아갈 때는 화살표를 쓰지 않는다.
      await page.goto(`${APP}?month=${FROM}`, { waitUntil: 'domcontentloaded' })
      await settled(page)
    }
    console.log(`   지연 ${String(latency).padStart(3)}ms  ${marks.join('  ')}`)
  }

  console.log(
    `   ⇒ 24회 중 아래 화면이 반쪽 상태를 보인 회차 ${leaked}건 · 시트가 가장 오래 열려 있던 시간 ${slowest}ms`,
  )
  for (const d of details) console.log(`     · ${d}`)
  await context.close()
}

await browser.close()
