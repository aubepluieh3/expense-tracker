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

/**
 * 인증 메일·비밀번호 재설정 메일이 돌아올 주소.
 *
 * origin 만으로 만들면 하위 경로에 배포했을 때 접두사가 빠진다 — 메일 링크가
 * `github.io/reset-password` 로 가서 레포 밖을 가리키고, 비밀번호 재설정이 404 로
 * 끝난다. BASE_URL 을 끼워서 만든다 (dev 에서는 '/' 라 결과가 같다).
 */
export function authRedirectTo(path = '/') {
  const base = new URL(import.meta.env.BASE_URL, window.location.origin)
  return new URL(path.replace(/^\//, ''), base).toString()
}

/** 로컬 세션에서 user id 를 꺼낸다. getUser() 와 달리 네트워크를 타지 않는다. */
export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession()
  const id = data.session?.user.id
  if (!id) throw new Error('로그인이 필요합니다')
  return id
}
