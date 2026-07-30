import { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { MonthNavigator } from '@/components/MonthNavigator'
import { MonthSummary } from '@/components/MonthSummary'
import { CategoryChart } from '@/components/CategoryBarList'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states'
import { Screen } from '@/components/ui/Screen'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { useMonthParam } from '@/hooks/useMonthParam'
import { useMonthSummary, usePrevMonthSummary, useSalaryWidget } from '@/hooks/useSummary'
import { categoryStatsOf, useCategoryStats, useLifetimeNet } from '@/hooks/useStats'
import { useRangeTransactions } from '@/hooks/useTransactions'
import { useToday } from '@/hooks/useToday'
import { formatAmount } from '@/lib/format'
import { addDays, daysBetween, shortDate } from '@/lib/month'

/**
 * 기간 축.
 *
 * 이 앱의 집계 축은 달력월이고 월급 사이클은 그 위의 관점이다 (기획서 §3.6 —
 * 급여일을 설정으로 받아 축을 아예 바꾸는 안은 폐기했다: 급여일이 25일이면
 * 6.25~7.24 를 "6월" 이라 불러야 하고, 급여일을 고치면 지난달 숫자가 달라진다).
 *
 * 그런데 돌아보는 화면에 월급 관점이 아예 없었다. "월급 기준으로 도는 가계부" 인데
 * 통계에는 월급이 한 글자도 없었던 셈이다. 그래서 축을 바꾸는 대신 **고를 수 있게**
 * 한다. 폐기 사유도 여기서는 발생하지 않는다 — 주기를 "6월" 이라 부르지 않고
 * `7.10 ~ 오늘` 처럼 날짜 범위를 그대로 쓴다.
 */
const AXIS_OPTIONS = [
  { value: 'month', label: '달력월' },
  { value: 'salary', label: '월급 주기' },
] as const
type Axis = (typeof AXIS_OPTIONS)[number]['value']

export default function Stats() {
  const [month, setMonth] = useMonthParam()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  const stats = useCategoryStats(month)
  const summary = useMonthSummary(month)
  const prev = usePrevMonthSummary(month)
  const lifetime = useLifetimeNet()
  const salary = useSalaryWidget()
  const todayIso = useToday()

  /**
   * 축은 URL 에 둔다 — 이 화면의 다른 상태(월)와 같은 규칙이다. 값이 없거나
   * 급여 정보가 없으면 달력월이다: 급여 거래가 없는 사람에게 월급 주기는 빈 축이다.
   */
  const canSalaryAxis = !!salary.data
  const axis: Axis = canSalaryAxis && params.get('axis') === 'salary' ? 'salary' : 'month'
  const setAxis = (next: Axis) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === 'salary') p.set('axis', 'salary')
        else p.delete('axis')
        return p
      },
      { replace: true },
    )

  /**
   * 월급 주기 범위. 급여일부터 **오늘까지**다 — 다음 급여일까지 잡으면 아직 오지 않은
   * 날이 분모에 들어가 "이 주기에 쓴 돈" 이 실제보다 작아 보인다. 월급 위젯의
   * spent_since 와 같은 범위여서 두 화면의 숫자가 어긋나지 않는다.
   *
   * end 는 미포함이라 오늘을 담으려면 하루를 더한다.
   */
  const cycleStart = axis === 'salary' ? (salary.data?.salary_date ?? null) : null
  const cycleEnd = cycleStart ? addDays(todayIso, 1) : null
  const cycleTx = useRangeTransactions(cycleStart, cycleEnd)

  const cycleRows = useMemo(() => categoryStatsOf(cycleTx.data ?? []), [cycleTx.data])

  const rows = axis === 'salary' ? cycleRows : (stats.data ?? [])
  const total =
    axis === 'salary' ? cycleRows.reduce((s, r) => s + r.total, 0) : (summary.data?.expense ?? 0)

  // 지난달 지출이 0이면 증감률이 무한대가 된다. "0원 → 120만원"을 "+∞%"라고
  // 쓰는 건 정보가 아니라서 표시를 생략한다.
  const prevExpense = prev.data?.expense ?? 0
  const delta =
    prevExpense > 0 && summary.isSuccess
      ? Math.round(((total - prevExpense) / prevExpense) * 100)
      : null

  /**
   * 축마다 기다릴 조회가 다르다. 한 곳에서 정해서 아래 분기가 축을 다시 판단하지
   * 않게 한다 — 조건이 흩어지면 한쪽 축만 스켈레톤을 빼먹는다.
   */
  const busy = axis === 'salary' ? cycleTx.isPending : stats.isPending || summary.isPending
  const failed = axis === 'salary' ? cycleTx.isError : stats.isError || summary.isError
  const ready = axis === 'salary' ? cycleTx.isSuccess : stats.isSuccess && summary.isSuccess
  const retry = () => {
    if (axis === 'salary') void cycleTx.refetch()
    else {
      void stats.refetch()
      void summary.refetch()
    }
  }

  return (
    <Screen>
      {/*
        월급 주기에서는 달 이동을 감춘다. 이 축의 기간은 "가장 최근 급여일부터
        오늘까지" 하나뿐이라 ‹ › 가 가리킬 대상이 없다 — 과거 주기를 넘기려면
        급여 이력으로 경계를 다시 계산해야 하고, 그건 기획서가 폐기한 그 문제다.
      */}
      {axis === 'month' ? (
        <MonthNavigator month={month} onChange={setMonth} />
      ) : (
        <p className="py-1.5 text-body font-semibold text-ink">
          {shortDate(cycleStart ?? todayIso)} ~ 오늘
          <span className="ml-1.5 text-caption font-normal text-ink-muted">
            {daysBetween(cycleStart ?? todayIso, todayIso) + 1}일째
          </span>
        </p>
      )}

      {/* 급여 정보가 없으면 고를 것이 없다 — 빈 축을 보여주지 않는다. */}
      {canSalaryAxis && (
        <div className="mt-3">
          <SegmentedControl
            label="기간 축"
            options={AXIS_OPTIONS}
            value={axis}
            onChange={setAxis}
          />
        </div>
      )}

      <div className="mt-5">
        <p className="text-label text-ink-muted">
          {axis === 'salary' ? '이 주기에 쓴 돈' : '이번 달 지출'}
        </p>
        {/*
          값이 오기 전에는 숫자를 쓰지 않는다. `?? 0` 으로 두면 "0원" 이 확정된 답처럼
          떠 있다가 실제 금액으로 튀었다 — 아래 막대는 스켈레톤인데 위 숫자만 다 안다는
          얼굴을 하고 있었던 셈이다.

          실패했을 때는 이 줄을 비운다. 바로 아래에 ErrorState 가 다시 시도를 들고
          나오므로, 같은 실패를 두 번 말하지 않는다.
        */}
        {busy ? (
          <div className="mt-0.5 flex h-8 items-center">
            <div className="h-7 w-40 animate-pulse rounded bg-surface-3" aria-hidden />
          </div>
        ) : (
          ready && (
            <div className="mt-0.5 flex items-baseline gap-2.5">
              <span className="text-hero font-semibold tabular-nums text-ink">
                {formatAmount(total)}
                <span className="ml-0.5 text-base font-normal text-ink-muted">원</span>
              </span>
              {/* 색을 쓰지 않는다. "지출을 빨갛게 칠하지 않는다"는 원칙과 일관되게. */}
              {axis === 'month' && delta !== null && (
                <span className="text-caption text-ink-muted">
                  지난달 대비 {delta > 0 ? '+' : ''}
                  {delta}% {delta > 0 ? '↑' : delta < 0 ? '↓' : ''}
                </span>
              )}
            </div>
          )
        )}

        {/*
          근거를 함께 둔다. 숫자만 있으면 "통장에 이만큼 있다" 로 읽힌다 (기획서 §3.6).

          달력월에서는 이 줄이 수입·지출·남은 금액을 맡는다 — 내역 화면 상단에서 이
          줄을 뺐으므로(월급 위젯과 숫자 두 개가 겹쳐 "어느 게 내 돈인지" 물어야 했다)
          달력월 수지를 볼 곳이 여기여야 한다.
        */}
        {axis === 'month' ? (
          <MonthSummary month={month} />
        ) : (
          ready &&
          salary.data && (
            <p className="mt-2 border-t border-line pt-2 text-caption tabular-nums text-ink-muted">
              월급 {formatAmount(salary.data.salary_amount)}원 중 남은 돈{' '}
              <span className="font-semibold text-ink">
                {formatAmount(salary.data.remaining)}원
              </span>
            </p>
          )
        )}
      </div>

      {/*
        차트는 필요한 조회를 함께 기다린다. 막대의 % 는 총지출을 분모로 쓰므로
        (CategoryBarList) 한쪽만 먼저 오면 분모가 0 이라 **모든 항목이 0%** 로
        보인다. 값이 틀린 화면을 잠깐 보여주는 것보다 스켈레톤을 조금 더 두는 게 낫다.
      */}
      {busy && <ListSkeleton rows={5} />}
      {failed && <ErrorState onRetry={retry} />}

      {ready && rows.length === 0 && (
        <EmptyState
          icon="📊"
          title={axis === 'salary' ? '이 주기에 쓴 돈이 없습니다' : '이번 달 지출 내역이 없습니다'}
        />
      )}

      {/* 상위 7개 + 기타 묶기는 차트 안에서만 안다. 화면은 행만 넘긴다. */}
      {ready && rows.length > 0 && (
        <CategoryChart
          rows={rows}
          total={total}
          // 통계에서 "식비가 42만원?" 하고 놀란 다음 할 일은 "뭘 샀길래" 확인하는
          // 것이다. 그 흐름을 한 번의 탭으로 연결한다. 월은 URL 로 유지된다.
          onSelect={(categoryId) => navigate(`/?month=${month}&category=${categoryId}`)}
        />
      )}

      {/*
        라벨은 먼저 자리를 잡고 숫자만 나중에 채운다. 줄 전체를 조회 뒤에 렌더하면
        화면 맨 아래가 늦게 자라서, 끝까지 스크롤해 둔 사람의 시야가 밀린다.

        실패하면 줄을 내린다 — 앱 사용 이후 누적은 각주이고, 각주 하나가 실패했다고
        다시 시도 버튼을 두 개로 늘릴 이유는 없다.
      */}
      {!lifetime.isError && (
        <div className="mt-8 flex items-baseline justify-between border-t border-line pt-3">
          <span className="text-label text-ink-muted">앱 사용 이후 누적</span>
          {lifetime.isPending ? (
            <div className="h-4 w-24 animate-pulse rounded bg-surface-3" aria-hidden />
          ) : (
            <span className="text-body font-semibold tabular-nums text-ink">
              {lifetime.data >= 0 ? '+' : '−'}
              {formatAmount(Math.abs(lifetime.data))}원
            </span>
          )}
        </div>
      )}
    </Screen>
  )
}
