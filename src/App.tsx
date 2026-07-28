import { Navigate, Route, Routes } from 'react-router-dom'
import { isSupabaseConfigured } from '@/lib/supabase'
import { ProtectedRoute, PublicOnlyRoute } from '@/auth/guards'
import { AppLayout } from '@/components/AppLayout'
import { AuthLayout } from '@/components/AuthLayout'
import Login from '@/routes/Login'
import Signup from '@/routes/Signup'
import ForgotPassword from '@/routes/ForgotPassword'
import ResetPassword from '@/routes/ResetPassword'
import Transactions from '@/routes/Transactions'
import Stats from '@/routes/Stats'
import Settings from '@/routes/Settings'
import Categories from '@/routes/Categories'

export default function App() {
  if (!isSupabaseConfigured) return <MissingEnv />

  return (
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
