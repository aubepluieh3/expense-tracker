import { useId, useState } from 'react'

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'id'> & {
  label: string
  hint?: string
}

export function TextField({ label, hint, className = '', ...rest }: Props) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm text-neutral-700">
        {label}
      </label>
      <input
        id={id}
        className={`w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-[15px] outline-none placeholder:text-neutral-400 focus:border-neutral-900 ${className}`}
        {...rest}
      />
      {hint && <p className="mt-1.5 text-xs text-neutral-500">{hint}</p>}
    </div>
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
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <label htmlFor={id} className="text-sm text-neutral-700">
          {label}
        </label>
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          className="text-xs text-neutral-500 hover:text-neutral-900"
        >
          {shown ? '숨기기' : '표시'}
        </button>
      </div>
      <input
        id={id}
        type={shown ? 'text' : 'password'}
        className="w-full rounded-xl border border-neutral-300 px-3.5 py-3 text-[15px] outline-none placeholder:text-neutral-400 focus:border-neutral-900"
        {...rest}
      />
      {hint && <p className="mt-1.5 text-xs text-neutral-500">{hint}</p>}
    </div>
  )
}
