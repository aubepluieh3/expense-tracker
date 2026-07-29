import { describe, expect, it } from 'vitest'
import {
  MAX_CATEGORY_NAME,
  MAX_NICKNAME,
  categoryNameError,
  nicknameError,
  normalizeSpaces,
} from '@/lib/rules'
import { MIN_PASSWORD, passwordError } from '@/auth/password'

/**
 * 이 규칙들은 DB 제약과 짝이 맞아야 한다. 어긋나면 화면은 통과시키고 DB 가
 * 거부하는데, 그 거부는 원시 Postgres 메시지로 돌아온다.
 */

describe('normalizeSpaces', () => {
  it('앞뒤 공백을 없앤다', () => {
    expect(normalizeSpaces('  헬스  ')).toBe('헬스')
  })

  it('연속 공백을 하나로 압축한다', () => {
    expect(normalizeSpaces('카페   간식')).toBe('카페 간식')
  })

  it('탭·개행도 공백으로 취급한다 — DB 트리거의 \\s+ 와 같아야 한다', () => {
    expect(normalizeSpaces('a\tb')).toBe('a b')
    expect(normalizeSpaces('a\nb')).toBe('a b')
  })

  it('공백만 있으면 빈 문자열이 된다 — 그래서 길이 검증이 걸린다', () => {
    expect(normalizeSpaces('   ')).toBe('')
  })

  it('멱등하다 — 두 번 걸어도 같다', () => {
    const once = normalizeSpaces('  카페   간식 ')
    expect(normalizeSpaces(once)).toBe(once)
  })
})

describe('nicknameError', () => {
  it('1~20자를 통과시킨다', () => {
    expect(nicknameError('가')).toBeNull()
    expect(nicknameError('a'.repeat(MAX_NICKNAME))).toBeNull()
  })

  it('비었거나 상한을 넘으면 문장을 준다', () => {
    expect(nicknameError('')).toBe('닉네임은 1~20자로 입력해 주세요')
    expect(nicknameError('a'.repeat(MAX_NICKNAME + 1))).toBe('닉네임은 1~20자로 입력해 주세요')
  })

  it('상한은 DB 제약(profiles_nickname_len)과 같다', () => {
    expect(MAX_NICKNAME).toBe(20)
  })
})

describe('categoryNameError', () => {
  it('1~20자를 통과시킨다', () => {
    expect(categoryNameError('식비')).toBeNull()
    expect(categoryNameError('a'.repeat(MAX_CATEGORY_NAME))).toBeNull()
  })

  it('라벨이 "이름" 이다 — 가입 화면의 닉네임과 문구가 갈리지 않아야 한다', () => {
    expect(categoryNameError('')).toBe('이름은 1~20자로 입력해 주세요')
  })

  it('상한은 DB 제약(categories_name_len)과 같다', () => {
    expect(MAX_CATEGORY_NAME).toBe(20)
  })
})

describe('passwordError', () => {
  it('8자 이상을 통과시킨다', () => {
    expect(passwordError('a'.repeat(MIN_PASSWORD))).toBeNull()
    expect(passwordError('a'.repeat(MIN_PASSWORD + 5))).toBeNull()
  })

  it('8자 미만이면 문장을 준다', () => {
    expect(passwordError('a'.repeat(MIN_PASSWORD - 1))).toBe('비밀번호는 8자 이상이어야 합니다')
    expect(passwordError('')).toBe('비밀번호는 8자 이상이어야 합니다')
  })

  it('공백을 지우지 않는다 — 비밀번호는 정규화 대상이 아니다', () => {
    expect(passwordError('  a  b  ')).toBeNull()
  })
})
