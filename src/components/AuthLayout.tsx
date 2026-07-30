import { GUIDE_PATH } from '@/lib/links'

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
      {/*
        앱 이름. 이게 없는 동안 로그인 화면에 있는 글자는 "로그인" 하나뿐이었다 —
        무엇에 가입하는지 모른 채 이메일과 비밀번호를 넣게 된다. 로그인은 앱을
        처음 만나는 화면이고, 여기서 이름을 안 말하면 말할 곳이 없다.

        제목보다 작게 둔다. 이 화면에서 사용자가 할 일은 로그인이지 브랜드
        감상이 아니다 — 이름이 제목을 이기면 "로그인" 을 찾는 데 시간이 걸린다.
      */}
      <p className="text-label font-semibold text-ink-muted">가계부</p>
      <h1 className="mt-1 text-title font-semibold text-ink">{title}</h1>
      {description && <p className="mt-2 text-label text-ink-2">{description}</p>}
      <div className="mt-8">{children}</div>
      {footer && <div className="mt-6 text-center text-label">{footer}</div>}

      {/*
        설명서. 로그인 전 화면에 둔다.

        처음에는 설정 화면에만 넣었는데, 설정은 로그인 뒤에 있어서 가입 전 사람은
        볼 방법이 없었다 — 무엇에 가입하는지 확인하려는 사람이 정확히 못 보는 자리다.
        여기 두면 로그인·가입·비밀번호 화면 전부에서 닿는다.

        라우터가 다루지 않는 정적 문서라 <Link> 가 아니라 <a> 다. 새 탭으로 연다 —
        입력하던 이메일·비밀번호를 잃지 않는다.
      */}
      <p className="mt-8 text-center">
        <a
          href={GUIDE_PATH}
          target="_blank"
          rel="noreferrer"
          // 다른 보조 링크와 같은 크기(text-label)를 쓴다. 12px 이던 동안 같은 층의
          // 링크 세 개가 14/14/12 로 갈려 위계가 없는데 크기만 달랐다.
          className="text-label text-ink-muted underline"
        >
          이 앱은 무엇인가요?
        </a>
      </p>
    </main>
  )
}
