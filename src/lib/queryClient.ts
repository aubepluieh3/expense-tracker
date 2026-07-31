import { QueryClient } from '@tanstack/react-query'

/**
 * 달별 조회를 캐시에 오래 남긴다.
 *
 * 기본 gcTime 은 5분이다. 달을 오가는 사용자에게 그건 짧다 — 5분 넘게 머문 뒤
 * 돌아온 달이 다시 "처음 보는 달" 이 되어 목록과 대표 숫자가 스켈레톤으로
 * 교체되고 화면이 180px 튄다(e2e/flicker.mjs 로 측정). 한 달치 거래 행이라
 * 오래 들고 있어도 메모리가 문제되지 않는다.
 *
 * staleTime 은 그대로 30초다. 이건 "다시 물어볼지" 이고 gcTime 은 "버릴지" 라,
 * 오래 남겨 두어도 낡은 값을 계속 보여주게 되지는 않는다 — 캐시가 있으면
 * 화면을 즉시 채우고 뒤에서 다시 받는다.
 */
export const MONTH_GC_TIME = 30 * 60_000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
