/**
 * 기획서 §3.4 — 이모지 피커를 따로 만들지 않고 자주 쓰는 목록 + 직접 입력으로 끝낸다.
 * 사용자는 이모지만 고르고 색은 시스템이 배정한다.
 *
 * 그룹으로 묶는 이유: 68개를 평평하게 늘어놓으면 찾는 데 오히려 오래 걸린다.
 * 가계부에서 실제로 카테고리가 되는 축(음식·이동·생활…)으로 나눈다.
 */
const GROUPS: [string, string[]][] = [
  ['음식', ['🍚', '🍜', '🍔', '🍕', '🍗', '🍣', '🥗', '🍰', '☕', '🧋', '🍺', '🍎']],
  ['마음', ['❤️', '💕', '💝', '💌', '🫶', '🤍', '🎁', '💐']],
  ['이동', ['🚌', '🚇', '🚗', '🚕', '⛽', '🚲', '✈️', '🅿️']],
  ['생활', ['🏠', '💡', '💧', '📱', '🧾', '🛒', '🧴', '🔧']],
  ['건강', ['🏥', '💊', '💪', '🦷', '👓']],
  ['문화', ['🎬', '🎮', '📚', '🎵', '🎫', '🎨', '🏕️']],
  ['사람', ['👶', '🎂', '🐶', '🐱', '🐾']],
  ['금융', ['💰', '💼', '📈', '🏦', '💳', '🪙']],
  ['기타', ['📦', '✂️', '👕', '👟', '💄', '🧢']],
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

      {/* 목록이 길어져서 스크롤 영역으로 감싼다. 시트 전체가 늘어나면 저장 버튼이 멀어진다. */}
      <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl bg-neutral-50 p-2.5">
        {GROUPS.map(([label, emojis]) => (
          <div key={label}>
            <p className="mb-1 px-0.5 text-xs text-neutral-400">{label}</p>
            <div className="grid grid-cols-6 gap-1">
              {emojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onChange(emoji)}
                  aria-pressed={value === emoji}
                  className={`rounded-lg py-1.5 text-xl transition ${
                    value === emoji
                      ? 'bg-neutral-200 ring-2 ring-neutral-900'
                      : 'hover:bg-neutral-200/60'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
