/**
 * 비밀번호 규칙. 한 곳에만 둔다.
 *
 * `const MIN_PASSWORD = 8` 이 세 파일(가입·재설정·설정)에 각각 선언돼 있었다.
 * 상수가 갈리면 조용히 갈린다 — 한쪽만 10 으로 올리면, 가입은 통과한 비밀번호가
 * 변경 화면에서 거부되고 에러 문구까지 서로 다른 숫자를 말한다.
 *
 * 검증도 함께 둔다. 상수만 공유하고 `password.length < MIN_PASSWORD` 를 각자
 * 쓰면 비교 방향이나 경계(<, <=)가 어긋날 자리가 남는다.
 */
export const MIN_PASSWORD = 8

/** 문제가 없으면 null. 호출부가 그대로 화면에 올릴 수 있는 한 줄을 반환한다. */
export function passwordError(password: string): string | null {
  if (password.length < MIN_PASSWORD) {
    return `비밀번호는 ${MIN_PASSWORD}자 이상이어야 합니다`
  }
  return null
}
