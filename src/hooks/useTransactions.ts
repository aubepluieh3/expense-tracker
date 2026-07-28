import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { currentUserId, supabase } from '@/lib/supabase'
import { invalidateAfter, qk } from '@/lib/queryKeys'
import { monthRange, type Month } from '@/lib/month'
import type { CategoryType } from '@/types/database'

export type TransactionListItem = {
  id: string
  category_id: string
  type: CategoryType
  amount: number
  occurred_on: string
  memo: string | null
  created_at: string
}

export type TransactionInput = {
  category_id: string
  type: CategoryType
  amount: number
  occurred_on: string
  memo: string | null
}

/**
 * 한 달치를 통째로 가져온다 (기획서 §3.5 — 페이징 없음).
 *
 * 필터를 쿼리에 넣지 않고 클라이언트에서 거는 이유:
 * 필터 목록을 "그 달에 거래가 있는 카테고리"로 채워야 하는데,
 * 쿼리를 필터링하면 그 목록 자체가 같이 줄어들어 선택지가 사라진다.
 */
export function useMonthTransactions(month: Month) {
  return useQuery({
    queryKey: qk.transactions(month),
    queryFn: async (): Promise<TransactionListItem[]> => {
      const { start, end } = monthRange(month)
      const { data, error } = await supabase
        .from('transactions')
        .select('id, category_id, type, amount, occurred_on, memo, created_at')
        .gte('occurred_on', start)
        .lt('occurred_on', end)
        .order('occurred_on', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useTransaction(id: string | null) {
  return useQuery({
    queryKey: qk.transaction(id ?? ''),
    enabled: !!id,
    queryFn: async (): Promise<TransactionListItem> => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, category_id, type, amount, occurred_on, memo, created_at')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data
    },
  })
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => invalidateAfter(qc, 'transaction')
}

export function useCreateTransaction() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (input: TransactionInput) => {
      const { error } = await supabase
        .from('transactions')
        .insert({ ...input, user_id: await currentUserId() })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useUpdateTransaction() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async ({ id, ...input }: TransactionInput & { id: string }) => {
      const { error } = await supabase.from('transactions').update(input).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

/** 거래는 완전 삭제한다. 카테고리와 달리 과거 통계에 남길 이유가 없다. */
export function useDeleteTransaction() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
