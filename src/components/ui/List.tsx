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

const listClass = 'divide-y divide-line border-y border-line'

/**
 * 행 공통 — 높이·간격·정렬.
 *
 * min-h 로 하한을 둔다. py 만으로는 행 안의 내용이 높이를 정해서, 클래스를
 * 공유해도 화면마다 다시 갈렸다 — 실측으로 내역 52 · 통계 56 · 설정 47 ·
 * 카테고리 관리 62 였다. 탭을 옮기면 리듬이 바뀌는 것이 이 파일이 막으려던
 * 문제인데 절반만 막고 있었던 셈이다.
 *
 * 값은 52px — 두 줄 텍스트(이름+메모)가 들어가는 내역 행의 높이다. 그보다
 * 낮았던 설정·통계는 이 하한으로 올라오고, 높았던 카테고리 관리는 행 안의
 * 버튼 높이를 맞춰서 내려온다(SubtleButton).
 */
export const rowClass = 'flex w-full items-center gap-3 py-2.5 min-h-[52px] text-left'

/** 행을 누를 수 있을 때 */
export const rowInteractiveClass = `${rowClass} -mx-1 rounded-control px-1 transition hover:bg-surface-2`

/**
 * 행 좌측 이모지.
 *
 * 폭을 고정한다(28px). 그래야 이름이 시작하는 x 가 이모지 글리프 폭에 의존하지 않고,
 * 그룹 헤더를 그 열에 맞출 수 있다 — 28 + gap-3(12) = 40px 이 이름 열의 들여쓰기다.
 * 아래 rowNameIndentClass 가 그 값을 쓴다.
 */
export const rowEmojiClass = 'w-7 shrink-0 text-center text-lg'

/**
 * 행의 이름이 시작하는 곳에 맞추는 들여쓰기.
 *
 * 날짜 그룹 헤더가 컨테이너 끝(x=20)에 붙어 있고 행 이름은 x=57 이라, 왼쪽 가장자리가
 * 20 / 20 / 57 로 계단이 됐다 — 오른쪽은 소계와 금액이 한 선에 정렬되는데 왼쪽만
 * 어긋나 있었다. 이모지 폭과 gap 에서 나오는 값이므로 여기서 한 번만 정한다.
 */
export const rowNameIndentClass = 'pl-10'

export function List({ children }: { children: React.ReactNode }) {
  return <ul className={listClass}>{children}</ul>
}
