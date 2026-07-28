import { FunnelIcon } from '@/components/ui/icons'
import { formatAmount } from '@/lib/format'
import type { Category, CategoryType } from '@/types/database'

/**
 * 내역 화면의 필터 — 토글 버튼 · 패널 · 요약 칩.
 *
 * Transactions.tsx 가 273줄에 6가지 일을 하고 있어서 떼어냈다.
 */

export function FilterToggleButton({
  open,
  active,
  onClick,
}: {
  open: boolean
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      aria-label="필터"
      aria-expanded={open}
      className={`grid size-9 place-items-center rounded-control hover:bg-surface-3 ${
        active ? 'text-ink' : 'text-ink-muted'
      }`}
    >
      <FunnelIcon className="size-4" />
    </button>
  )
}

const TYPE_FILTERS = [
  { value: null, label: '전체' },
  { value: 'income' as const, label: '수입' },
  { value: 'expense' as const, label: '지출' },
]

export function FilterPanel({
  type,
  categoryId,
  options,
  onChange,
}: {
  type: CategoryType | null
  categoryId: string | null
  /** 그 달에 거래가 있는 카테고리만 (기획서 §3.5) */
  options: Category[]
  onChange: (patch: { type?: CategoryType | null; category?: string | null }) => void
}) {
  return (
    <div className="mt-3 space-y-2 rounded-card bg-surface-2 p-3">
      <div className="flex gap-1">
        {TYPE_FILTERS.map((o) => (
          <button
            key={o.label}
            onClick={() => onChange({ type: o.value })}
            className={`flex-1 rounded-control py-1.5 text-label transition ${
              (type ?? null) === o.value ? 'bg-accent text-white' : 'bg-surface text-ink-2'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <select
        value={categoryId ?? ''}
        onChange={(e) => onChange({ category: e.target.value || null })}
        className="w-full rounded-control border border-line-2 bg-surface px-2.5 py-2 text-label text-ink outline-none"
      >
        <option value="">카테고리 전체</option>
        {options.map((c) => (
          <option key={c.id} value={c.id}>
            {c.emoji} {c.name}
            {c.deleted_at ? ' (삭제됨)' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

export function FilterChip({
  type,
  category,
  count,
  sum,
  onClear,
}: {
  type: CategoryType | null
  category: Category | undefined
  count: number
  sum: number
  onClear: () => void
}) {
  const parts = [
    category && `${category.emoji} ${category.name}`,
    type === 'income' ? '수입' : type === 'expense' ? '지출' : null,
    `${count}건`,
    `${formatAmount(sum)}원`,
  ].filter(Boolean)

  return (
    <div className="mt-3 flex items-center gap-2 text-label">
      <span className="rounded-control bg-accent px-2.5 py-1 text-white">{parts.join(' · ')}</span>
      <button onClick={onClear} className="text-ink-muted hover:text-ink" aria-label="필터 해제">
        ✕
      </button>
    </div>
  )
}
