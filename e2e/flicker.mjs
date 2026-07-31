import { chromium } from 'playwright'
import { APP, EMAIL, PASSWORD, SUPABASE_ANON as ANON, SUPABASE_URL as URL } from './config.mjs'

/**
 * 달을 바꿀 때의 깜빡임 재현 — 고치지 않고 **측정만** 한다.
 *
 *   node e2e/flicker.mjs
 *
 * 통과/실패를 내는 검증이 아니다. requestAnimationFrame 마다 화면 상태를 찍어
 * "내용 → 스켈레톤 → 내용" 이 실제로 일어나는지, 몇 ms 동안인지, 그 사이 페이지
 * 높이가 얼마나 튀는지를 표로 뽑는다. 눈으로 본 깜빡임을 숫자로 남기는 것이 목적이다.
 *
 * 측정을 세 번 한다 — 처음 보는 달 / 캐시에 있는 달 / 다시 처음 보는 달. 깜빡임이
 * 달 이동 자체 때문인지 캐시 유무 때문인지는 이 대비로만 갈린다.
 *
 * 지연을 얹은 회차를 따로 돈다. localhost + 유선에서는 왕복이 짧아 스켈레톤이
 * 한두 프레임만 스치는데, 그건 실제 사용 환경이 아니다 — 휴대폰에서 얼마나
 * 오래 보이는지가 사용자가 겪는 값이다.
 */

const SETTLE_FRAMES = 15 // 스켈레톤 없는 프레임이 이만큼 이어지면 안정됐다고 본다
const SETTLE_TIMEOUT = 15_000

/* ─────────────────────────────────────────────────────────── 계정 데이터 준비 */

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

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/**
 * 측정할 세 달에 거래가 있게 해 둔다.
 *
 * 빈 달은 깜빡임을 약하게 만든다 — 스켈레톤에서 빈 상태로 넘어가는 것도 깜빡임이지만,
 * 사용자가 불편하다고 말하는 쪽은 **보고 있던 목록이 사라지는** 경우다. 이미 거래가
 * 있는 달은 건드리지 않는다(reset 을 걸지 않는다 — 이 스크립트는 측정용이다).
 */
async function seed(months) {
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
  if (!expense) throw new Error('지출 카테고리가 없습니다')

  const added = []
  for (const month of months) {
    const got = await api(
      `/rest/v1/transactions?select=id&occurred_on=gte.${month}-01&occurred_on=lt.${shiftMonth(month, 1)}-01`,
    )
    const have = got.body?.length ?? 0
    if (have >= 3) continue
    const rows = Array.from({ length: 3 - have }, (_, i) => ({
      user_id: uid,
      category_id: expense.id,
      type: 'expense',
      amount: 12_000 + i * 1_000,
      occurred_on: `${month}-${String(i + 5).padStart(2, '0')}`,
      memo: '깜빡임 측정용',
    }))
    await api('/rest/v1/transactions', { method: 'POST', body: JSON.stringify(rows) })
    added.push(`${month}+${rows.length}`)
  }
  return added
}

/* ────────────────────────────────────────────────────────────────── 프레임 채취 */

/**
 * 매 프레임 화면 상태를 찍는다.
 *
 * innerText 를 읽지 않는다 — 프레임마다 강제 리플로우를 걸면 측정이 측정 대상을
 * 흔든다. 셀렉터 카운트와 rect 하나로 "무엇이 떠 있는가" 는 충분히 구별된다.
 *
 *   rows   거래 행 수. **판정의 기준이다** — 0 이면 보고 있던 목록이 사라진 것이다
 *   hero   대표 숫자 텍스트 ('' = 대표 자리가 비었다)
 *   dim    이전 달 목록이 로딩 표시로 흐려져 있는가 (aria-busy)
 *   pulse  animate-pulse 개수. 참고용 — 무엇이 떠 있는지 눈으로 읽을 때만 쓴다
 *   h      화면 높이 (레이아웃이 튀는 폭)
 *
 * dim 을 함께 재는 이유: 흐림도 눈에 보이는 변화다. 스켈레톤을 없애고 흐림을
 * 늘리기만 했으면 고친 게 아니므로 둘을 같은 표에 놓는다.
 *
 * pulse 로 판정하지 않는다. 한때 `.animate-pulse` 개수로 "스켈레톤이 떴다" 를
 * 판정했는데, 월 요약의 대표 자리 스켈레톤과 월 네비게이터의 기다림 점이 같은
 * 클래스를 쓰는 탓에 **의도된 두 표시가 목록 깜빡임으로 집계됐다.** 물어야 할 것은
 * "보고 있던 목록이 사라졌는가" 이고 그건 rows 가 직접 답한다.
 *
 * hero 도 aria-hidden 안쪽은 세지 않는다 — 스켈레톤이 실제 대표 숫자와 같은 태그·
 * 같은 클래스를 쓰게 되어(MonthSummary) 그냥 읽으면 스켈레톤의 &nbsp; 가 잡힌다.
 */
const SAMPLER = () => {
  window.__frames = []
  window.__sampling = true
  const tick = () => {
    if (!window.__sampling) return
    const section = document.querySelector('section')
    const hero = [...document.querySelectorAll('.text-hero')].find(
      (el) => !el.closest('[aria-hidden]'),
    )
    window.__frames.push({
      t: Math.round(performance.now()),
      rows: document.querySelectorAll('section li').length,
      hero: hero?.textContent ?? '',
      dim: !!document.querySelector('[aria-busy="true"]'),
      pulse: document.querySelectorAll('.animate-pulse').length,
      h: section ? Math.round(section.getBoundingClientRect().height) : 0,
    })
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

/** 같은 상태가 이어지는 프레임을 한 구간으로 접는다. */
function phases(frames) {
  const key = (f) => `${f.rows}|${f.hero}|${f.dim}|${f.pulse > 0}`
  const out = []
  for (const f of frames) {
    const last = out[out.length - 1]
    if (last && key(last.first) === key(f)) {
      last.last = f
      last.n += 1
      last.hMin = Math.min(last.hMin, f.h)
      last.hMax = Math.max(last.hMax, f.h)
    } else {
      out.push({ first: f, last: f, n: 1, hMin: f.h, hMax: f.h })
    }
  }
  return out
}

async function measure(page, label, act) {
  await page.evaluate(SAMPLER)
  const t0 = await page.evaluate(() => performance.now())
  await act()

  // 스켈레톤 없는 프레임이 연달아 나오면 그친다.
  const deadline = Date.now() + SETTLE_TIMEOUT
  for (;;) {
    const done = await page.evaluate((need) => {
      const f = window.__frames
      if (f.length < need) return false
      return f.slice(-need).every((x) => x.pulse === 0 && !x.dim)
    }, SETTLE_FRAMES)
    if (done) break
    if (Date.now() > deadline) break
    await new Promise((s) => setTimeout(s, 30))
  }

  const frames = await page.evaluate(() => {
    window.__sampling = false
    return window.__frames
  })

  return { label, t0, frames: frames.map((f) => ({ ...f, t: f.t - Math.round(t0) })) }
}

/* ──────────────────────────────────────────────────────────────────── 보고서 */

function report(m) {
  const ph = phases(m.frames)
  console.log(`\n── ${m.label}`)
  if (!ph.length) {
    console.log('   프레임을 못 찍었습니다')
    return null
  }

  const held = (pick) => ph.filter(pick).reduce((s, p) => s + (p.last.t - p.first.t), 0)

  for (const p of ph) {
    const ms = p.last.t - p.first.t
    const what =
      p.first.rows > 0
        ? `목록 ${p.first.rows}행${p.first.dim ? ' 흐림' : ''}`
        : `목록 없음(펄스 ${p.first.pulse})`
    const hero = p.first.hero ? `대표 ${p.first.hero.replace(/\s+/g, '')}` : '대표 빈 자리'
    const h = p.hMin === p.hMax ? `${p.hMin}px` : `${p.hMin}~${p.hMax}px`
    console.log(
      `   ${String(p.first.t).padStart(5)}ms  ${String(ms).padStart(4)}ms 유지  ` +
        `${what.padEnd(18)} ${hero.padEnd(18)} 높이 ${h}`,
    )
  }

  /*
    깜빡임의 정의: **보고 있던 목록이 사라졌다가 돌아왔다.**

    이전에는 `.animate-pulse` 가 떴는지로 판정했는데, 대표 자리 스켈레톤과
    기다림 점이 같은 클래스를 써서 의도한 표시까지 깜빡임으로 셌다.
  */
  const lost = ph.findIndex((p) => p.first.rows === 0)
  const hadRowsBefore = ph.slice(0, Math.max(lost, 0)).some((p) => p.first.rows > 0)
  const lostMs = held((p) => p.first.rows === 0)
  // 흐림도 보이는 변화다 — 스켈레톤을 흐림으로 바꾸기만 했으면 고친 게 아니다.
  const dimMs = held((p) => p.first.dim)
  // 대표 자리는 일부러 이전 달 값을 안 남긴다(useSummary). 그 자리가 빈 시간.
  const heroMs = held((p) => !p.first.hero)
  const heights = m.frames.map((f) => f.h)
  const jump = Math.max(...heights) - Math.min(...heights)
  const settled = m.frames[m.frames.length - 1].t

  console.log(
    `   ⇒ ${
      lost >= 0 && hadRowsBefore
        ? `깜빡임 있음 — 목록이 ${lostMs}ms 사라짐`
        : lost >= 0
          ? `목록 없음 ${lostMs}ms (직전에도 없었음)`
          : '깜빡임 없음 — 목록이 자리를 지켰다'
    } · 흐림 ${dimMs}ms · 대표 빈 자리 ${heroMs}ms · 높이 변동 ${jump}px · 안정까지 ${settled}ms`,
  )
  return { flicker: lost >= 0 && hadRowsBefore, lostMs, dimMs, heroMs, jump, settled }
}

/* ──────────────────────────────────────────────────────────────────────── 실행 */

const thisMonth = (() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
})()
const prev = shiftMonth(thisMonth, -1)
const prev2 = shiftMonth(thisMonth, -2)
/**
 * 프리페치가 못 덮는 달. 양옆만 미리 받으므로(usePrefetchMonths) 시트로 멀리
 * 건너뛰면 캐시가 없다 — 이전 달 목록이 자리를 지키는 쪽이 맡는 경로다.
 */
const jump = shiftMonth(thisMonth, -6)

console.log('── 준비')
const added = await seed([thisMonth, prev, prev2, jump])
console.log(`   거래 보강: ${added.length ? added.join(' · ') : '필요 없음 (이미 3건 이상)'}`)

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 } })
const page = await context.newPage()

await page.goto(APP, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('text=로그인', { timeout: 30000 })
await page.getByLabel('이메일').fill(EMAIL)
await page.getByLabel('비밀번호').fill(PASSWORD)
await page.getByRole('button', { name: '로그인' }).click()
await page.getByRole('button', { name: '거래 추가' }).waitFor({ timeout: 30000 })
// 첫 화면의 조회가 모두 끝난 뒤에 재기 시작한다.
await page.waitForFunction(() => document.querySelectorAll('.animate-pulse').length === 0, null, {
  timeout: 30000,
})

const back = () => page.getByRole('button', { name: '이전 달' }).click()
const fwd = () => page.getByRole('button', { name: '다음 달' }).click()

/**
 * 월 선택 시트를 **측정 전에** 열어 둔다. 재는 것은 달을 고르는 클릭 하나이고,
 * 시트를 여는 동작까지 재면 그 애니메이션이 프레임에 섞인다.
 *
 * 시트는 fixed inset-0 이라(Sheet.tsx) section 의 레이아웃 높이에 안 들어간다 —
 * 열린 채로 재도 높이 측정이 오염되지 않는다.
 */
async function openPicker(target) {
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

const pickMonth = (m) =>
  page
    .getByRole('dialog')
    .getByRole('button', { name: `${Number(m.slice(5, 7))}월`, exact: true })
    .click()

const cdp = await context.newCDPSession(page)
await cdp.send('Network.enable')

/** 왕복 지연을 얹는다. 0 이면 그대로(유선). */
async function latency(ms) {
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: ms,
    downloadThroughput: -1,
    uploadThroughput: -1,
  })
}

const summary = []

/*
  0 · 150 · 600ms.

  600 을 넣는 이유는 로딩 표시의 문턱(Transactions 의 DIM_DELAY = 200ms)을 확실히
  넘기기 위해서다. 150ms 회차에서는 조회가 그보다 빨리 끝나 흐림이 아예 안 켜졌는데,
  그건 좋은 결과이지만 **흐림 경로를 검증하지는 못한다** — 켜졌을 때 목록이 자리를
  지키는지는 켜지는 회차에서만 볼 수 있다.
*/
for (const rtt of [0, 150, 600]) {
  await latency(rtt)
  const tag = rtt === 0 ? '유선' : `지연 +${rtt}ms`
  console.log(`\n\n════ ${tag} ════`)

  // 캐시를 비워 "처음 보는 달" 을 다시 만든다. 새로고침이 가장 확실하다.
  await page.goto(`${APP}?month=${thisMonth}`, { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '거래 추가' }).waitFor({ timeout: 30000 })
  await page.waitForFunction(() => document.querySelectorAll('.animate-pulse').length === 0, null, {
    timeout: 30000,
  })

  summary.push([
    tag,
    '① 처음 보는 달로 (‹)',
    report(await measure(page, `${tag} · ${thisMonth} → ${prev} (캐시 없음)`, back)),
  ])
  summary.push([
    tag,
    '② 캐시에 있는 달로 (›)',
    report(await measure(page, `${tag} · ${prev} → ${thisMonth} (캐시 있음)`, fwd)),
  ])
  await back()
  await page.waitForFunction(() => document.querySelectorAll('.animate-pulse').length === 0, null, {
    timeout: 30000,
  })
  summary.push([
    tag,
    '③ 또 처음 보는 달로 (‹)',
    report(await measure(page, `${tag} · ${prev} → ${prev2} (캐시 없음)`, back)),
  ])

  await openPicker(jump)
  summary.push([
    tag,
    '④ 6개월 전으로 (시트)',
    report(await measure(page, `${tag} · ${prev2} → ${jump} (프리페치 밖)`, () => pickMonth(jump))),
  ])
}

console.log('\n\n════ 요약 ════')
for (const [tag, what, r] of summary) {
  if (!r) continue
  console.log(
    `${tag.padEnd(10)} ${what.padEnd(24)} ${
      r.flicker ? `목록 사라짐 ${String(r.lostMs).padStart(4)}ms` : '목록 유지        '
    }  흐림 ${String(r.dimMs).padStart(4)}ms  대표 빈 자리 ${String(r.heroMs).padStart(4)}ms  높이 ${String(r.jump).padStart(4)}px  안정 ${String(r.settled).padStart(4)}ms`,
  )
}

await browser.close()
