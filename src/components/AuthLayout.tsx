/**
 * 인증 화면(로그인·가입·비밀번호) 공통 껍데기.
 *
 * 에러·안내 박스는 ui/Callout 으로 옮겼다. 여기 있던 FormError·FormNotice 는
 * 목록 로딩 실패(ErrorState)와 생김새가 달라서, 같은 "에러"인데 화면마다
 * 다르게 보이는 원인이었다.
 */
export function AuthLayout({
  title,
  description,
  children,
  footer,
}: {
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[420px] flex-col justify-center px-6 py-12">
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      {description && <p className="mt-2 text-label text-ink-2">{description}</p>}
      <div className="mt-8">{children}</div>
      {footer && <div className="mt-6 text-center text-label">{footer}</div>}
    </main>
  )
}
