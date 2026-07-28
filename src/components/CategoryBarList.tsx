import { useEffect, useState } from 'react'
import { formatAmount } from '@/lib/format'
import { rowEmojiClass } from '@/components/ui/List'
import type { CategoryStatRow } from '@/types/database'

/**
 * 카테고리별 지출 — 100% 스택 바 + 가로 막대 목록.
 *
 * 차트 라이브러리를 쓰지 않는다. 그리는 게 사각형 두 종류뿐이라 축·격자·툴팁·좌표
 * 변환이 필요 없고, div 로 하면 라운딩·간격·진입 애니메이션·hover 강조·한글 truncate 를
 * CSS 로 그대로 통제할 수 있다.
 *
 * 막대 길이는 최댓값 기준으로 정규화한다(합계 기준이 아니라). 이 화면에서 사용자가
 * 하려는 일은 "어디에 제일 많이 썼나"라서 순위 판별이 우선이다. 전체 대비 비중은
 * 상단 스택 바와 % 숫자가 담당한다.
 *
 * "상위 7개 + 기타" 묶기는 이 파일 안에서만 안다. 이전에는 buildSlices 를
 * export 해서 화면이 결과를 두 컴포넌트에 각각 넘겼는데, 호출자가 내부 규칙을
 * 알아야 하는 구조였다.
 */

const TOP = 7

/**
 * 순위 기반 단일 색조 램프 (파랑 진 → 연).
 *
 * 카테고리마다 다른 색(8색 팔레트)을 주지 않는 이유: 이 목록은 이모지와 이름이
 * 이미 정체성을 담당한다. 색이 그 일을 맡지 않으면 색은 순위를 나를 수 있다.
 * 가장 옅은 단계도 흰 배경에서 2:1 대비를 넘는다(ordinal 램프 하한).
 */
const RAMP = [
  '#184f95',
  '#1c5cab',
  '#256abf',
  '#2a78d6',
  '#3987e5',
  '#5598e7',
  '#6da7ec',
  '#86b6ef',
] as const

/** "기타"는 팔레트 밖 무채색으로 빼서 묶음임을 표시한다. */
const OTHER_COLOR = '#b8b8b3'

/** 항목 수에 맞춰 램프를 고르게 훑는다. 3개뿐일 때 어두운 쪽에 몰리지 않도록. */
function rampColor(index: number, count: number) {
  if (count <= 1) return RAMP[0]
  return RAMP[Math.round((index * (RAMP.length - 1)) / (count - 1))]
}

/**
 * 판별 유니온으로 "기타"를 표현한다.
 * 이전에는 id: string | null 로 sentinel 을 만들어서, 호출할 때마다 s.id! 로
 * 타입 시스템을 우회해야 했다.
 */
type Slice =
  | { kind: 'category'; id: string; name: string; emoji: string; color: string; total: number }
  | { kind: 'other'; count: number; color: string; total: number }

function buildSlices(rows: CategoryStatRow[]): { slices: Slice[]; rest: Slice[] } {
  const topRows = rows.slice(0, TOP)
  const restRows = rows.slice(TOP)

  const toSlice = (r: CategoryStatRow, color: string): Slice => ({
    kind: 'category',
    id: r.category_id,
    name: r.name,
    emoji: r.emoji,
    color,
    total: r.total,
  })

  const top = topRows.map((r, i) => toSlice(r, rampColor(i, topRows.length)))
  // 기타 안의 항목은 색을 주지 않는다. 주면 한 화면에 8색을 넘는다.
  const rest = restRows.map((r) => toSlice(r, OTHER_COLOR))

  if (rest.length === 0) return { slices: top, rest: [] }

  return {
    slices: [
      ...top,
      {
        kind: 'other',
        count: rest.length,
        color: OTHER_COLOR,
        total: rest.reduce((s, r) => s + r.total, 0),
      },
    ],
    rest,
  }
}

/** 진입 시 0 → 목표 너비로 자라나게 한다. 정적인 막대보다 데이터가 살아 보인다. */
function useGrow() {
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return grown
}

export function CategoryChart({
  rows,
  total,
  onSelect,
}: {
  rows: CategoryStatRow[]
  total: number
  onSelect: (categoryId: string) => void
}) {
  const { slices, rest } = buildSlices(rows)
  return (
    <>
      <StackBar slices={slices} />
      <BarList slices={slices} rest={rest} total={total} onSelect={onSelect} />
    </>
  )
}

/** 스택 바만 따로 필요한 곳(대표 숫자 아래)에서 쓴다. */
export function StackBar({ slices }: { slices: Slice[] }) {
  const grown = useGrow()

  // 카테고리가 하나뿐이면 전체가 한 색이라 정보가 없다.
  if (slices.length < 2) return null

  return (
    <div
      className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-surface-3 transition-opacity duration-500"
      style={{ opacity: grown ? 1 : 0 }}
      aria-hidden
    >
      {slices.map((s) => (
        <div
          key={s.kind === 'other' ? 'other' : s.id}
          style={{ flexGrow: s.total, backgroundColor: s.color }}
        />
      ))}
    </div>
  )
}

function BarList({
  slices,
  rest,
  total,
  onSelect,
}: {
  slices: Slice[]
  rest: Slice[]
  total: number
  onSelect: (categoryId: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const grown = useGrow()
  const max = Math.max(...slices.map((s) => s.total), 1)

  return (
    <ul className="mt-5">
      {slices.map((s, i) => {
        const isOther = s.kind === 'other'
        const percent = total > 0 ? Math.round((s.total / total) * 100) : 0

        return (
          <li key={isOther ? 'other' : s.id}>
            <button
              onClick={() => (isOther ? setExpanded((v) => !v) : onSelect(s.id))}
              className="group w-full rounded-control px-1 py-2 text-left transition hover:bg-surface-2"
            >
              <div className="flex items-baseline gap-2">
                <span aria-hidden className={rowEmojiClass}>
                  {isOther ? '📦' : s.emoji}
                </span>
                {/* 기타는 항목이 아니라 묶음이다. 같은 무게로 그리면 동급으로 읽힌다. */}
                <span
                  className={`flex-1 truncate text-body ${isOther ? 'text-ink-muted' : 'text-ink'}`}
                >
                  {isOther ? '기타' : s.name}
                  {isOther && (
                    <span className="ml-1 text-caption text-ink-muted">
                      {s.count}개 {expanded ? '▴' : '▾'}
                    </span>
                  )}
                </span>
                <span className={`text-body tabular-nums ${isOther ? 'text-ink-muted' : 'text-ink'}`}>
                  {formatAmount(s.total)}
                </span>
                {/* 묶음의 비중은 정보가 약해서 % 를 비운다. */}
                <span className="w-9 text-right text-caption tabular-nums text-ink-muted">
                  {isOther ? '' : `${percent}%`}
                </span>
              </div>

              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-3">
                <div
                  className="h-full rounded-full transition-[width] duration-700 ease-out"
                  style={{
                    width: grown ? `${(s.total / max) * 100}%` : '0%',
                    backgroundColor: s.color,
                    transitionDelay: `${i * 40}ms`,
                  }}
                />
              </div>
            </button>

            {isOther && expanded && (
              <ul className="mb-1 ml-6 border-l border-line pl-3">
                {rest.map(
                  (r) =>
                    r.kind === 'category' && (
                      <li key={r.id}>
                        <button
                          onClick={() => onSelect(r.id)}
                          className="flex w-full items-baseline gap-2 rounded-control px-1 py-1.5 text-left transition hover:bg-surface-2"
                        >
                          <span aria-hidden className="text-label">
                            {r.emoji}
                          </span>
                          <span className="flex-1 truncate text-label text-ink-2">{r.name}</span>
                          <span className="text-label tabular-nums text-ink-2">
                            {formatAmount(r.total)}
                          </span>
                        </button>
                      </li>
                    ),
                )}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}
