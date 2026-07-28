import type { AuthError } from '@supabase/supabase-js'

/**
 * 미인증 계정 판별.
 * supabase-js 버전에 따라 code 가 없을 수 있어 message 도 함께 본다.
 */
export function isEmailNotConfirmed(error: AuthError): boolean {
  return error.code === 'email_not_confirmed' || /not\s*confirmed/i.test(error.message)
}
