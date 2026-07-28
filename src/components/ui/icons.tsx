/**
 * 필터 깔때기.
 *
 * 처음엔 유니코드 ⚲ 를 임시로 썼는데 돋보기도 깔때기도 아니어서 무엇인지 읽히지
 * 않았다. 적당한 문자가 없어서 SVG 로 그린다.
 */
export function FunnelIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M2.2 3.4h11.6L9.4 8.6v4.1l-2.8 1.4V8.6L2.2 3.4Z" />
    </svg>
  )
}

export function PlusIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      className={className}
      aria-hidden
    >
      <path d="M8 3.2v9.6M3.2 8h9.6" />
    </svg>
  )
}
