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

/**
 * 지급일이 아직 오지 않은 급여.
 *
 * 위젯이 빈 이유를 가르는 데만 쓴다. get_salary_widget 은 `occurred_on <= p_today`
 * 로 걸러서(0003_summary.sql — "미래에 등록한 급여는 아직 안 받은 돈") 미래 급여가
 * 있어도 빈 값을 준다. 그래서 화면은 "월급을 등록하면" 이라고 말했고, 방금 등록한
 * 사람에게는 거짓이었다 — 등록은 됐고 지급일이 안 온 것이다.
 *
 * RPC 를 고치는 대신 여기서 한 번 더 묻는다. 마이그레이션은 배포와 별도로 손으로
 * 돌려야 하는 일이라, 프론트만으로 끝나는 쪽이 어긋날 여지가 적다.
 *
 * 위젯이 값을 잃었을 때만 조회한다(enabled) — 정상 상태에서는 필요 없는 왕복이다.
 */
export function useUpcomingSalary(categoryId: string | null, enabled: boolean) {
  const today = useToday()
  return useQuery({
    queryKey: qk.upcomingSalary(categoryId, today),
    enabled: enabled && !!categoryId,
    queryFn: async (): Promise<{ id: string; occurred_on: string; amount: number } | null> => {
      // enabled 로 막혀 있어 도달하지 않지만, ! 로 타입을 우회하지 않는다.
      if (!categoryId) throw new Error('카테고리 id 가 없습니다')
      const { data, error } = await supabase
        .from('transactions')
        .select('id, occurred_on, amount')
        .eq('category_id', categoryId)
        .gt('occurred_on', today)
        .order('occurred_on', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/**
 * 급여 카테고리 **밖에** 들어 있는 수입.
 *
 * 위젯과 useUpcomingSalary 는 둘 다 지정된 카테고리 한 곳만 본다. 그래서 지정이
 * 다른 수입 카테고리를 가리키면 — 지정을 옮겼든, 월급을 다른 수입 칸에 적었든 —
 * 급여가 멀쩡히 등록돼 있는데도 화면은 "월급을 등록하면" 이라고 말했다.
 * 이미 등록한 사람에게 등록하라고 하는, 이 화면의 가장 오래된 거짓말의 마지막 경우다.
 *
 * 여기서 할 일은 위젯 값을 만드는 것이 아니라 **안내를 사실로 만드는 것**이다.
 * 그래서 지정을 바꿀 대상이 될 수 있는 수입만 찾는다:
 *   - 삭제된 카테고리는 제외한다(`categories!inner` + deleted_at is null).
 *     지정 화면 목록에 없는 카테고리로 "바꾸세요" 라고 하면 따를 수 없는 안내다.
 *   - 날짜는 걸지 않는다. 미래 급여여도 지정을 바꾸는 것이 할 일이고, 바꾸면
 *     그때는 "지급 예정" 안내가 맡는다.
 *
 * 가장 최근 것 하나만 가져온다 — 안내에 이름 하나를 넣는 데 필요한 전부다.
 */
export function useIncomeOutsideSalary(categoryId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: qk.incomeOutsideSalary(categoryId),
    enabled: enabled && !!categoryId,
    queryFn: async (): Promise<{
      id: string
      occurred_on: string
      amount: number
      categories: { name: string }
    } | null> => {
      // enabled 로 막혀 있어 도달하지 않지만, ! 로 타입을 우회하지 않는다.
      if (!categoryId) throw new Error('카테고리 id 가 없습니다')
      const { data, error } = await supabase
        .from('transactions')
        .select('id, occurred_on, amount, categories!inner(name, deleted_at)')
        .eq('type', 'income')
        .neq('category_id', categoryId)
        .is('categories.deleted_at', null)
        .order('occurred_on', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}
