import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { monthRange, today, type Month } from '@/lib/month'
import type { MonthSummaryRow, SalaryWidgetRow } from '@/types/database'

/** 월별 총수입 / 총지출 / 남은 금액 */
export function useMonthSummary(month: Month) {
  return useQuery({
    queryKey: ['month-summary', month],
    queryFn: async (): Promise<MonthSummaryRow> => {
      const { data, error } = await supabase.rpc('get_month_summary', {
        p_month: monthRange(month).start,
      })
      if (error) throw error
      return data[0] ?? { income: 0, expense: 0, net: 0 }
    },
  })
}

/** 전월 대비 계산용 */
export function usePrevMonthSummary(month: Month) {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) - 1
  const prev = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
  return useMonthSummary(prev)
}

/**
 * 월급 위젯.
 *
 * 오늘 날짜를 클라이언트에서 넘긴다 — DB 타임존이 UTC 라서 current_date 가
 * KST 와 최대 하루 어긋나고, 거래 입력 폼도 로컬 날짜를 쓰기 때문이다.
 *
 * 반환값이 null 이면 급여 카테고리 미지정 / 삭제됨 / 급여 거래 없음 중 하나다.
 */
export function useSalaryWidget() {
  const p_today = today()
  return useQuery({
    queryKey: ['salary-widget', p_today],
    queryFn: async (): Promise<SalaryWidgetRow | null> => {
      const { data, error } = await supabase.rpc('get_salary_widget', { p_today })
      if (error) throw error
      return data[0] ?? null
    },
  })
}
