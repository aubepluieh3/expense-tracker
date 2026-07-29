import { createContext, use } from 'react'
import type { Session, User } from '@supabase/supabase-js'

/**
 * 컨텍스트와 훅만 여기 둔다. Provider 컴포넌트는 AuthProvider.tsx 다.
 *
 * 나누는 이유는 HMR 이다. 컴포넌트 파일이 컴포넌트 아닌 것을 함께 export 하면
 * react-refresh 가 그 파일의 갱신을 포기하고 전체 리로드로 떨어진다 —
 * AuthProvider.tsx 를 고칠 때마다 로그인 상태를 들고 있는 트리가 통째로 다시
 * 마운트된다는 뜻이다. 실제로 린터가 이 파일을 만들기 전까지 경고하고 있었다.
 */
export type AuthValue = {
  session: Session | null
  user: User | null
  /** 최초 세션 확인이 끝나기 전까지 true. 이 사이에 렌더하면 로그인 화면이 깜빡인다. */
  loading: boolean
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth() {
  const ctx = use(AuthContext)
  if (!ctx) throw new Error('useAuth 는 AuthProvider 안에서만 쓸 수 있습니다.')
  return ctx
}
