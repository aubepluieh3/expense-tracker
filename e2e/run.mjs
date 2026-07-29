import { mkdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import { chromium } from 'playwright'
import { APP, EMAIL, PASSWORD as PW, SECOND, SHOTS } from './config.mjs'
import { reset } from './reset.mjs'

/**
 * 통합 검증 — 첫 사용자부터 전 기능을 훑는다.
 *
 *   npm run test:e2e        3회 (기본)
 *   npm run test:e2e -- 1   1회
 *
 * 개발 서버가 5173 에 떠 있어야 한다. 라운드마다 계정을 초기화하므로
 * 같은 계정에 다른 테스트를 동시에 돌리면 서로를 망친다.
 *
 * 실패하면 그 순간의 화면을 e2e/shots/ 에 남긴다 — 추측하지 않고 보고
 * 판단하기 위해서다. 지금까지 앱 버그 6건과 테스트 결함 4건을 이 방식으로 잡았다.
 */
const ROUNDS = Number(process.argv[2] ?? 3)

mkdirSync(SHOTS, { recursive: true })

/* ────────────────────────────────────────────────────────────── 검증 하네스 */
let round = 0
const results = []
let consoleErrors = []

/** 실패한 검증의 화면을 남긴다. 추측하지 않고 보고 판단하기 위해. */
let currentPage = null
let shotSeq = 0

/**
 * 오늘 날짜 때문에 성립하지 않는 검증을 "건너뜀"으로 남긴다.
 *
 * 통과로 위장하면 조용히 커버리지가 사라지고, 실패로 두면 버그가 아닌데
 * 빨간불이 뜬다 — 예정 배지 검증은 오늘이 말일이면 이 달 안에 미래 날짜가
 * 없어서 매달 한 번 실패했다. 셋째 상태가 필요하다.
 */
const SKIP = Symbol('skip')
function skip(why) {
  const e = new Error(why)
  e[SKIP] = true
  throw e
}

async function check(area, name, fn) {
  const t0 = Date.now()
  try {
    await fn()
    results.push({ round, area, name, ok: true, ms: Date.now() - t0 })
  } catch (e) {
    if (e?.[SKIP]) {
      results.push({ round, area, name, ok: true, skipped: true, why: e.message, ms: Date.now() - t0 })
      return
    }
    let shot = null
    if (currentPage && !currentPage.isClosed()) {
      shot = join(SHOTS, `fail-R${round}-${String(++shotSeq).padStart(2, '0')}.png`)
      try {
        await currentPage.screenshot({ path: shot })
        const dialogOpen = await currentPage.getByRole('dialog').count()
        const url = new URL(currentPage.url()).pathname + new URL(currentPage.url()).search
        results.push({
          round,
          area,
          name,
          ok: false,
          ms: Date.now() - t0,
          err: `${String(e.message ?? e).split('\n')[0].slice(0, 110)}  [dialog=${dialogOpen} url=${url}] → ${relative(process.cwd(), shot)}`,
        })
        return
      } catch {
        /* 스크린샷 실패는 무시 */
      }
    }
    results.push({
      round,
      area,
      name,
      ok: false,
      ms: Date.now() - t0,
      err: String(e.message ?? e).split('\n')[0].slice(0, 150),
    })
  }
}

const expect = (cond, msg) => {
  if (!cond) throw new Error(msg)
}

/**
 * 조건이 참이 될 때까지 폴링한다.
 *
 * Playwright 의 자동 대기는 locator 에만 붙는다. "제어 입력이 React 커밋 뒤에
 * 반영되는지" 처럼 값을 읽어 비교하는 단정에는 안 걸려서, 클릭 직후 바로 읽으면
 * 한 프레임 차이로 실패한다 — 실제로 급여 체크박스에서 3/3 으로 그랬다.
 */
async function waitUntil(fn, msg, timeout = 5000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    if (await fn()) return
    await new Promise((s) => setTimeout(s, 50))
  }
  throw new Error(`${msg} (${timeout}ms 대기)`)
}

/* ─────────────────────────────────────────────────────────────────── 실행 */
const browser = await chromium.launch()

for (round = 1; round <= ROUNDS; round++) {
  await reset({ quiet: true })
  consoleErrors = []

  const page = await browser.newPage({ viewport: { width: 420, height: 900 } })
  page.on('console', (m) => {
    // 400/401 = 의도한 잘못된 로그인, 409 = 의도한 중복 이름(UNIQUE 위반)
    if (m.type() === 'error' && !/ERR_ABORTED|40[019] \(\)/.test(m.text()))
      consoleErrors.push(m.text())
  })
  page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e}`))

  // Playwright 는 리스너가 없으면 confirm 을 자동 처리한다.
  // 페이지 생성 시점에 등록해 두고 호출 횟수만 센다.
  let confirmCount = 0
  page.on('dialog', async (d) => {
    confirmCount += 1
    await d.dismiss()
  })

  currentPage = page
  const dlg = () => page.getByRole('dialog')

  /**
   * 카테고리 칩은 "최근" 줄과 그리드에 같은 이름으로 동시에 나올 수 있다.
   * 이름만으로 잡으면 strict mode 위반이라 그리드 쪽으로 좁힌다.
   * exact:true 가 필요하다 — 기본 부분일치면 '최근 사용한 카테고리' 도 걸린다.
   */
  const grid = () => dlg().getByRole('group', { name: '카테고리', exact: true })
  const recentRow = () => dlg().getByRole('group', { name: '최근 사용한 카테고리', exact: true })
  const chip = (name) => grid().getByRole('button', { name })

  /**
   * 로컬 날짜로 포맷한다. toISOString() 은 UTC 기준이라 KST 00~09시에 하루 밀린다 —
   * 앱이 클라이언트 로컬 날짜를 쓰는데 테스트가 UTC 를 쓰면 그 시간대에만 깨진다.
   */
  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  /* ── 1. 비로그인 · 인증 ────────────────────────────────────────────── */
  await check('인증', '보호된 경로 접근 → /login 으로 튕김', async () => {
    await page.goto(`${APP}/stats`, { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/\/login/, { timeout: 20000 })
  })

  await check('인증', '비밀번호 표시 토글', async () => {
    const pw = page.getByLabel('비밀번호')
    await pw.fill('abc')
    expect((await pw.getAttribute('type')) === 'password', '초기 type 이 password 가 아님')
    await page.getByRole('button', { name: '표시' }).click()
    expect((await pw.getAttribute('type')) === 'text', '토글 후 type 이 text 가 아님')
    await page.getByRole('button', { name: '숨기기' }).click()
    expect((await pw.getAttribute('type')) === 'password', '되돌리기 실패')
  })

  await check('인증', '잘못된 비밀번호 → 통일된 에러 메시지', async () => {
    await page.getByLabel('이메일').fill('nobody@example.com')
    await page.getByLabel('비밀번호').fill('wrongpassword')
    await page.getByRole('button', { name: '로그인' }).click()
    await page.getByText('이메일 또는 비밀번호가 올바르지 않습니다').waitFor({ timeout: 20000 })
  })

  await check('인증', '/forgot-password → 계정 존재 여부 노출 안 함', async () => {
    await page.getByRole('link', { name: '비밀번호를 잊으셨나요?' }).click()
    await page.getByText('가입할 때 쓴 이메일로').waitFor({ timeout: 15000 })
    await page.getByLabel('이메일').fill('nobody@example.com')
    await page.getByRole('button', { name: '재설정 메일 받기' }).click()
    await page.getByText('해당 계정이 있다면').waitFor({ timeout: 20000 })
  })

  await check('인증', '/reset-password 세션 없이 접근 → 안내', async () => {
    await page.goto(`${APP}/reset-password`, { waitUntil: 'domcontentloaded' })
    await page.getByText('링크가 유효하지 않습니다').waitFor({ timeout: 20000 })
  })

  await check('인증', '이미 가입한 이메일로 재가입 → 계정 열거 방지 안내', async () => {
    await page.goto(`${APP}/signup`, { waitUntil: 'domcontentloaded' })
    await page.getByLabel('이메일').fill(EMAIL)
    await page.getByLabel('비밀번호').fill(PW)
    await page.getByLabel('닉네임').fill('SOO')
    await page.getByRole('button', { name: '가입하기' }).click()
    await page.getByText('메일을 확인해 주세요').waitFor({ timeout: 25000 })
    await page.getByText('이미 가입한 이메일이라면').waitFor({ timeout: 5000 })
    await page.getByRole('link', { name: '로그인하러 가기 →' }).waitFor({ timeout: 5000 })
  })

  await check('인증', '가입 검증 — 8자 미만 비밀번호 거부', async () => {
    await page.goto(`${APP}/signup`, { waitUntil: 'domcontentloaded' })
    await page.getByLabel('이메일').fill('x@example.com')
    await page.getByLabel('비밀번호').fill('short')
    await page.getByLabel('닉네임').fill('테스터')
    await page.getByRole('button', { name: '가입하기' }).click()
    await page.getByText('비밀번호는 8자 이상').waitFor({ timeout: 10000 })
  })

  await check('인증', '로그인 성공 → 홈 도달', async () => {
    await page.goto(`${APP}/login`, { waitUntil: 'domcontentloaded' })
    await page.getByLabel('이메일').fill(EMAIL)
    await page.getByLabel('비밀번호').fill(PW)
    await page.getByRole('button', { name: '로그인' }).click()
    await page.getByRole('button', { name: '거래 추가' }).waitFor({ timeout: 30000 })
  })

  await check('인증', '로그인 상태로 /login 접근 → 홈으로', async () => {
    await page.goto(`${APP}/login`, { waitUntil: 'domcontentloaded' })
    await page.waitForURL((u) => new URL(u).pathname === '/', { timeout: 20000 })
  })

  /* ── 2. 첫 사용자 빈 상태 ─────────────────────────────────────────── */
  await check('빈 상태', '내역 — "아직 기록이 없어요"', async () => {
    await page.getByText('아직 기록이 없어요').waitFor({ timeout: 20000 })
  })

  await check('빈 상태', '월급 위젯 — 급여 카테고리는 이미 지정돼 있으니 거래 등록으로 보낸다', async () => {
    await page.getByText('급여를 등록하면 남은 금액을 보여드려요').waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: '급여 거래 등록하기' }).waitFor({ timeout: 5000 })
    // 카테고리 관리로 보내면 이미 지정된 걸 보고 돌아 나와야 한다
    expect(
      (await page.getByRole('link', { name: /급여 카테고리/ }).count()) === 0,
      '급여 카테고리가 지정돼 있는데 카테고리 관리로 보낸다',
    )
  })

  await check('빈 상태', '위젯의 "급여 거래 등록하기" 가 시트를 연다', async () => {
    await page.getByRole('button', { name: '급여 거래 등록하기' }).click()
    await dlg().waitFor({ timeout: 15000 })
    await dlg().getByRole('button', { name: '닫기' }).click()
    await dlg().waitFor({ state: 'detached', timeout: 10000 })
  })

  await check('빈 상태', '통계 — "이번 달 지출 내역이 없습니다"', async () => {
    await page.getByRole('link', { name: /통계/ }).click()
    await page.getByText('이번 달 지출 내역이 없습니다').waitFor({ timeout: 20000 })
  })

  await check('빈 상태', '통계 — 전월 데이터 없으면 증감 표시 생략', async () => {
    const txt = await page.locator('section').first().innerText()
    expect(!txt.includes('지난달 대비'), '전월 지출 0인데 증감이 표시됨')
  })

  await check('빈 상태', '"기록 시작하기" 버튼이 등록 시트를 연다', async () => {
    await page.getByRole('link', { name: /내역/ }).click()
    await page.getByRole('button', { name: '기록 시작하기' }).click()
    await dlg().waitFor({ timeout: 15000 })
    expect(new URL(page.url()).searchParams.get('new') === '1', 'URL 에 new=1 이 없음')
  })

  /* ── 3. 등록 시트 ─────────────────────────────────────────────────── */
  await check('등록', '빈 시트 닫기 — 확인창 없음', async () => {
    const before = confirmCount
    await dlg().getByRole('button', { name: '닫기' }).click()
    await dlg().waitFor({ state: 'detached', timeout: 10000 })
    expect(confirmCount === before, '네이티브 확인창이 떴다')
  })

  await check('등록', 'FAB → 지출 기본 선택 · 칩 8개 + 더보기', async () => {
    await page.getByRole('button', { name: '거래 추가' }).click()
    await dlg().waitFor({ timeout: 15000 })
    const chips = grid().locator('button[aria-pressed]')
    expect((await chips.count()) === 6, `지출 카테고리 6개여야 하는데 ${await chips.count()}개`)
    await chip(/^식비/).click()
    expect(
      (await chip(/^식비/).getAttribute('aria-pressed')) === 'true',
      '칩 선택이 안 됨',
    )
  })

  await check('등록', '거래 0건 — "최근" 줄이 없다', async () => {
    expect((await recentRow().count()) === 0, '거래가 하나도 없는데 최근 줄이 나왔다')
  })

  await check('등록', '수입 전환 → 카테고리 선택 초기화', async () => {
    await dlg().getByRole('radio', { name: '수입', exact: true }).click()
    const pressed = await grid().locator('button[aria-pressed="true"]').count()
    expect(pressed === 0, '타입을 바꿨는데 선택이 남아 있음')
    await dlg().getByRole('radio', { name: '지출', exact: true }).click()
  })

  await check('등록', '카테고리 없이 저장 → 검증 메시지', async () => {
    await dlg().getByPlaceholder('0').fill('10000')
    await page.getByRole('button', { name: '저장' }).click()
    await page.getByText('카테고리를 선택해 주세요').waitFor({ timeout: 10000 })
  })

  await check('등록', '금액 없이 저장 → 검증 메시지', async () => {
    await chip(/^식비/).click()
    await dlg().getByPlaceholder('0').fill('')
    await page.getByRole('button', { name: '저장' }).click()
    await page.getByText('금액을 입력해 주세요').waitFor({ timeout: 10000 })
  })

  /**
   * transactions.amount 는 integer(int4) 라서 상한이 2,147,483,647 이다.
   * 입력을 10자리까지 허용하면 그 위를 칠 수 있고, 클라이언트 검증(> 0)은
   * 통과한 뒤 INSERT 가 22003 으로 터진다 —
   * `value "3000000000" is out of range for type integer` 가 그대로 화면에 떴다.
   * 9자리로 끊어 애초에 입력 불가능하게 만든 것을 지킨다.
   */
  await check('등록', '금액은 9자리까지 — int4 상한을 넘길 수 없다', async () => {
    await dlg().getByPlaceholder('0').fill('99999999999999')
    const v = (await dlg().getByPlaceholder('0').inputValue()).replace(/,/g, '')
    expect(v.length === 9, `9자리여야 하는데 ${v.length}자리(${v})`)
    expect(Number(v) < 2_147_483_647, `int4 상한을 넘는다: ${v}`)
  })

  await check('등록', '천단위 콤마 · 어제 버튼 · 메모', async () => {
    await dlg().getByPlaceholder('0').fill('12000')
    expect(
      (await dlg().getByPlaceholder('0').inputValue()) === '12,000',
      '천단위 콤마가 안 붙음',
    )
    await dlg().getByRole('button', { name: '어제' }).click()
    await dlg().getByPlaceholder('선택').fill('점심 김밥천국')
  })

  await check('등록', '입력 후 닫기 → 시트 안 확인 (네이티브 아님)', async () => {
    const before = confirmCount
    await dlg().getByRole('button', { name: '닫기' }).click()
    await dlg().getByText('작성 중인 내용을 버릴까요?').waitFor({ timeout: 10000 })
    expect(confirmCount === before, '브라우저 기본 다이얼로그가 떴다')
    await dlg().getByRole('button', { name: '계속 작성' }).click()
    expect((await dlg().getByPlaceholder('0').inputValue()) === '12,000', '입력값이 사라졌다')
  })

  await check('등록', '저장 → 목록 반영 + URL 정리', async () => {
    await page.getByRole('button', { name: '저장' }).click()
    await dlg().waitFor({ state: 'detached', timeout: 20000 })
    await page.getByText('점심 김밥천국').waitFor({ timeout: 15000 })
    expect(!new URL(page.url()).searchParams.has('new'), 'URL 에 new 가 남음')
  })

  /** 이 기능의 핵심 계약: 최근 줄은 바뀌고 그리드는 안 바뀐다. */
  const DEFAULT_EXPENSE_ORDER = '식비,카페·간식,교통,주거·통신,생활용품,문화·여가'
  const chipNames = (scope) =>
    scope
      .locator('button[aria-pressed]')
      .allInnerTexts()
      .then((rows) => rows.map((t) => t.split('\n').pop().trim()))

  await check('등록', '"최근" 줄에 방금 쓴 카테고리가 맨 앞', async () => {
    await page.getByRole('button', { name: '거래 추가' }).click()
    await dlg().waitFor({ timeout: 15000 })
    await recentRow().waitFor({ timeout: 15000 })
    const recent = await chipNames(recentRow())
    expect(recent[0] === '식비', `최근 첫 칸이 식비가 아님: ${recent.join(',')}`)
  })

  await check('등록', '최근 사용과 무관하게 그리드 순서는 생성순 고정', async () => {
    const order = await chipNames(grid())
    expect(
      order.join(',') === DEFAULT_EXPENSE_ORDER,
      `그리드가 재정렬됐다: ${order.join(',')}`,
    )
  })

  /* 날짜 물려받기 — 직전 거래를 [어제]로 저장했으므로 어제가 남아 있어야 한다 */
  const dateInput = () => dlg().locator('input[type="date"]')

  await check('등록', '직전에 저장한 날짜를 물려받는다', async () => {
    const yesterday = iso(new Date(Date.now() - 86_400_000))
    expect(
      (await dateInput().inputValue()) === yesterday,
      `날짜가 오늘로 되돌아갔다: ${await dateInput().inputValue()} (기대 ${yesterday})`,
    )
  })

  await check('등록', '오늘이 아니면 경고 줄 + 링 표시', async () => {
    await dlg().getByText('어제 날짜로 저장됩니다').waitFor({ timeout: 10000 })
    expect(
      (await dateInput().getAttribute('class'))?.includes('ring-2'),
      '날짜 필드에 링이 없다',
    )
  })

  await check('등록', '물려받은 날짜만으로는 dirty 가 아니다 (확인창 없이 닫힘)', async () => {
    const before = confirmCount
    await dlg().getByRole('button', { name: '닫기' }).click()
    await dlg().waitFor({ state: 'detached', timeout: 10000 })
    expect(confirmCount === before, '네이티브 확인창이 떴다')
  })

  await check('등록', '[오늘] 누르면 경고 줄이 사라진다', async () => {
    await page.getByRole('button', { name: '거래 추가' }).click()
    await dlg().waitFor({ timeout: 15000 })
    await dlg().getByRole('button', { name: '오늘' }).click()
    await page.waitForTimeout(200)
    expect(
      (await dlg().getByText(/날짜로 저장됩니다/).count()) === 0,
      '오늘로 되돌렸는데 경고 줄이 남아 있다',
    )
    // 물려받은 날짜를 바꿨으니 이제는 dirty 다 — 확인을 받고 버린다
    await dlg().getByRole('button', { name: '닫기' }).click()
    await dlg().getByRole('button', { name: '버리기' }).click()
    await dlg().waitFor({ state: 'detached', timeout: 10000 })
  })

  /* ── 4. 수정 · 삭제 ───────────────────────────────────────────────── */
  await check('수정', '거래 탭 → 수정 시트 (값이 채워짐)', async () => {
    await page.getByRole('button', { name: /점심 김밥천국/ }).click()
    await dlg().waitFor({ timeout: 15000 })
    expect((await dlg().getByPlaceholder('0').inputValue()) === '12,000', '금액이 안 채워짐')
    expect(
      (await dlg().getByPlaceholder('선택').inputValue()) === '점심 김밥천국',
      '메모가 안 채워짐',
    )
  })

  await check('수정', '금액 변경 → 저장 → 목록 갱신', async () => {
    await dlg().getByPlaceholder('0').fill('13500')
    await page.getByRole('button', { name: '저장' }).click()
    await dlg().waitFor({ state: 'detached', timeout: 20000 })
    await page.getByText('−13,500').first().waitFor({ timeout: 15000 })
  })

  await check('삭제', '인라인 확인 → 취소', async () => {
    await page.getByRole('button', { name: /점심 김밥천국/ }).click()
    await dlg().waitFor({ timeout: 15000 })
    await dlg().getByRole('button', { name: '거래 삭제' }).click()
    await dlg().getByText('이 거래를 삭제할까요?').waitFor({ timeout: 10000 })
    await dlg().getByRole('button', { name: '취소' }).click()
    await dlg().getByRole('button', { name: '거래 삭제' }).waitFor({ timeout: 10000 })
  })

  await check('삭제', '삭제 실행 → 목록에서 사라짐', async () => {
    await dlg().getByRole('button', { name: '거래 삭제' }).click()
    await dlg().getByRole('button', { name: '삭제' }).click()
    await dlg().waitFor({ state: 'detached', timeout: 20000 })
    await page.getByText('아직 기록이 없어요').waitFor({ timeout: 15000 })
  })

  /* ── 5. 월 이동 ───────────────────────────────────────────────────── */
  await check('월 이동', '빈 지난달 — 첫 사용자 문구가 아니라 그 달 이름을 쓴다', async () => {
    await page.getByRole('button', { name: '이전 달' }).click()
    await page.waitForTimeout(700)
    const label = await page.getByRole('button', { name: /\d{4}년 \d+월/ }).innerText()
    await page.getByText(`${label}에는 기록이 없어요`).waitFor({ timeout: 15000 })
    // 여긴 첫 지출이 아니다 — 이 사용자는 이번 달에 이미 넣어 봤다
    expect(
      (await page.getByText('첫 지출을 기록해 볼까요?').count()) === 0,
      '지난달인데 첫 사용자 문구가 뜬다',
    )
    await page.getByRole('button', { name: '다음 달' }).click()
    await page.waitForTimeout(600)
  })

  await check('월 이동', '‹ › 버튼', async () => {
    const label = page.getByRole('button', { name: /\d{4}년 \d+월/ })
    const before = await label.innerText()
    await page.getByRole('button', { name: '이전 달' }).click()
    await page.waitForTimeout(400)
    expect((await label.innerText()) !== before, '이전 달로 안 감')
    await page.getByRole('button', { name: '다음 달' }).click()
    await page.waitForTimeout(400)
    expect((await label.innerText()) === before, '다음 달로 안 돌아옴')
  })

  await check('월 이동', '라벨 탭 → 월 선택 시트 → 연도 이동 → 월 선택', async () => {
    await page.getByRole('button', { name: /\d{4}년 \d+월/ }).click()
    await dlg().waitFor({ timeout: 15000 })
    await dlg().getByRole('button', { name: '이전 해' }).click()
    await dlg().getByRole('button', { name: '3월' }).click()
    await dlg().waitFor({ state: 'detached', timeout: 10000 })
    expect(new URL(page.url()).searchParams.get('month')?.endsWith('-03'), 'month 파라미터가 3월이 아님')
  })

  await check('월 이동', '뒤로가기로 이전 달 복귀', async () => {
    await page.goBack()
    await page.waitForTimeout(600)
    const m = new URL(page.url()).searchParams.get('month')
    expect(!m || !m.endsWith('-03'), '뒤로가기가 월 이동을 되돌리지 못함')
  })

  /**
   * 지난달을 보는 중에 저장하면 날짜 기본값은 오늘(이번 달)이다. 저장한 달로
   * 옮기지 않으면 목록이 그대로 비어 있어 저장이 실패한 것처럼 보인다 —
   * 실제로 "아직 기록이 없어요"가 떠 있었다.
   */
  await check('월 이동', '다른 달로 저장 → 그 달로 이동하고 거래가 보인다', async () => {
    await page.goto(`${APP}/`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: '이전 달' }).waitFor({ timeout: 20000 })
    await page.getByRole('button', { name: '이전 달' }).click()
    await page.waitForTimeout(600)
    const viewed = new URL(page.url()).searchParams.get('month')

    await page.getByRole('button', { name: /거래 추가|기록 시작하기/ }).first().click()
    await dlg().waitFor({ timeout: 15000 })
    const sheetDate = await dlg().locator('input[type="date"]').inputValue()
    expect(!sheetDate.startsWith(viewed), `이 검증은 시트 날짜가 다른 달일 때만 성립: ${sheetDate}`)
    await chip(/^교통/).click()
    await dlg().getByPlaceholder('0').fill('1234')
    await dlg().getByPlaceholder('선택').fill('다른달 저장')
    await page.getByRole('button', { name: '저장' }).click()
    await dlg().waitFor({ state: 'detached', timeout: 20000 })

    await page.getByText('다른달 저장').waitFor({ timeout: 15000 })
    expect(
      new URL(page.url()).searchParams.get('month') === sheetDate.slice(0, 7),
      `저장한 달로 안 옮겨졌다: url=${new URL(page.url()).searchParams.get('month')} 저장=${sheetDate.slice(0, 7)}`,
    )

    // 뒷 검증에 영향 없게 지운다
    await page.getByRole('button', { name: /다른달 저장/ }).click()
    await dlg().waitFor({ timeout: 15000 })
    await dlg().getByRole('button', { name: '거래 삭제' }).click()
    await dlg().getByRole('button', { name: '삭제' }).click()
    await dlg().waitFor({ state: 'detached', timeout: 20000 })
  })

  /* ── 6. 데이터 넣고 위젯 · 필터 · 통계 ────────────────────────────── */
  const today = new Date()
  const thisMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  await check('위젯', '급여 등록 → 월급 위젯 표시', async () => {
    await page.goto(`${APP}/?month=${thisMonth}&new=1`, { waitUntil: 'domcontentloaded' })
    await dlg().waitFor({ timeout: 20000 })
    await dlg().getByRole('radio', { name: '수입', exact: true }).click()
    await chip(/^급여/).click()
    await dlg().getByPlaceholder('0').fill('3000000')
    await dlg().getByRole('button', { name: '오늘' }).click()
    await page.getByRole('button', { name: '저장' }).click()
    await dlg().waitFor({ state: 'detached', timeout: 20000 })
    await page.getByText('월급 남은 돈').waitFor({ timeout: 15000 })
    await page.getByText(/3,000,000원 중 100%/).waitFor({ timeout: 15000 })
  })

  await check('위젯', '지출 추가 → 남은 돈 감소', async () => {
    await page.getByRole('button', { name: '거래 추가' }).click()
    await dlg().waitFor({ timeout: 15000 })
    await chip(/^식비/).click()
    await dlg().getByPlaceholder('0').fill('500000')
    await page.getByRole('button', { name: '저장' }).click()
    await dlg().waitFor({ state: 'detached', timeout: 20000 })
    await page.getByText('2,500,000').first().waitFor({ timeout: 15000 })
  })

  /**
   * "이 달 안의 미래 날짜". +3일을 그대로 쓰면 월말에 다음 달로 넘어가고,
   * 그러면 이 달 목록·위젯에 안 나타나 검증 자체가 성립하지 않는다
   * (7/29 에 +3 = 8/1 로 실제로 이 검증이 3회 모두 깨졌다).
   */
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const futureInMonth = new Date(today)
  futureInMonth.setDate(Math.min(today.getDate() + 3, lastDay.getDate()))
  const hasFutureDay = iso(futureInMonth) !== iso(today)

  await check('위젯', '미래 지출 → 예정 배지 + 위젯의 예정 표시', async () => {
    if (!hasFutureDay) skip('오늘이 이 달 마지막 날 — 이 달 안에 미래 날짜가 없다')
    const future = futureInMonth
    await page.getByRole('button', { name: '거래 추가' }).click()
    await dlg().waitFor({ timeout: 15000 })
    await chip(/^카페·간식/).click()
    await dlg().getByPlaceholder('0').fill('8000')
    await dlg().locator('input[type="date"]').fill(iso(future))
    await page.getByRole('button', { name: '저장' }).click()
    await dlg().waitFor({ state: 'detached', timeout: 20000 })
    await page.getByText('예정', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByText(/예정 8,000/).waitFor({ timeout: 10000 })
  })

  await check('필터', '필터 열기 → 지출만 → 칩 표시 · 패널 자동 접힘', async () => {
    await page.getByRole('button', { name: '필터', exact: true }).click()
    await page.getByRole('button', { name: '지출', exact: true }).click()
    await page.waitForTimeout(500)
    expect(new URL(page.url()).searchParams.get('type') === 'expense', 'type 파라미터 없음')
    await page.getByText(/지출 · \d+건/).waitFor({ timeout: 10000 })
    // 적용 후에도 패널이 남으면 목록이 아래로 밀려 결과를 보려고 한 번 더 눌러야 한다
    expect((await page.locator('select').count()) === 0, '적용 후에도 필터 패널이 열려 있다')
  })

  await check('필터', '카테고리 선택 → 그 달 거래가 있는 카테고리만 목록에', async () => {
    await page.getByRole('button', { name: '필터', exact: true }).click() // 접혔으니 다시 펼친다
    const opts = await page.locator('select option').allInnerTexts()
    expect(opts.length === 4, `옵션이 4개(전체+3)여야 하는데 ${opts.length}개: ${opts.join('/')}`)
    await page.locator('select').selectOption({ index: 1 })
    await page.waitForTimeout(500)
    expect(new URL(page.url()).searchParams.has('category'), 'category 파라미터 없음')
  })

  await check('필터', '요약 카드는 필터에 반응하지 않음', async () => {
    const txt = await page.locator('section').first().innerText()
    expect(txt.includes('3,000,000'), '필터를 걸었는데 월급 위젯 기준액이 바뀜')
  })

  await check('필터', '칩 ✕ → 필터 해제', async () => {
    await page.getByRole('button', { name: '필터 해제' }).click()
    await page.waitForTimeout(500)
    const u = new URL(page.url())
    expect(!u.searchParams.has('type') && !u.searchParams.has('category'), '필터가 안 풀림')
  })

  await check('통계', '스택 바 + 막대 + 누적', async () => {
    await page.getByRole('link', { name: /통계/ }).click()
    await page.getByText('이번 달 지출').waitFor({ timeout: 20000 })
    await page.getByText('앱 사용 이후 누적').waitFor({ timeout: 15000 })
    await page.getByText('+2,492,000').waitFor({ timeout: 15000 })
  })

  await check('통계', '막대 탭 → 필터된 내역으로 드릴다운', async () => {
    await page.getByRole('button', { name: /식비/ }).first().click()
    await page.waitForURL((u) => new URL(u).searchParams.has('category'), { timeout: 20000 })
    await page.getByText(/식비 · 1건/).waitFor({ timeout: 15000 })
  })

  /* ── 7. 카테고리 관리 ─────────────────────────────────────────────── */
  await check('카테고리', '설정 → 카테고리 관리 진입', async () => {
    await page.getByRole('link', { name: /설정/ }).click()
    await page.getByRole('link', { name: '카테고리 관리' }).click()
    await page.getByRole('button', { name: '＋ 카테고리 추가' }).waitFor({ timeout: 20000 })
  })

  await check('카테고리', '지출/수입 탭 전환', async () => {
    await page.getByRole('radio', { name: '수입', exact: true }).click()
    await page.getByText('급여').waitFor({ timeout: 10000 })
    await page.getByText('월급 기준').waitFor({ timeout: 10000 })
    await page.getByRole('radio', { name: '지출', exact: true }).click()
    await page.getByText('식비').waitFor({ timeout: 10000 })
  })

  await check('카테고리', '추가 — 이모지 그룹에서 하트 선택', async () => {
    await page.getByRole('button', { name: '＋ 카테고리 추가' }).click()
    await dlg().waitFor({ timeout: 15000 })
    await dlg().getByLabel('이름').fill('데이트')
    await dlg().getByRole('button', { name: '❤️' }).click()
    expect(
      (await dlg().getByLabel('이모지 직접 입력').inputValue()) === '❤️',
      '이모지 선택이 입력칸에 반영 안 됨',
    )
    await dlg().getByRole('button', { name: '저장' }).click()
    await dlg().waitFor({ state: 'detached', timeout: 20000 })
    await page.getByText('데이트').waitFor({ timeout: 15000 })
  })

  await check('카테고리', '이름 검증 — 빈 이름 거부', async () => {
    await page.getByRole('button', { name: '＋ 카테고리 추가' }).click()
    await dlg().waitFor({ timeout: 15000 })
    await dlg().getByLabel('이름').fill('   ')
    await dlg().getByRole('button', { name: '저장' }).click()
    await dlg().getByText('이름은 1~20자').waitFor({ timeout: 10000 })
    await dlg().getByRole('button', { name: '닫기' }).click()
    await dlg().waitFor({ state: 'detached', timeout: 10000 })
  })

  await check('카테고리', '중복 이름 → "이미 있는 이름입니다"', async () => {
    await page.getByRole('button', { name: '＋ 카테고리 추가' }).click()
    await dlg().waitFor({ timeout: 15000 })
    await dlg().getByLabel('이름').fill('식비')
    await dlg().getByRole('button', { name: '저장' }).click()
    await dlg().getByText('이미 있는 이름입니다').waitFor({ timeout: 15000 })
    await dlg().getByRole('button', { name: '닫기' }).click()
    await dlg().waitFor({ state: 'detached', timeout: 10000 })
  })

  await check('카테고리', '이름 정규화 — 연속 공백 압축', async () => {
    await page.getByRole('button', { name: '＋ 카테고리 추가' }).click()
    await dlg().waitFor({ timeout: 15000 })
    await dlg().getByLabel('이름').fill('  헬스   장  ')
    await dlg().getByRole('button', { name: '저장' }).click()
    await dlg().waitFor({ state: 'detached', timeout: 20000 })
    await page.getByText('헬스 장', { exact: true }).waitFor({ timeout: 15000 })
  })

  await check('카테고리', '수정 — 이름 변경', async () => {
    const row = page.locator('li', { hasText: '헬스 장' }).first()
    await row.getByRole('button', { name: '수정' }).click()
    await dlg().waitFor({ timeout: 15000 })
    await dlg().getByLabel('이름').fill('헬스장')
    await dlg().getByRole('button', { name: '저장' }).click()
    await dlg().waitFor({ state: 'detached', timeout: 20000 })
    await page.getByText('헬스장', { exact: true }).waitFor({ timeout: 15000 })
  })

  await check('카테고리', '거래 0건 삭제 → 스낵바 실행 취소', async () => {
    const row = page.locator('li', { hasText: '헬스장' }).first()
    await row.getByRole('button', { name: '삭제' }).click()
    await dlg().getByRole('button', { name: '삭제' }).click()
    await page.getByText(/'헬스장'을\(를\) 삭제했습니다/).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: '실행 취소' }).click()
    await page.getByText('헬스장', { exact: true }).waitFor({ timeout: 15000 })
  })

  await check('카테고리', '삭제 후 같은 이름 → 되살리기 제안', async () => {
    const row = page.locator('li', { hasText: '헬스장' }).first()
    await row.getByRole('button', { name: '삭제' }).click()
    await dlg().getByRole('button', { name: '삭제' }).click()
    await page.waitForTimeout(1200)
    await page.getByRole('button', { name: '＋ 카테고리 추가' }).click()
    await dlg().waitFor({ timeout: 15000 })
    await dlg().getByLabel('이름').fill('헬스장')
    await dlg().getByRole('button', { name: '저장' }).click()
    await dlg().getByText('예전에 삭제한').waitFor({ timeout: 20000 })
    await dlg().getByText('연결된 거래는 없습니다').waitFor({ timeout: 5000 })
    await dlg().getByRole('button', { name: '되살리기' }).click()
    await dlg().waitFor({ state: 'detached', timeout: 20000 })
    await page.getByText('헬스장', { exact: true }).waitFor({ timeout: 15000 })
  })

  await check('카테고리', '거래 있는 카테고리 삭제 → 건수 안내', async () => {
    const row = page.locator('li', { hasText: '식비' }).first()
    await row.getByRole('button', { name: '삭제' }).click()
    await dlg().getByText(/기록된 거래 1건과 과거 통계는 그대로 유지됩니다/).waitFor({ timeout: 15000 })
    await dlg().getByRole('button', { name: '취소' }).click()
    await dlg().waitFor({ state: 'detached', timeout: 10000 })
  })

  await check('카테고리', '급여 카테고리 지정 이동', async () => {
    await page.getByRole('radio', { name: '수입', exact: true }).click()
    // 탭이 실제로 바뀐 뒤에 누른다. 목록 교체 전에 누르면 엉뚱한 행이 잡힌다.
    const row = page.locator('li', { hasText: '용돈' }).first()
    await row.waitFor({ timeout: 15000 })
    await row.getByRole('button', { name: '수정' }).click()
    await dlg().waitFor({ timeout: 15000 })
    /**
     * .check() 를 쓰지 않는다. 그것은 클릭 직후 DOM 의 checked 를 즉시 단정하는데,
     * 이 체크박스는 제어 입력이라 React 렌더 한 프레임 뒤에 반영된다.
     * 확인해야 할 것은 중간 DOM 상태가 아니라 아래의 "월급 기준" 배지다.
     */
    const box = dlg().getByRole('checkbox')
    if (!(await box.isChecked())) await box.click()
    await waitUntil(() => box.isChecked(), '체크박스가 켜지지 않았다')
    await dlg().getByRole('button', { name: '저장' }).click()
    await dlg().waitFor({ state: 'detached', timeout: 20000 })
    const badgeRow = page.locator('li', { hasText: '용돈' }).first()
    await badgeRow.getByText('월급 기준').waitFor({ timeout: 15000 })
  })

  await check('카테고리', '급여 지정 이동 → 위젯이 빈 상태로', async () => {
    await page.getByRole('link', { name: /내역/ }).click()
    await page.getByText('급여를 등록하면 남은 금액을 보여드려요').waitFor({ timeout: 20000 })
  })

  await check('카테고리', '← 설정 링크로 복귀', async () => {
    await page.goto(`${APP}/settings/categories`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('link', { name: '← 설정' }).click()
    await page.getByRole('button', { name: '비밀번호 변경' }).waitFor({ timeout: 20000 })
  })

  /* ── 8. 설정 ──────────────────────────────────────────────────────── */
  await check('설정', '닉네임 · 이메일 표시', async () => {
    await page.getByText('SOO').waitFor({ timeout: 15000 })
    await page.getByText(EMAIL).waitFor({ timeout: 10000 })
  })

  await check('설정', '비밀번호 변경 — 8자 미만 거부', async () => {
    await page.getByRole('button', { name: '비밀번호 변경' }).click()
    await dlg().waitFor({ timeout: 15000 })
    await dlg().getByLabel('새 비밀번호').fill('short')
    await dlg().getByRole('button', { name: '변경하기' }).click()
    await dlg().getByText('비밀번호는 8자 이상').waitFor({ timeout: 10000 })
    await dlg().getByRole('button', { name: '닫기' }).click()
    await dlg().waitFor({ state: 'detached', timeout: 10000 })
  })

  await check('설정', '로그아웃 → /login', async () => {
    await page.getByRole('button', { name: '로그아웃' }).click()
    await page.waitForURL(/\/login/, { timeout: 20000 })
  })

  await check('설정', '로그아웃 후 보호된 경로 접근 차단', async () => {
    await page.goto(`${APP}/settings`, { waitUntil: 'domcontentloaded' })
    await page.waitForURL(/\/login/, { timeout: 20000 })
  })

  /* ── 8.5 세션 전환 캐시 유출 ──────────────────────────────────────── */
  /**
   * RLS 는 서버 쪽 격리를 해 주지만 React Query 캐시는 그 바깥이다.
   * queryClient 는 모듈 싱글턴이라 로그아웃해도 살아남고 staleTime 이 30초라,
   * 같은 탭에서 A 로그아웃 → B 로그인 하면 B 가 A 의 데이터를 그대로 본다.
   *
   * **최초 1회만 goto 하고 이후는 클릭으로만 이동해야 한다.** goto 는 전체
   * 페이지 로드라 queryClient 가 새로 만들어진다 — 처음 이 검증을 쓸 때 중간에
   * goto 를 넣어서, 수정을 껐는데도 통과하는 헛도는 테스트를 만들었다.
   *
   * B 계정은 읽기 전용이다. reset 을 걸지 않고 아무것도 쓰지 않는다.
   */
  await check('격리', '로그아웃 → 다른 계정 로그인 시 앞 사용자 캐시가 안 보인다', async () => {
    if (!SECOND) skip('.env.test.local 에 E2E_EMAIL_2 / E2E_PASSWORD_2 가 없다')

    const MARK = `유출확인-${round}`
    const page2 = await browser.newPage({ viewport: { width: 420, height: 900 } })
    currentPage = page2
    let loads = 0
    page2.on('load', () => (loads += 1))
    const dlg2 = () => page2.getByRole('dialog')
    const tab = (name) => page2.getByRole('link', { name: new RegExp(name) }).click()
    const login = async (email, password) => {
      await page2.waitForSelector('text=로그인', { timeout: 30000 })
      await page2.getByLabel('이메일').fill(email)
      await page2.getByLabel('비밀번호').fill(password)
      await page2.getByRole('button', { name: '로그인' }).click()
    }

    try {
      await page2.goto(APP, { waitUntil: 'domcontentloaded' }) // 유일한 goto
      await login(EMAIL, PW)
      await page2.getByRole('button', { name: /거래 추가|기록 시작하기/ }).first().waitFor({ timeout: 30000 })
      const loadsAfterLogin = loads

      // A 에 표식을 남긴다 (거래 메모로 충분하다 — 카테고리는 건드리지 않는다)
      await page2.getByRole('button', { name: /거래 추가|기록 시작하기/ }).first().click()
      await dlg2().waitFor({ timeout: 15000 })
      await dlg2()
        .getByRole('group', { name: '카테고리', exact: true })
        .getByRole('button', { name: /^식비/ })
        .click()
      await dlg2().getByPlaceholder('0').fill('54321')
      await dlg2().getByPlaceholder('선택').fill(MARK)
      await page2.getByRole('button', { name: '저장' }).click()
      await dlg2().waitFor({ state: 'detached', timeout: 20000 })
      await page2.getByText(MARK).waitFor({ timeout: 15000 })

      await tab('설정')
      await page2.getByRole('button', { name: '로그아웃' }).waitFor({ timeout: 15000 })
      const aNick = (await page2.locator('body').innerText()).match(/닉네임\s*\n?\s*(\S+)/)?.[1]

      await page2.getByRole('button', { name: '로그아웃' }).click()
      await page2.waitForURL(/\/login/, { timeout: 20000 })
      await login(SECOND.email, SECOND.password)
      await page2.getByRole('button', { name: /거래 추가|기록 시작하기/ }).first().waitFor({ timeout: 30000 })

      // 페이지가 다시 로드됐다면 캐시가 사라져 검증이 성립하지 않는다
      expect(
        loads - loadsAfterLogin === 0,
        `중간에 페이지가 ${loads - loadsAfterLogin}번 다시 로드돼 검증이 성립하지 않는다`,
      )

      const leaks = new Set()
      for (const where of ['내역', '통계', '설정']) {
        if (where !== '내역') await tab(where)
        for (let i = 0; i < 12; i++) {
          const body = await page2.locator('body').innerText()
          if (body.includes(MARK)) leaks.add(`${where}: 앞 사용자의 거래 메모`)
          if (body.includes('54,321')) leaks.add(`${where}: 앞 사용자의 금액`)
          if (aNick && body.includes(aNick) && !body.includes(SECOND.email.split('@')[0]))
            leaks.add(`${where}: 앞 사용자의 닉네임 ${aNick}`)
          await page2.waitForTimeout(70)
        }
      }
      expect(leaks.size === 0, `앞 사용자 데이터가 보인다 — ${[...leaks].join(' / ')}`)
    } finally {
      currentPage = page
      await page2.close()
    }
  })

  /* ── 9. 데스크톱 ──────────────────────────────────────────────────── */
  await page.close()
  const desk = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  desk.on('console', (m) => m.type() === 'error' && consoleErrors.push(`[desktop] ${m.text()}`))

  await check('데스크톱', '상단 탭 · ＋추가 버튼 · FAB 없음', async () => {
    await desk.goto(APP, { waitUntil: 'domcontentloaded' })
    await desk.getByLabel('이메일').fill(EMAIL)
    await desk.getByLabel('비밀번호').fill(PW)
    await desk.getByRole('button', { name: '로그인' }).click()
    await desk.getByRole('button', { name: '추가' }).waitFor({ timeout: 30000 })
    expect(!(await desk.getByRole('button', { name: '거래 추가' }).isVisible()), 'FAB 이 보임')
    const nav = await desk.locator('nav').boundingBox()
    expect(nav.y < 100, `상단 탭이어야 하는데 y=${Math.round(nav.y)}`)
  })

  await check('데스크톱', '월 라벨이 컬럼 중앙', async () => {
    const box = await desk.getByRole('button', { name: /\d{4}년 \d+월/ }).boundingBox()
    const center = box.x + box.width / 2
    expect(Math.abs(center - 720) < 3, `중앙(720)에서 ${Math.round(center - 720)}px 벗어남`)
  })

  await check('데스크톱', '＋추가 버튼이 등록 시트를 연다', async () => {
    await desk.getByRole('button', { name: '추가' }).click()
    await desk.getByRole('dialog').waitFor({ timeout: 15000 })
  })

  await desk.close()

  results.push({
    round,
    area: '콘솔',
    name: `에러 ${consoleErrors.length}건`,
    ok: consoleErrors.length === 0,
    err: consoleErrors.slice(0, 2).join(' | '),
  })
}

await browser.close()

/* ─────────────────────────────────────────────────────────────── 결과 출력 */
const areas = [...new Set(results.map((r) => r.area))]
console.log()
for (const area of areas) {
  const rows = results.filter((r) => r.area === area)
  const names = [...new Set(rows.map((r) => r.name))]
  console.log(`── ${area}`)
  for (const name of names) {
    const per = [1, 2, 3].slice(0, ROUNDS).map((rd) => {
      const hit = rows.find((r) => r.round === rd && r.name === name)
      if (!hit) return '·'
      return hit.skipped ? '⊘' : hit.ok ? '✓' : '✕'
    })
    const failed = rows.find((r) => r.name === name && !r.ok)
    const skipped = rows.find((r) => r.name === name && r.skipped)
    const tail = failed ? `\n         → ${failed.err}` : skipped ? `\n         ⊘ ${skipped.why}` : ''
    console.log(`   ${per.join(' ')}  ${name}${tail}`)
  }
  console.log()
}

const total = results.length
const failed = results.filter((r) => !r.ok)
const skippedRows = results.filter((r) => r.skipped)
console.log(
  `검증 ${total}건 (${ROUNDS}회 × ${total / ROUNDS}) · 통과 ${total - failed.length - skippedRows.length}` +
    ` · 실패 ${failed.length}` +
    (skippedRows.length ? ` · 건너뜀 ${skippedRows.length}` : ''),
)
if (failed.length) {
  console.log('\n실패 목록:')
  for (const f of failed) console.log(`  R${f.round} [${f.area}] ${f.name}\n      ${f.err}`)
}
