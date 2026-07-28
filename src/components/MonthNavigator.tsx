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
      <div className="flex items-center gap-1">
        <button
          aria-label="이전 달"
          onClick={() => onChange(shiftMonth(month, -1))}
          className="size-9 rounded-lg text-neutral-500 hover:bg-neutral-100"
        >
          ‹
        </button>
        <button
          onClick={() => setPicking(true)}
          className="flex-1 rounded-lg py-1.5 text-[15px] font-semibold text-neutral-900 hover:bg-neutral-100"
        >
          {monthLabel(month)}
        </button>
        <button
          aria-label="다음 달"
          onClick={() => onChange(shiftMonth(month, 1))}
          className="size-9 rounded-lg text-neutral-500 hover:bg-neutral-100"
        >
          ›
        </button>
        {right}
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
          className="size-8 rounded-lg text-neutral-500 hover:bg-neutral-100"
        >
          ‹
        </button>
        <span className="text-base font-semibold text-neutral-900">{year}년</span>
        <button
          aria-label="다음 해"
          onClick={() => setYear((y) => y + 1)}
          className="size-8 rounded-lg text-neutral-500 hover:bg-neutral-100"
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
              className={`rounded-xl py-2.5 text-sm transition ${
                selected
                  ? 'bg-neutral-900 text-white'
                  : value === thisMonth
                    ? 'bg-neutral-100 font-medium text-neutral-900'
                    : 'text-neutral-700 hover:bg-neutral-100'
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
