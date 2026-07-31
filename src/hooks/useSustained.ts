import { useEffect, useState } from 'react'

/**
 * cond 가 delay 이상 이어질 때만 true.
 *
 * 로딩 표시를 즉시 켜면 100ms 에 끝나는 전환에서도 표시가 번쩍한다 — 깜빡임을
 * 없애려고 넣은 장치가 새 깜빡임을 만드는 셈이다. 그래서 표시는 실제로 기다리게
 * 되는 경로에만 나타나게 한다.
 *
 * cond 가 꺼지면 즉시 false 다 — 값이 도착한 순간에는 기다릴 이유가 없고,
 * 늦추면 이미 끝난 화면이 표시를 달고 남는다.
 */
export function useSustained(cond: boolean, delay: number) {
  const [on, setOn] = useState(false)

  useEffect(() => {
    if (!cond) {
      setOn(false)
      return
    }
    const id = setTimeout(() => setOn(true), delay)
    return () => clearTimeout(id)
  }, [cond, delay])

  return on
}
