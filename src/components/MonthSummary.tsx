import { useMonthSummary } from '@/hooks/useSummary'
import { formatAmount } from '@/lib/format'
import type { Month } from '@/lib/month'

/**
 * README 의 "월별 총수입 / 총지출 / 잔액".
 *
 * 라벨은 "남은 금액"이다. "잔액"이라고 쓰면 사용자가 통장 잔고로 읽는다 —
 * 통장에 500만원 있고 이번 달 196만원 남긴 사람이 이 숫자를 보고 혼란스러워한다.
 * 수입·지출을 함께 적어 계산 근거를 보여주면 오해가 사라진다.
 *
 * 필터를 걸어도 이 값은 변하지 않는다. 필터에 반응하면 "남은 금액"이 의미 없는
 * 숫자가 된다(식비만 걸었는데 남은 금액이 −420,000원).
 */
export function MonthSummary({ month }: { month: Month }) {
  const { data, isPending, isError } = useMonthSummary(month)
  const monthNumber = Number(month.slice(5, 7))

  if (isPending) {
    return (
      <div className="mt-4 space-y-1.5 border-t border-neutral-100 pt-3" aria-hidden>
        <div className="h-4 w-full animate-pulse rounded bg-neutral-100" />
        <div className="h-3 w-48 animate-pulse rounded bg-neutral-100" />
      </div>
    )
  }

  if (isError || !data) return null

  const positive = data.net >= 0

  return (
    <div className="mt-4 border-t border-neutral-100 pt-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-neutral-500">{monthNumber}월 남은 금액</span>
        <span
          className={`text-[15px] font-semibold tabular-nums ${
            positive ? 'text-neutral-900' : 'text-red-600'
          }`}
        >
          {positive ? '+' : '−'}
          {formatAmount(Math.abs(data.net))}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-neutral-400 tabular-nums">
        수입 {formatAmount(data.income)} · 지출 {formatAmount(data.expense)}
      </p>
    </div>
  )
}
