import { NavLink, Outlet } from 'react-router-dom'
import { ChartIcon, ListIcon, SlidersIcon } from '@/components/ui/icons'

/**
 * 로그인 후 공통 셸.
 *
 * 탭 위치가 화면 크기에 따라 다르다 (기획서 §2):
 *   모바일  하단 고정 — 엄지가 닿는 자리
 *   데스크톱 컬럼 상단 — 마우스가 화면 아래까지 내려갈 이유가 없고,
 *            520px 폭 막대가 큰 화면 아래에 잘린 채 떠 있으면 어색하다
 *
 * nav 를 DOM 상 main 보다 먼저 두고, 모바일에서만 fixed 로 띄운다.
 * 순서를 뒤집으면 데스크톱에서 탭이 아래로 내려간다.
 *
 * 화면 껍데기(Screen · Page)는 ui/Screen.tsx 에 있다 — 레이아웃과 다른 관심사다.
 */

const TABS = [
  { to: '/', label: '내역', Icon: ListIcon },
  { to: '/stats', label: '통계', Icon: ChartIcon },
  { to: '/settings', label: '설정', Icon: SlidersIcon },
] as const

export function AppLayout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col bg-surface sm:my-6 sm:min-h-[calc(100dvh-3rem)] sm:overflow-hidden sm:rounded-sheet sm:border sm:border-line-2 sm:shadow-sm">
      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[520px] border-t border-line-2 bg-surface sm:static sm:mx-0 sm:max-w-none sm:border-t-0 sm:border-b">
        <ul className="grid grid-cols-3">
          {TABS.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2.5 text-caption transition sm:flex-row sm:justify-center sm:gap-1.5 sm:py-3 sm:text-label ${
                    isActive ? 'text-ink sm:font-medium' : 'text-ink-muted sm:hover:text-ink-2'
                  }`
                }
              >
                <tab.Icon className="size-5 sm:size-4" />
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* 모바일은 하단 탭 높이만큼 여백이 필요하지만 데스크톱은 탭이 위에 있다. */}
      <main className="flex-1 pb-24 sm:overflow-y-auto sm:pb-8">
        <Outlet />
      </main>
    </div>
  )
}
