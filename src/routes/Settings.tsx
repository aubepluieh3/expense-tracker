import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { Page } from '@/components/AppLayout'
import { Button } from '@/components/ui/Button'
import { useProfile } from '@/hooks/useCategories'

/** 비밀번호 변경은 설정 화면을 제대로 다듬을 때 붙인다 (updateUser 한 줄). */
export default function Settings() {
  const { user, signOut } = useAuth()
  const profile = useProfile()

  return (
    <Page title="설정">
      <div className="space-y-6">
        <div className="text-sm">
          <p className="text-neutral-500">닉네임</p>
          <p className="mt-1 text-neutral-900">{profile.data?.nickname ?? '…'}</p>
          <p className="mt-3 text-neutral-500">이메일</p>
          <p className="mt-1 text-neutral-900">{user?.email}</p>
        </div>

        <ul className="divide-y divide-neutral-100 border-y border-neutral-100">
          <li>
            <Link
              to="/settings/categories"
              className="flex items-center justify-between py-3.5 text-[15px] text-neutral-900"
            >
              카테고리 관리
              <span className="text-neutral-400">›</span>
            </Link>
          </li>
        </ul>

        <Button variant="ghost" onClick={() => void signOut()}>
          로그아웃
        </Button>
      </div>
    </Page>
  )
}
