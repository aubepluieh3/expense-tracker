import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { monthRange, type Month } from '@/lib/month'
import { qk } from '@/lib/queryKeys'
import type { CategoryStatRow } from '@/types/database'

/** 카테고리별 지출. 삭제된 카테고리도 과거 이름 그대로 포함된다. */
export function useCategoryStats(month: Month) {
  return useQuery({
    queryKey: qk.categoryStats(month),
    queryFn: async (): Promise<CategoryStatRow[]> => {
      const { data, error } = await supabase.rpc('get_category_stats', {
        p_month: monthRange(month).start,
      })
      if (error) throw error
      return data
    },
  })
}

/**
 * 거래 목록에서 카테고리별 지출을 직접 집계한다. get_category_stats 의 클라이언트 판.
 *
 * RPC 는 달력월만 받으므로(p_month) 월급 주기를 담을 수 없다. 그런데 계산이 하는 일은
 * "지출만 골라 카테고리로 묶고 합계를 내려 정렬" 뿐이고, 거래 조회에 이름·이모지가
 * 함께 실려 오므로(useTransactions 의 SELECT) 여기서 같은 결과를 만들 수 있다.
 * 마이그레이션 없이 축을 하나 더 얻는 값이 이 중복보다 크다.
 *
 * color_slot 은 0 으로 둔다 — CategoryBarList 는 순위(index)로 색을 정하고 이 값을
 * 읽지 않는다. 서버 응답 모양을 맞추기 위한 자리다.
 */
export function categoryStatsOf(
  items: {
    type: string
    amount: number
    category_id: string
    categories: { name: string; emoji: string }
  }[],
): CategoryStatRow[] {
  const byId = new Map<string, CategoryStatRow>()
  for (const t of items) {
    if (t.type !== 'expense') continue
    const row = byId.get(t.category_id)
    if (row) row.total += t.amount
    else
      byId.set(t.category_id, {
        category_id: t.category_id,
        name: t.categories.name,
        emoji: t.categories.emoji,
        color_slot: 0,
        total: t.amount,
      })
  }
  return [...byId.values()].sort((a, b) => b.total - a.total)
}
