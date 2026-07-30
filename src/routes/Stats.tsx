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
        {/*
          값이 오기 전에는 숫자를 쓰지 않는다. `?? 0` 으로 두면 "0원" 이 확정된 답처럼
          떠 있다가 실제 금액으로 튀었다 — 아래 막대는 스켈레톤인데 위 숫자만 다 안다는
          얼굴을 하고 있었던 셈이다.

          실패했을 때는 이 줄을 비운다. 바로 아래에 ErrorState 가 다시 시도를 들고
          나오므로, 같은 실패를 두 번 말하지 않는다.
        */}
        {summary.isPending ? (
          <div className="mt-0.5 flex h-8 items-center">
            <div className="h-7 w-40 animate-pulse rounded bg-surface-3" aria-hidden />
          </div>
        ) : (
          summary.data && (
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
          )
        )}
      </div>

      {/*
        차트는 두 조회를 함께 기다린다. 막대의 % 는 summary 의 총지출을 분모로 쓰므로
        (CategoryBarList), stats 만 먼저 오면 분모가 0 이라 **모든 항목이 0%** 로
        보인다. 값이 틀린 화면을 잠깐 보여주는 것보다 스켈레톤을 조금 더 두는 게 낫다.
      */}
      {(stats.isPending || summary.isPending) && <ListSkeleton rows={5} />}
      {(stats.isError || summary.isError) && (
        <ErrorState
          onRetry={() => {
            void stats.refetch()
            void summary.refetch()
          }}
        />
      )}

      {stats.isSuccess && summary.isSuccess && rows.length === 0 && (
        <EmptyState icon="📊" title="이번 달 지출 내역이 없습니다" />
      )}

      {/* 상위 7개 + 기타 묶기는 차트 안에서만 안다. 화면은 행만 넘긴다. */}
      {stats.isSuccess && summary.isSuccess && rows.length > 0 && (
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
