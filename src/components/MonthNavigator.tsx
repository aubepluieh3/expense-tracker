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

  return (
    <>
      {/*
        1fr auto 1fr 그리드로 월 라벨을 가운데 열에 둔다.
        flex 로 하면 오른쪽 버튼이 있는 화면(내역)에서만 라벨이 왼쪽으로 밀려서,
        탭을 옮길 때 라벨이 튄다.
      */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-center">
        <button
          aria-label="이전 달"
          onClick={() => onChange(shiftMonth(month, -1))}
          className="size-9 justify-self-start rounded-control text-ink-muted hover:bg-surface-3"
        >
          ‹
        </button>
        <button
          onClick={() => setPicking(true)}
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

  return (
    <Sheet title="월 선택" onClose={onClose}>
      <div className="mb-4 flex items-center justify-center gap-6">
        <button
          aria-label="이전 해"
          onClick={() => setYear((y) => y - 1)}
          className="size-8 rounded-control text-ink-muted hover:bg-surface-3"
        >
          ‹
        </button>
        <span className="text-base font-semibold text-ink">{year}년</span>
        <button
          aria-label="다음 해"
          onClick={() => setYear((y) => y + 1)}
          className="size-8 rounded-control text-ink-muted hover:bg-surface-3"
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
