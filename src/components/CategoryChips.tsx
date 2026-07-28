import { useState } from 'react'
import type { Category } from '@/types/database'

const VISIBLE = 8

/**
 * 드롭다운이 아니라 칩 그리드인 이유: 드롭다운은 열기→스크롤→선택 3동작인데 그리드는 1동작이다.
 * 8개까지만 노출하고 나머지는 접는다 — 카테고리 개수 자체에는 제한이 없다.
 */
export function CategoryChips({
  categories,
  value,
  onChange,
}: {
  categories: Category[]
  value: string | null
  onChange: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const overflow = categories.length > VISIBLE
  const shown = expanded || !overflow ? categories : categories.slice(0, VISIBLE)

  return (
    <div>
      <div className="grid grid-cols-4 gap-1.5">
        {shown.map((c) => {
          const selected = c.id === value
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onChange(c.id)}
              aria-pressed={selected}
              // 선택 표시는 세 채널을 겹친다 — 배경(면적) · 링(윤곽) · 글자 굵기.
              // 링 하나만 쓰면 4열 그리드의 작은 칩에서 이모지에 묻혀 안 보인다.
              // 배경을 검게 칠하지 않는 이유: 이모지는 자체 색을 가진 그림이라
              // 어두운 배경 위에서 대비가 무너진다.
              className={`flex flex-col items-center gap-0.5 rounded-xl px-1 py-2.5 transition ${
                selected
                  ? 'bg-neutral-200 ring-2 ring-neutral-900'
                  : 'hover:bg-neutral-100'
              }`}
            >
              <span aria-hidden className="text-xl">
                {c.emoji}
              </span>
              <span
                className={`w-full truncate text-center text-xs ${
                  selected ? 'font-semibold text-neutral-900' : 'text-neutral-700'
                }`}
              >
                {c.name}
              </span>
            </button>
          )
        })}

        {overflow && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="flex flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-2.5 text-xs text-neutral-500 hover:bg-neutral-100"
          >
            <span aria-hidden className="text-xl">
              ⋯
            </span>
            더보기
          </button>
        )}
      </div>

      {categories.length === 0 && (
        <p className="py-4 text-center text-sm text-neutral-400">
          카테고리가 없습니다. 설정에서 추가해 주세요.
        </p>
      )}
    </div>
  )
}
