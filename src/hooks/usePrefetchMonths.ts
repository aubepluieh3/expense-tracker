import { useCallback, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { monthSummaryOptions } from '@/hooks/useSummary'
import { monthTransactionsOptions } from '@/hooks/useTransactions'
import { shiftMonth, type Month } from '@/lib/month'

/**
 * 보고 있는 달의 양옆을 미리 받아 둔다.
 *
 * 깜빡임을 가리는 게 아니라 없애는 쪽이다. 실측에서 **캐시에 있는 달로 옮기면
 * 스켈레톤이 아예 뜨지 않았다** — 깜빡임의 조건은 달 이동 자체가 아니라 그 달의
 * 캐시가 없는 것이었다(e2e/flicker.mjs 의 측정 ②). 낡은 값을 보여주는 방식과
 * 달리 이건 그 달의 진짜 값이라 라벨과 어긋날 여지도 없다.
 *
 * ‹ › 로 한 칸씩 옮기는 것이 달을 바꾸는 주된 방법이므로 양옆 둘로 대부분을 덮는다.
 * 월 선택 시트로 6개월 전으로 건너뛰는 경로는 남는다 — 그쪽은 이전 달 목록이
 * 자리를 지키는 편이 맡는다(useTransactions 의 placeholderData).
 *
 * 통계 화면은 아직 대상이 아니다. 거기는 카테고리 통계·월급 주기 조회가 더 붙어
 * 있어서 미리 받을 것이 다르다. 측정한 것도 내역 화면이라 넓히지 않았다.
 */
export function usePrefetchAdjacentMonths(
  month: Month,
  /**
   * 보고 있는 달이 다 온 뒤에 시작한다.
   *
   * 같이 띄우면 프리페치 4건이 지금 화면이 기다리는 요청과 대역·커넥션을 다투어
   * 보고 있는 달이 오히려 늦어진다 — 깜빡임을 줄이려고 깜빡임을 늘리는 셈이다.
   */
  ready: boolean,
) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!ready) return
    for (const m of [shiftMonth(month, -1), shiftMonth(month, 1)]) {
      // prefetchQuery 는 staleTime(30초) 안의 신선한 캐시가 있으면 조회하지 않는다.
      void qc.prefetchQuery(monthTransactionsOptions(m))
      void qc.prefetchQuery(monthSummaryOptions(m))
    }
  }, [qc, month, ready])
}

/**
 * 한 달을 화면에 그릴 수 있을 때까지 기다린다. 월 선택 시트가 "다 받은 뒤에 닫기"
 * 에 쓴다 (MonthNavigator).
 *
 * 시트는 프리페치가 못 덮는 경로다 — 6개월 전을 고르면 캐시가 없다. 그런데 여기는
 * 화살표와 달리 **기다릴 자리가 있다**: 시트가 이미 열려 있고 누른 달이 즉시
 * 강조되므로 탭이 먹었다는 피드백이 끊기지 않는다. 그래서 아래 화면에 반쪽 상태를
 * 내보내는 대신 시트 안에서 기다린다.
 *
 * 이미 값이 있으면 기다리지 않는다. 낡았어도 화면은 즉시 채워지고 갱신은 뒤에서
 * 도므로, 여기서 기다리면 시트가 이유 없이 남는다 — staleTime(30초)이 지난 달로
 * 돌아가는 흔한 경우가 그렇다.
 */
export function useEnsureMonth() {
  const qc = useQueryClient()

  return useCallback(
    async (month: Month) => {
      const tx = monthTransactionsOptions(month)
      const summary = monthSummaryOptions(month)
      await Promise.all([
        qc.getQueryData(tx.queryKey) === undefined ? qc.prefetchQuery(tx) : null,
        qc.getQueryData(summary.queryKey) === undefined ? qc.prefetchQuery(summary) : null,
      ])
    },
    [qc],
  )
}
