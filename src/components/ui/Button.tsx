type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'outline' | 'ghost' | 'danger'
  /** block = 폼 제출용 전체 폭, inline = 문장·행 안의 동작 */
  size?: 'block' | 'inline'
  loading?: boolean
}

/**
 * 앱의 유일한 버튼.
 *
 * 이전에는 primary/ghost 두 종류뿐이라 ErrorState 의 "다시 시도"와 삭제 버튼이
 * 각자 인라인 스타일을 썼고, 결과적으로 버튼 모양이 다섯 가지가 됐다.
 * outline 과 danger 를 넣어 전부 흡수한다.
 */
const VARIANT = {
  primary: 'bg-accent text-white hover:bg-accent-hover',
  outline: 'border border-line-2 text-ink hover:bg-surface-3',
  ghost: 'text-ink-2 hover:bg-surface-3',
  danger: 'bg-danger text-white hover:brightness-110',
} as const

const SIZE = {
  block: 'w-full px-4 py-3',
  inline: 'px-3 py-1.5',
} as const

export function Button({
  variant = 'primary',
  size = 'block',
  loading,
  children,
  className = '',
  ...rest
}: Props) {
  return (
    <button
      className={`rounded-control text-label font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT[variant]} ${SIZE[size]} ${className}`}
      disabled={loading || rest.disabled}
      {...rest}
    >
      {loading ? '처리 중…' : children}
    </button>
  )
}

/** 문장 안에서 다른 화면으로 보내는 링크. 인증 화면 4곳에 반복돼 있던 스타일. */
export function TextLink({
  children,
  className = '',
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={`font-medium text-ink underline ${className}`} {...rest}>
      {children}
    </a>
  )
}

/** 행 안의 부수 동작 (수정 / 삭제 / 닫기). 4곳에 반복돼 있던 스타일. */
export function SubtleButton({
  children,
  className = '',
  tone = 'default',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'default' | 'danger' }) {
  return (
    <button
      className={`rounded-control px-2 py-1 text-caption transition ${
        tone === 'danger'
          ? 'text-ink-muted hover:bg-danger-soft hover:text-danger'
          : 'text-ink-muted hover:bg-surface-3 hover:text-ink'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
