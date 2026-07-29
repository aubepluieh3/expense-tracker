/**
 * 화면·앱·DB 가 함께 지켜야 하는 입력 규칙.
 *
 * 여기 있는 값은 전부 스키마에 짝이 있다. 앱이 먼저 막는 이유는 DB 가 막으면
 * 이미 늦기 때문이다 — CHECK 위반은 원시 Postgres 메시지로 돌아오고, 그건
 * 사용자가 할 수 있는 일이 없는 문장이다(0007 이 이모지에서 겪은 그대로다).
 *
 * 반대로 앱에만 두면 안 된다. 두 겹인 것이 맞다. 이 파일은 "DB 가 이미 아는
 * 것을 화면도 알게 하는" 곳이고, 그래서 각 항목에 대응하는 제약을 적어 둔다.
 *
 * 비밀번호는 여기 없다(auth/password.ts). 그 규칙의 주인은 우리 스키마가 아니라
 * Supabase auth 라서, 같은 파일에 두면 "DB 제약을 옮긴 것" 이라는 이 파일의
 * 성격이 흐려진다.
 */

/**
 * 앞뒤 공백 제거 + 연속 공백 압축.
 *
 * DB 트리거 normalize_category() 와 같은 규칙이다 (0002 에서 이름, 0007 에서
 * 이모지까지). 트리거가 어차피 저장 시점에 정규화하지만 화면에서도 같은 값을
 * 만들어야 한다 — 안 그러면 사용자가 입력한 것과 저장된 것이 달라지고,
 * '헬스 ' 로 만든 카테고리가 UNIQUE 위반으로 튕기는 이유를 알 수 없다.
 *
 * 두 곳에 복붙돼 있었다 — CategoryFormSheet 의 제출 검증과
 * useCategories 의 findDeletedByName. 후자가 어긋나면 되살리기 후보를
 * 못 찾는다(이름이 정규화된 채 저장돼 있으므로).
 */
export function normalizeSpaces(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/** profiles_nickname_len — char_length(nickname) between 1 and 20 */
export const MAX_NICKNAME = 20

/** categories_name_len — char_length(name) between 1 and 20 */
export const MAX_CATEGORY_NAME = 20

/**
 * 문제가 없으면 null. 호출부가 그대로 화면에 올릴 수 있는 한 줄을 반환한다.
 *
 * 하한을 상수로 두지 않는다. 1 은 "비어 있으면 안 된다" 는 뜻이고, 그건
 * 조정할 수 있는 값이 아니라 규칙 그 자체다.
 */
function lengthError(value: string, max: number, label: string): string | null {
  if (value.length < 1 || value.length > max) {
    return `${label}은 1~${max}자로 입력해 주세요`
  }
  return null
}

/** 정규화된 값을 받는다 — 호출부가 normalizeSpaces 를 먼저 거친다. */
export function nicknameError(nickname: string): string | null {
  return lengthError(nickname, MAX_NICKNAME, '닉네임')
}

/** 정규화된 값을 받는다 — 호출부가 normalizeSpaces 를 먼저 거친다. */
export function categoryNameError(name: string): string | null {
  return lengthError(name, MAX_CATEGORY_NAME, '이름')
}
