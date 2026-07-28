import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { monthRange, type Month } from '@/lib/month'
import type { CategoryStatRow } from '@/types/database'

/** 카테고리별 지출. 삭제된 카테고리도 과거 이름 그대로 포함된다. */
export function useCategoryStats(month: Month) {
  return useQuery({
    queryKey: ['category-stats', month],
    queryFn: async (): Promise<CategoryStatRow[]> => {
      const { data, error } = await supabase.rpc('get_category_stats', {
        p_month: monthRange(month).start,
      })
      if (error) throw error
      return data
    },
  })
}

/** 앱 사용 이후 누적. 통장 잔고가 아니다. */
export function useLifetimeNet() {
  return useQuery({
    queryKey: ['lifetime-net'],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc('get_lifetime_net', {})
      if (error) throw error
      return data ?? 0
    },
  })
}
