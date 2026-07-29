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
 * 3,200,000 → '320만', 1,000,217,999 → '10억'. 한 줄에 여러 숫자를 넣어야 하는
 * 보조 표시에만 쓴다. 아래 단위를 버리므로 주요 금액에는 쓰지 않는다.
 *
 * 억을 따로 두는 이유: 만에서 멈추면 10억이 '100,021만' 이 된다. 축약의 목적이
 * 좁은 줄에서 자릿수를 줄이는 것인데, 만 단위로는 자리가 오히려 늘고 읽는 사람이
 * 콤마를 세게 된다. 실제로 요약 줄에 '지출 99,999만' 이 떴다.
 *
 * 억 구간만 소수 한 자리를 쓴다. 만 구간은 정수로 충분하지만(320만) 억 구간은
 * 정수로 자르면 1.9억과 1.1억이 똑같이 '1억' 이 되어 8천만원 차이가 사라진다.
 * 반올림이 아니라 버림이다 — 9.99억을 '10억' 으로 올리면 실제보다 커 보인다.
 */
export function abbrevAmount(n: number): string {
  const abs = Math.abs(n)
  if (abs < 10_000) return won.format(n)
  if (abs < 100_000_000) return `${won.format(Math.trunc(n / 10_000))}만`
  return `${Math.trunc(n / 10_000_000) / 10}억`
}
