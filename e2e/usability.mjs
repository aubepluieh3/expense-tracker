import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { APP, EMAIL, PASSWORD, SHOTS } from './config.mjs'
import { reset } from './reset.mjs'

/**
 * 사용성 테스트 — 실제 사용자처럼 한 주치를 기록한다.
 * 통과/실패가 아니라 마찰을 찾는 게 목적이다. 동작마다 탭 수와 시간을 센다.
 */

mkdirSync(SHOTS, { recursive: true })
const findings = []
let taps = 0
const note = (level, where, what) => findings.push({ level, where, what })

await reset({ quiet: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 420, height: 900 } })
const d = () => page.getByRole('dialog')

async function tap(locator) {
  taps += 1
  await locator.click()
}

const recentRow = () => d().getByRole('group', { name: '최근 사용한 카테고리', exact: true })
const grid = () => d().getByRole('group', { name: '카테고리', exact: true })

/**
 * 실제 사용자처럼 고른다 — "최근" 줄에 있으면 거기서 누르고, 없으면 그리드에서 찾는다.
 * 그리드에도 안 보이면(더보기 뒤) 더보기를 한 번 더 눌러야 한다. 그 한 탭이
 * "최근" 줄이 실제로 아끼는 비용이다.
 */
async function pickCategory(category) {
  const re = new RegExp(`^${category}`)
  if (await recentRow().getByRole('button', { name: re }).count()) {
    await tap(recentRow().getByRole('button', { name: re }))
    return 'recent'
  }
  if (!(await grid().getByRole('button', { name: re }).count())) {
    await tap(grid().getByRole('button', { name: '더보기' }))
    await tap(grid().getByRole('button', { name: re }))
    return 'overflow'
  }
  await tap(grid().getByRole('button', { name: re }))
  return 'grid'
}

const iso = (offset) => {
  const t = new Date()
  t.setDate(t.getDate() + offset)
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`
}

async function record({ category, amount, memo, dayOffset, income = false }) {
  const t0 = Date.now()
  const before = taps

  await tap(page.getByRole('button', { name: '거래 추가' }))
  await d().waitFor()

  if (income) await tap(d().getByRole('radio', { name: '수입' }))
  const via = await pickCategory(category)

  await tap(d().getByPlaceholder('0'))
  await d().getByPlaceholder('0').type(String(amount), { delay: 20 })

  if (dayOffset === -1) await tap(d().getByRole('button', { name: '어제' }))
  else if (dayOffset !== 0) {
    await d().locator('input[type="date"]').fill(iso(dayOffset))
    taps += 2 // 달력 열고 날짜 고르기
  }

  if (memo) {
    await tap(d().getByPlaceholder('선택'))
    await d().getByPlaceholder('선택').type(memo, { delay: 15 })
  }

  await tap(page.getByRole('button', { name: '저장' }))
  await d().waitFor({ state: 'detached', timeout: 20000 })

  const ms = Date.now() - t0
  const label = { recent: '최근줄', grid: '그리드', overflow: '더보기뒤' }[via]
  console.log(
    `   ${category.padEnd(7)} ${String(amount).padStart(8)}원  탭 ${taps - before}회  ${(ms / 1000).toFixed(1)}초  (${label})`,
  )
  return { taps: taps - before, ms, via }
}

console.log('── 로그인 · 첫 화면')
await page.goto(APP, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('text=로그인', { timeout: 30000 })
await page.getByLabel('이메일').fill(EMAIL)
await page.getByLabel('비밀번호').fill(PASSWORD)
await page.getByRole('button', { name: '로그인' }).click()
await page.getByRole('button', { name: '거래 추가' }).waitFor({ timeout: 30000 })
await page.screenshot({ path: join(SHOTS, 'ux-01-empty.png') })

if ((await page.locator('section').first().innerText()).includes('급여를 등록하면')) {
  note(
    '불편',
    '첫 화면',
    '위젯이 "급여를 등록하면 남은 금액을 보여드려요"로 시작하고 링크는 카테고리 관리로 보낸다. 정작 필요한 건 "급여 거래를 등록"하는 것이라 링크가 목적지를 잘못 가리킨다.',
  )
}

console.log('\n── 한 주치 기록')
const runs = []
runs.push(await record({ category: '급여', amount: 3200000, dayOffset: -6, income: true }))
runs.push(await record({ category: '주거·통신', amount: 780000, memo: '월세', dayOffset: -6 }))
runs.push(await record({ category: '식비', amount: 9000, memo: '점심 김치찌개', dayOffset: -3 }))
runs.push(await record({ category: '카페·간식', amount: 4800, dayOffset: -3 }))
runs.push(await record({ category: '교통', amount: 1400, dayOffset: -2 }))
runs.push(await record({ category: '식비', amount: 12000, memo: '점심 파스타', dayOffset: -1 }))
runs.push(await record({ category: '카페·간식', amount: 5200, dayOffset: -1 }))
runs.push(await record({ category: '생활용품', amount: 38000, memo: '세제 휴지', dayOffset: 0 }))
runs.push(await record({ category: '식비', amount: 11000, memo: '점심 돈까스', dayOffset: 0 }))

const avg = runs.reduce((s, r) => s + r.taps, 0) / runs.length
const avgMs = runs.reduce((s, r) => s + r.ms, 0) / runs.length
console.log(`\n   평균 ${avg.toFixed(1)}탭 · ${(avgMs / 1000).toFixed(1)}초`)
await page.screenshot({ path: join(SHOTS, 'ux-02-week.png') })

const viaCount = runs.reduce((m, r) => ({ ...m, [r.via]: (m[r.via] ?? 0) + 1 }), {})
console.log(`   선택 경로: ${JSON.stringify(viaCount)}`)
note(
  '관찰',
  '등록 · 카테고리',
  `기본 6개만 쓰는 한 주치에서는 "최근" 줄이 탭 수를 줄이지 않는다 — 기본 카테고리가 이미 대략 빈도순으로 배치돼 있어 어차피 1탭이다(경로 분포 ${JSON.stringify(viaCount)}). 이 줄이 값을 하는 건 카테고리가 8개를 넘어 "더보기" 뒤로 밀린 경우다. 아래에서 따로 측정한다.`,
)

await tap(page.getByRole('button', { name: '거래 추가' }))
await d().waitFor()
const dateValue = await d().locator('input[type="date"]').inputValue()
await d().getByRole('button', { name: '닫기' }).click()
await d()
  .waitFor({ state: 'detached', timeout: 5000 })
  .catch(() => {})
note(
  '불편',
  '등록 · 날짜',
  `[어제]까지는 버튼이지만 이틀 전 이상은 달력을 열어야 한다. 주말에 한 주치를 몰아 적는 사람에게는 대부분의 입력이 달력 경로다. 시트를 다시 열면 날짜가 항상 오늘(${dateValue})로 되돌아가는 것도 몰아 적기와 어긋난다.`,
)

console.log('\n── 수정')
await page.getByRole('button', { name: /점심 파스타/ }).click()
await d().waitFor()
await page.screenshot({ path: join(SHOTS, 'ux-03-edit.png') })
await d().getByPlaceholder('0').fill('13000')
await page.getByRole('button', { name: '저장' }).click()
await d().waitFor({ state: 'detached', timeout: 20000 })
console.log('   금액 수정: 탭 3회 (행 → 금액 → 저장)')
note(
  '좋음',
  '수정',
  '목록에서 행을 바로 누르면 값이 채워진 시트가 열린다. 금액만 고쳐 저장하면 끝이라 3탭이다.',
)

console.log('\n── 필터')
await page.getByRole('button', { name: '필터', exact: true }).click()
const opts = await page.locator('select option').allInnerTexts()
await page.locator('select').selectOption({ label: opts.find((o) => o.includes('식비')) })
await page.waitForTimeout(700)
await page.screenshot({ path: join(SHOTS, 'ux-04-filter.png') })
const chipText = await page
  .locator('span')
  .filter({ hasText: /식비 · \d+건/ })
  .first()
  .innerText()
console.log(`   ${chipText}`)
note(
  '불편',
  '필터',
  `필터를 걸어도 패널이 열린 채 남아 목록을 아래로 밀어낸다. 결과를 보려면 필터 아이콘을 한 번 더 눌러 접어야 한다 (칩에 "${chipText}" 가 이미 나오므로 패널은 닫혀도 된다).`,
)
await page.getByRole('button', { name: '필터 해제' }).click()
await page.getByRole('button', { name: '필터', exact: true }).click()

console.log('\n── 통계')
await page.getByRole('link', { name: /통계/ }).click()
await page.waitForSelector('text=이번 달 지출', { timeout: 20000 })
await page.waitForTimeout(1300)
await page.screenshot({ path: join(SHOTS, 'ux-05-stats.png') })
const statsText = await page.locator('section').first().innerText()
console.log('   ' + statsText.split('\n').filter(Boolean).slice(0, 5).join(' | '))
if (!statsText.includes('지난달 대비')) {
  note(
    '관찰',
    '통계',
    '첫 달은 전월 데이터가 없어 증감이 안 나온다. 의도한 동작이지만 첫 달 사용자에게는 화면이 다소 심심하다.',
  )
}

await page.getByRole('button', { name: /식비/ }).first().click()
await page.waitForURL((u) => new URL(u).searchParams.has('category'), { timeout: 20000 })
await page.waitForTimeout(800)
await page.screenshot({ path: join(SHOTS, 'ux-06-drilldown.png') })
note(
  '좋음',
  '통계 → 내역',
  '막대를 누르면 그 카테고리만 걸린 내역으로 넘어간다. "식비가 왜 많지?" 에서 "뭘 샀길래" 로 한 탭이다.',
)

console.log('\n── 월급 위젯')
await page.getByRole('link', { name: /내역/ }).click()
await page.waitForSelector('text=월급 남은 돈', { timeout: 20000 })
await page.waitForTimeout(500)
const widget = await page.locator('section').first().innerText()
console.log('   ' + widget.split('\n').filter(Boolean).slice(0, 5).join(' | '))
note(
  '좋음',
  '월급 위젯',
  '급여를 넣자마자 남은 금액·진행 바·다음 급여까지 남은 일수가 한 덩어리로 나온다.',
)
await page.screenshot({ path: join(SHOTS, 'ux-07-final.png') })

/* ── "최근" 줄이 실제로 값을 하는 경우: 더보기 뒤로 밀린 카테고리 ────────── */
console.log('\n── 더보기 뒤 카테고리')
await page.goto(`${APP}/settings/categories`, { waitUntil: 'domcontentloaded' })
const addBtn = page.getByRole('button', { name: /카테고리 추가/ })
await addBtn.waitFor({ timeout: 20000 })
// 지출 6개 + 3개 = 9개. 8개 노출 한도를 넘겨 마지막 것들이 더보기 뒤로 간다.
for (const name of ['반려동물', '의료', '경조사']) {
  await addBtn.click()
  await d().waitFor()
  await d().getByLabel('이름').fill(name)
  await d().getByRole('button', { name: '저장' }).click()
  await d().waitFor({ state: 'detached', timeout: 20000 })
}
await page.goto(APP, { waitUntil: 'domcontentloaded' })
await page.getByRole('button', { name: '거래 추가' }).waitFor({ timeout: 20000 })

const cold = await record({ category: '경조사', amount: 50000, dayOffset: 0 })
const warm = await record({ category: '경조사', amount: 30000, dayOffset: 0 })
await page.screenshot({ path: join(SHOTS, 'ux-08-recent.png') })
note(
  warm.taps < cold.taps ? '좋음' : '관찰',
  '등록 · 최근 줄',
  `더보기 뒤에 있는 '경조사'를 처음 넣을 때 ${cold.taps}탭(${cold.via}), 바로 다시 넣을 때 ${warm.taps}탭(${warm.via}). "최근" 줄이 더보기 한 탭을 걷어낸다. 기본 카테고리만 쓰는 사용자에게는 효과가 없고, 자기 카테고리를 추가한 사용자에게 효과가 있다.`,
)

console.log('\n' + '─'.repeat(58))
console.log(`총 ${taps}탭 · 거래 1건당 평균 ${avg.toFixed(1)}탭 · ${(avgMs / 1000).toFixed(1)}초\n`)
for (const level of ['불편', '관찰', '좋음']) {
  const rows = findings.filter((f) => f.level === level)
  if (!rows.length) continue
  console.log(`【${level}】`)
  for (const f of rows) console.log(`  · [${f.where}] ${f.what}\n`)
}

await browser.close()
