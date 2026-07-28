import { Link } from 'react-router-dom'
import { useSalaryWidget } from '@/hooks/useSummary'
import { formatAmount } from '@/lib/format'
import { daysBetween, shortDate, today } from '@/lib/month'

/**
 * "이번 월급 얼마 남았지?" 에 직접 답하는 위젯 (기획서 §3.6).
 *
 * 기간 축(달력월)과 관점(월급 사이클)을 분리한 결과물이다.
 * 급여 거래의 날짜가 곧 급여일이므로 급여일 설정 화면이 필요 없다.
 */
export function SalaryWidget() {
  const { data, isPending, isError } = useSalaryWidget()

  if (isPending) {
    return (
      <div className="mt-3 space-y-2" aria-hidden>
        <div className="h-3 w-24 animate-pulse rounded bg-neutral-100" />
        <div className="h-7 w-40 animate-pulse rounded bg-neutral-100" />
        <div className="h-1.5 w-full animate-pulse rounded-full bg-neutral-100" />
      </div>
    )
  }

  if (isError) return null

  // 급여 카테고리 미지정 / 삭제됨 / 급여 거래 없음
  if (!data) {
    return (
      <div className="mt-3 rounded-xl bg-neutral-50 px-4 py-3.5">
        <p className="text-sm text-neutral-600">급여를 등록하면 남은 금액을 보여드려요</p>
        <Link
          to="/settings/categories"
          className="mt-1 inline-block text-xs text-neutral-500 underline"
        >
          급여 카테고리 확인하기
        </Link>
      </div>
    )
  }

  const now = today()
  const sinceSalary = daysBetween(data.salary_date, now)
  const untilNext = daysBetween(now, data.next_salary_date)
  const ratio = data.salary_amount > 0 ? data.remaining / data.salary_amount : 0
  const percent = Math.max(0, Math.min(100, Math.round(ratio * 100)))
  const overspent = data.remaining < 0

  return (
    <div className="mt-3">
      <p className="text-sm text-neutral-500">💼 월급 남은 돈</p>

      <p
        className={`mt-0.5 text-2xl font-semibold tabular-nums ${
          overspent ? 'text-red-600' : 'text-neutral-900'
        }`}
      >
        {overspent && '−'}
        {formatAmount(Math.abs(data.remaining))}
        <span className="ml-0.5 text-base font-normal text-neutral-500">원</span>
      </p>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-200">
        <div
          className={`h-full rounded-full ${overspent ? 'bg-red-500' : 'bg-neutral-900'}`}
          style={{ width: `${overspent ? 100 : percent}%` }}
        />
      </div>

      <p className="mt-1.5 text-xs text-neutral-500">
        {overspent ? (
          <>월급을 {formatAmount(Math.abs(data.remaining))}원 초과했어요</>
        ) : (
          <>
            {formatAmount(data.salary_amount)}원 중 {percent}% 남음
          </>
        )}
      </p>

      <p className="mt-0.5 text-xs text-neutral-400">
        {shortDate(data.salary_date)} 지급
        {/* 급여 등록을 깜빡한 경우를 사용자가 알아챌 수 있게 경과일을 보여준다. */}
        {sinceSalary > 40 ? ` · ${sinceSalary}일 전` : ''}
        {untilNext >= 0 ? ` · 다음 급여까지 ${untilNext}일` : ` · 다음 급여 예정일 지남`}
      </p>

      {/* 미래 날짜로 등록한 지출. 남은 돈에서 빼지 않고 따로 보여준다 —
          아직 통장에서 안 나간 돈이라 섞으면 숫자가 이상해진다. */}
      {data.upcoming > 0 && (
        <p className="mt-1.5 text-xs text-neutral-500">
          예정 지출 {formatAmount(data.upcoming)}원
        </p>
      )}
    </div>
  )
}
