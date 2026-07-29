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

/**
 * 행 안의 부수 동작 (수정 / 삭제). 4곳에 반복돼 있던 스타일.
 *
 * danger 는 **평상시에** 빨갛다. 이전에는 빨강이 hover: 에만 걸려 있었는데,
 * 터치 기기에는 hover 가 없다. 그래서 모바일에서 카테고리 목록 열 줄 내내
 * `수정  삭제` 가 똑같은 회색으로 나란히 있었고, 파괴적인 쪽이 오른쪽에 붙어
 * 있다는 것 외에 구분할 신호가 없었다. 색은 눌러 보기 전에 보여야 뜻이 있다.
 *
 * 탭 타깃도 넓혔다. text-caption + px-2 py-1 은 24px 높이라 44px 권장치의
 * 절반이었고, 옆 버튼이 되돌릴 수 없는 동작이면 오탭 한 번의 값이 비싸다.
 */
export function SubtleButton({
  children,
  className = '',
  tone = 'default',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: 'default' | 'danger' }) {
  return (
    <button
      className={`rounded-control px-2.5 py-2 text-label transition ${
        tone === 'danger'
          ? 'text-danger hover:bg-danger-soft'
          : 'text-ink-2 hover:bg-surface-3 hover:text-ink'
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}
