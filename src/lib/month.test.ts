import { describe, expect, it } from 'vitest'
import {
  addDays,
  currentMonth,
  dayLabel,
  daysBetween,
  isValidMonth,
  monthLabel,
  monthRange,
  relativeDayLabel,
  shiftMonth,
  shortDate,
  today,
} from '@/lib/month'

/**
 * 이 파일은 순수 함수만 들어 있어서 테스트 비용이 거의 없는데 검증이 0건이었다.
 * e2e 가 간접적으로 덮고 있었지만, 경계값(말일·연말·윤년)은 오늘 날짜에 따라
 * 우연히만 지나간다 — 12월에만 깨지는 버그는 12월에만 잡힌다.
 *
 * 목표는 커버리지 숫자가 아니라 "달 경계에서 하루 밀리는" 부류를 고정하는 것이다.
 * 이 앱은 그 실수를 이미 두 번 했다(0003 의 타임존, useToday 의 자정).
 */

describe('shiftMonth', () => {
  it('같은 해 안에서 이동한다', () => {
    expect(shiftMonth('2026-07', 1)).toBe('2026-08')
    expect(shiftMonth('2026-07', -1)).toBe('2026-06')
  })

  it('연말·연초를 넘는다', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })

  it('12개월 이상도 이동한다', () => {
    expect(shiftMonth('2026-07', 12)).toBe('2027-07')
    expect(shiftMonth('2026-07', -12)).toBe('2025-07')
    expect(shiftMonth('2026-07', 18)).toBe('2028-01')
  })

  it('0 이면 그대로다', () => {
    expect(shiftMonth('2026-07', 0)).toBe('2026-07')
  })

  it('결과는 항상 2자리 월이다', () => {
    expect(shiftMonth('2026-09', 1)).toBe('2026-10')
    expect(shiftMonth('2026-10', -1)).toBe('2026-09')
  })
})

describe('monthRange', () => {
  it('반열린 구간 [start, end) 을 만든다', () => {
    expect(monthRange('2026-07')).toEqual({ start: '2026-07-01', end: '2026-08-01' })
  })

  it('12월의 end 는 다음 해 1월이다', () => {
    expect(monthRange('2026-12')).toEqual({ start: '2026-12-01', end: '2027-01-01' })
  })

  it('2월도 말일을 계산하지 않는다 — 다음 달 1일이 end 다', () => {
    // BETWEEN 을 쓰면 여기서 28/29 를 판단해야 한다. 그걸 피하는 게 이 함수의 목적이다.
    expect(monthRange('2024-02').end).toBe('2024-03-01')
    expect(monthRange('2026-02').end).toBe('2026-03-01')
  })
})

describe('addDays', () => {
  it('달 경계를 넘는다', () => {
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01')
    expect(addDays('2026-08-01', -1)).toBe('2026-07-31')
  })

  it('연 경계를 넘는다', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('윤년 2월을 안다', () => {
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
  })

  it('0 이면 그대로다', () => {
    expect(addDays('2026-07-15', 0)).toBe('2026-07-15')
  })
})

describe('daysBetween', () => {
  it('to − from 을 일 단위로 준다', () => {
    expect(daysBetween('2026-07-01', '2026-07-08')).toBe(7)
    expect(daysBetween('2026-07-08', '2026-07-01')).toBe(-7)
    expect(daysBetween('2026-07-01', '2026-07-01')).toBe(0)
  })

  it('달·해를 넘어도 맞다', () => {
    expect(daysBetween('2026-07-31', '2026-08-01')).toBe(1)
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1)
  })

  it('윤년을 포함한 1년은 366일이다', () => {
    expect(daysBetween('2024-01-01', '2025-01-01')).toBe(366)
    expect(daysBetween('2026-01-01', '2027-01-01')).toBe(365)
  })

  it('DST 전환 구간에서도 정수 일수를 준다', () => {
    // Date.UTC 로 계산하므로 로컬 DST 와 무관하다. 로컬 자정 기준으로 뺐다면
    // 23시간/25시간이 섞여 Math.round 가 흔들릴 수 있는 구간이다.
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2)
    expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2)
  })
})

describe('relativeDayLabel', () => {
  it('오늘이면 null — 알릴 게 없다', () => {
    expect(relativeDayLabel('2026-07-29', '2026-07-29')).toBeNull()
  })

  it('하루 차이는 어제·내일이다', () => {
    expect(relativeDayLabel('2026-07-28', '2026-07-29')).toBe('어제')
    expect(relativeDayLabel('2026-07-30', '2026-07-29')).toBe('내일')
  })

  it('이틀 이상은 N일 전·N일 후다', () => {
    expect(relativeDayLabel('2026-07-27', '2026-07-29')).toBe('2일 전')
    expect(relativeDayLabel('2026-08-04', '2026-07-29')).toBe('6일 후')
  })

  it('달을 넘는 차이도 센다', () => {
    expect(relativeDayLabel('2026-06-29', '2026-07-29')).toBe('30일 전')
  })
})

describe('isValidMonth', () => {
  it('YYYY-MM 만 통과한다', () => {
    expect(isValidMonth('2026-07')).toBe(true)
    expect(isValidMonth('2026-01')).toBe(true)
    expect(isValidMonth('2026-12')).toBe(true)
  })

  it('범위 밖 월을 거른다', () => {
    expect(isValidMonth('2026-00')).toBe(false)
    expect(isValidMonth('2026-13')).toBe(false)
  })

  it('모양이 다르면 거른다 — URL 로 아무 값이나 들어온다', () => {
    expect(isValidMonth('2026-7')).toBe(false)
    expect(isValidMonth('2026-07-01')).toBe(false)
    expect(isValidMonth('abcd-ef')).toBe(false)
    expect(isValidMonth('')).toBe(false)
    expect(isValidMonth(null)).toBe(false)
  })
})

describe('라벨', () => {
  it('monthLabel 은 앞의 0 을 버린다', () => {
    expect(monthLabel('2026-07')).toBe('2026년 7월')
    expect(monthLabel('2026-12')).toBe('2026년 12월')
  })

  it('shortDate 는 M.D 다', () => {
    expect(shortDate('2026-07-29')).toBe('7.29')
    expect(shortDate('2026-01-05')).toBe('1.5')
  })

  it('dayLabel 은 요일을 붙인다', () => {
    // 2026-07-29 는 수요일
    expect(dayLabel('2026-07-29')).toBe('7월 29일 (수)')
    // 2026-08-01 은 토요일
    expect(dayLabel('2026-08-01')).toBe('8월 1일 (토)')
  })
})

describe('오늘 기준 값', () => {
  it('today() 와 currentMonth() 는 서로 일관된다', () => {
    // 자정 직전에 두 함수가 각각 Date 를 새로 만들면 하루가 어긋날 수 있다.
    // 여기서 잡을 수 있는 것은 "형식과 접두사가 맞는가" 까지다.
    expect(today()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(currentMonth()).toMatch(/^\d{4}-\d{2}$/)
    expect(today().startsWith(currentMonth())).toBe(true)
  })

  it('relativeDayLabel 의 from 기본값은 오늘이다', () => {
    expect(relativeDayLabel(today())).toBeNull()
    expect(relativeDayLabel(addDays(today(), -1))).toBe('어제')
  })
})
