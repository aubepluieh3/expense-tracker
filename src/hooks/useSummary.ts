import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { monthRange, shiftMonth, type Month } from '@/lib/month'
import { useToday } from '@/hooks/useToday'
import { qk } from '@/lib/queryKeys'
import type { MonthSummaryRow, SalaryWidgetRow } from '@/types/database'

/** 월별 총수입 / 총지출 / 남은 금액 */
export function useMonthSummary(month: Month) {
  return useQuery({
    queryKey: qk.monthSummary(month),
    queryFn: async (): Promise<MonthSummaryRow> => {
      const { data, error } = await supabase.rpc('get_month_summary', {
        p_month: monthRange(month).start,
      })
      if (error) throw error
      return data[0] ?? { income: 0, expense: 0, net: 0 }
    },
  })
}

/**
 * 전월 대비 계산용.
 * 월 계산은 lib/month.ts 에만 둔다 — 여기 같은 식을 손으로 다시 쓰고 있었다.
 */
export function usePrevMonthSummary(month: Month) {
  return useMonthSummary(shiftMonth(month, -1))
}

/**
 * 월급 위젯.
 *
 * 오늘 날짜를 클라이언트에서 넘긴다 — DB 타임존이 UTC 라서 current_date 가
 * KST 와 최대 하루 어긋나고, 거래 입력 폼도 로컬 날짜를 쓰기 때문이다.
 *
 * 반환값이 null 이면 급여 카테고리 미지정 / 삭제됨 / 급여 거래 없음 중 하나다.
 *
 * useToday 를 쓰므로 자정을 넘기면 키가 바뀌어 저절로 다시 조회된다.
 */
export function useSalaryWidget() {
  const p_today = useToday()
  return useQuery({
    queryKey: qk.salaryWidget(p_today),
    queryFn: async (): Promise<SalaryWidgetRow | null> => {
      const { data, error } = await supabase.rpc('get_salary_widget', { p_today })
      if (error) throw error
      return data[0] ?? null
    },
  })
}
