const won = new Intl.NumberFormat('ko-KR')

/** 12000 → '12,000' */
export function formatAmount(n: number): string {
  return won.format(n)
}

/** 수입은 +, 지출은 −. 부호는 type 이 결정한다(금액은 항상 양수로 저장). */
export function signedAmount(type: 'income' | 'expense', amount: number): string {
  return `${type === 'income' ? '+' : '−'}${won.format(amount)}`
}

/** 입력값에서 숫자만 남긴다. */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}
