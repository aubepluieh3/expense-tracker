import type { QueryClient } from '@tanstack/react-query'

/**
 * 거래가 하나만 바뀌어도 값이 달라지는 쿼리들.
 *
 * 설계 §6.4 — 하나씩 무효화하면 반드시 빠뜨린다.
 * 특히 월급 위젯은 거래 추가만으로 값이 바뀌는데 잊기 쉽다.
 */
export function invalidateTransactionRelated(qc: QueryClient) {
  for (const key of [
    ['transactions'],
    ['month-summary'],
    ['category-stats'],
    ['salary-widget'],
    ['lifetime-net'],
  ]) {
    void qc.invalidateQueries({ queryKey: key })
  }
}
