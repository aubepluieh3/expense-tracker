import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MonthNavigator } from '@/components/MonthNavigator'
import { SalaryWidget } from '@/components/SalaryWidget'
import { MonthSummary } from '@/components/MonthSummary'
import { TransactionFormSheet } from '@/components/TransactionFormSheet'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states'
import { useMonthParam } from '@/hooks/useMonthParam'
import { useAllCategories } from '@/hooks/useCategories'
import { useMonthTransactions, useTransaction, type TransactionListItem } from '@/hooks/useTransactions'
import { dayLabel } from '@/lib/month'
import { formatAmount } from '@/lib/format'
import type { Category, CategoryType } from '@/types/database'

export default function Transactions() {
  const [month, setMonth] = useMonthParam()
  const [params, setParams] = useSearchParams()
  const [filterOpen, setFilterOpen] = useState(false)

  const typeFilter = params.get('type') as CategoryType | null
  const categoryFilter = params.get('category')
  const isNew = params.get('new') === '1'
  const editId = params.get('edit')

  const tx = useMonthTransactions(month)
  const categories = useAllCategories()

  const byId = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c])),
    [categories.data],
  )

  const all = tx.data ?? []

  /**
   * 필터 목록은 "그 달에 거래가 있는 카테고리"로 채운다 (기획서 §3.5).
   * 활성 카테고리로 채우면 삭제된 카테고리의 과거 거래를 필터로 찾을 방법이 없어진다.
   */
  const filterOptions = useMemo(() => {
    const ids = new Set(all.map((t) => t.category_id))
    return [...ids].map((id) => byId.get(id)).filter((c): c is Category => !!c)
  }, [all, byId])

  const visible = all.filter(
    (t) =>
      (!typeFilter || t.type === typeFilter) &&
      (!categoryFilter || t.category_id === categoryFilter),
  )

  const groups = useMemo(() => {
    const map = new Map<string, TransactionListItem[]>()
    for (const t of visible) map.set(t.occurred_on, [...(map.get(t.occurred_on) ?? []), t])
    return [...map.entries()]
  }, [visible])

  function patchParams(patch: Record<string, string | null>) {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) {
          if (v === null) p.delete(k)
          else p.set(k, v)
        }
        return p
      },
      { replace: true },
    )
  }

  const filterActive = !!typeFilter || !!categoryFilter
  const inList = all.find((t) => t.id === editId)
  const fetched = useTransaction(editId && !inList ? editId : null)
  const editItem = inList ?? fetched.data

  return (
    <section className="px-5 pt-4 pb-8">
      <MonthNavigator
        month={month}
        onChange={setMonth}
        right={
          <button
            onClick={() => setFilterOpen((v) => !v)}
            aria-label="필터"
            aria-expanded={filterOpen}
            className={`size-9 rounded-lg text-base ${
              filterActive ? 'text-neutral-900' : 'text-neutral-400'
            } hover:bg-neutral-100`}
          >
            ⚲
          </button>
        }
      />

      <SalaryWidget />
      <MonthSummary month={month} />

      {/* 사용자의 대부분은 "전체"로 본다. 필터 줄이 상시로 자리를 차지할 이유가 없다. */}
      {filterOpen && (
        <div className="mt-3 space-y-2 rounded-xl bg-neutral-50 p-3">
          <div className="flex gap-1">
            {[
              { v: null, label: '전체' },
              { v: 'income', label: '수입' },
              { v: 'expense', label: '지출' },
            ].map((o) => (
              <button
                key={o.label}
                onClick={() => patchParams({ type: o.v })}
                className={`flex-1 rounded-lg py-1.5 text-sm transition ${
                  (typeFilter ?? null) === o.v
                    ? 'bg-neutral-900 text-white'
                    : 'bg-white text-neutral-600'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <select
            value={categoryFilter ?? ''}
            onChange={(e) => patchParams({ category: e.target.value || null })}
            className="w-full rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-sm text-neutral-800 outline-none"
          >
            <option value="">카테고리 전체</option>
            {filterOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
                {c.deleted_at ? ' (삭제됨)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {filterActive && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="rounded-lg bg-neutral-900 px-2.5 py-1 text-white">
            {categoryFilter ? `${byId.get(categoryFilter)?.emoji ?? ''} ${byId.get(categoryFilter)?.name ?? ''}` : ''}
            {categoryFilter && typeFilter ? ' · ' : ''}
            {typeFilter === 'income' ? '수입' : typeFilter === 'expense' ? '지출' : ''}
            {` · ${visible.length}건 · ${formatAmount(visible.reduce((s, t) => s + t.amount, 0))}원`}
          </span>
          <button
            onClick={() => patchParams({ type: null, category: null })}
            className="text-neutral-500 hover:text-neutral-900"
            aria-label="필터 해제"
          >
            ✕
          </button>
        </div>
      )}

      <div className="mt-4">
        {tx.isPending && <ListSkeleton />}
        {tx.isError && <ErrorState onRetry={() => void tx.refetch()} />}

        {tx.isSuccess && all.length === 0 && (
          <EmptyState
            icon="📝"
            title="아직 기록이 없어요"
            description="첫 지출을 기록해 볼까요?"
            action={
              <button
                onClick={() => patchParams({ new: '1' })}
                className="rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-medium text-white"
              >
                기록 시작하기
              </button>
            }
          />
        )}

        {tx.isSuccess && all.length > 0 && visible.length === 0 && (
          <EmptyState icon="🔍" title="조건에 맞는 거래가 없습니다" />
        )}

        {groups.map(([date, items]) => {
          const net = items.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0)
          return (
            <div key={date} className="mb-5">
              <div className="flex items-baseline justify-between border-b border-neutral-100 pb-1.5">
                <h2 className="text-sm text-neutral-500">{dayLabel(date)}</h2>
                <span className="text-xs text-neutral-400">
                  {net >= 0 ? '+' : '−'}
                  {formatAmount(Math.abs(net))}
                </span>
              </div>
              <ul>
                {items.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => patchParams({ edit: t.id })}
                      className="flex w-full items-center gap-3 py-2.5 text-left hover:bg-neutral-50"
                    >
                      <span aria-hidden className="text-lg">
                        {byId.get(t.category_id)?.emoji ?? '📦'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] text-neutral-900">
                          {byId.get(t.category_id)?.name ?? '알 수 없음'}
                        </span>
                        {t.memo && (
                          <span className="block truncate text-xs text-neutral-500">{t.memo}</span>
                        )}
                      </span>
                      {/* 지출을 빨갛게 칠하지 않는다. 목록 대부분이 빨개져서 강조가 사라진다. */}
                      <span
                        className={`shrink-0 text-[15px] tabular-nums ${
                          t.type === 'income' ? 'text-[#006300]' : 'text-neutral-900'
                        }`}
                      >
                        {t.type === 'income' ? '+' : '−'}
                        {formatAmount(t.amount)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>

      {/* 하단 탭 위 16px. 목록 끝 여백이 없으면 마지막 거래가 가려진다. */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[520px]">
        <div className="flex justify-end px-5 pb-[calc(3.5rem+1rem)]">
          <button
            onClick={() => patchParams({ new: '1' })}
            aria-label="거래 추가"
            className="pointer-events-auto size-14 rounded-full bg-neutral-900 text-2xl text-white shadow-lg hover:bg-neutral-800"
          >
            ＋
          </button>
        </div>
      </div>

      {isNew && <TransactionFormSheet onClose={() => patchParams({ new: null })} />}
      {editId && editItem && (
        <TransactionFormSheet initial={editItem} onClose={() => patchParams({ edit: null })} />
      )}
    </section>
  )
}
