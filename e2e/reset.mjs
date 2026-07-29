import { EMAIL, PASSWORD, SUPABASE_ANON as ANON, SUPABASE_URL as URL } from './config.mjs'

/**
 * 테스트 계정을 "신규 가입 직후" 상태로 되돌린다.
 *
 * anon 키로만 동작한다 — RLS 를 그대로 통과하므로, 초기화 자체가 정책이
 * 열려 있는지 확인해 주는 셈이다. service_role 을 쓰면 그 검증이 사라진다.
 */
const DEFAULTS = [
  '식비', '카페·간식', '교통', '주거·통신', '생활용품', '문화·여가',
  '급여', '용돈', '금융수입', '기타수입',
]

let token = ''

async function api(p, i = {}) {
  const r = await fetch(URL + p, {
    ...i,
    headers: {
      apikey: ANON,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(i.headers ?? {}),
    },
  })
  const t = await r.text()
  return { status: r.status, body: t ? JSON.parse(t) : null }
}

/** 신규 가입 직후 상태로 되돌린다: 거래 0건, 기본 카테고리 10개(활성), 급여 지정 */
export async function reset({ quiet = false } = {}) {
  const s = await api('/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  token = s.body.access_token
  const uid = s.body.user.id

  const del = await api('/rest/v1/transactions?id=not.is.null', { method: 'DELETE' })

  const cats = await api('/rest/v1/categories?select=id,name,type,deleted_at')
  let removed = 0
  let restored = 0
  for (const c of cats.body) {
    if (!DEFAULTS.includes(c.name)) {
      await api(`/rest/v1/categories?id=eq.${c.id}`, { method: 'DELETE' })
      removed += 1
    } else if (c.deleted_at) {
      await api(`/rest/v1/categories?id=eq.${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ deleted_at: null }),
      })
      restored += 1
    }
  }

  const after = await api('/rest/v1/categories?select=id,name&deleted_at=is.null')
  const salary = after.body.find((c) => c.name === '급여')
  await api(`/rest/v1/profiles?id=eq.${uid}`, {
    method: 'PATCH',
    body: JSON.stringify({ salary_category_id: salary.id }),
  })

  if (!quiet) {
    console.log(
      `초기화: 거래 ${del.body?.length ?? 0}건 삭제 · 추가 카테고리 ${removed}개 삭제 · ${restored}개 복구 · 활성 ${after.body.length}개`,
    )
  }
  return { categories: after.body.length }
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  await reset()
}
