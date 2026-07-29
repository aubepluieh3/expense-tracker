import { useMemo, useState } from 'react'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'
import { SegmentedControl, TYPE_OPTIONS } from '@/components/ui/SegmentedControl'
import { CategoryChips } from '@/components/CategoryChips'
import { Callout } from '@/components/ui/Callout'
import { useAllCategories, useCategories, useRecentCategoryIds } from '@/hooks/useCategories'
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
  const [confirmingClose, setConfirmingClose] = useState(false)

  const active = useCategories()
  const all = useAllCategories()
  const recentIds = useRecentCategoryIds()
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

  /**
   * 그리드 위에 따로 붙는 "최근" 줄. 최근 사용순 id 를 이번 타입의 칩과 교집합한다.
   *
   * 시트가 열려 있는 동안에는 절대 바뀌지 않는다 — 무효화는 저장 성공 시점에
   * 일어나고 그때 시트는 닫힌다(refetchOnWindowFocus 도 꺼 두었다).
   * 고르는 중에 칩이 움직이면 이 줄을 따로 둔 의미가 없어진다.
   */
  const recent = useMemo(() => {
    const byId = new Map(chips.map((c) => [c.id, c]))
    return (recentIds.data ?? []).flatMap((id) => byId.get(id) ?? [])
  }, [recentIds.data, chips])

  /**
   * 새 거래는 "사용자가 뭔가 입력했는가"로 판단한다.
   * !isEdit 을 그대로 dirty 로 쓰면 시트를 열고 바로 닫아도 확인창이 떴다.
   */
  const dirty = isEdit
    ? type !== initial.type ||
      categoryId !== initial.category_id ||
      amount !== String(initial.amount) ||
      occurredOn !== initial.occurred_on ||
      memo !== (initial.memo ?? '')
    : categoryId !== null || amount !== '' || memo !== '' || occurredOn !== today()

  /**
   * window.confirm 을 쓰지 않는다. 브라우저 기본 다이얼로그는 "localhost:5173에
   * 표시된 메시지" 가 붙고 OS 스타일로 떠서 앱과 전혀 맞지 않는다. 삭제 확인은
   * 이미 시트 안 인라인으로 처리하고 있었는데 이 경로만 빠져 있었다.
   */
  function requestClose() {
    if (dirty) {
      setConfirmingClose(true)
      return
    }
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
          className="text-label font-semibold text-ink disabled:opacity-40"
        >
          {busy ? '저장 중…' : '저장'}
        </button>
      }
    >
      {/* ✕ 를 누른 자리 바로 아래에 띄운다. 시트 아래쪽에 두면 방금 누른 곳에서
          시선이 멀어진다. */}
      {confirmingClose && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-control bg-surface-3 px-3.5 py-3">
          <span className="text-label text-ink">작성 중인 내용을 버릴까요?</span>
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" size="inline" onClick={() => setConfirmingClose(false)}>
              계속 작성
            </Button>
            <Button variant="danger" size="inline" onClick={onClose}>
              버리기
            </Button>
          </div>
        </div>
      )}

      <form id="transaction-form" onSubmit={submit} className="space-y-4">
        {/* 거래의 대부분은 지출이라 지출이 기본 선택이다. */}
        <SegmentedControl
          label="수입·지출 구분"
          options={TYPE_OPTIONS}
          value={type}
          onChange={(t) => {
            setType(t)
            setCategoryId(null) // 타입이 바뀌면 카테고리 선택은 무효다
          }}
        />

        <CategoryChips
          categories={chips}
          recent={recent}
          value={categoryId}
          onChange={setCategoryId}
        />

        <div className="space-y-3 border-t border-line pt-4">
          <label className="flex items-center gap-3">
            <span className="w-10 shrink-0 text-label text-ink-muted">금액</span>
            <span className="flex flex-1 items-baseline justify-end gap-1">
              <input
                inputMode="numeric"
                placeholder="0"
                value={amount ? formatAmount(Number(amount)) : ''}
                onChange={(e) => setAmount(digitsOnly(e.target.value).slice(0, 10))}
                className="w-full bg-transparent text-right text-xl font-semibold text-ink outline-none placeholder:text-ink-muted"
              />
              <span className="text-label text-ink-muted">원</span>
            </span>
          </label>

          <div className="flex items-center gap-3">
            <span className="w-10 shrink-0 text-label text-ink-muted">날짜</span>
            <div className="flex flex-1 items-center justify-end gap-1.5">
              {/* 실제 입력의 대부분이 어제/오늘이다. 달력은 예외 경로. */}
              <QuickDate label="어제" value={addDays(today(), -1)} current={occurredOn} onPick={setOccurredOn} />
              <QuickDate label="오늘" value={today()} current={occurredOn} onPick={setOccurredOn} />
              <input
                type="date"
                value={occurredOn}
                onChange={(e) => e.target.value && setOccurredOn(e.target.value)}
                className="rounded-control border border-line-2 px-2 py-1.5 text-label text-ink outline-none focus:border-ink"
              />
            </div>
          </div>

          <label className="flex items-center gap-3">
            <span className="w-10 shrink-0 text-label text-ink-muted">메모</span>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              maxLength={100}
              placeholder="선택"
              className="flex-1 bg-transparent text-right text-body text-ink outline-none placeholder:text-ink-muted"
            />
          </label>
        </div>

        <Callout tone="error">{error}</Callout>
      </form>

      {isEdit && (
        <div className="mt-5 border-t border-line pt-4">
          {confirmingDelete ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-label text-ink-2">이 거래를 삭제할까요?</span>
              <div className="flex gap-2">
                <Button variant="ghost" size="inline" onClick={() => setConfirmingDelete(false)}>
                  취소
                </Button>
                <Button
                  variant="danger"
                  size="inline"
                  loading={remove.isPending}
                  onClick={async () => {
                    await remove.mutateAsync(initial.id)
                    onClose()
                  }}
                >
                  삭제
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="text-label text-danger hover:underline"
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
      className={`rounded-control px-2.5 py-1.5 text-label transition ${
        active ? 'bg-accent text-white' : 'bg-surface-3 text-ink-2 hover:bg-selected'
      }`}
    >
      {label}
    </button>
  )
}
