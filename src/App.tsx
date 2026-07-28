import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { isSupabaseConfigured } from '@/lib/supabase'
import { ProtectedRoute, PublicOnlyRoute } from '@/auth/guards'
import { AppLayout } from '@/components/AppLayout'
import { AuthLayout } from '@/components/AuthLayout'
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner'

/**
 * 라우트 단위로 코드를 나눈다.
 * 로그인 화면이 통계·거래 코드까지 전부 받아올 이유가 없다.
 */
const Login = lazy(() => import('@/routes/Login'))
const Signup = lazy(() => import('@/routes/Signup'))
const ForgotPassword = lazy(() => import('@/routes/ForgotPassword'))
const ResetPassword = lazy(() => import('@/routes/ResetPassword'))
const Transactions = lazy(() => import('@/routes/Transactions'))
const Stats = lazy(() => import('@/routes/Stats'))
const Settings = lazy(() => import('@/routes/Settings'))
const Categories = lazy(() => import('@/routes/Categories'))

export default function App() {
  if (!isSupabaseConfigured) return <MissingEnv />

  return (
    <Suspense fallback={<FullScreenSpinner />}>
      <Routes>
        {/* 비로그인 전용 */}
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
        </Route>

        {/*
          재설정 화면은 가드를 걸지 않는다.
          메일 링크로 들어오면 이미 세션이 있어서, 비로그인 전용으로 묶으면 비밀번호를 못 바꾼다.
        */}
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* 로그인 필요 */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Transactions />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/categories" element={<Categories />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

function MissingEnv() {
  return (
    <AuthLayout title="환경변수가 없습니다">
      <p className="text-sm text-neutral-600">
        <code className="rounded bg-neutral-100 px-1.5 py-0.5">.env.example</code> 을 복사해{' '}
        <code className="rounded bg-neutral-100 px-1.5 py-0.5">.env.local</code> 을 만들고 Supabase
        프로젝트의 URL 과 anon key 를 채운 뒤 dev 서버를 다시 시작하세요.
      </p>
    </AuthLayout>
  )
}
