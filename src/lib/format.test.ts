import { describe, expect, it } from 'vitest'
import { abbrevAmount, digitsOnly, formatAmount } from '@/lib/format'

describe('formatAmount', () => {
  it('천 단위로 끊는다', () => {
    expect(formatAmount(12000)).toBe('12,000')
    expect(formatAmount(0)).toBe('0')
    expect(formatAmount(999)).toBe('999')
    expect(formatAmount(1000)).toBe('1,000')
  })

  it('음수도 그대로 포맷한다 — 부호 처리는 호출부가 한다', () => {
    expect(formatAmount(-12000)).toBe('-12,000')
  })
})

describe('digitsOnly', () => {
  it('숫자만 남긴다', () => {
    expect(digitsOnly('12,000')).toBe('12000')
    expect(digitsOnly('1a2b3')).toBe('123')
    expect(digitsOnly('')).toBe('')
    expect(digitsOnly('원')).toBe('')
  })

  it('부호와 소수점도 버린다 — 금액은 양의 정수다', () => {
    expect(digitsOnly('-500')).toBe('500')
    expect(digitsOnly('1.5')).toBe('15')
  })
})

/**
 * abbrevAmount 는 경계가 셋이다 (1만 · 1억 · 버림). 문서화된 예시와 실제 값이
 * 어긋난 적이 있어서(요약 줄에 '지출 99,999만' 이 떴다) 경계를 못 박아 둔다.
 */
describe('abbrevAmount', () => {
  it('1만 미만은 축약하지 않는다', () => {
    expect(abbrevAmount(0)).toBe('0')
    expect(abbrevAmount(9999)).toBe('9,999')
  })

  it('만 구간은 정수 만 단위다', () => {
    expect(abbrevAmount(10_000)).toBe('1만')
    expect(abbrevAmount(3_200_000)).toBe('320만')
    // 아래 단위를 버린다 — 올리면 실제보다 커 보인다
    expect(abbrevAmount(3_209_999)).toBe('320만')
  })

  it('만 구간의 상한에서 억으로 넘어간다', () => {
    expect(abbrevAmount(99_999_999)).toBe('9,999만')
    expect(abbrevAmount(100_000_000)).toBe('1억')
  })

  it('억 구간은 소수 한 자리다 — 정수로 자르면 1.9억과 1.1억이 같아진다', () => {
    expect(abbrevAmount(110_000_000)).toBe('1.1억')
    expect(abbrevAmount(190_000_000)).toBe('1.9억')
    expect(abbrevAmount(1_000_217_999)).toBe('10억')
  })

  it('억 구간도 반올림이 아니라 버림이다', () => {
    // 9.99억을 '10억' 으로 올리면 실제보다 커 보인다
    expect(abbrevAmount(999_000_000)).toBe('9.9억')
  })

  it('음수도 같은 규칙을 쓴다', () => {
    expect(abbrevAmount(-3_200_000)).toBe('-320만')
    expect(abbrevAmount(-5000)).toBe('-5,000')
  })
})
