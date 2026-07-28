import { useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { FormError } from '@/components/AuthLayout'
import { EmojiPicker } from '@/components/EmojiPicker'

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
  /** 에러 메시지를 반환하면 시트를 닫지 않고 표시한다. null 이면 성공. */
  onSubmit: (v: { name: string; emoji: string }) => Promise<string | null>
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
    const message = await onSubmit({ name: trimmed, emoji })
    setBusy(false)

    if (message) setError(message)
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
        <FormError>{error}</FormError>
        <Button type="submit" loading={busy}>
          저장
        </Button>
      </form>
    </Sheet>
  )
}
