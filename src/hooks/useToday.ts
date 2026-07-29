import { useEffect, useState } from 'react'
import { today } from '@/lib/month'

/**
 * 로컬 기준 오늘 'YYYY-MM-DD'. 자정을 넘기면 스스로 갱신된다.
 *
 * today() 를 그냥 부르면 렌더 시점에 한 번 계산되고 다시 계산할 계기가 없다.
 * queryClient 는 refetchOnWindowFocus 를 껐고, 탭을 열어 둔 채 자정을 넘기는 건
 * 모바일의 기본 사용 패턴이다. 그래서 다음이 하루씩 틀어졌다:
 *
 *   - 등록 시트의 "어제"·"오늘" 버튼이 하루 밀린 날짜를 저장
 *   - 내역의 "예정" 배지가 어제 거래에 붙음
 *   - 월급 위젯 쿼리 키(salary-widget, today)가 안 바뀌어 p_today 가 어제로 고정
 *
 * DB 타임존(UTC)과 KST 의 차이는 p_today 를 클라이언트가 넘겨서 이미 해결해
 * 두었는데(0003), 정작 클라이언트 쪽 자정 경계가 비어 있었다.
 *
 * 두 경로로 갱신한다:
 *   1) 다음 자정에 맞춘 타이머 — 탭이 떠 있는 채로 날이 바뀌는 경우
 *   2) visibilitychange — 백그라운드 탭은 타이머가 조여져서 늦게 깨거나
 *      아예 안 깬다. 다음 날 아침에 앱으로 돌아오는 실제 경로가 이쪽이다.
 *
 * lib/month.ts 에 두지 않는다 — 그 파일은 문자열·숫자 연산만 하는 순수 모듈이다.
 */
export function useToday(): string {
  const [value, setValue] = useState(today)

  useEffect(() => {
    let timer: number

    function schedule() {
      const now = new Date()
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime()
      // 1초 여유를 둔다. 자정 정각에 깨면 타이머 오차로 아직 어제일 수 있다.
      timer = window.setTimeout(
        () => {
          setValue(today())
          schedule()
        },
        nextMidnight - now.getTime() + 1000,
      )
    }

    function sync() {
      if (document.visibilityState === 'visible') setValue(today())
    }

    schedule()
    document.addEventListener('visibilitychange', sync)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  return value
}
