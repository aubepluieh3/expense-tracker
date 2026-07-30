import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { TextLink } from '@/components/ui/TextLink'
import type { Category, CategoryType } from '@/types/database'

const VISIBLE = 8

/** "최근" 줄에 놓는 칸 수. 4열 중 3칸만 채워 아래 그리드와 다른 줄임이 보이게 한다. */
const RECENT = 3

/**
 * 드롭다운이 아니라 칩 그리드인 이유: 드롭다운은 열기→스크롤→선택 3동작인데 그리드는 1동작이다.
 * 8개까지만 노출하고 나머지는 접는다 — 카테고리 개수 자체에는 제한이 없다.
 *
 * 그리드 순서는 생성순 고정이다. 사용 빈도순·최근순으로 그리드를 재정렬하면
 * 저장할 때마다 칩 위치가 바뀌는데, 자주 쓰는 두세 개가 서로 앞자리를 왕복하므로
 * 가장 많이 쓰는 구간이 가장 불안정해진다. 익숙한 자리를 안 보고 누른 사람은
 * 다른 카테고리로 저장하고도 알아채지 못한다 — 에러 없이 통계만 틀어진다.
 *
 * 대신 최근 쓴 것만 위에 따로 한 줄로 복사한다. 그리드는 움직이지 않고,
 * "윗줄 = 최근"이라는 규칙 자체는 고정이라 여기에도 근육 기억이 생긴다.
 * 직접 추가해 더보기 뒤로 밀린 카테고리도 한 번 쓰면 윗줄로 올라온다.
 */
export function CategoryChips({
  categories,
  type,
  recent = [],
  value,
  onChange,
  pending = false,
  error = false,
  onRetry,
}: {
  categories: Category[]
  /** 빈 상태 문구에만 쓴다 — "지출 카테고리가 없습니다" 가 "카테고리가 없습니다" 보다 정확하다. */
  type: CategoryType
  /**
   * 최근 사용순 전체. 몇 개를 노출할지는 이 컴포넌트가 정한다 — 한 줄에 몇 칸이
   * 들어가는지는 그리드를 그리는 쪽만 안다.
   * 아래 그리드와 겹쳐도 그대로 둔다. 규칙이 한 줄이어야 예측된다.
   */
  recent?: Category[]
  value: string | null
  onChange: (id: string) => void
  /**
   * 카테고리 조회 상태.
   *
   * 칩이 비어 보이는 이유가 셋이다 — 아직 안 왔다 / 실패했다 / 정말 없다.
   * 구분하지 않았더니 조회 중에도 "지출 카테고리가 없습니다 · 만들러 가기 →" 가
   * 떴다. 기본 카테고리 10개가 멀쩡히 있는 사람에게 없다고 말한 셈이고, 링크를
   * 따라가면 그 10개가 그대로 있다. 로딩 표시가 없는 것보다 나쁜 상태였다.
   *
   * 그리드를 그리는 곳이 스켈레톤도 그린다 — 몇 열인지 아는 것은 이 파일뿐이다.
   */
  pending?: boolean
  error?: boolean
  onRetry?: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const overflow = categories.length > VISIBLE
  // 더보기 버튼도 한 칸을 차지한다. VISIBLE 개를 그대로 자르면 4열 그리드가
  // 9칸이 되어 마지막 줄에 한 칸만 남았다.
  const shown = expanded || !overflow ? categories : categories.slice(0, VISIBLE - 1)
  const recentShown = recent.slice(0, RECENT)

  // 조회가 끝나기 전에는 아무 말도 하지 않는다. 자리만 잡아 두면 칩이 도착할 때
  // 시트 높이가 튀지 않는다 — 4열 두 줄은 기본 카테고리 개수(지출 6 · 수입 4)를 덮는다.
  if (pending) {
    return (
      <div className="grid grid-cols-4 gap-1.5" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => (
          // 높이를 숫자로 박지 않는다. 칩과 같은 상자(패딩·간격·글자 크기)에 보이지
          // 않는 내용을 채워서 높이를 얻는다 — 칩 디자인이 바뀌면 같이 따라간다.
          <div key={i} className="animate-pulse rounded-control bg-surface-3 px-1 py-2.5">
            <span className="invisible block text-xl">가</span>
            <span className="invisible mt-0.5 block text-caption">가</span>
          </div>
        ))}
      </div>
    )
  }

  /*
    실패했을 때도 "없습니다" 라고 하면 안 된다 — 사용자가 카테고리를 새로 만들러
    가고, 거기서 이미 있는 것을 본다. 여기서 다시 시도할 수 있게 둔다: 시트를 닫고
    다시 여는 것으로도 재조회되지만, 그건 실패했다는 사실을 아는 사람만 할 수 있다.
  */
  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <Callout tone="error">카테고리를 불러오지 못했습니다</Callout>
        {onRetry && (
          <Button variant="outline" size="inline" onClick={onRetry}>
            다시 시도
          </Button>
        )}
      </div>
    )
  }

  return (
    <div>
      {/*
        최근 줄은 아래 그리드와 **모양이 달라야** 한다. 처음에는 같은 4열 그리드를
        위에 하나 더 얹었는데, 같은 크기·같은 스타일의 격자가 둘 쌓여 한 덩어리로
        읽혔다. "최근" 라벨도 x=0 인데 첫 칩의 이모지는 셀 가운데라 라벨만 붕 떴다.
        가로 pill 로 바꾸면 격자가 아니라 "바로가기"로 읽히고, 왼쪽 정렬이라
        라벨과 줄도 맞는다. 라벨 폭 w-10 은 아래 금액·날짜·메모 줄과 같은 값이다.
      */}
      {recentShown.length > 0 && (
        <div className="mb-3 flex items-center gap-3">
          <span className="w-10 shrink-0 text-label text-ink-muted">최근</span>
          <div
            role="group"
            aria-label="최근 사용한 카테고리"
            className="flex flex-1 flex-wrap gap-1.5"
          >
            {recentShown.map((c) => (
              <RecentPill key={c.id} category={c} selected={c.id === value} onSelect={onChange} />
            ))}
          </div>
        </div>
      )}

      <div
        role="group"
        aria-label="카테고리"
        className={`grid grid-cols-4 gap-1.5 ${recentShown.length > 0 ? 'border-t border-line pt-3' : ''}`}
      >
        {shown.map((c) => (
          <Chip key={c.id} category={c} selected={c.id === value} onSelect={onChange} />
        ))}

        {/*
          펼치기·접기는 카테고리가 아니다. 이전에는 칩과 똑같은 모양으로 8번째
          칸에 앉아 있어서 "더보기" 라는 이름의 카테고리처럼 읽혔다 — 이모지
          자리에 ⋯ 가 있고 아래에 글자가 있는 구조가 칩과 같았다.
          점선 테두리로 "칸이지만 항목은 아니다"를 표시한다.

          접기를 함께 둔다. 한 번 펼치면 되돌릴 수 없어서, 열 개를 넘기면
          시트가 길어진 채로 남았다. 여는 문에는 닫는 손잡이가 있어야 한다.
        */}
        {overflow && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex flex-col items-center justify-center gap-0.5 rounded-control border border-dashed border-line-2 px-1 py-2.5 text-caption text-ink-2 hover:bg-surface-3"
          >
            {/* ▴ 는 통계의 "N개 ▾" 와 같은 글리프다 — 펼침·접힘 표시가 앱에 하나여야 한다. */}
            <span aria-hidden className="text-xl leading-none">
              {expanded ? '▴' : '⋯'}
            </span>
            {expanded ? '접기' : '더보기'}
          </button>
        )}
      </div>

      {/*
        막다른 골목을 없앤다. "설정에서 추가해 주세요" 만 있으면 시트를 닫고
        탭을 옮겨 두 단계를 더 가야 한다 — 그 경로를 아는 사람에게만 통하는 안내다.
      */}
      {categories.length === 0 && (
        <div className="py-4 text-center">
          <p className="text-label text-ink-muted">
            {type === 'expense' ? '지출' : '수입'} 카테고리가 없습니다.
          </p>
          <TextLink to="/settings/categories" className="mt-1.5 inline-block text-label">
            카테고리 만들러 가기 →
          </TextLink>
        </div>
      )}
    </div>
  )
}

/**
 * 최근 줄의 가로 pill. 선택 표시는 그리드 칩과 같은 장치(배경 + 링 + 굵기)를 쓴다 —
 * 모양은 달라도 "선택됨"을 읽는 방법은 하나여야 한다.
 */
function RecentPill({
  category,
  selected,
  onSelect,
}: {
  category: Category
  selected: boolean
  onSelect: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(category.id)}
      aria-pressed={selected}
      className={`flex items-center gap-1.5 rounded-control px-2.5 py-1.5 transition ${
        selected ? 'bg-selected ring-2 ring-ink' : 'bg-surface-3 hover:bg-selected'
      }`}
    >
      <span aria-hidden className="text-base leading-none">
        {category.emoji}
      </span>
      <span className={`text-label ${selected ? 'font-semibold text-ink' : 'text-ink-2'}`}>
        {category.name}
      </span>
    </button>
  )
}

/**
 * radio 가 아니라 aria-pressed 를 쓴다. 최근 줄과 그리드에 같은 카테고리가 동시에
 * 나올 수 있는데, radiogroup 이라면 checked 인 radio 가 둘이 되어 규격에 어긋난다.
 * 토글 두 개가 같은 상태를 비추는 것은 정상이다.
 */
function Chip({
  category,
  selected,
  onSelect,
}: {
  category: Category
  selected: boolean
  onSelect: (id: string) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(category.id)}
      aria-pressed={selected}
      // 선택 표시는 세 채널을 겹친다 — 배경(면적) · 링(윤곽) · 글자 굵기.
      // 링 하나만 쓰면 4열 그리드의 작은 칩에서 이모지에 묻혀 안 보인다.
      // 배경을 검게 칠하지 않는 이유: 이모지는 자체 색을 가진 그림이라
      // 어두운 배경 위에서 대비가 무너진다.
      className={`flex flex-col items-center gap-0.5 rounded-control px-1 py-2.5 transition ${
        selected ? 'bg-selected ring-2 ring-ink' : 'hover:bg-surface-3'
      }`}
    >
      <span aria-hidden className="text-xl">
        {category.emoji}
      </span>
      <span
        className={`w-full truncate text-center text-caption ${
          selected ? 'font-semibold text-ink' : 'text-ink-2'
        }`}
      >
        {category.name}
      </span>
    </button>
  )
}
