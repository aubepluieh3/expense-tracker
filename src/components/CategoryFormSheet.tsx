import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { Callout } from '@/components/ui/Callout'
import { EmojiPicker } from '@/components/EmojiPicker'

/**
 * onSubmit 이 이걸 반환하면 시트를 닫지 않는다 — 부모가 이미 다른 시트를 열었다는 뜻.
 *
 * 필요해진 이유: 카테고리 관리가 삭제 확인·되살리기 제안을 하나의 sheet 상태로
 * 합치면서, 되살리기를 열어도 폼이 성공으로 보고 onClose() 를 불러 바로 덮어버렸다.
 * null(성공·닫기) / string(에러·유지) 두 가지로는 표현할 수 없는 세 번째 경우다.
 */
export const HANDLED = Symbol('handled')

export function CategoryFormSheet({
  title,
  initial,
  extra,
  onClose,
  onSubmit,
}: {
  title: string
  initial?: { name: string; emoji: string }
  /** 급여 지정 토글처럼 폼 아래에 붙는 추가 항목 */
  extra?: React.ReactNode
  onClose: () => void
  /** null = 성공·닫기 · string = 에러 표시 · HANDLED = 부모가 처리했으니 닫지 않음 */
  onSubmit: (v: { name: string; emoji: string }) => Promise<string | null | typeof HANDLED>
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [emoji, setEmoji] = useState(initial?.emoji ?? '📦')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const trimmed = name.trim().replace(/\s+/g, ' ')
    if (trimmed.length < 1 || trimmed.length > 20) {
      setError('이름은 1~20자로 입력해 주세요')
      return
    }

    setBusy(true)
    const result = await onSubmit({ name: trimmed, emoji })
    setBusy(false)

    if (result === HANDLED) return
    if (result) setError(result)
    else onClose()
  }

  return (
    <Sheet title={title} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <TextField
          label="이름"
          required
          maxLength={20}
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <EmojiPicker value={emoji} onChange={setEmoji} />
        {extra}
        <Callout tone="error">{error}</Callout>
        <Button type="submit" loading={busy}>
          저장
        </Button>
      </form>
    </Sheet>
  )
}
