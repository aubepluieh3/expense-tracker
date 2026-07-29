import { useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import { AuthContext, type AuthValue } from '@/auth/authContext'

/** 컨텍스트와 useAuth 는 authContext.ts 다 — 이 파일은 컴포넌트만 export 한다(HMR). */
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

    /**
     * 거부(reject)를 처리한다. 이전에는 .then 하나뿐이어서, getSession() 이 실패하면
     * setLoading(false) 에 도달하지 못했다 — loading 이 true 인 동안 두 가드가 모두
     * FullScreenSpinner 를 돌리므로(auth/guards.tsx) 앱이 스피너에서 멈춘다.
     *
     * 실제로는 supabase-js 가 구독 직후 INITIAL_SESSION 을 쏘기 때문에 아래
     * onAuthStateChange 가 loading 을 풀어 줄 때가 많다. 그건 이 코드가 의도한
     * 복구 경로가 아니라 우연이고, 그동안 거부는 unhandled 로 남는다.
     * 로딩을 끝내는 책임을 두 경로 각각이 갖게 한다.
     */
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!mounted) return
        trackUser(data.session)
        setSession(data.session)
      })
      .catch((e: unknown) => {
        // 세션을 못 읽었으면 비로그인으로 취급한다. 가드가 로그인 화면으로 보낸다.
        console.error('세션 조회 실패', e)
      })
      .finally(() => {
        if (mounted) setLoading(false)
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
