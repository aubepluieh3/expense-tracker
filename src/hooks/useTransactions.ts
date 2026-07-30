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
  /**
   * 행과 함께 오는 카테고리 이름.
   *
   * null 이 아니다 — category_id 가 NOT NULL 이고 FK 가 on delete restrict 라
   * 거래가 참조하는 카테고리 행은 지워질 수 없다 (0001_init.sql).
   */
  categories: { name: string; emoji: string }
}

/**
 * 이름을 행과 함께 가져온다.
 *
 * 예전에는 거래와 카테고리를 따로 조회해 클라이언트에서 맞췄다. 그래서 카테고리
 * 쪽이 늦거나 실패하면 목록의 모든 행이 "알 수 없음 · 📦" 으로 보였다 — 그건
 * 삭제된 카테고리를 위한 문구라, 방금 적은 거래가 망가진 것처럼 읽혔다.
 *
 * FK 가 복합키(category_id, user_id, type)인데도 PostgREST 가 관계를 자동으로
 * 찾는다. 실제로 확인하고 넣었다.
 */
const SELECT =
  'id, category_id, type, amount, occurred_on, memo, created_at, categories(name, emoji)'

/** 등록·수정이 공유하는 입력 모양. 이 파일 안에서만 쓴다. */
type TransactionInput = {
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
        .select(SELECT)
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
    // qk.transaction 이 null 을 받는다. '' 로 바꿔 넘기면 lib/queryKeys.ts 가
    // 만들지 않겠다고 적어 둔 가짜 sentinel 을 호출부에서 다시 만드는 셈이다.
    queryKey: qk.transaction(id),
    enabled: !!id,
    queryFn: async (): Promise<TransactionListItem> => {
      // enabled 로 막혀 있어 도달하지 않지만, ! 로 타입을 우회하지 않는다.
      if (!id) throw new Error('거래 id 가 없습니다')
      const { data, error } = await supabase
        .from('transactions')
        .select(SELECT)
        .eq('id', id)
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
