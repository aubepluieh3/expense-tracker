import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { currentUserId, supabase } from '@/lib/supabase'
import type { Category, CategoryType } from '@/types/database'

/** UNIQUE 제약 위반. 같은 이름이 이미 있다는 뜻(삭제된 것 포함). */
export const UNIQUE_VIOLATION = '23505'

/** 정렬은 생성순 고정. 칩 그리드 위치가 안 바뀌어야 근육 기억이 생긴다. */
async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data
}

/**
 * 삭제된 것까지 전부.
 * 과거 거래에 붙은 카테고리는 삭제됐어도 이름·이모지를 보여줘야 한다.
 */
export function useAllCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: fetchCategories })
}

/** 활성만. 선택 UI(칩 그리드, 관리 화면)에 쓴다. 같은 쿼리를 select 로 걸러 재사용한다. */
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: fetchCategories,
    select: (rows) => rows.filter((c) => !c.deleted_at),
  })
}

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nickname, salary_category_id')
        .single()
      if (error) throw error
      return data
    },
  })
}

/** 특정 카테고리에 달린 거래 건수. 삭제 안내와 되살리기 안내에 쓴다. */
export async function fetchTransactionCount(categoryId: string) {
  const { count, error } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId)
  if (error) throw error
  return count ?? 0
}

/** 같은 이름으로 삭제된 카테고리 찾기. 되살리기 제안의 근거. */
export async function findDeletedByName(type: CategoryType, name: string) {
  const normalized = name.trim().replace(/\s+/g, ' ')
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('type', type)
    .eq('name', normalized)
    .not('deleted_at', 'is', null)
    .maybeSingle()
  if (error) throw error
  return data
}

function useInvalidate() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['categories'] })
    void qc.invalidateQueries({ queryKey: ['profile'] })
  }
}

export function useCreateCategory() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (input: { type: CategoryType; name: string; emoji: string }) => {
      // 색 슬롯 배정과 INSERT 가 원자적이어야 해서 RPC 를 쓴다.
      const { data, error } = await supabase.rpc('create_category', {
        p_type: input.type,
        p_name: input.name,
        p_emoji: input.emoji,
      })
      if (error) throw error
      return data
    },
    onSuccess: invalidate,
  })
}

export function useUpdateCategory() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (input: { id: string; name: string; emoji: string }) => {
      const { error } = await supabase
        .from('categories')
        .update({ name: input.name, emoji: input.emoji })
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

/**
 * 삭제는 항상 소프트 삭제다.
 * 완전 삭제하면 실행 취소가 불가능해지는데, 어떤 경우에만 취소가 되는 건 일관성이 없다.
 */
export function useDeleteCategory() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

/** 색 슬롯은 건드리지 않는다. 순환을 허용하므로 중복 검사가 없고 과거 통계의 색이 보존된다. */
export function useRestoreCategory() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .update({ deleted_at: null })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

/** 월급 위젯 기준 카테고리 지정. profiles 한 행 수정으로 끝난다. */
export function useSetSalaryCategory() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: async (categoryId: string | null) => {
      const { error } = await supabase
        .from('profiles')
        .update({ salary_category_id: categoryId })
        .eq('id', await currentUserId())
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}
