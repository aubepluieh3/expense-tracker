import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { currentMonth, monthLabel, shiftMonth, type Month } from '@/lib/month'

/**
 * 내역·통계가 같은 컴포넌트를 쓴다. 월 상태는 URL 에 있으므로 탭을 옮겨도 유지된다.
 * 라벨을 누르면 월 선택 시트가 열린다 — ‹ › 만 있으면 6개월 전으로 가는 데 6번 눌러야 한다.
 */
export function MonthNavigator({
  month,
  onChange,
  right,
}: {
  month: Month
  onChange: (m: Month) => void
  right?: React.ReactNode
}) {
  const [picking, setPicking] = useState(false)
  const away = month !== currentMonth()

  return (
    <>
      {/*
        1fr auto 1fr 그리드로 월 라벨을 가운데 열에 둔다.
        flex 로 하면 오른쪽 버튼이 있는 화면(내역)에서만 라벨이 왼쪽으로 밀려서,
        탭을 옮길 때 라벨이 튄다.
      */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center">
        <div className="flex items-center gap-1 justify-self-start">
          <button
            aria-label="이전 달"
            onClick={() => onChange(shiftMonth(month, -1))}
            className="size-9 rounded-control text-ink-muted hover:bg-surface-3"
          >
            ‹
          </button>
          {/*
            다른 달을 보고 있을 때만 나타난다. 8월까지 넘긴 사람이 돌아오려면
            ‹ 를 그만큼 되짚어야 했다 — 월 선택 시트에 이번 달이 강조돼 있지만
            그건 라벨을 눌러야 열리고, 라벨이 버튼이라는 표시가 없다.
            이번 달에 있을 때는 자리를 비운다: 늘 있으면 뜻 없는 버튼이 하나 는다.
          */}
          {away && (
            <button
              onClick={() => onChange(currentMonth())}
              className="rounded-control bg-surface-3 px-2 py-1 text-caption text-ink-2 transition hover:bg-selected hover:text-ink"
            >
              이번 달
            </button>
          )}
        </div>
        <button
          onClick={() => setPicking(true)}
          aria-label={`${monthLabel(month)} — 다른 달 선택`}
          className="rounded-control px-3 py-1.5 text-body font-semibold text-ink hover:bg-surface-3"
        >
          {monthLabel(month)}
        </button>
        <div className="flex items-center gap-1 justify-self-end">
          <button
            aria-label="다음 달"
            onClick={() => onChange(shiftMonth(month, 1))}
            className="size-9 rounded-control text-ink-muted hover:bg-surface-3"
          >
            ›
          </button>
          {right}
        </div>
      </div>

      {picking && (
        <MonthPicker
          month={month}
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

function MonthPicker({
  month,
  onPick,
  onClose,
}: {
  month: Month
  onPick: (m: Month) => void
  onClose: () => void
}) {
  const [year, setYear] = useState(Number(month.slice(0, 4)))
  const thisMonth = currentMonth()

  const thisYear = Number(thisMonth.slice(0, 4))
  // 이미 범위 밖의 달을 보고 있다면(URL 로 들어온 경우) 그 해까지는 허용한다.
  const minYear = Math.min(thisYear - YEARS_BACK, year)
  const maxYear = Math.max(thisYear + YEARS_AHEAD, year)

  return (
    <Sheet title="월 선택" onClose={onClose}>
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
          return (
            <button
              key={value}
              onClick={() => onPick(value)}
              className={`rounded-control py-2.5 text-label transition ${
                selected
                  ? 'bg-accent text-white'
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
