import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { currentMonth, isValidMonth, shiftMonth, type Month } from '@/lib/month'

/**
 * 선택한 월을 URL 쿼리로 관리한다 (설계 §3.5).
 *
 * 전역 상태로 두면 새로고침 시 이번 달로 초기화되고 뒤로가기가 달 이동을 기억하지 못한다.
 * URL 에 두면 내역/통계 화면이 같은 값을 공유하는 것도 공짜로 따라온다.
 */
export function useMonthParam(): [Month, (m: Month) => void, (d: number) => void] {
  const [params, setParams] = useSearchParams()
  const raw = params.get('month')
  const month = isValidMonth(raw) ? raw : currentMonth()

  const setMonth = useCallback(
    (next: Month) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev)
          p.set('month', next)
          return p
        },
        { replace: true },
      )
    },
    [setParams],
  )

  const step = useCallback((delta: number) => setMonth(shiftMonth(month, delta)), [month, setMonth])

  return [month, setMonth, step]
}
