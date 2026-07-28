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

export function monthOf(iso: string): Month {
  return iso.slice(0, 7)
}

export function shiftMonth(month: Month, delta: number): Month {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`
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
