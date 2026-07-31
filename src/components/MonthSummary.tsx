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
 * 단 수지가 음수면 그 라벨이 값과 어긋나므로 hero 에서는 라벨을 값에 맞춘다
 * — 아래 overspent · expenseOnly 참고.
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
    /*
      대표 숫자는 이전 달 값을 남기지 않는다 — 왜인지는 useSummary 에 적었다.
      그래서 여기서 할 일은 "자리를 지키는 것" 뿐이다.

      막대 높이를 h-3 / h-7 로 박아 두었더니 그 자리가 실제 대표 숫자보다
      낮아서, 값이 도착할 때 아래 목록이 통째로 밀렸다. 달을 바꿀 때 화면이
      414 → 296 → 477px 로 튄 것의 일부다(e2e/flicker.mjs).

      그래서 막대에 높이를 주는 대신 **아래 실제 마크업과 같은 태그·같은 텍스트
      클래스**를 쓰고 안에 &nbsp; 를 넣는다. 줄 높이가 글꼴에서 나오므로 자리가
      정의상 같아지고, 타입 스케일을 고쳐도(index.css) 따라온다.

      막대는 absolute 로 흐름에서 뺀다. 처음에 inline-block 으로 &nbsp; 를 감쌌더니
      그 자체가 줄 상자를 키워서 이번에는 자리가 실제보다 25px **높았다** — 붕괴가
      초과로 바뀐 것뿐이고 목록은 여전히 내려갔다 올라온다. 흐름에서 빼면 줄 높이는
      &nbsp; 하나가 정하므로 실제 텍스트와 같아진다.

      완전히 같아지지는 않는다 — 기록이 없는 달은 아래에서 null 을 반환하고
      수입이 없는 달은 근거 줄이 빠지므로, 그 두 경우에는 값이 온 뒤 자리가
      줄어든다. 미리 알 수 없는 것들이라 여기서 맞출 방법이 없다.
    */
    const bar = 'absolute inset-y-0.5 left-0 animate-pulse rounded bg-surface-3'
    return variant === 'hero' ? (
      <div className="mt-4" aria-hidden>
        <p className="relative text-label">
          &nbsp;
          <span className={`${bar} w-24`} />
        </p>
        <p className="relative mt-0.5 text-hero font-semibold">
          &nbsp;
          <span className={`${bar} w-40`} />
        </p>
        <p className="relative mt-1 text-caption">
          &nbsp;
          <span className={`${bar} w-32`} />
        </p>
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
    hero 라벨·색을 값에 맞춘다.

    라벨을 "남은 금액" 하나로 고정했던 동안, 첫 사용자가 처음 보는 화면이
    "7월 남은 금액 / −11,500원" (빨강) 이었다. 점심값 한 건을 적었을 뿐인데 남은 돈이
    마이너스라고 말하는 셈이어서 문장 자체가 성립하지 않는다. 게다가 빨강은 이 앱에서
    초과·삭제에 예약된 색인데(index.css) 수입을 아직 안 적은 상태가 초과와 같은 색이었다.
    아래 규칙이 hero 를 아예 안 그리는 덕에 등록 전에는 이 자리가 비어 있으니, 첫 기록의
    피드백이 "빈 자리에 빨간 숫자가 생기는 것" 이었던 셈이다.

    수지가 음수인 이유는 둘이고 사용자가 할 일도 다르다 — 수입을 아직 안 적었거나,
    적었는데 그보다 많이 썼거나. 앞은 "이 달에 쓴 돈" 이 그 자체로 답이고 경고할 일이
    아니다. 빨강과 − 기호는 뒤에만 쓴다.

    한 줄 변형(variant='line')은 그대로 둔다. 그건 통계 화면에서 이미 "이번 달 지출"
    대표 숫자 아래 붙는 근거 줄이라, 같은 규칙을 넣으면 라벨이 그 대표와 겹친다.
  */
  /** 수입을 적었는데 그보다 많이 썼다. 이때만 초과다. */
  const overspent = data.net < 0 && data.income > 0
  /** 수입이 없는 달. 음수 수지를 보여줄 자리가 아니라 지출 총액으로 답한다. */
  const expenseOnly = data.net < 0 && data.income === 0

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
        <p className="text-label text-ink-muted">
          {monthNumber}월 {expenseOnly ? '지출' : overspent ? '초과' : '남은 금액'}
        </p>
        <p
          className={`mt-0.5 text-hero font-semibold tabular-nums ${
            overspent ? 'text-danger' : 'text-ink'
          }`}
        >
          {overspent && '−'}
          {formatAmount(Math.abs(data.net))}
          <span className="ml-0.5 text-base font-normal text-ink-muted">원</span>
        </p>
        {/*
          수입이 없는 달에는 근거 줄을 뺀다. "수입 0 · 지출 11,500" 은 위 대표 숫자를
          그대로 되풀이하는 줄이라(라벨이 이미 '지출' 이라고 말한다) 같은 값이 40px
          안에 두 번 선다. 근거를 붙이는 이유가 "통장 잔고로 읽히는 것을 막는 것"
          인데, 라벨이 지출이면 그 오해 자체가 없다.

          축약하지 않는다. abbrevAmount 는 좁은 줄에서 자릿수를 줄이는 장치인데
          (format.ts) 이 줄은 자기 줄을 다 쓰므로 좁지 않았고, 바로 위 대표 숫자가
          원 단위인 채로 아래 줄만 만 단위여서 −62,750 밑에 "지출 6만" 이 붙었다 —
          3천원 가까이가 사라지고 한 줄 안에서 "수입 0"(원)과 "지출 6만"(만)이 섞였다.
        */}
        {!expenseOnly && (
          <p className="mt-1 text-caption tabular-nums text-ink-muted">
            수입 {formatAmount(data.income)} · 지출 {formatAmount(data.expense)}
          </p>
        )}
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
