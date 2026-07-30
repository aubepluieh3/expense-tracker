import { TextLink } from '@/components/ui/TextLink'
import { useCategories } from '@/hooks/useCategories'
import { useProfile } from '@/hooks/useProfile'
import { useIncomeOutsideSalary, useSalaryWidget, useUpcomingSalary } from '@/hooks/useSummary'
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
  onOpenTransaction,
}: {
  /** 보고 있는 달. 이번 달이 아니면 위젯을 내린다. */
  month: Month
  onRecordSalary?: () => void
  /**
   * 이미 등록해 둔 급여 거래를 연다.
   *
   * 지급일을 잘못 넣어서 위젯이 비는 경우가 있다. 날짜만 알려주고 끝내면 그 거래를
   * 목록에서 손으로 찾아야 하는데, 미래 날짜라 목록 맨 위에 있긴 하지만 "이걸
   * 고치면 된다" 는 연결이 끊긴다.
   */
  onOpenTransaction?: (id: string) => void
}) {
  const { data, isPending, isSuccess, isError } = useSalaryWidget()
  const profile = useProfile()
  const categories = useCategories()
  // 아래 이른 반환들보다 위에서 부른다 — 훅은 조건 뒤에 올 수 없다.
  const todayIso = useToday()
  /**
   * 위젯이 값을 잃은 이유를 가르는 조회. 정상 상태에서는 돌지 않는다.
   * profile 이 오기 전에는 카테고리 id 가 없어 hook 안에서 스스로 멈춘다.
   */
  const upcoming = useUpcomingSalary(profile.data?.salary_category_id ?? null, isSuccess && !data)
  /**
   * 그다음 이유 — 급여가 지정 밖의 수입 카테고리에 들어 있는가.
   * 미래 급여가 아니라고 확인된 뒤에만 묻는다(왕복을 하나씩만 늘린다).
   */
  const outside = useIncomeOutsideSalary(
    profile.data?.salary_category_id ?? null,
    isSuccess && !data && upcoming.isSuccess && !upcoming.data,
  )

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
   * 위젯이 빈 이유는 다섯이다 — 급여 카테고리 미지정 / 그 카테고리가 삭제됨 /
   * 급여 거래가 없음 / **등록했지만 지급일이 아직 안 옴** / **급여가 지정 밖의
   * 수입 카테고리에 있음**. 안내를 하나로 뭉치면 링크가 절반의 사용자에게 헛다리다.
   *
   * 이전에는 세 경우 모두 카테고리 관리로 보냈다. 그런데 기본 카테고리에 급여가
   * 이미 지정돼 있어서, 첫 사용자의 실제 원인은 대부분 "급여 거래를 안 넣음"이다.
   * 카테고리 화면에 가면 이미 지정된 걸 보고 다시 돌아 나와야 했다.
   *
   * 네 번째는 뒤늦게 발견했다. RPC 가 `occurred_on <= p_today` 로 걸러서
   * (0003_summary.sql) 미래 날짜로 등록한 급여는 위젯에 안 잡히는데, 화면은
   * "월급을 등록하면" 이라고 말했다 — 방금 등록한 사람에게 등록하라고 한 것이다.
   * 지급일을 잘못 넣었을 때 나오는 상태이기도 해서, 날짜를 보여주고 그 거래로
   * 보낸다.
   */
  if (!data) {
    /*
      어느 안내를 띄울지는 "급여 카테고리가 지정돼 있는가" 로 갈린다. 그 답을
      아직 모르는 동안 기본값으로 계산하면 **틀린 쪽으로 보낸다** — categories 가
      오기 전에는 designated 가 false 여서 "급여 카테고리를 정하면" 이 떴고,
      링크를 따라가면 이미 지정된 것을 보고 돌아 나와야 했다. 위 주석이 걱정한
      바로 그 상황이 로딩 중에 되살아난 셈이다.

      모르는 동안에는 묻지 않는다: 위와 같은 스켈레톤으로 자리만 잡는다.
      판정에 실패했으면 아무 말도 하지 않는다 — 이 위젯은 조회 실패에 이미
      침묵을 택했고(위 isError), 반쪽 정보로 엉뚱한 화면에 보내는 것보다 낫다.
    */
    if (profile.isPending || categories.isPending) {
      return (
        <div className="mt-3 space-y-2" aria-hidden>
          <div className="h-3 w-24 animate-pulse rounded bg-surface-3" />
          <div className="h-7 w-40 animate-pulse rounded bg-surface-3" />
        </div>
      )
    }
    if (profile.isError || categories.isError) return null

    const salaryId = profile.data?.salary_category_id
    // 이름까지 찾아 둔다 — 아래에서 "지금 기준이 무엇인지" 를 말해야 한다.
    const designated = salaryId ? (categories.data ?? []).find((c) => c.id === salaryId) : undefined

    /*
      문구가 "남은 금액을 보여드려요" 가 아니다. 대표 자리에 이미 남은 금액이 떠
      있으므로 그렇게 말하면 거짓이 된다 — 없는 것을 준다고 하는 셈이다.
      여기서 제안하는 것은 기간 축을 달력월에서 월급 사이클로 바꿔 보는 것이다.

      한 줄로만 그린다. 카드(3줄) 형태도 있었지만 대표 자리를 남은 금액이 가져간
      뒤로는 아무 경로에서도 닿지 않는 죽은 코드였다.
    */
    const line = 'mt-2 text-caption text-ink-muted'

    if (!designated) {
      // 지정이 없다 — 삭제된 카테고리를 가리키고 있는 경우도 여기로 온다.
      return (
        <p className={line}>
          💼 급여 카테고리를 정하면 월급 기준으로도 보여드려요{' '}
          <TextLink to="/settings/categories" className="font-normal underline">
            지정하기
          </TextLink>
        </p>
      )
    }

    /*
      등록했는지 아직 모른다. 이 시점에 "등록하면" 이라고 말하면 이미 등록한 사람에게
      틀린 말이 되므로, 답이 오기 전에는 아무 말도 하지 않는다. 조회가 실패해도 같다 —
      이 위젯은 모를 때 침묵하는 쪽을 택했다.
    */
    if (upcoming.isPending || upcoming.isError) return null

    // 지역 변수로 받는다 — 아래 onClick 클로저 안에서는 upcoming.data 의 좁히기가 유지되지 않는다.
    const next = upcoming.data
    if (next) {
      const days = daysBetween(todayIso, next.occurred_on)
      return (
        <p className={line}>
          💼 {shortDate(next.occurred_on)} 지급 예정
          {days > 0 && ` · ${days}일 뒤`} · 그날부터 월급 기준으로 보여드려요{' '}
          {onOpenTransaction && (
            <button type="button" onClick={() => onOpenTransaction(next.id)} className="underline">
              거래 열기
            </button>
          )}
        </p>
      )
    }

    /*
      마지막 이유: 급여가 지정 밖의 수입 카테고리에 있다. 위젯은 지정된 한 곳만
      보므로(0003_summary.sql 의 v_cat) '급여' 에 300만원이 들어 있어도 값을 잃고,
      그러면 이 화면은 "월급을 등록하면" 이라고 말했다 — 등록은 이미 끝났고
      어긋난 것은 지정이다. 할 일이 다르면 안내도 달라야 한다.

      여기서도 모르는 동안에는 말하지 않는다. "등록하라" 를 먼저 띄우고 나중에
      정정하면, 잘못된 지시를 이미 따라간 사람이 생긴다.
    */
    if (outside.isPending || outside.isError) return null
    const elsewhere = outside.data
    if (elsewhere) {
      return (
        <p className={line}>
          💼 월급 기준이 '{designated.name}' 이에요. '{elsewhere.categories.name}' 로 바꾸면 월급
          기준으로도 보여드려요{' '}
          {/* 링크가 줄바꿈에 쪼개지면 "기준 / 바꾸기" 로 갈라져 두 개처럼 보인다. */}
          <TextLink to="/settings/categories" className="whitespace-nowrap font-normal underline">
            기준 바꾸기
          </TextLink>
        </p>
      )
    }

    return (
      <p className={line}>
        💼 월급을 등록하면 월급 기준으로도 보여드려요{' '}
        <button type="button" onClick={onRecordSalary} className="underline">
          등록하기
        </button>
      </p>
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
