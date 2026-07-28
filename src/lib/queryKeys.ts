import type { QueryClient } from '@tanstack/react-query'
import type { Month } from '@/lib/month'

/**
 * 쿼리 키와 무효화 규칙.
 *
 * 이전에는 무효화 목록이 두 파일에 따로 있어서 서로를 몰랐고, 카테고리 쪽에
 * salary-widget 이 빠져서 급여 지정을 옮겨도 위젯이 낡은 값을 계속 보여줬다.
 * 아무 에러도 나지 않는 종류의 버그였다.
 *
 * 그래서 목록을 한 곳에 모으는 데 그치지 않고, **빠뜨리면 컴파일이 안 되게** 했다.
 * 쿼리를 하나 추가하려면 qk 에 항목을 쓰게 되고, 그러면 QUERIES 항목이 필요해지고,
 * QUERIES 항목에는 staleOn 이 필수다.
 */

/** 무효화를 유발하는 변경의 종류 */
type Trigger = 'transaction' | 'category'

type QueryDef = {
  /** 캐시 키의 첫 요소 */
  prefix: string
  /** 이 쿼리가 낡는 조건. 필수라서 빠뜨리면 컴파일이 안 된다. */
  staleOn: readonly Trigger[]
}

/**
 * 함수를 거치는 이유: 객체 리터럴에 satisfies 만 붙이면 staleOn 이
 * ['category'] 같은 좁은 리터럴로 추론돼서 includes 검사가 막힌다.
 */
const def = (prefix: string, staleOn: readonly Trigger[]): QueryDef => ({ prefix, staleOn })

/**
 * 각 쿼리가 "무엇이 바뀌면 낡는가".
 *
 * prefix 는 캐시 키의 첫 요소다. 접두사만 넘기면 TanStack 이 부분 일치로
 * 월·날짜가 붙은 키까지 잡아준다 — ['transactions'] 하나로 2026-07, 2026-06 …
 */
const QUERIES = {
  categories: def('categories', ['category']),
  profile: def('profile', ['category']),

  // 거래 행이 카테고리 이름·이모지를 쓴다
  transactions: def('transactions', ['transaction', 'category']),
  transaction: def('transaction', ['transaction']),

  monthSummary: def('month-summary', ['transaction']),
  // 통계는 카테고리 이름·이모지를 그대로 보여준다
  categoryStats: def('category-stats', ['transaction', 'category']),
  // 급여 지정이 바뀌면 위젯 기준 자체가 바뀐다
  salaryWidget: def('salary-widget', ['transaction', 'category']),
  lifetimeNet: def('lifetime-net', ['transaction']),
}

/**
 * 캐시 키는 여기서만 만든다. 문자열 리터럴을 호출 지점에 두면 오타가
 * 컴파일에 안 걸리고 조용히 무효화만 안 된다.
 *
 * prefix 를 QUERIES 에서 가져오므로, QUERIES 에 없는 쿼리는 키를 만들 수 없다.
 */
export const qk = {
  categories: () => [QUERIES.categories.prefix] as const,
  profile: () => [QUERIES.profile.prefix] as const,
  transactions: (month: Month) => [QUERIES.transactions.prefix, month] as const,
  transaction: (id: string) => [QUERIES.transaction.prefix, id] as const,
  monthSummary: (month: Month) => [QUERIES.monthSummary.prefix, month] as const,
  categoryStats: (month: Month) => [QUERIES.categoryStats.prefix, month] as const,
  salaryWidget: (today: string) => [QUERIES.salaryWidget.prefix, today] as const,
  lifetimeNet: () => [QUERIES.lifetimeNet.prefix] as const,
}

/**
 * 변경 뒤 낡은 쿼리를 전부 무효화한다.
 * 목록을 손으로 관리하지 않는다 — QUERIES 의 staleOn 에서 만들어진다.
 */
export function invalidateAfter(qc: QueryClient, trigger: Trigger) {
  for (const q of Object.values(QUERIES)) {
    if (q.staleOn.includes(trigger)) {
      void qc.invalidateQueries({ queryKey: [q.prefix] })
    }
  }
}
