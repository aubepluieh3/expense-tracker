/**
 * 기획서 §3.4 — 이모지 피커를 따로 만들지 않고 자주 쓰는 24개 그리드 + 직접 입력으로 끝낸다.
 * 사용자는 이모지만 고르고 색은 시스템이 배정한다.
 */
const COMMON = [
  '🍚', '🍜', '☕', '🛒', '🚌', '🚗',
  '⛽', '🏠', '💡', '📱', '👕', '💊',
  '🏥', '📚', '🎬', '🎮', '✈️', '🎁',
  '💰', '💼', '📈', '🐶', '✂️', '📦',
]

export function EmojiPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (emoji: string) => void
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-sm text-neutral-700">이모지</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={8}
          aria-label="이모지 직접 입력"
          className="w-16 rounded-lg border border-neutral-300 px-2 py-1 text-center text-lg outline-none focus:border-neutral-900"
        />
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {COMMON.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onChange(emoji)}
            aria-pressed={value === emoji}
            className={`rounded-lg py-2 text-xl transition ${
              value === emoji ? 'bg-neutral-900/10 ring-1 ring-neutral-900' : 'hover:bg-neutral-100'
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}
