import { useNavigate } from 'react-router-dom'
import { MonthNavigator } from '@/components/MonthNavigator'
import { CategoryChart } from '@/components/CategoryBarList'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/states'
import { Screen } from '@/components/ui/Screen'
import { useMonthParam } from '@/hooks/useMonthParam'
import { useMonthSummary, usePrevMonthSummary } from '@/hooks/useSummary'
import { useCategoryStats, useLifetimeNet } from '@/hooks/useStats'
import { formatAmount } from '@/lib/format'

export default function Stats() {
  const [month, setMonth] = useMonthParam()
  const navigate = useNavigate()

  const stats = useCategoryStats(month)
  const summary = useMonthSummary(month)
  const prev = usePrevMonthSummary(month)
  const lifetime = useLifetimeNet()

  const rows = stats.data ?? []
  const total = summary.data?.expense ?? 0

  // 지난달 지출이 0이면 증감률이 무한대가 된다. "0원 → 120만원"을 "+∞%"라고
  // 쓰는 건 정보가 아니라서 표시를 생략한다.
  const prevExpense = prev.data?.expense ?? 0
  const delta =
    prevExpense > 0 && summary.isSuccess
      ? Math.round(((total - prevExpense) / prevExpense) * 100)
      : null

  return (
    <Screen>
      <MonthNavigator month={month} onChange={setMonth} />

      <div className="mt-5">
        <p className="text-label text-ink-muted">이번 달 지출</p>
        <div className="mt-0.5 flex items-baseline gap-2.5">
          <span className="text-hero font-semibold tabular-nums text-ink">
            {formatAmount(total)}
            <span className="ml-0.5 text-base font-normal text-ink-muted">원</span>
          </span>
          {/* 색을 쓰지 않는다. "지출을 빨갛게 칠하지 않는다"는 원칙과 일관되게. */}
          {delta !== null && (
            <span className="text-caption text-ink-muted">
              지난달 대비 {delta > 0 ? '+' : ''}
              {delta}% {delta > 0 ? '↑' : delta < 0 ? '↓' : ''}
            </span>
          )}
        </div>
      </div>

      {stats.isPending && <ListSkeleton rows={5} />}
      {stats.isError && <ErrorState onRetry={() => void stats.refetch()} />}

      {stats.isSuccess && rows.length === 0 && (
        <EmptyState icon="📊" title="이번 달 지출 내역이 없습니다" />
      )}

      {/* 상위 7개 + 기타 묶기는 차트 안에서만 안다. 화면은 행만 넘긴다. */}
      {stats.isSuccess && rows.length > 0 && (
        <CategoryChart
          rows={rows}
          total={total}
          // 통계에서 "식비가 42만원?" 하고 놀란 다음 할 일은 "뭘 샀길래" 확인하는
          // 것이다. 그 흐름을 한 번의 탭으로 연결한다. 월은 URL 로 유지된다.
          onSelect={(categoryId) => navigate(`/?month=${month}&category=${categoryId}`)}
        />
      )}

      {lifetime.isSuccess && (
        <div className="mt-8 flex items-baseline justify-between border-t border-line pt-3">
          <span className="text-label text-ink-muted">앱 사용 이후 누적</span>
          <span className="text-body font-semibold tabular-nums text-ink">
            {lifetime.data >= 0 ? '+' : '−'}
            {formatAmount(Math.abs(lifetime.data))}원
          </span>
        </div>
      )}
    </Screen>
  )
}
