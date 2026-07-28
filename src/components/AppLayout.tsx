import { NavLink, Outlet } from 'react-router-dom'

/**
 * 로그인 후 공통 셸.
 * 모바일은 하단 탭, 데스크톱은 max-width 520px 중앙 정렬 (기획서 §2 반응형 전략).
 * 4단계에서 내역 화면과 함께 다듬는다.
 */

const TABS = [
  { to: '/', label: '내역', icon: '📋' },
  { to: '/stats', label: '통계', icon: '📊' },
  { to: '/settings', label: '설정', icon: '⚙️' },
] as const

export function AppLayout() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col">
      <main className="flex-1 pb-24">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 mx-auto max-w-[520px] border-t border-neutral-200 bg-white">
        <ul className="grid grid-cols-3">
          {TABS.map((tab) => (
            <li key={tab.to}>
              <NavLink
                to={tab.to}
                end={tab.to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-0.5 py-2.5 text-xs ${
                    isActive ? 'text-neutral-900' : 'text-neutral-400'
                  }`
                }
              >
                <span aria-hidden className="text-base">
                  {tab.icon}
                </span>
                {tab.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

export function Page({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <section className="px-5 py-6">
      <h1 className="text-lg font-semibold text-neutral-900">{title}</h1>
      <div className="mt-4">{children}</div>
    </section>
  )
}
