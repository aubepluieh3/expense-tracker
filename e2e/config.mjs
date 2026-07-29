import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * 테스트 설정. 값은 전부 파일에서 읽는다 — 코드에 계정을 박으면 커밋에 섞인다.
 *
 *   .env.local        앱과 공유. VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
 *   .env.test.local   테스트 전용. E2E_EMAIL / E2E_PASSWORD  (gitignore)
 *
 * anon 키는 프론트 번들에 그대로 들어가는 공개 값이라 비밀이 아니다. 반면
 * 테스트 계정 비밀번호는 진짜 비밀이므로 따로 둔다. service_role 키는 어디에도
 * 쓰지 않는다 — RLS 를 우회하면 테스트가 검증해야 할 격리를 스스로 무너뜨린다.
 */

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function readEnv(name, { required = true } = {}) {
  const path = join(root, name)
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    if (!required) return {}
    throw new Error(
      `${name} 이 없습니다. ${name}.example 을 복사해 값을 채워 주세요.\n  경로: ${path}`,
    )
  }
  const out = {}
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 0) continue
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim()
  }
  return out
}

const app = readEnv('.env.local')
const test = readEnv('.env.test.local')

function need(obj, key, file) {
  const v = obj[key]
  if (!v) throw new Error(`${file} 에 ${key} 가 없습니다.`)
  return v
}

export const SUPABASE_URL = need(app, 'VITE_SUPABASE_URL', '.env.local').replace(/\/rest\/v1\/?$/, '')
export const SUPABASE_ANON = need(app, 'VITE_SUPABASE_ANON_KEY', '.env.local')
export const EMAIL = need(test, 'E2E_EMAIL', '.env.test.local')
export const PASSWORD = need(test, 'E2E_PASSWORD', '.env.test.local')

/** 개발 서버 주소. vite.config.ts 가 strictPort 5173 으로 고정돼 있다. */
export const APP = test.E2E_BASE_URL || 'http://localhost:5173'

/** 실패 스크린샷을 남기는 곳. 저장소에 커밋하지 않는다. */
export const SHOTS = join(root, 'e2e', 'shots')
