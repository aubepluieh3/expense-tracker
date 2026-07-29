/**
 * 두세 개 중 하나를 고르는 토글.
 *
 * 거래 등록의 지출/수입 토글과 카테고리 관리의 지출/수입 탭이 클래스 문자열까지
 * 똑같이 복붙돼 있었다.
 *
 * radiogroup / radio + aria-checked 를 쓴다. 처음에 aria-pressed 를 붙였는데
 * 그건 on/off 토글용이라 "그룹에서 하나를 고른다"는 사실이 스크린리더에
 * 전달되지 않는다. 그리고 카테고리 칩이 이미 aria-pressed 를 쓰고 있어서,
 * "선택된 칩" 을 찾는 셀렉터에 세그먼트 버튼이 섞여 들어갔다.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  /** 스크린리더용 그룹 이름 */
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex gap-1 rounded-control bg-surface-3 p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => {
            if (o.value !== value) onChange(o.value)
          }}
          // 고르지 않은 쪽도 ink-2 다. ink-muted(#a3a3a3) 는 placeholder·보조
          // 수치용 회색이라, 옅은 트랙 위에 얹으니 "수입" 이 비활성 버튼처럼
          // 보였다 — 지출/수입은 둘 다 언제나 누를 수 있는 선택지다.
          className={`flex-1 rounded-control py-2 text-label transition ${
            value === o.value ? 'bg-surface font-medium text-ink shadow-sm' : 'text-ink-2'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** 지출/수입은 앱 전체에서 같은 순서·같은 라벨로 쓴다. */
export const TYPE_OPTIONS = [
  { value: 'expense', label: '지출' },
  { value: 'income', label: '수입' },
] as const
