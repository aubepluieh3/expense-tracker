import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/auth/authContext'
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner'

/** 로그인이 필요한 경로 */
export function ProtectedRoute() {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenSpinner />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}

/**
 * 비로그인 전용 경로 (로그인·회원가입·비밀번호 찾기).
 *
 * /reset-password 는 여기에 넣지 않는다 — 메일 링크로 들어오면 이미 세션이 있는 상태라
 * 막아 버리면 비밀번호를 바꿀 수 없다.
 */
export function PublicOnlyRoute() {
  const { session, loading } = useAuth()

  if (loading) return <FullScreenSpinner />
  if (session) return <Navigate to="/" replace />
  return <Outlet />
}
