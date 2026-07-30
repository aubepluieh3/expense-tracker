import { useMonthSummary } from '@/hooks/useSummary'
import { abbrevAmount, formatAmount } from '@/lib/format'
import type { Month } from '@/lib/month'

/**
 * README 의 "월별 총수입 / 총지출 / 잔액".
 *
 * 라벨은 "남은 금액"이다. "잔액"이라고 쓰면 사용자가 통장 잔고로 읽는다 —
 * 통장에 500만원 있고 이번 달 196만원 남긴 사람이 이 숫자를 보고 혼란스러워한다.
 * 수입·지출을 함께 적어 계산 근거를 보여주면 오해가 사라진다.
 *
 * 세 값을 한 줄에 넣는다. 내역 화면 상단이 8줄까지 늘어나 거래가 4건만 보였는데,
 * 근거는 만 단위로 줄여도 역할을 하므로 줄을 합치는 편이 낫다.
 *
 * 필터를 걸어도 이 값은 변하지 않는다. 필터에 반응하면 "남은 금액"이 의미 없는
 * 숫자가 된다(식비만 걸었는데 남은 금액이 −420,000원).
 */
export function MonthSummary({
  month,
  variant = 'line',
}: {
  month: Month
  /**
   * hero = 대표 숫자로 크게.
   *
   * 화면 맨 위의 대표 자리는 하나뿐이고, 보통 월급 위젯이 쓴다. 그 위젯이 자리를
   * 비울 때(다른 달을 보거나 급여 정보가 없을 때) 이 값이 그 자리를 대신한다 —
   * 그때 "지금 얼마 남았나"에 답하는 숫자는 이것뿐인데, 한 줄짜리로 두면 안내문보다
   * 작아서 화면에서 가장 중요한 값이 가장 작게 보였다.
   */
  variant?: 'line' | 'hero'
}) {
  const { data, isPending, isError } = useMonthSummary(month)
  const monthNumber = Number(month.slice(5, 7))

  if (isPending) {
    return variant === 'hero' ? (
      <div className="mt-4 space-y-2" aria-hidden>
        <div className="h-3 w-24 animate-pulse rounded bg-surface-3" />
        <div className="h-7 w-40 animate-pulse rounded bg-surface-3" />
        <div className="h-3 w-32 animate-pulse rounded bg-surface-3" />
      </div>
    ) : (
      <div className="mt-3 border-t border-line pt-3" aria-hidden>
        <div className="h-4 w-full animate-pulse rounded bg-surface-3" />
      </div>
    )
  }

  if (isError || !data) return null

  const positive = data.net >= 0

  /*
    월급 위젯의 대표 숫자와 같은 모양으로 그린다 (SalaryWidget). 같은 자리에서
    번갈아 나타나는 두 값이라 크기·자간·단위 위치가 다르면 자리가 흔들린다.
    근거(수입·지출)는 여기서도 유지한다 — 없으면 "통장 잔고" 로 읽힌다.
  */
  if (variant === 'hero') {
    /*
      기록이 없는 달에는 대표 숫자를 두지 않는다. 24px 로 뜬 "0원 · 수입 0 · 지출 0" 은
      알려주는 것이 없고, 바로 아래 "6월에는 기록이 없어요" 와 같은 말을 두 번 한다.
      한 줄 변형은 그대로 둔다 — 작아서 방해가 되지 않고, 급여가 있는 달에만 쓰인다.
    */
    if (data.income === 0 && data.expense === 0) return null

    return (
      <div className="mt-4">
        <p className="text-label text-ink-muted">{monthNumber}월 남은 금액</p>
        <p
          className={`mt-0.5 text-hero font-semibold tabular-nums ${
            positive ? 'text-ink' : 'text-danger'
          }`}
        >
          {positive ? '' : '−'}
          {formatAmount(Math.abs(data.net))}
          <span className="ml-0.5 text-base font-normal text-ink-muted">원</span>
        </p>
        <p className="mt-1 text-caption tabular-nums text-ink-muted">
          수입 {abbrevAmount(data.income)} · 지출 {abbrevAmount(data.expense)}
        </p>
      </div>
    )
  }

  return (
    <div className="mt-3 flex items-baseline gap-2 border-t border-line pt-3">
      <span className="shrink-0 text-label text-ink-muted">{monthNumber}월 남은 금액</span>
      <span className="flex-1 truncate text-caption tabular-nums text-ink-muted">
        수입 {abbrevAmount(data.income)} · 지출 {abbrevAmount(data.expense)}
      </span>
      <span
        className={`shrink-0 text-body font-semibold tabular-nums ${
          positive ? 'text-ink' : 'text-danger'
        }`}
      >
        {positive ? '+' : '−'}
        {formatAmount(Math.abs(data.net))}
      </span>
    </div>
  )
}
