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
const rowShapeClass = 'flex items-center gap-3 py-2.5 min-h-[52px] text-left'

export const rowClass = `${rowShapeClass} w-full`

/**
 * 행을 누를 수 있을 때.
 *
 * 폭을 `calc(100% + 0.5rem)` 로 준다 — `-mx-1` 을 상쇄하는 값이다. `w-full` 이면
 * 폭이 컨테이너와 같은 350px 로 고정된 채 왼쪽으로만 4px 밀리므로, 박스가
 * 오른쪽에서 8px 모자란다. 그 결과가 두 가지로 보였다:
 *
 *   - 행 금액의 오른쪽 끝이 362px, 그날 소계는 370px — 오른쪽 열이 계단이 됐다.
 *     금액을 세로로 훑는 화면에서 그 열이 안 맞으면 자리를 눈으로 다시 찾아야 한다.
 *   - hover 하이라이트가 왼쪽으로만 4px 삐져나오고 오른쪽은 안쪽으로 들어갔다.
 *
 * 음수 마진은 하이라이트를 글자보다 조금 넓게 깔기 위한 것이므로 폭으로 되돌려
 * 준다 — 그래야 `px-1` 안쪽 내용이 컨테이너 좌우 20px 선에 그대로 선다.
 *
 * rowClass 를 이어 쓰지 않고 rowShapeClass 에서 따로 조립한다. 이어 쓰면 `w-full` 과
 * 이 폭이 한 문자열에 같이 들어가고, 둘 다 width 유틸리티라 어느 쪽이 이기는지는
 * 클래스 문자열 순서가 아니라 생성된 CSS 순서가 정한다 — 빌드에 따라 조용히 뒤집힌다.
 */
export const rowInteractiveClass = `${rowShapeClass} -mx-1 w-[calc(100%+0.5rem)] rounded-control px-1 transition hover:bg-surface-2`

/**
 * 행 좌측 이모지.
 *
 * 폭을 고정한다(28px). 그래야 이름이 시작하는 x 가 이모지 글리프 폭에 의존하지 않고
 * 행마다 이름 열이 흔들리지 않는다 — 28 + gap-3(12) = 40px 이 이름 열의 들여쓰기다.
 */
export const rowEmojiClass = 'w-7 shrink-0 text-center text-lg'

export function List({ children }: { children: React.ReactNode }) {
  return <ul className={listClass}>{children}</ul>
}
