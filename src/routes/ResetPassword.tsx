import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/authContext'
import { NewPasswordForm } from '@/auth/NewPasswordForm'
import { AuthLayout } from '@/components/AuthLayout'
import { TextLink } from '@/components/ui/TextLink'
import { FullScreenSpinner } from '@/components/ui/FullScreenSpinner'

/**
 * 메일의 재설정 링크로 진입한다.
 * supabase-js 가 URL 의 토큰을 자동으로 처리해 세션을 만들고,
 * AuthProvider 의 onAuthStateChange 가 그걸 받는다. 세션이 있어야 변경이 가능하다.
 */
export default function ResetPassword() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()

  if (loading) return <FullScreenSpinner />

  if (!session) {
    return (
      <AuthLayout
        title="링크가 유효하지 않습니다"
        description="재설정 링크가 만료되었거나 이미 사용되었습니다. 다시 요청해 주세요."
        footer={<TextLink to="/forgot-password">재설정 메일 다시 받기</TextLink>}
      >
        <></>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="새 비밀번호 설정">
      <NewPasswordForm onDone={() => navigate('/', { replace: true })} />
    </AuthLayout>
  )
}
