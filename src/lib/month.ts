/**
 * 월 단위 유틸.
 *
 * Date 객체로 월 계산을 하면 타임존 경계에서 하루씩 밀린다.
 * 여기서는 'YYYY-MM' / 'YYYY-MM-DD' 문자열과 숫자 연산만 쓴다.
 */

const DOW = ['일', '월', '화', '수', '목', '금', '토'] as const

const pad = (n: number) => String(n).padStart(2, '0')

/** 'YYYY-MM' */
export type Month = string

export function currentMonth(): Month {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
}

/** 로컬 기준 오늘 'YYYY-MM-DD' */
export function today(): string {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d + delta)
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

export function isValidMonth(value: string | null): value is Month {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)
}

export function shiftMonth(month: Month, delta: number): Month {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`
}

/**
 * 날짜를 그 달 안으로 밀어 넣는다. 이미 그 달이면 그대로.
 *
 *   clampToMonth('2026-07-30', '2026-07')  → '2026-07-30'   (그대로)
 *   clampToMonth('2026-07-30', '2026-06')  → '2026-06-30'   (말일)
 *   clampToMonth('2026-07-30', '2026-09')  → '2026-09-01'   (1일)
 *
 * 등록 시트의 날짜 기본값에 쓴다. 6월을 보는 중에 ＋ 를 누르면 기본값이 오늘(7월)
 * 이라 달력을 열어 달부터 고쳐야 했다. 일자는 어차피 바꾸지만 달이 틀리면
 * 그 한 단계가 더 붙는다.
 *
 * 과거 달은 말일, 미래 달은 1일이 되는데 분기가 아니라 같은 식의 결과다 —
 * "그 달에서 오늘에 가장 가까운 날" 하나의 규칙이다. 목록이 날짜 내림차순이라
 * 과거 달의 가장 최근 지점이 말일인 것도 맞는다.
 */
export function clampToMonth(iso: string, month: Month): string {
  const { start, end } = monthRange(month)
  if (iso < start) return start
  const last = addDays(end, -1) // end 는 다음 달 1일(미포함)
  return iso > last ? last : iso
}

/** 조회 조건용 반열린 구간 [start, end). BETWEEN 을 쓰면 말일 경계에서 실수한다. */
export function monthRange(month: Month): { start: string; end: string } {
  return { start: `${month}-01`, end: `${shiftMonth(month, 1)}-01` }
}

export function monthLabel(month: Month): string {
  const [y, m] = month.split('-').map(Number)
  return `${y}년 ${m}월`
}

/** '7월 3일 (목)' */
export function dayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  return `${m}월 ${d}일 (${DOW[new Date(y, m - 1, d).getDay()]})`
}

/** '6.25' */
export function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${m}.${d}`
}

/**
 * '어제' · '6일 전' · '내일' · '2일 후'. 오늘이면 null — 알릴 게 없다.
 *
 * null 을 반환하는 게 호출부를 단순하게 만든다. "오늘인가" 판정과 "며칠 차이인가"를
 * 따로 계산하면 두 값이 어긋날 수 있다.
 */
export function relativeDayLabel(iso: string, from: string = today()): string | null {
  const diff = daysBetween(from, iso)
  if (diff === 0) return null
  if (diff === -1) return '어제'
  if (diff === 1) return '내일'
  return diff < 0 ? `${-diff}일 전` : `${diff}일 후`
}

/** to − from, 일 단위. 로컬 자정 기준으로 계산해 DST·타임존 영향을 받지 않는다. */
export function daysBetween(from: string, to: string): number {
  const [y1, m1, d1] = from.split('-').map(Number)
  const [y2, m2, d2] = to.split('-').map(Number)
  const a = Date.UTC(y1, m1 - 1, d1)
  const b = Date.UTC(y2, m2 - 1, d2)
  return Math.round((b - a) / 86_400_000)
}
