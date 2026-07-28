import { useId, useState } from 'react'

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string
  hint?: string
}

/**
 * 입력 스타일은 여기 한 곳에만 있다.
 * 이전에는 TextField 와 PasswordField 가 같은 클래스 문자열을 복붙해서,
 * 한쪽만 고치면 두 입력의 모양이 갈라졌다.
 */
const inputClass =
  'w-full rounded-control border border-line-2 px-3.5 py-3 text-body text-ink outline-none transition placeholder:text-ink-muted focus:border-ink'

function FieldShell({
  id,
  label,
  hint,
  action,
  children,
}: {
  id: string
  label: string
  hint?: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor={id} className="text-label text-ink-2">
          {label}
        </label>
        {action}
      </div>
      {children}
      {hint && <p className="mt-1.5 text-caption text-ink-muted">{hint}</p>}
    </div>
  )
}

export function TextField({ label, hint, className = '', ...rest }: Props) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint}>
      <input id={id} className={`${inputClass} ${className}`} {...rest} />
    </FieldShell>
  )
}

/**
 * 비밀번호 입력.
 * 확인 필드 대신 "표시" 토글을 쓴다 — 확인 필드는 입력을 두 배로 만들면서
 * 복붙으로 무력화되지만, 표시 토글은 필드 하나로 오타를 실제로 잡는다.
 */
export function PasswordField({ label, hint, ...rest }: Props) {
  const id = useId()
  const [shown, setShown] = useState(false)

  return (
    <FieldShell
      id={id}
      label={label}
      hint={hint}
      action={
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          className="text-caption text-ink-muted transition hover:text-ink"
        >
          {shown ? '숨기기' : '표시'}
        </button>
      }
    >
      <input id={id} type={shown ? 'text' : 'password'} className={inputClass} {...rest} />
    </FieldShell>
  )
}
