import { useEffect, useRef, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { useSustained } from '@/hooks/useSustained'
import { currentMonth, monthLabel, shiftMonth, type Month } from '@/lib/month'

/**
 * 내역·통계가 같은 컴포넌트를 쓴다. 월 상태는 URL 에 있으므로 탭을 옮겨도 유지된다.
 * 라벨을 누르면 월 선택 시트가 열린다 — ‹ › 만 있으면 6개월 전으로 가는 데 6번 눌러야 한다.
 */
export function MonthNavigator({
  month,
  onChange,
  busy,
  prepare,
  right,
}: {
  month: Month
  onChange: (m: Month) => void
  /**
   * 그 달을 그릴 수 있게 준비한다. 주면 **월 선택 시트가 준비를 기다린 뒤 닫힌다**.
   *
   * ‹ › 에는 쓰지 않는다. 양옆은 미리 받아 두므로(usePrefetchMonths) 기다릴 일이
   * 거의 없고, 혹 기다리게 되어도 화살표를 누른 뒤 아무 일도 안 일어나면 탭이
   * 씹힌 것으로 읽힌다 — 그쪽은 즉시 옮기고 아래 화면이 로딩 표시를 맡는다.
   *
   * 시트는 사정이 다르다. 멀리 건너뛰면 캐시가 없는데, 시트 안에는 기다림을
   * 보여줄 자리가 있고 누른 달이 즉시 강조되므로 피드백이 끊기지 않는다.
   * 반쪽 상태를 아래 화면에 내보내는 것보다 시트에서 기다리는 편이 낫다.
   */
  prepare?: (m: Month) => Promise<void>
  /**
   * 새 달을 기다리는 중. 값을 주면 그 자리(6px)가 **늘 잡혀 있고** 켜질 때만 보인다 —
   * 나타날 때 자리를 만들면 옆의 '이번 달' 버튼이 밀린다.
   *
   * 목록 흐림이 이미 기다림을 말하지만(Transactions) 흐림만으로는 "비활성" 으로도
   * 읽힌다. 달을 바꾼 곳이 여기라 시선이 이미 이쪽에 있으므로 이유를 여기서 붙인다.
   * 값을 주지 않은 화면(통계)에는 자리도 만들지 않는다.
   */
  busy?: boolean
  right?: React.ReactNode
}) {
  const [picking, setPicking] = useState(false)
  const away = month !== currentMonth()

  return (
    <>
      {/*
        `‹ 2026년 7월 ›` 을 한 덩어리로 묶어 왼쪽에 두고, 필터·추가는 오른쪽에 둔다.

        이전에는 1fr auto 1fr 그리드로 라벨을 화면 중앙에 고정했다. 라벨은 정확히
        중앙이었지만 **화살표가 비대칭**이 됐다 — 오른쪽 열에 필터(+데스크톱은 추가)가
        같이 들어가서 › 가 안쪽으로 밀린다. 실측으로 모바일이 왼쪽 104px 대 오른쪽
        64px, 데스크톱이 153px 대 43px 였다. 화살표가 라벨에서 100px 넘게 떨어지면
        "이 달의 이전/다음" 이라는 연결도 끊긴다. › 와 필터 사이는 4px 뿐이어서
        오조작도 생겼다.

        중앙 정렬을 포기하는 대신 얻는 것: 화살표–라벨 거리가 좌우 같아지고,
        "달을 옮기는 조작" 과 "목록에 손대는 조작" 이 좌우로 갈린다.
      */}
      <div className="flex items-center gap-1">
        <button
          aria-label="이전 달"
          onClick={() => onChange(shiftMonth(month, -1))}
          className="size-9 shrink-0 rounded-control text-ink-muted hover:bg-surface-3"
        >
          ‹
        </button>
        <button
          onClick={() => setPicking(true)}
          aria-label={`${monthLabel(month)} — 다른 달 선택`}
          className="shrink-0 rounded-control px-2 py-1.5 text-body font-semibold text-ink hover:bg-surface-3"
        >
          {monthLabel(month)}
        </button>
        <button
          aria-label="다음 달"
          onClick={() => onChange(shiftMonth(month, 1))}
          className="size-9 shrink-0 rounded-control text-ink-muted hover:bg-surface-3"
        >
          ›
        </button>

        {/* ‹ 와 › 사이에는 아무것도 넣지 않는다 — 화살표와 라벨의 거리가 좌우로
            어긋나면 "이 달의 이전/다음" 이라는 연결이 끊긴다(위 주석). 그래서
            기다림 표시는 달 조작 묶음의 바깥, › 뒤에 둔다. */}
        {busy !== undefined && (
          <span
            aria-hidden
            className={`size-1.5 shrink-0 rounded-full bg-ink-muted transition-opacity ${
              busy ? 'animate-pulse opacity-100' : 'opacity-0'
            }`}
          />
        )}

        {/*
          다른 달을 보고 있을 때만 나타난다. 8월까지 넘긴 사람이 돌아오려면
          ‹ 를 그만큼 되짚어야 했다 — 월 선택 시트에 이번 달이 강조돼 있지만
          그건 라벨을 눌러야 열리고, 라벨이 버튼이라는 표시가 없다.
          이번 달에 있을 때는 자리를 비운다: 늘 있으면 뜻 없는 버튼이 하나 는다.

          달 조작 묶음의 끝에 둔다 — ‹ › 와 같은 일(달 이동)을 하는 버튼이다.
        */}
        {away && (
          <button
            onClick={() => onChange(currentMonth())}
            className="shrink-0 rounded-control bg-surface-3 px-2 py-1 text-caption text-ink-2 transition hover:bg-selected hover:text-ink"
          >
            이번 달
          </button>
        )}

        {/* 목록에 손대는 조작(필터·추가)은 반대쪽으로 밀어 달 조작과 섞이지 않게 한다. */}
        <div className="ml-auto flex shrink-0 items-center gap-1">{right}</div>
      </div>

      {picking && (
        <MonthPicker
          month={month}
          prepare={prepare}
          onClose={() => setPicking(false)}
          onPick={(m) => {
            onChange(m)
            setPicking(false)
          }}
        />
      )}
    </>
  )
}

/**
 * 연도 이동 범위.
 *
 * 상한을 두지 않으면 2999년까지 갈 수 있었다. 깨지지는 않지만 빈 화면만 나오는
 * 곳으로 사용자를 보내는 버튼이고, 돌아오려면 그만큼 다시 눌러야 한다.
 * 과거는 몰아 적기를 감안해 넉넉히, 미래는 예정 거래 등록까지 한 해만.
 */
const YEARS_BACK = 10
const YEARS_AHEAD = 1

/** 이만큼 넘게 기다리게 될 때만 "불러오는 중" 을 띄운다. 그 아래는 그냥 닫힌다. */
const SPINNER_AFTER = 150
/**
 * 아무리 늦어도 이만큼이면 그냥 넘어간다.
 *
 * 없으면 조회가 느리거나 실패하는 동안 시트에 갇힌다 — 사용자가 요청한 것은
 * "그 달로 가기" 인데 못 가는 게 최악이다. 넘어간 뒤에는 아래 화면의 로딩
 * 표시가 맡는다(Transactions).
 */
const WAIT_MAX = 1500

function MonthPicker({
  month,
  onPick,
  onClose,
  prepare,
}: {
  month: Month
  onPick: (m: Month) => void
  onClose: () => void
  prepare?: (m: Month) => Promise<void>
}) {
  const [year, setYear] = useState(Number(month.slice(0, 4)))
  const thisMonth = currentMonth()

  /** 준비를 기다리고 있는 달. 누른 즉시 강조되므로 탭 피드백은 끊기지 않는다. */
  const [pending, setPending] = useState<Month | null>(null)
  const slow = useSustained(!!pending, SPINNER_AFTER)

  /*
    기다리는 사이에 상황이 바뀔 수 있고, 그때 늦게 끝난 준비가 달을 옮기면 안 된다.
    두 경우다 — 다른 달을 다시 눌렀거나, 시트를 닫았거나. 세는 값을 하나 두고
    둘 다 그 값을 올려서 무효로 만든다(닫기는 아래 언마운트 정리가 한다).
  */
  const attempt = useRef(0)
  useEffect(() => () => void (attempt.current += 1), [])

  async function pick(value: Month) {
    if (!prepare) {
      onPick(value)
      return
    }
    const my = (attempt.current += 1)
    setPending(value)
    // prefetchQuery 는 실패해도 reject 하지 않지만, 기대에 기대지 않는다 —
    // 여기서 throw 가 새면 시트가 눌린 채로 멈춘다.
    await Promise.race([
      prepare(value).catch(() => {}),
      new Promise((r) => setTimeout(r, WAIT_MAX)),
    ])
    if (attempt.current !== my) return
    onPick(value)
  }

  const thisYear = Number(thisMonth.slice(0, 4))
  // 이미 범위 밖의 달을 보고 있다면(URL 로 들어온 경우) 그 해까지는 허용한다.
  const minYear = Math.min(thisYear - YEARS_BACK, year)
  const maxYear = Math.max(thisYear + YEARS_AHEAD, year)

  return (
    <Sheet
      title="월 선택"
      onClose={onClose}
      /*
        헤더 그리드가 1fr auto 1fr 이고 액션 칸은 늘 렌더된다(Sheet). 그래서 이
        글자가 나타나도 제목이 안 밀린다 — 그리드 아래 12칸에 넣으면 시트가
        바닥에 붙어 있어서 격자가 위로 밀렸다.
      */
      action={slow ? <span className="text-caption text-ink-muted">불러오는 중…</span> : undefined}
    >
      <div className="mb-4 flex items-center justify-center gap-6">
        <button
          aria-label="이전 해"
          disabled={year <= minYear}
          onClick={() => setYear((y) => y - 1)}
          className="size-8 rounded-control text-ink-muted hover:bg-surface-3 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          ‹
        </button>
        <span className="text-base font-semibold text-ink">{year}년</span>
        <button
          aria-label="다음 해"
          disabled={year >= maxYear}
          onClick={() => setYear((y) => y + 1)}
          className="size-8 rounded-control text-ink-muted hover:bg-surface-3 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {Array.from({ length: 12 }, (_, i) => {
          const value = `${year}-${String(i + 1).padStart(2, '0')}`
          const selected = value === month
          const loading = value === pending
          return (
            <button
              key={value}
              onClick={() => void pick(value)}
              aria-busy={loading && slow ? true : undefined}
              /*
                누른 달은 준비가 끝나기 전에도 곧바로 선택된 모양이 된다. 시트가
                열린 채 남는 구간이라, 여기서 아무 변화가 없으면 탭이 씹힌 것으로
                읽힌다 — 시트에서 기다리기로 한 근거가 바로 이 피드백이다.
              */
              className={`rounded-control py-2.5 text-label transition ${
                selected || loading
                  ? `bg-accent text-white${loading && slow ? ' animate-pulse' : ''}`
                  : value === thisMonth
                    ? 'bg-surface-3 font-medium text-ink'
                    : 'text-ink-2 hover:bg-surface-3'
              }`}
            >
              {i + 1}월
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}
