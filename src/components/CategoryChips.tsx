import { useState } from 'react'
import type { Category } from '@/types/database'

const VISIBLE = 8

/** "최근" 줄에 놓는 칸 수. 4열 중 3칸만 채워 아래 그리드와 다른 줄임이 보이게 한다. */
const RECENT = 3

/**
 * 드롭다운이 아니라 칩 그리드인 이유: 드롭다운은 열기→스크롤→선택 3동작인데 그리드는 1동작이다.
 * 8개까지만 노출하고 나머지는 접는다 — 카테고리 개수 자체에는 제한이 없다.
 *
 * 그리드 순서는 생성순 고정이다. 사용 빈도순·최근순으로 그리드를 재정렬하면
 * 저장할 때마다 칩 위치가 바뀌는데, 자주 쓰는 두세 개가 서로 앞자리를 왕복하므로
 * 가장 많이 쓰는 구간이 가장 불안정해진다. 익숙한 자리를 안 보고 누른 사람은
 * 다른 카테고리로 저장하고도 알아채지 못한다 — 에러 없이 통계만 틀어진다.
 *
 * 대신 최근 쓴 것만 위에 따로 한 줄로 복사한다. 그리드는 움직이지 않고,
 * "윗줄 = 최근"이라는 규칙 자체는 고정이라 여기에도 근육 기억이 생긴다.
 * 직접 추가해 더보기 뒤로 밀린 카테고리도 한 번 쓰면 윗줄로 올라온다.
 */
export function CategoryChips({
  categories,
  recent = [],
  value,
  onChange,
}: {
  categories: Category[]
  /**
   * 최근 사용순 전체. 몇 개를 노출할지는 이 컴포넌트가 정한다 — 한 줄에 몇 칸이
   * 들어가는지는 그리드를 그리는 쪽만 안다.
   * 아래 그리드와 겹쳐도 그대로 둔다. 규칙이 한 줄이어야 예측된다.
   */
  recent?: Category[]
  value: string | null
  onChange: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const overflow = categories.length > VISIBLE
  // 더보기 버튼도 한 칸을 차지한다. VISIBLE 개를 그대로 자르면 4열 그리드가
  // 9칸이 되어 마지막 줄에 한 칸만 남았다.
  const shown = expanded || !overflow ? categories : categories.slice(0, VISIBLE - 1)
  const recentShown = recent.slice(0, RECENT)

  return (
    <div className="space-y-3">
      {recentShown.length > 0 && (
        <div>
          <p className="mb-1 text-caption text-ink-muted">최근</p>
          {/* 아래 그리드와 같은 4열이라 열이 맞는다. 줄이 따로인 게 의도로 읽힌다. */}
          <div role="group" aria-label="최근 사용한 카테고리" className="grid grid-cols-4 gap-1.5">
            {recentShown.map((c) => (
              <Chip key={c.id} category={c} selected={c.id === value} onSelect={onChange} />
            ))}
          </div>
        </div>
      )}

      <div role="group" aria-label="카테고리" className="grid grid-cols-4 gap-1.5">
        {shown.map((c) => (
          <Chip key={c.id} category={c} selected={c.id === value} onSelect={onChange} />
        ))}

        {overflow && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex flex-col items-center justify-center gap-0.5 rounded-control px-1 py-2.5 text-caption text-ink-muted hover:bg-surface-3"
          >
            <span aria-hidden className="text-xl">
              ⋯
            </span>
            더보기
          </button>
        )}
      </div>

      {categories.length === 0 && (
        <p className="py-4 text-center text-label text-ink-muted">
          카테고리가 없습니다. 설정에서 추가해 주세요.
        </p>
      )}
    </div>
  )
}

/**
 * radio 가 아니라 aria-pressed 를 쓴다. 최근 줄과 그리드에 같은 카테고리가 동시에
 * 나올 수 있는데, radiogroup 이라면 checked 인 radio 가 둘이 되어 규격에 어긋난다.
 * 토글 두 개가 같은 상태를 비추는 것은 정상이다.
 */
function Chip({
  category,
  selected,
  onSelect,
}: {
  category: Category
  selected: boolean
  onSelect: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(category.id)}
      aria-pressed={selected}
      // 선택 표시는 세 채널을 겹친다 — 배경(면적) · 링(윤곽) · 글자 굵기.
      // 링 하나만 쓰면 4열 그리드의 작은 칩에서 이모지에 묻혀 안 보인다.
      // 배경을 검게 칠하지 않는 이유: 이모지는 자체 색을 가진 그림이라
      // 어두운 배경 위에서 대비가 무너진다.
      className={`flex flex-col items-center gap-0.5 rounded-control px-1 py-2.5 transition ${
        selected ? 'bg-selected ring-2 ring-ink' : 'hover:bg-surface-3'
      }`}
    >
      <span aria-hidden className="text-xl">
        {category.emoji}
      </span>
      <span
        className={`w-full truncate text-center text-caption ${
          selected ? 'font-semibold text-ink' : 'text-ink-2'
        }`}
      >
        {category.name}
      </span>
    </button>
  )
}
