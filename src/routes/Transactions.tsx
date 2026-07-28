import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MonthNavigator } from '@/components/MonthNavigator'
import { SalaryWidget } from '@/components/SalaryWidget'
import { MonthSummary } from '@/components/MonthSummary'
import { TransactionFormSheet } from '@/components/TransactionFormSheet'
import { DayGroup } from '@/components/DayGroup'
import { FilterChip, FilterPanel, FilterToggleButton } from '@/components/TransactionFilter'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states'
import { Button } from '@/components/ui/Button'
import { Screen } from '@/components/ui/Screen'
import { PlusIcon } from '@/components/ui/icons'
import { useMonthParam } from '@/hooks/useMonthParam'
import { useAllCategories } from '@/hooks/useCategories'
import {
  useMonthTransactions,
  useTransaction,
  type TransactionListItem,
} from '@/hooks/useTransactions'
import { today } from '@/lib/month'
import type { Category, CategoryType } from '@/types/database'

/** tx.data 가 없을 때마다 새 [] 를 만들면 아래 useMemo 들의 deps 가 매번 바뀐다. */
const NO_ITEMS: TransactionListItem[] = []

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

  const categoryById = useMemo(
    () => new Map((categories.data ?? []).map((c) => [c.id, c])),
    [categories.data],
  )

  const all = tx.data ?? NO_ITEMS

  /**
   * 필터 목록은 "그 달에 거래가 있는 카테고리"로 채운다 (기획서 §3.5).
   * 활성 카테고리로 채우면 삭제된 카테고리의 과거 거래를 필터로 찾을 방법이 없어진다.
   */
  const filterOptions = useMemo(() => {
    const ids = new Set(all.map((t) => t.category_id))
    return [...ids].map((id) => categoryById.get(id)).filter((c): c is Category => !!c)
  }, [all, categoryById])

  const visible = useMemo(
    () =>
      all.filter(
        (t) =>
          (!typeFilter || t.type === typeFilter) &&
          (!categoryFilter || t.category_id === categoryFilter),
      ),
    [all, typeFilter, categoryFilter],
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

  const openNew = () => patchParams({ new: '1' })

  const todayIso = today()
  const filterActive = !!typeFilter || !!categoryFilter

  // 다른 달의 거래를 링크로 열었을 때만 따로 조회한다.
  const inList = all.find((t) => t.id === editId)
  const fetched = useTransaction(editId && !inList ? editId : null)
  const editItem = inList ?? fetched.data

  return (
    <Screen>
      <MonthNavigator
        month={month}
        onChange={setMonth}
        right={
          <>
            <FilterToggleButton
              open={filterOpen}
              active={filterActive}
              onClick={() => setFilterOpen((v) => !v)}
            />
            {/* 데스크톱에서는 FAB 이 뷰포트 하단에 고정돼 목록을 덮으므로
                여기 툴바 버튼으로 대체한다. */}
            <Button size="inline" onClick={openNew} className="hidden items-center gap-1 sm:flex">
              <PlusIcon className="size-3.5" />
              추가
            </Button>
          </>
        }
      />

      <SalaryWidget />
      <MonthSummary month={month} />

      {/* 사용자의 대부분은 "전체"로 본다. 필터 줄이 상시로 자리를 차지할 이유가 없다. */}
      {filterOpen && (
        <FilterPanel
          type={typeFilter}
          categoryId={categoryFilter}
          options={filterOptions}
          onChange={(patch) => patchParams(patch)}
        />
      )}

      {filterActive && (
        <FilterChip
          type={typeFilter}
          category={categoryFilter ? categoryById.get(categoryFilter) : undefined}
          count={visible.length}
          sum={visible.reduce((s, t) => s + t.amount, 0)}
          onClear={() => patchParams({ type: null, category: null })}
        />
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
              <Button size="inline" onClick={openNew}>
                기록 시작하기
              </Button>
            }
          />
        )}

        {tx.isSuccess && all.length > 0 && visible.length === 0 && (
          <EmptyState icon="🔍" title="조건에 맞는 거래가 없습니다" />
        )}

        {groups.map(([date, items]) => (
          <DayGroup
            key={date}
            date={date}
            items={items}
            upcoming={date > todayIso}
            categoryById={categoryById}
            onSelect={(id) => patchParams({ edit: id })}
          />
        ))}
      </div>

      {/*
        FAB 은 모바일 전용이다. 뷰포트 하단 고정이라 화면이 세로로 길어지면
        스크롤 위치와 무관하게 목록 중간을 덮는다 — 데스크톱에서 실제로 금액과
        날짜 소계가 가려졌다. 하단 탭 위 16px.
      */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto max-w-[520px] sm:hidden">
        <div className="flex justify-end px-5 pb-[calc(3.5rem+1rem)]">
          <button
            onClick={openNew}
            aria-label="거래 추가"
            className="pointer-events-auto grid size-14 place-items-center rounded-full bg-accent text-white shadow-lg hover:bg-accent-hover"
          >
            <PlusIcon className="size-6" />
          </button>
        </div>
      </div>

      {isNew && <TransactionFormSheet onClose={() => patchParams({ new: null })} />}
      {editId && editItem && (
        <TransactionFormSheet initial={editItem} onClose={() => patchParams({ edit: null })} />
      )}
    </Screen>
  )
}
