import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { currentUserId, supabase } from '@/lib/supabase'
import { invalidateAfter, qk } from '@/lib/queryKeys'
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
  return useQuery({ queryKey: qk.categories(), queryFn: fetchCategories })
}

/** 활성만. 선택 UI(칩 그리드, 관리 화면)에 쓴다. 같은 쿼리를 select 로 걸러 재사용한다. */
export function useCategories() {
  return useQuery({
    queryKey: qk.categories(),
    queryFn: fetchCategories,
    select: (rows) => rows.filter((c) => !c.deleted_at),
  })
}

/**
 * 마지막으로 사용한 순서의 카테고리 id 목록 (최근 → 오래된).
 *
 * 칩 그리드는 여전히 생성순 고정이다. 이 순서는 그리드 위 "최근" 줄에만 쓴다.
 * 그리드까지 사용순으로 재정렬하면 입력할 때마다 칩 위치가 바뀌어서, 익숙한
 * 자리를 안 보고 누르는 사람이 조용히 다른 카테고리로 저장하게 된다.
 *
 * 타입 구분과 개수 제한은 호출하는 쪽에서 한다 — 화면이 이미 타입별로 걸러진
 * 칩 목록을 들고 있으므로 교집합만 취하면 되고, 노출 개수도 화면 사정이다.
 */
export function useRecentCategoryIds() {
  return useQuery({
    queryKey: qk.recentCategories(),
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.rpc('get_recent_category_ids')
      if (error) throw error
      return data.map((r) => r.category_id)
    },
  })
}

export function useProfile() {
  return useQuery({
    queryKey: qk.profile(),
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

/**
 * 특정 카테고리에 달린 거래 건수. 삭제 안내와 되살리기 안내에 쓴다.
 *
 * 이전에는 맨손 async 함수로 불러서 결과를 로컬 상태에 복사해 넣었다. 그래서
 * 느린 네트워크에서 "삭제" 를 누르면 아무 반응이 없었다 — 로딩도, 에러 처리도,
 * 캐시도 없었다. TanStack Query 를 쓰는 프로젝트에 이 하나만 예외였다.
 */
export function useTransactionCount(categoryId: string | null) {
  return useQuery({
    queryKey: qk.transactionCount(categoryId),
    enabled: !!categoryId,
    queryFn: async (): Promise<number> => {
      if (!categoryId) throw new Error('카테고리 id 가 없습니다')
      const { count, error } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('category_id', categoryId)
      if (error) throw error
      return count ?? 0
    },
  })
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

/** 무효화 목록은 lib/queryKeys.ts 의 의존 표 하나에서만 관리한다. */
function useInvalidate() {
  const qc = useQueryClient()
  return () => invalidateAfter(qc, 'category')
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
