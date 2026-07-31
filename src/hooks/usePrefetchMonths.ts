import { useCallback, useEffect, useMemo } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { categoryStatsOptions } from '@/hooks/useStats'
import { monthSummaryOptions } from '@/hooks/useSummary'
import { monthTransactionsOptions } from '@/hooks/useTransactions'
import { shiftMonth, type Month } from '@/lib/month'

/**
 * 달을 바꿀 때의 깜빡임을 **가리지 않고 없애는** 쪽.
 *
 * 실측에서 캐시에 있는 달로 옮기면 스켈레톤이 아예 뜨지 않았다 — 깜빡임의 조건은
 * 달 이동 자체가 아니라 그 달의 캐시가 없는 것이었다(e2e/flicker.mjs 의 측정 ②).
 * 낡은 값을 보여주는 방식과 달리 이건 그 달의 진짜 값이라 라벨과 어긋날 여지도 없다.
 *
 * 두 가지로 쓴다. 양옆을 배경으로 미리 받아 두는 것(prefetch)과, 월 선택 시트가
 * 닫히기 전에 기다리는 것(ensure). 정책이 다르다 —
 *
 *   prefetch  신선한 캐시가 있으면 아무것도 안 한다 (prefetchQuery 가 staleTime 을 본다)
 *   ensure    **값이 있으면 낡았어도 즉시 끝난다.** 화면은 즉시 채워지고 갱신은 뒤에서
 *             돌기 때문이다. 여기서 기다리면 staleTime(30초)이 지난 달로 돌아갈 때
 *             시트가 이유 없이 남는다.
 *
 * 어떤 조회가 한 달을 이루는지는 화면마다 다르므로 화면별 훅으로 나눠 둔다.
 * 목록을 한 곳에 뭉치면 통계가 거래 목록을, 내역이 카테고리 통계를 받게 된다.
 */

/** ensure 정책 — 값이 없을 때만 받아온다. */
function ensureOne(qc: QueryClient, key: readonly unknown[], fetch: () => Promise<unknown>) {
  return qc.getQueryData(key) === undefined ? fetch() : Promise.resolve()
}

/** 한 달을 데우는 두 가지 방법. 화면별 훅이 이 모양으로 돌려준다. */
type Warmer = {
  prefetch: (m: Month) => void
  ensure: (m: Month) => Promise<void>
}

/** 내역 화면: 그 달의 거래 목록과 월 요약. */
export function useTransactionsMonthWarmer(): Warmer {
  const qc = useQueryClient()

  return useMemo(
    () => ({
      prefetch: (m) => {
        void qc.prefetchQuery(monthTransactionsOptions(m))
        void qc.prefetchQuery(monthSummaryOptions(m))
      },
      ensure: async (m) => {
        const tx = monthTransactionsOptions(m)
        const summary = monthSummaryOptions(m)
        await Promise.all([
          ensureOne(qc, tx.queryKey, () => qc.prefetchQuery(tx)),
          ensureOne(qc, summary.queryKey, () => qc.prefetchQuery(summary)),
        ])
      },
    }),
    [qc],
  )
}

/**
 * 통계 화면(달력월 축): 카테고리 통계와 월 요약, 그리고 **지난달 요약**.
 *
 * 지난달 것까지 넣는 이유는 "지난달 대비 +12%" 다(Stats). 그게 없으면 화면이
 * 스켈레톤을 거치지는 않아도 증감률만 뒤늦게 끼어든다.
 *
 * 거래 목록은 넣지 않는다 — 이 화면은 RPC 집계만 쓴다. 월급 주기 축도 대상이
 * 아니다: 그 축의 기간은 급여일부터 오늘까지 하나뿐이라 달과 무관하다.
 */
export function useStatsMonthWarmer(): Warmer {
  const qc = useQueryClient()

  return useMemo(
    () => ({
      prefetch: (m) => {
        void qc.prefetchQuery(categoryStatsOptions(m))
        void qc.prefetchQuery(monthSummaryOptions(m))
        void qc.prefetchQuery(monthSummaryOptions(shiftMonth(m, -1)))
      },
      ensure: async (m) => {
        const stats = categoryStatsOptions(m)
        const summary = monthSummaryOptions(m)
        const prev = monthSummaryOptions(shiftMonth(m, -1))
        await Promise.all([
          ensureOne(qc, stats.queryKey, () => qc.prefetchQuery(stats)),
          ensureOne(qc, summary.queryKey, () => qc.prefetchQuery(summary)),
          ensureOne(qc, prev.queryKey, () => qc.prefetchQuery(prev)),
        ])
      },
    }),
    [qc],
  )
}

/**
 * 보고 있는 달의 양옆을 미리 받아 둔다.
 *
 * ‹ › 로 한 칸씩 옮기는 것이 달을 바꾸는 주된 방법이므로 양옆 둘로 대부분을 덮는다.
 * 월 선택 시트로 멀리 건너뛰는 경로는 남는다 — 그쪽은 시트가 스스로 기다린다
 * (MonthNavigator 의 prepare).
 *
 * ready 는 "보고 있는 달이 다 왔는가" 다. 같이 띄우면 프리페치가 지금 화면이
 * 기다리는 요청과 대역·커넥션을 다투어 보고 있는 달이 오히려 늦어진다 —
 * 깜빡임을 줄이려고 깜빡임을 늘리는 셈이다.
 */
export function usePrefetchAdjacentMonths(warmer: Warmer, month: Month, ready: boolean) {
  const { prefetch } = warmer

  useEffect(() => {
    if (!ready) return
    prefetch(shiftMonth(month, -1))
    prefetch(shiftMonth(month, 1))
  }, [prefetch, month, ready])
}

/** 월 선택 시트에 넘길 준비 함수. 참조가 안 바뀌어야 시트가 매 렌더 새로 받지 않는다. */
export function useEnsureMonth(warmer: Warmer) {
  const { ensure } = warmer
  return useCallback((m: Month) => ensure(m), [ensure])
}
