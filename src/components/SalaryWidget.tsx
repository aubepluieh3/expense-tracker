import { TextLink } from '@/components/ui/TextLink'
import { useCategories, useProfile } from '@/hooks/useCategories'
import { useSalaryWidget } from '@/hooks/useSummary'
import { useToday } from '@/hooks/useToday'
import { abbrevAmount, formatAmount } from '@/lib/format'
import { currentMonth, daysBetween, shortDate, type Month } from '@/lib/month'

/**
 * "이번 월급 얼마 남았지?" 에 직접 답하는 위젯 (기획서 §3.6).
 *
 * 기간 축(달력월)과 관점(월급 사이클)을 분리한 결과물이다.
 * 급여 거래의 날짜가 곧 급여일이므로 급여일 설정 화면이 필요 없다.
 *
 * 4줄로 압축했다 — 라벨 줄에 "N원 중 M%"를 붙이고, 지급일·다음 급여·예정 지출을
 * 한 줄로 합쳤다. 내역 화면 상단이 8줄까지 늘어나 거래가 4건만 보였다.
 */
export function SalaryWidget({
  month,
  onRecordSalary,
}: {
  /** 보고 있는 달. 이번 달이 아니면 위젯을 내린다. */
  month: Month
  onRecordSalary?: () => void
}) {
  const { data, isPending, isError } = useSalaryWidget()
  const profile = useProfile()
  const categories = useCategories()
  // 아래 이른 반환들보다 위에서 부른다 — 훅은 조건 뒤에 올 수 없다.
  const todayIso = useToday()

  /**
   * 이번 달에만 보여준다.
   *
   * 이 위젯의 기간 축은 달력월이 아니라 월급 사이클이라, 어느 달을 보고 있든
   * 같은 값을 낸다. 그래서 6월로 넘겨도 "7.29 지급 · 다음 급여까지 31일 ·
   * 3,188,000원" 이 그대로 붙어 있었고, 바로 아래 "6월 남은 금액 +0" 과 나란히
   * 놓이니 위 숫자도 6월 것으로 읽혔다. 게다가 두 숫자가 8만원 차이로 겹쳐
   * (위젯은 예정 지출 제외, 월 요약은 포함) 어느 게 내 돈인지 물어야 했다.
   *
   * 계산을 보고 있는 달에 맞추는 방법도 있지만 그건 "월급 남은 돈" 의 뜻을 바꾸는
   * 일이다. 지난달의 월급 잔액은 이미 끝난 이야기이고, 다른 달을 여는 이유는
   * 그달의 기록을 확인하려는 것이다. 답이 없는 질문이면 묻지 않는 편이 낫다.
   */
  if (month !== currentMonth()) return null

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

  /**
   * 위젯이 빈 이유는 셋이다 — 급여 카테고리 미지정 / 그 카테고리가 삭제됨 /
   * 급여 거래가 없음. 안내를 하나로 뭉치면 링크가 절반의 사용자에게 헛다리다.
   *
   * 이전에는 세 경우 모두 카테고리 관리로 보냈다. 그런데 기본 카테고리에 급여가
   * 이미 지정돼 있어서, 첫 사용자의 실제 원인은 대부분 "급여 거래를 안 넣음"이다.
   * 카테고리 화면에 가면 이미 지정된 걸 보고 다시 돌아 나와야 했다.
   */
  if (!data) {
    const salaryId = profile.data?.salary_category_id
    const designated = !!salaryId && (categories.data ?? []).some((c) => c.id === salaryId)

    return (
      <div className="mt-3 rounded-control bg-surface-2 px-4 py-3">
        {designated ? (
          <>
            <p className="text-label text-ink-2">급여를 등록하면 남은 금액을 보여드려요</p>
            <button
              type="button"
              onClick={onRecordSalary}
              className="mt-0.5 text-caption text-ink-muted underline"
            >
              급여 거래 등록하기
            </button>
          </>
        ) : (
          <>
            <p className="text-label text-ink-2">급여 카테고리를 정하면 남은 금액을 보여드려요</p>
            <TextLink
              to="/settings/categories"
              className="mt-0.5 inline-block text-caption font-normal text-ink-muted"
            >
              급여 카테고리 지정하기
            </TextLink>
          </>
        )}
      </div>
    )
  }

  const sinceSalary = daysBetween(data.salary_date, todayIso)
  const untilNext = daysBetween(todayIso, data.next_salary_date)
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
