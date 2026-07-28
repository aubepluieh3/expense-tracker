const won = new Intl.NumberFormat('ko-KR')

/** 12000 → '12,000' */
export function formatAmount(n: number): string {
  return won.format(n)
}

/** 입력값에서 숫자만 남긴다. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * 3,200,000 → '320만'. 한 줄에 여러 숫자를 넣어야 하는 보조 표시에만 쓴다.
 * 만 단위 아래는 버리므로 주요 금액에는 쓰지 않는다.
 */
export function abbrevAmount(n: number): string {
  if (Math.abs(n) < 10_000) return won.format(n)
  return `${won.format(Math.trunc(n / 10_000))}만`
}
