import type { AuthError } from '@supabase/supabase-js'

/**
 * 미인증 계정 판별.
 * supabase-js 버전에 따라 code 가 없을 수 있어 message 도 함께 본다.
 */
export function isEmailNotConfirmed(error: AuthError): boolean {
  return error.code === 'email_not_confirmed' || /not\s*confirmed/i.test(error.message)
}

/** 429. status 가 없는 구버전을 위해 메시지도 함께 본다. */
function isRateLimited(error: AuthError): boolean {
  return error.status === 429 || /rate\s*limit/i.test(error.message)
}

/** 네트워크 장애·서버 오류. 계정 정보를 담고 있지 않다. */
function isNetworkOrServer(error: AuthError): boolean {
  return !error.status || error.status >= 500
}

/**
 * 메일 발송(가입 인증·비밀번호 재설정) 실패를 사용자에게 보여줄 문장으로 바꾼다.
 * 보여주면 안 되는 실패는 null 을 반환한다.
 *
 * 세 화면이 이 응답을 통째로 버리고 있었다. 계정 열거 방지 논리는 **계정 존재
 * 여부**에만 적용되는데, 그걸 근거로 rate limit 과 네트워크 실패까지 같이
 * 삼켰다. Supabase 무료 티어의 메일 rate limit 은 실제로 자주 걸리고, 그때
 * 사용자는 "보냈습니다"를 보고 오지 않을 메일을 무한정 기다린다.
 *
 * 반대로 계정 상태를 알려주는 에러(이미 인증됨 등)는 그대로 노출하면 열거가
 * 열리므로 숨긴다 — 그 경우는 호출부가 기존의 "메일 확인" 안내로 넘어간다.
 */
export function mailSendFailure(error: AuthError): string | null {
  console.error('메일 발송 실패', error)
  if (isRateLimited(error)) return '메일 요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.'
  if (isNetworkOrServer(error)) return '메일을 보내지 못했습니다. 네트워크 상태를 확인해 주세요.'
  // 그 밖의 4xx 는 계정 상태를 드러낼 수 있다. 숨긴다.
  return null
}

/**
 * Supabase auth 에러 코드 → 사용자가 **할 수 있는 일이 있는** 한국어 한 줄.
 *
 * 여기 없는 코드는 일부러 여기 없다. 목록을 늘리는 기준은 "이 문장을 읽고
 * 사용자가 다르게 행동할 수 있는가" 하나다. 그렇지 않으면 호출부의 fallback 이
 * 낫다 — 원인을 정확히 말해 주는 대신 다음 행동을 모르게 만드는 문장은 진단
 * 정보이지 안내가 아니고, 진단은 console 이 맡는다.
 *
 * 계정 존재 여부를 드러내는 코드(user_already_exists 등)는 넣지 않는다.
 * 가입 화면의 "메일 확인" 안내가 이미 그 경우를 열거 없이 덮는다(routes/Signup.tsx).
 */
const CODE_MESSAGES: Record<string, string> = {
  weak_password: '비밀번호가 너무 단순합니다. 다른 비밀번호를 입력해 주세요.',
  same_password: '지금 쓰고 있는 비밀번호와 같습니다.',
  email_address_invalid: '이메일 주소 형식이 올바르지 않습니다.',
  // 재설정 링크의 세션이 폼을 채우는 사이에 만료된 경우.
  session_not_found: '세션이 만료되었습니다. 재설정 메일을 다시 받아 주세요.',
  session_expired: '세션이 만료되었습니다. 재설정 메일을 다시 받아 주세요.',
}

/**
 * 인증 요청 실패를 화면에 올릴 문장으로 바꾼다.
 *
 * 세 곳(가입·비밀번호 재설정·설정의 비밀번호 변경)이 `error.message` 를 그대로
 * 화면에 올리고 있었다. Supabase 의 auth 메시지는 영문이라, 나머지가 전부
 * 한국어 한 줄인 UI 에 `Password should be at least 6 characters` 가 떴다.
 *
 * 이 앱은 다른 경로에서 이미 같은 규칙을 세워 두었다 —
 * components/TransactionFormSheet.tsx 와 routes/Categories.tsx 가 원시 Postgres
 * 메시지를 막고 진단을 console 로 보낸다. 인증 쪽만 빠져 있었다.
 *
 * fallback 은 호출부가 넘긴다. "가입하지 못했습니다" 와 "비밀번호를 변경하지
 * 못했습니다" 는 여기서 만들 수 없고, 어느 동작이 실패했는지는 호출부만 안다.
 */
export function authFailureMessage(error: AuthError, fallback: string): string {
  console.error('인증 요청 실패', error)
  if (isRateLimited(error)) return '요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.'
  if (isNetworkOrServer(error)) return '요청을 보내지 못했습니다. 네트워크 상태를 확인해 주세요.'
  return CODE_MESSAGES[error.code ?? ''] ?? fallback
}
