import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

/**
 * 환경변수가 없으면 앱 전체가 흰 화면이 되는 대신,
 * 이 플래그로 안내 화면을 띄운다.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

export const supabase = createClient<Database>(
  url || 'http://localhost:54321',
  anonKey || 'missing-anon-key',
)

/** 인증 메일·비밀번호 재설정 메일이 돌아올 주소 */
export function authRedirectTo(path = '/') {
  return new URL(path, window.location.origin).toString()
}

/** 로컬 세션에서 user id 를 꺼낸다. getUser() 와 달리 네트워크를 타지 않는다. */
export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('로그인이 필요합니다')
  return id
}
