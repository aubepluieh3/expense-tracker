import { createContext, use, useEffect, useMemo, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'

type AuthValue = {
  session: Session | null
  user: User | null
  /** 최초 세션 확인이 끝나기 전까지 true. 이 사이에 렌더하면 로그인 화면이 깜빡인다. */
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  /**
   * 캐시를 버릴 시점을 판단하는 기준. undefined = 아직 모름, null = 비로그인.
   *
   * RLS 가 서버 쪽 격리를 완벽하게 해 주지만 React Query 캐시는 그 바깥이다.
   * queryClient 는 모듈 싱글턴이라 로그아웃해도 살아남고, staleTime 이 30초라
   * 같은 탭에서 A 로그아웃 → B 로그인 하면 B 가 A 의 거래·카테고리·닉네임을
   * 그대로 본다(리페치조차 안 걸린다). 공용 PC 를 쓰는 가계부라 현실적인 경로다.
   *
   * 이벤트 이름(SIGNED_OUT)이 아니라 user.id 의 변화를 본다 — 토큰 갱신은
   * 같은 id 라서 캐시를 살려야 하고, 메일 링크로 다른 계정 세션이 들어오는
   * 경로는 SIGNED_OUT 없이 사용자가 바뀐다. id 만 보면 둘이 한 규칙에 담긴다.
   */
  const knownUserId = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    let mounted = true

    /** 첫 이벤트는 "바뀐 것"이 아니므로 버리지 않는다. */
    function trackUser(next: Session | null) {
      const nextId = next?.user.id ?? null
      if (knownUserId.current !== undefined && knownUserId.current !== nextId) {
        queryClient.clear()
      }
      knownUserId.current = nextId
    }

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      trackUser(data.session)
      setSession(data.session)
      setLoading(false)
    })

    // 로그인·로그아웃·토큰 갱신, 그리고 메일 링크로 들어온 세션까지 여기로 들어온다.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      trackUser(next)
      setSession(next)
      setLoading(false)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signOut: async () => {
        await supabase.auth.signOut()
      },
    }),
    [session, loading],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}

export function useAuth() {
  const ctx = use(AuthContext)
  if (!ctx) throw new Error('useAuth 는 AuthProvider 안에서만 쓸 수 있습니다.')
  return ctx
}
