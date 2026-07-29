/**
 * 앱 밖의 정적 문서 경로.
 *
 * public/ 에 있는 파일이라 라우터가 다루지 않는다 — <Link> 가 아니라 <a> 로 연다.
 *
 * 두 곳에서 쓴다: 로그인 전 화면(components/AuthLayout.tsx)과 설정(routes/Settings.tsx).
 * 각자 문자열을 적으면 파일 이름을 바꿀 때 한쪽만 고쳐지고, 죽은 링크는 눌러 보기
 * 전까지 드러나지 않는다 — MAX_NICKNAME 을 한쪽만 쓴 것과 같은 실수다 (lib/rules.ts).
 *
 * BASE_URL 을 앞에 붙인다. '/guide.html' 로 고정하면 하위 경로에 배포했을 때
 * 레포 밖(github.io/guide.html)을 가리킨다. BASE_URL 은 항상 '/' 로 끝난다.
 */
export const GUIDE_PATH = `${import.meta.env.BASE_URL}guide.html`
