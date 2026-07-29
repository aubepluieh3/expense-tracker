import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { currentUserId, supabase } from '@/lib/supabase'
import { invalidateAfter, qk } from '@/lib/queryKeys'
import type { ProfileRow } from '@/types/database'

/**
 * profiles 한 행을 읽고 쓰는 훅들.
 *
 * 이 세 개가 useCategories.ts 에 있었다. 그 파일이 스스로 인정해 둔 상태였다 —
 * "파일 이름과 안 맞지만, profile 쿼리를 쓰는 코드가 흩어지는 것보다는 낫다".
 * 흩어짐을 막는 방법이 남의 파일에 얹는 것일 필요는 없어서 여기로 옮긴다.
 * 설정 화면이 닉네임 훅을 `from '@/hooks/useCategories'` 로 가져오고 있었다.
 */

export function useProfile() {
  return useQuery({
    queryKey: qk.profile(),
    queryFn: async (): Promise<ProfileRow> => {
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
 * 닉네임 변경.
 *
 * 가입 때 필수로 받고 설정 화면에 표시까지 하는데 바꿀 길이 없었다. 오타를 냈거나
 * 마음이 바뀌면 계정을 다시 만드는 것 말고 방법이 없었다는 뜻이다.
 *
 * 길이 검증은 가입과 같다(lib/rules.ts). 상한은 DB 도 갖고 있지만(0001 의 CHECK),
 * 잘라 보내지 않고 막는다 — 조용히 잘리면 사용자가 입력한 것과 저장된 것이
 * 달라진다.
 */
export function useUpdateNickname() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (nickname: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ nickname })
        .eq('id', await currentUserId())
      if (error) throw error
    },
    // 프로필만 낡는다. 카테고리·거래·통계는 닉네임과 무관하므로
    // invalidateAfter('category') 를 부르면 필요 없는 재조회가 줄줄이 붙는다.
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.profile() }),
  })
}

/**
 * 월급 위젯 기준 카테고리 지정. profiles 한 행 수정으로 끝난다.
 *
 * 낙관적으로 먼저 반영한다. 이 체크박스의 진실은 서버에 있어서, 서버 값만 보면
 * 왕복이 끝날 때까지 누른 표시가 나지 않았다 — 로컬에서 재어 보니 100~300ms 고
 * 느린 망에서는 수 초다. 그동안 화면이 그대로라 사용자는 한 번 더 누르는데,
 * 그 두 번째 클릭이 지정을 해제한다.
 *
 * profile 캐시를 미리 바꾸면 체크박스와 월급 위젯이 함께 즉시 반응하고,
 * 실패하면 이전 값으로 되돌린다.
 */
export function useSetSalaryCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (categoryId: string | null) => {
      const { error } = await supabase
        .from('profiles')
        .update({ salary_category_id: categoryId })
        .eq('id', await currentUserId())
      if (error) throw error
    },
    onMutate: async (categoryId) => {
      // 진행 중인 refetch 가 낙관값을 덮어쓰지 못하게 먼저 끊는다.
      await qc.cancelQueries({ queryKey: qk.profile() })
      const previous = qc.getQueryData<ProfileRow>(qk.profile())
      qc.setQueryData<ProfileRow>(qk.profile(), (old) =>
        old ? { ...old, salary_category_id: categoryId } : old,
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(qk.profile(), ctx.previous)
    },
    // 급여 기준이 바뀌면 위젯 기준 자체가 바뀐다 — queryKeys 의 의존 표가 정한다.
    onSuccess: () => invalidateAfter(qc, 'category'),
  })
}
