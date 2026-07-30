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

/*
  하단 탭 아이콘.

  이모지(📋 📊 ⚙️)를 쓰고 있었다. 화면의 나머지는 무채색·절제된 타이포로 통제돼
  있는데 내비게이션만 여러 색이 섞인 그림이라 유독 튀었고, 이모지는 OS 마다 모양이
  달라서 디자인이 통제되지 않았다(Windows·iOS·Android 가 각각 다르다).

  카테고리 이모지는 그대로 둔다 — 그건 사용자가 고른 **데이터**다. 여기는 제품의 옷이다.

  선 굵기·둥근 끝은 FunnelIcon·PlusIcon 과 같은 값을 쓴다.
*/
const NAV = {
  viewBox: '0 0 20 20',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

/** 내역 — 줄이 그어진 목록 */
export function ListIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...NAV} className={className} aria-hidden>
      <path d="M7 5.5h8.5M7 10h8.5M7 14.5h8.5M4 5.5h.01M4 10h.01M4 14.5h.01" />
    </svg>
  )
}

/** 통계 — 길이가 다른 막대 세 개. 통계 화면의 가로 막대와 같은 뜻이다. */
export function ChartIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...NAV} className={className} aria-hidden>
      <path d="M4 5.5h11M4 10h7.5M4 14.5h4" />
    </svg>
  )
}

/** 설정 — 슬라이더. 톱니바퀴보다 선이 적어 12px 에서도 뭉치지 않는다. */
export function SlidersIcon({ className = '' }: { className?: string }) {
  return (
    <svg {...NAV} className={className} aria-hidden>
      <path d="M3.5 6.5h13M3.5 13.5h13" />
      <circle cx="8" cy="6.5" r="2" />
      <circle cx="13" cy="13.5" r="2" />
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
