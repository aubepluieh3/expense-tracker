/**
 * 목록의 공통 리듬.
 *
 * 이전에는 네 목록(거래·카테고리·설정·통계)이 전부 다른 행 높이(py-2 ~ py-3.5),
 * 다른 구분선(border-b / divide-y / 없음), 다른 이모지 크기(text-base / text-lg)를
 * 썼다. 탭을 옮기면 리듬이 바뀌었다.
 *
 * 행의 내용은 화면마다 다르므로 컴포넌트로 묶지 않고 클래스만 공유한다.
 * 과하게 추상화하면 네 화면 중 어느 것도 제대로 맞지 않는다.
 */

const listClass = 'divide-y divide-line'

/** 행 공통 — 높이·간격·정렬 */
export const rowClass = 'flex w-full items-center gap-3 py-3 text-left'

/** 행을 누를 수 있을 때 */
export const rowInteractiveClass = `${rowClass} -mx-1 rounded-control px-1 transition hover:bg-surface-2`

/** 행 좌측 이모지 */
export const rowEmojiClass = 'shrink-0 text-lg'

export function List({ children }: { children: React.ReactNode }) {
  return <ul className={listClass}>{children}</ul>
}
