import type { AuthError } from '@supabase/supabase-js'

/**
 * 미인증 계정 판별.
 * supabase-js 버전에 따라 code 가 없을 수 있어 message 도 함께 본다.
 */
export function isEmailNotConfirmed(error: AuthError): boolean {
  return error.code === 'email_not_confirmed' || /not\s*confirmed/i.test(error.message)
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
  // 429. status 가 없는 구버전을 위해 메시지도 본다.
  if (error.status === 429 || /rate\s*limit/i.test(error.message)) {
    return '메일 요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.'
  }
  // 네트워크 장애·서버 오류. 계정 정보를 담고 있지 않다.
  if (!error.status || error.status >= 500) {
    return '메일을 보내지 못했습니다. 네트워크 상태를 확인해 주세요.'
  }
  // 그 밖의 4xx 는 계정 상태를 드러낼 수 있다. 숨긴다.
  return null
}
