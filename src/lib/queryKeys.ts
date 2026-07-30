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
  // 거래를 넣으면 순서가 바뀌고, 카테고리를 지우면 목록에서 빠져야 한다
  recentCategories: def('recent-categories', ['transaction', 'category']),

  // 거래 행이 카테고리 이름·이모지를 쓴다 — 쿼리가 임베드로 함께 가져온다
  transactions: def('transactions', ['transaction', 'category']),
  /*
    임의 날짜 범위. 월급 주기 통계가 쓴다 — 급여일은 달력월 경계와 무관하다.
    같은 prefix 를 쓰지 않는 이유는 무효화 범위가 아니라 키 충돌이다:
    ['transactions', '2026-07'] 과 ['transactions', '2026-07-10', '2026-08-10'] 이
    부분 일치로 서로를 건드린다.
  */
  rangeTransactions: def('range-transactions', ['transaction', 'category']),
  // 단건도 같은 SELECT 를 쓰므로 이름을 싣는다. 지금 그 이름을 화면에 쓰는 곳은
  // 없지만, 없다고 빼 두면 쓰기 시작한 사람이 낡은 값을 보고도 이유를 못 찾는다.
  transaction: def('transaction', ['transaction', 'category']),

  transactionCount: def('transaction-count', ['transaction', 'category']),

  monthSummary: def('month-summary', ['transaction']),
  // 통계는 카테고리 이름·이모지를 그대로 보여준다
  categoryStats: def('category-stats', ['transaction', 'category']),
  // 급여 지정이 바뀌면 위젯 기준 자체가 바뀐다
  salaryWidget: def('salary-widget', ['transaction', 'category']),
  // 위젯이 빈 이유를 가르는 조회 — 지급일이 아직 오지 않은 급여가 있는가
  upcomingSalary: def('upcoming-salary', ['transaction', 'category']),
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
  recentCategories: () => [QUERIES.recentCategories.prefix] as const,
  transactions: (month: Month) => [QUERIES.transactions.prefix, month] as const,
  /** end 는 미포함(exclusive). null 이면 enabled:false 로 실행되지 않는다. */
  rangeTransactions: (start: string | null, end: string | null) =>
    [QUERIES.rangeTransactions.prefix, start, end] as const,
  /** id 가 null 이면 enabled:false 로 실행되지 않는다. 가짜 sentinel 을 만들지 않는다. */
  transaction: (id: string | null) => [QUERIES.transaction.prefix, id] as const,
  transactionCount: (categoryId: string | null) =>
    [QUERIES.transactionCount.prefix, categoryId] as const,
  monthSummary: (month: Month) => [QUERIES.monthSummary.prefix, month] as const,
  categoryStats: (month: Month) => [QUERIES.categoryStats.prefix, month] as const,
  salaryWidget: (today: string) => [QUERIES.salaryWidget.prefix, today] as const,
  /** 오늘이 키에 들어간다 — 자정을 넘기면 "미래" 의 기준이 바뀐다. */
  upcomingSalary: (categoryId: string | null, today: string) =>
    [QUERIES.upcomingSalary.prefix, categoryId, today] as const,
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
