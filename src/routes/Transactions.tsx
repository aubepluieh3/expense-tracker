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
import { Snackbar, type SnackbarState } from '@/components/ui/Snackbar'
import { PlusIcon } from '@/components/ui/icons'
import { useMonthParam } from '@/hooks/useMonthParam'
import { useEnsureMonth, usePrefetchAdjacentMonths } from '@/hooks/usePrefetchMonths'
import { useSustained } from '@/hooks/useSustained'
import { useAllCategories } from '@/hooks/useCategories'
import {
  useCreateTransaction,
  useMonthTransactions,
  useTransaction,
  type TransactionListItem,
} from '@/hooks/useTransactions'
import { useSalaryWidget } from '@/hooks/useSummary'
import { useToday } from '@/hooks/useToday'
import { currentMonth, monthLabel } from '@/lib/month'
import type { Category, CategoryType } from '@/types/database'

/** tx.data 가 없을 때마다 새 [] 를 만들면 아래 useMemo 들의 deps 가 매번 바뀐다. */
const NO_ITEMS: TransactionListItem[] = []

/**
 * 흐림을 켜기까지 기다리는 시간.
 *
 * 즉시 켜면 프리페치가 먹어서 100ms 에 끝나는 이동에서도 흐림이 번쩍한다 —
 * 깜빡임을 없애려고 넣은 장치가 새 깜빡임을 만드는 셈이다. 양옆 달을 미리
 * 받아 두므로(usePrefetchMonths) 대부분의 ‹ › 이동은 이 문턱을 못 넘는다.
 *
 * 월 선택 시트는 이 문턱에 닿기 전에 자기가 기다리므로(MonthNavigator) 여기까지
 * 오는 경로는 화살표와, 시트가 기다리다 지친 경우뿐이다.
 */
const DIM_DELAY = 200

export default function Transactions() {
  const [month, setMonth] = useMonthParam()
  const [params, setParams] = useSearchParams()
  const [filterOpen, setFilterOpen] = useState(false)
  const [snack, setSnack] = useState<SnackbarState>(null)
  const recreate = useCreateTransaction()

  const typeFilter = params.get('type') as CategoryType | null
  const categoryFilter = params.get('category')
  /**
   * 등록 시트를 여는 파라미터. 값이 타입을 함께 나른다.
   *
   *   new=1        지출로 시작 (FAB · ＋추가 — 거래의 대부분이 지출이다)
   *   new=income   수입 탭으로 시작
   *   new=salary   수입 탭 + 급여 칩까지 미리 선택 (월급 안내의 "등록하기")
   *
   * `type` 을 쓰지 않는다 — 그건 이 화면의 필터 파라미터라, 시트를 여는 데 쓰면
   * 목록까지 걸러진다. 1 을 계속 받는 이유는 기존 링크·검증이 그걸 쓰기 때문이다.
   */
  const newParam = params.get('new')
  const isNew = ['1', 'expense', 'income', 'salary'].includes(newParam ?? '')
  const editId = params.get('edit')

  const tx = useMonthTransactions(month)
  const categories = useAllCategories()

  /**
   * 이전 달 목록이 자리를 지키고 있는 동안(useTransactions 의 placeholderData)
   * 그 사실을 화면에 표시한다. 표시가 없으면 "6월" 라벨 아래 7월 거래가 선다.
   */
  const stale = tx.isPlaceholderData
  const dimmed = useSustained(stale, DIM_DELAY)
  /*
    흐림과 함께 클릭을 막는다. 흐려진 7월 행을 눌러 7월 거래 시트가 열리면
    그건 표시 문제가 아니라 버그다. 필터 칩도 같은 규칙으로 덮는다 — 그 칩은
    '3건 · 39,000원' 처럼 **숫자를 말하고**, 그 값은 클라이언트 필터를 이전 달
    행에 적용한 결과다. ✕(필터 해제)가 그 사이 안 눌리는 것은 받아들인다.
  */
  const dimClass = `transition-opacity duration-200 ${dimmed ? 'pointer-events-none opacity-50' : ''}`

  /** 양옆 달을 미리 받아 둔다. 지금 달이 진짜로 다 온 뒤에 시작한다. */
  usePrefetchAdjacentMonths(month, tx.isSuccess && !tx.isPlaceholderData)
  /** 월 선택 시트가 이걸 기다린 뒤 닫힌다 — 멀리 건너뛰는 경로는 프리페치 밖이다. */
  const ensureMonth = useEnsureMonth()

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

  /**
   * URL 이 이 화면의 상태 저장소다. 달·필터는 replace, 시트는 push 한다.
   *
   * 시트를 replace 로 열면 히스토리에 자리가 생기지 않는다. 그러면 뒤로가기가
   * 시트를 닫는 대신 **직전 화면으로 나가고**, 히스토리가 얕으면 앱 밖으로 나간다.
   * 실제로 통계 → 내역 → ＋ 순서로 누른 뒤 뒤로가기를 하면 통계로 튀었고,
   * 로그인 직후에는 about:blank 까지 갔다. 모바일에서 시트를 닫는 가장 흔한
   * 동작이 스와이프 백이라, 사용자 눈에는 "적으려다 앱이 닫혔다"가 된다.
   *
   * 반대로 달·필터까지 push 하면 ‹ 를 여섯 번 누른 사람이 돌아오려고 뒤로가기를
   * 여섯 번 눌러야 한다. 그쪽은 화면 안 컨트롤로 오가는 값이라 replace 가 맞다.
   * 시트만 히스토리에 쌓는다 — 시트는 화면 위에 겹친 층이고, 층을 걷어내는 것이
   * 뒤로가기의 원래 의미다.
   */
  function patchParams(patch: Record<string, string | null>, { push = false } = {}) {
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        for (const [k, v] of Object.entries(patch)) {
          if (v === null) p.delete(k)
          else p.set(k, v)
        }
        return p
      },
      { replace: !push },
    )
  }

  const openNew = () => patchParams({ new: '1' }, { push: true })
  /**
   * 급여를 적으러 온 경로. 타입과 카테고리가 이미 정해져 있으므로 둘 다 미리 고른다 —
   * 여기 온 사람이 지출이나 용돈을 적을 일은 없다.
   */
  const openNewSalary = () => patchParams({ new: 'salary' }, { push: true })

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

  /**
   * 거래 삭제에 실행 취소를 붙인다.
   *
   * 카테고리 삭제는 스낵바로 되돌릴 수 있는데 거래는 확인창뿐이었다. 훨씬 자주
   * 하는 동작인 쪽에만 안전망이 없었던 셈이다. 실수로 지운 뒤 남는 방법이
   * "금액·날짜·메모를 기억해서 다시 입력" 이면 확인창 한 번으로는 부족하다.
   *
   * 되살리기는 카테고리와 달리 **새 행 INSERT** 다. 거래는 소프트 삭제가 아니라
   * 완전 삭제이고(useTransactions.ts), 그 선택 자체는 옳다 — 지운 거래가 통계에
   * 남으면 안 된다. 그래서 id 가 바뀐다. 사용자가 보는 값(카테고리·금액·날짜·메모)은
   * 모두 같으므로 화면에서 구별되지 않지만, 그 거래를 가리키던 링크(?edit=id)는
   * 죽는다. 링크를 들고 있을 사람이 방금 지운 본인뿐이라 그 대가를 받아들인다.
   */
  function deleteWithUndo(item: TransactionListItem) {
    patchParams({ edit: null })
    setSnack({
      message: '거래를 삭제했습니다.',
      actionLabel: '실행 취소',
      onAction: () => {
        recreate.mutate(
          {
            category_id: item.category_id,
            type: item.type,
            amount: item.amount,
            occurred_on: item.occurred_on,
            memo: item.memo,
          },
          {
            // 시트가 이미 닫혔으므로 실패를 담을 곳이 스낵바뿐이다.
            onError: () => setSnack({ message: '거래를 되살리지 못했습니다.', tone: 'error' }),
            // 지운 거래가 다른 달이었으면 되살려도 지금 화면에 안 보인다.
            // 저장 경로(closeAfterSave)와 같은 규칙으로 그 달로 옮긴다.
            onSuccess: () => {
              const restored = item.occurred_on.slice(0, 7)
              if (restored !== month) patchParams({ month: restored })
            },
          },
        )
      },
    })
  }

  /**
   * 월급 위젯이 대표 숫자 자리를 차지하는가.
   *
   * 이번 달이 아니면 위젯은 스스로 내려간다(SalaryWidget) — 그 규칙을 여기서
   * 다시 판단하지 않도록 같은 식을 쓴다. 아래 빈 상태 문구도 이미 이 비교를 한다.
   */
  const salary = useSalaryWidget()
  const thisMonth = month === currentMonth()
  const salaryPending = thisMonth && salary.isPending
  const salaryHasHero = thisMonth && !!salary.data

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
        busy={dimmed}
        prepare={ensureMonth}
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

      {/*
        대표 숫자 자리는 하나다.

        보통은 월급 위젯이 쓴다 — "이번 월급 얼마 남았지?" 가 이 앱의 첫 질문이다
        (기획서 §3.6). 그 위젯이 자리를 비우는 경우가 둘 있다: 다른 달을 보고 있을
        때(위젯이 스스로 내려간다)와 급여 정보가 없을 때. 그때는 이 달 남은 금액이
        대표가 된다 — 그 순간 "지금 얼마 남았나" 에 답하는 숫자는 그것뿐인데,
        예전에는 한 줄짜리로 안내 카드 아래에 있어서 화면에서 가장 중요한 값이
        가장 작게 보였다.

        조회 중에는 위젯의 스켈레톤만 둔다. 둘을 함께 그리면 결과가 온 순간
        배치가 통째로 바뀌어 화면이 한 번 튄다.
      */}
      {salaryPending ? (
        <SalaryWidget month={month} onRecordSalary={openNewSalary} />
      ) : salaryHasHero ? (
        /*
          월급 위젯이 값을 가지면 이 화면에는 그것만 둔다.

          예전에는 아래에 "7월 남은 금액" 줄을 함께 뒀는데, 같은 화면에 "남은 돈" 이
          두 개 있는 셈이었다. 기간 축이 다르다는 것을 아는 사람에게만 유용하고,
          SalaryWidget 의 주석이 실제로 겪은 혼동을 적어 두었다 — "두 숫자가 8만원
          차이로 겹쳐(위젯은 예정 지출 제외, 월 요약은 포함) 어느 게 내 돈인지
          물어야 했다."

          이 앱은 월급을 기준으로 도는 가계부다. 그래서 여기는 월급 하나로 두고,
          달력월 수지는 통계 화면의 '달력월' 축이 맡는다.
        */
        <SalaryWidget month={month} onRecordSalary={openNewSalary} />
      ) : (
        <>
          <MonthSummary month={month} variant="hero" />
          <SalaryWidget
            month={month}
            onRecordSalary={openNewSalary}
            onOpenTransaction={(id) => patchParams({ edit: id }, { push: true })}
          />
        </>
      )}

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
        <div className={dimClass}>
          <FilterChip
            type={typeFilter}
            category={categoryFilter ? categoryById.get(categoryFilter) : undefined}
            count={visible.length}
            sum={visible.reduce((s, t) => s + t.amount, 0)}
            onClear={() => patchParams({ type: null, category: null })}
          />
        </div>
      )}

      <div className={`mt-4 ${dimClass}`} aria-busy={dimmed || undefined}>
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
            onSelect={(id) => patchParams({ edit: id }, { push: true })}
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
          start={newParam === 'salary' ? 'salary' : newParam === 'income' ? 'income' : 'expense'}
          onClose={() => patchParams({ new: null })}
          onSaved={(iso) => closeAfterSave('new', iso)}
          month={month}
        />
      )}
      {editId && editItem && (
        <TransactionFormSheet
          initial={editItem}
          onClose={() => patchParams({ edit: null })}
          onSaved={(iso) => closeAfterSave('edit', iso)}
          onDeleted={deleteWithUndo}
          month={month}
        />
      )}
      {/* FAB 위에 뜨도록 시트들과 같은 층에 둔다. */}
      <Snackbar state={snack} onDismiss={() => setSnack(null)} />

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
