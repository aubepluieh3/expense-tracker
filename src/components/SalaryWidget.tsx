import { Link } from 'react-router-dom'
import { useSalaryWidget } from '@/hooks/useSummary'
import { abbrevAmount, formatAmount } from '@/lib/format'
import { daysBetween, shortDate, today } from '@/lib/month'

/**
 * "이번 월급 얼마 남았지?" 에 직접 답하는 위젯 (기획서 §3.6).
 *
 * 기간 축(달력월)과 관점(월급 사이클)을 분리한 결과물이다.
 * 급여 거래의 날짜가 곧 급여일이므로 급여일 설정 화면이 필요 없다.
 *
 * 4줄로 압축했다 — 라벨 줄에 "N원 중 M%"를 붙이고, 지급일·다음 급여·예정 지출을
 * 한 줄로 합쳤다. 내역 화면 상단이 8줄까지 늘어나 거래가 4건만 보였다.
 */
export function SalaryWidget() {
  const { data, isPending, isError } = useSalaryWidget()

  if (isPending) {
    return (
      <div className="mt-3 space-y-2" aria-hidden>
        <div className="h-3 w-24 animate-pulse rounded bg-surface-3" />
        <div className="h-7 w-40 animate-pulse rounded bg-surface-3" />
        <div className="h-1.5 w-full animate-pulse rounded-full bg-surface-3" />
      </div>
    )
  }

  if (isError) return null

  // 급여 카테고리 미지정 / 삭제됨 / 급여 거래 없음
  if (!data) {
    return (
      <div className="mt-3 rounded-control bg-surface-2 px-4 py-3">
        <p className="text-label text-ink-2">급여를 등록하면 남은 금액을 보여드려요</p>
        <Link
          to="/settings/categories"
          className="mt-0.5 inline-block text-caption text-ink-muted underline"
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
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-label text-ink-muted">💼 월급 남은 돈</span>
        <span className="shrink-0 text-caption tabular-nums text-ink-muted">
          {overspent ? '월급 초과' : `${formatAmount(data.salary_amount)}원 중 ${percent}%`}
        </span>
      </div>

      <p
        className={`mt-0.5 text-hero font-semibold tabular-nums ${
          overspent ? 'text-danger' : 'text-ink'
        }`}
      >
        {overspent && '−'}
        {formatAmount(Math.abs(data.remaining))}
        <span className="ml-0.5 text-base font-normal text-ink-muted">원</span>
      </p>

      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-selected">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ease-out ${
            overspent ? 'bg-danger' : 'bg-accent'
          }`}
          style={{ width: `${overspent ? 100 : percent}%` }}
        />
      </div>

      <p className="mt-1.5 truncate text-caption text-ink-muted">
        {shortDate(data.salary_date)} 지급
        {/* 급여 등록을 깜빡한 경우를 사용자가 알아챌 수 있게 경과일을 보여준다. */}
        {sinceSalary > 40 && ` (${sinceSalary}일 전)`}
        {untilNext >= 0 ? ` · 다음 급여까지 ${untilNext}일` : ' · 다음 급여 예정일 지남'}
        {/* 미래 날짜로 등록한 지출. 남은 돈에서 빼지 않고 따로 보여준다 —
            아직 통장에서 안 나간 돈이라 섞으면 숫자가 이상해진다. */}
        {data.upcoming > 0 && ` · 예정 ${abbrevAmount(data.upcoming)}`}
      </p>
    </div>
  )
}
