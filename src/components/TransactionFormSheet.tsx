import { useMemo, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { CategoryChips } from '@/components/CategoryChips'
import { FormError } from '@/components/AuthLayout'
import { useAllCategories, useCategories } from '@/hooks/useCategories'
import {
  useCreateTransaction,
  useDeleteTransaction,
  useUpdateTransaction,
  type TransactionListItem,
} from '@/hooks/useTransactions'
import { digitsOnly, formatAmount } from '@/lib/format'
import { addDays, today } from '@/lib/month'
import type { CategoryType } from '@/types/database'

/**
 * 가계부가 버려지는 1위 원인은 기능 부족이 아니라 입력 귀찮음이다.
 * 그래서 이 화면의 설계 목표는 "탭 수 최소화"다.
 *
 *  - 저장 버튼은 헤더 우측: 하단 고정 버튼은 모바일 키보드에 반드시 가린다.
 *  - 카테고리를 금액보다 위에: 키보드가 필요 없는 선택을 먼저 끝낸다.
 *    금액을 먼저 치면 올라온 키보드가 칩 그리드를 덮는다.
 *  - 지출이 기본 선택, 날짜 기본값은 오늘.
 */
export function TransactionFormSheet({
  initial,
  onClose,
}: {
  initial?: TransactionListItem
  onClose: () => void
}) {
  const isEdit = !!initial

  const [type, setType] = useState<CategoryType>(initial?.type ?? 'expense')
  const [categoryId, setCategoryId] = useState<string | null>(initial?.category_id ?? null)
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [occurredOn, setOccurredOn] = useState(initial?.occurred_on ?? today())
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [error, setError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const active = useCategories()
  const all = useAllCategories()
  const create = useCreateTransaction()
  const update = useUpdateTransaction()
  const remove = useDeleteTransaction()

  // 수정 중인 거래의 카테고리가 삭제됐을 수 있다.
  // 그 경우에도 칩에 남겨 두어야 카테고리를 강제로 바꾸지 않아도 된다.
  const chips = useMemo(() => {
    const list = (active.data ?? []).filter((c) => c.type === type)
    if (!categoryId || list.some((c) => c.id === categoryId)) return list
    const orphan = all.data?.find((c) => c.id === categoryId)
    return orphan && orphan.type === type ? [...list, orphan] : list
  }, [active.data, all.data, type, categoryId])

  const dirty =
    !isEdit ||
    type !== initial.type ||
    categoryId !== initial.category_id ||
    amount !== String(initial.amount) ||
    occurredOn !== initial.occurred_on ||
    memo !== (initial.memo ?? '')

  function requestClose() {
    if (dirty && !window.confirm('작성 중인 내용을 취소할까요?')) return
    onClose()
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const value = Number(amount)
    if (!categoryId) return setError('카테고리를 선택해 주세요')
    if (!Number.isFinite(value) || value <= 0) return setError('금액을 입력해 주세요')

    const payload = {
      category_id: categoryId,
      type,
      amount: value,
      occurred_on: occurredOn,
      memo: memo.trim() || null,
    }

    try {
      if (isEdit) await update.mutateAsync({ id: initial.id, ...payload })
      else await create.mutateAsync(payload)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const busy = create.isPending || update.isPending

  return (
    <Sheet
      title={isEdit ? '거래 수정' : `${type === 'expense' ? '지출' : '수입'} 등록`}
      onClose={requestClose}
      action={
        <button
          type="submit"
          form="transaction-form"
          disabled={busy}
          className="text-sm font-semibold text-neutral-900 disabled:opacity-40"
        >
          {busy ? '저장 중…' : '저장'}
        </button>
      }
    >
      <form id="transaction-form" onSubmit={submit} className="space-y-4">
        {/* 거래의 대부분은 지출이라 지출이 기본 선택이다. */}
        <div className="flex gap-1 rounded-xl bg-neutral-100 p-1">
          {(['expense', 'income'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                if (t === type) return
                setType(t)
                setCategoryId(null) // 타입이 바뀌면 카테고리 선택은 무효다
              }}
              className={`flex-1 rounded-lg py-2 text-sm transition ${
                type === t ? 'bg-white font-medium text-neutral-900 shadow-sm' : 'text-neutral-500'
              }`}
            >
              {t === 'expense' ? '지출' : '수입'}
            </button>
          ))}
        </div>

        <CategoryChips categories={chips} value={categoryId} onChange={setCategoryId} />

        <div className="space-y-3 border-t border-neutral-100 pt-4">
          <label className="flex items-center gap-3">
            <span className="w-10 shrink-0 text-sm text-neutral-500">금액</span>
            <span className="flex flex-1 items-baseline justify-end gap-1">
              <input
                inputMode="numeric"
                placeholder="0"
                value={amount ? formatAmount(Number(amount)) : ''}
                onChange={(e) => setAmount(digitsOnly(e.target.value).slice(0, 10))}
                className="w-full bg-transparent text-right text-xl font-semibold text-neutral-900 outline-none placeholder:text-neutral-300"
              />
              <span className="text-sm text-neutral-500">원</span>
            </span>
          </label>

          <div className="flex items-center gap-3">
            <span className="w-10 shrink-0 text-sm text-neutral-500">날짜</span>
            <div className="flex flex-1 items-center justify-end gap-1.5">
              {/* 실제 입력의 대부분이 어제/오늘이다. 달력은 예외 경로. */}
              <QuickDate label="어제" value={addDays(today(), -1)} current={occurredOn} onPick={setOccurredOn} />
              <QuickDate label="오늘" value={today()} current={occurredOn} onPick={setOccurredOn} />
              <input
                type="date"
                value={occurredOn}
                onChange={(e) => e.target.value && setOccurredOn(e.target.value)}
                className="rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900 outline-none focus:border-neutral-900"
              />
            </div>
          </div>

          <label className="flex items-center gap-3">
            <span className="w-10 shrink-0 text-sm text-neutral-500">메모</span>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              maxLength={100}
              placeholder="선택"
              className="flex-1 bg-transparent text-right text-[15px] text-neutral-900 outline-none placeholder:text-neutral-300"
            />
          </label>
        </div>

        <FormError>{error}</FormError>
      </form>

      {isEdit && (
        <div className="mt-5 border-t border-neutral-100 pt-4">
          {confirmingDelete ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-neutral-700">이 거래를 삭제할까요?</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="rounded-lg px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100"
                >
                  취소
                </button>
                <button
                  onClick={async () => {
                    await remove.mutateAsync(initial.id)
                    onClose()
                  }}
                  disabled={remove.isPending}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  삭제
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="text-sm text-red-600 hover:underline"
            >
              거래 삭제
            </button>
          )}
        </div>
      )}
    </Sheet>
  )
}

function QuickDate({
  label,
  value,
  current,
  onPick,
}: {
  label: string
  value: string
  current: string
  onPick: (v: string) => void
}) {
  const active = current === value
  return (
    <button
      type="button"
      onClick={() => onPick(value)}
      className={`rounded-lg px-2.5 py-1.5 text-sm transition ${
        active ? 'bg-neutral-900 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
      }`}
    >
      {label}
    </button>
  )
}
