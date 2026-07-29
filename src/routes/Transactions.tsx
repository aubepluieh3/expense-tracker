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
import { Sheet } from '@/components/ui/Sheet'
import { PlusIcon } from '@/components/ui/icons'
import { useMonthParam } from '@/hooks/useMonthParam'
import { useAllCategories } from '@/hooks/useCategories'
import {
  useMonthTransactions,
  useTransaction,
  type TransactionListItem,
} from '@/hooks/useTransactions'
import { useToday } from '@/hooks/useToday'
import { currentMonth, monthLabel } from '@/lib/month'
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

  /**
   * 날짜별로 묶는다. visible 이 이미 날짜 내림차순이라 Map 의 삽입 순서가 곧 표시 순서다.
   * 하루치 배열을 매번 새로 만들지 않고 push 한다 — 스프레드는 그날 건수의 제곱이 된다.
   */
  const groups = useMemo(() => {
    const map = new Map<string, TransactionListItem[]>()
    for (const t of visible) {
      const day = map.get(t.occurred_on)
      if (day) day.push(t)
      else map.set(t.occurred_on, [t])
    }
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

  /**
   * 저장한 거래가 지금 보는 달에 없으면 그 달로 옮긴다.
   *
   * 옮기지 않으면 이런 일이 생긴다 — 6월을 보는 중에 ＋ 를 누르면 날짜 기본값은
   * 오늘(7월)이다. 저장은 성공하지만 6월 목록에는 없으니 화면에 "아직 기록이
   * 없어요"가 그대로 떠서, 저장이 실패한 것처럼 보인다.
   *
   * 시트를 닫는 것과 달을 옮기는 것을 한 번에 patch 한다. 두 번 나누면 같은
   * 틱에서 URL 을 두 번 갱신해 하나가 덮일 수 있다.
   */
  function closeAfterSave(key: 'new' | 'edit', occurredOn: string) {
    const saved = occurredOn.slice(0, 7)
    patchParams({ [key]: null, ...(saved === month ? {} : { month: saved }) })
  }

  // "예정" 배지의 기준. 자정을 넘기면 갱신된다 — 고정값이면 어제 거래에 배지가 남는다.
  const todayIso = useToday()
  const filterActive = !!typeFilter || !!categoryFilter

  // 다른 달의 거래를 링크로 열었을 때만 따로 조회한다.
  const inList = all.find((t) => t.id === editId)
  const fetched = useTransaction(editId && !inList ? editId : null)
  const editItem = inList ?? fetched.data
  /**
   * 없는 id 로 들어온 경우(지워진 거래의 링크 등). 이전에는 시트가 열리지 않고
   * URL 에 edit= 만 남아서, 링크가 죽었는지 앱이 멈췄는지 알 수 없었다.
   */
  const editMissing = !!editId && !editItem && fetched.isError

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

      <SalaryWidget onRecordSalary={openNew} />
      <MonthSummary month={month} />

      {/* 사용자의 대부분은 "전체"로 본다. 필터 줄이 상시로 자리를 차지할 이유가 없다. */}
      {filterOpen && (
        <FilterPanel
          type={typeFilter}
          categoryId={categoryFilter}
          options={filterOptions}
          // 적용하면 접는다. 패널이 열린 채 남으면 목록을 아래로 밀어내서
          // 방금 걸러낸 결과를 보려고 필터 버튼을 한 번 더 눌러야 했다.
          // 걸린 조건은 아래 요약 칩이 계속 보여주므로 패널이 남을 이유가 없다.
          onChange={(patch) => {
            patchParams(patch)
            setFilterOpen(false)
          }}
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

        {/* 빈 이유가 셋이다 — 아직 아무것도 안 넣음 / 이 달만 비어 있음 / 필터에 안 걸림.
            처음에는 앞의 둘을 구분하지 않아서, 7월에 거래가 쌓인 사용자가 6월로 넘어가면
            "아직 기록이 없어요 · 첫 지출을 기록해 볼까요?" 라는 첫 사용자 문구를 봤다. */}
        {tx.isSuccess &&
          all.length === 0 &&
          (month === currentMonth() ? (
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
          ) : (
            <EmptyState icon="📭" title={`${monthLabel(month)}에는 기록이 없어요`} />
          ))}

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

      {isNew && (
        <TransactionFormSheet
          onClose={() => patchParams({ new: null })}
          onSaved={(iso) => closeAfterSave('new', iso)}
        />
      )}
      {editId && editItem && (
        <TransactionFormSheet
          initial={editItem}
          onClose={() => patchParams({ edit: null })}
          onSaved={(iso) => closeAfterSave('edit', iso)}
        />
      )}
      {editMissing && (
        <Sheet title="거래를 찾을 수 없습니다" onClose={() => patchParams({ edit: null })}>
          <p className="text-label text-ink-2">이미 삭제된 거래일 수 있습니다.</p>
          <div className="mt-5">
            <Button variant="ghost" onClick={() => patchParams({ edit: null })}>
              닫기
            </Button>
          </div>
        </Sheet>
      )}
    </Screen>
  )
}
