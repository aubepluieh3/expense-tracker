import { useMemo, useRef, useState } from 'react'
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
import { useToday } from '@/hooks/useToday'
import { digitsOnly, formatAmount } from '@/lib/format'
import { addDays, relativeDayLabel, today } from '@/lib/month'
import type { CategoryType } from '@/types/database'

/**
 * 직전에 저장한 날짜. 다음 새 시트가 이걸 물려받는다.
 *
 * 주말에 지난주를 몰아 적으면 시트를 열 때마다 날짜가 오늘로 되돌아가서 매번
 * 달력을 다시 열어야 했다. 직전 값을 물려주면 그 왕복이 사라진다.
 *
 * 모듈 스코프인 것은 의도다 — 새로고침하면 오늘로 초기화된다. localStorage 에
 * 넣으면 어제 몰아 적기를 끝낸 날짜가 다음 날까지 살아남아, 오늘 점심값이
 * 조용히 지난주로 들어간다. 몰아 적기는 한 번에 끝내는 작업이라 세션을 넘길
 * 이유가 없다.
 *
 * 수정 시트는 여기에 쓰지 않는다. 과거 거래를 고치는 건 작업 날짜를 정하는
 * 행동이 아니다.
 */
let carriedDate: string | null = null

/**
 * 금액 상한. transactions.amount 가 integer(int4) 라서 하드 상한이
 * 2,147,483,647 이다. 이전에는 입력을 10자리까지 허용해서 그 위를 칠 수 있었고,
 * 클라이언트 검증(> 0)은 통과한 뒤 INSERT 가 22003 으로 터졌다 —
 * `value "3000000000" is out of range for type integer` 가 그대로 화면에 떴다.
 *
 * 9자리로 끊는다. 개인 가계부의 한 건이 10억을 넘을 일은 없고,
 * 자리수로 막으면 상한 초과가 애초에 입력 불가능한 상태가 된다.
 */
const AMOUNT_DIGITS = 9

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
  onSaved,
  onDeleted,
}: {
  initial?: TransactionListItem
  onClose: () => void
  /**
   * 저장 성공 시 닫기 대신 이걸 부른다. 저장된 날짜를 넘기는 이유는 호출부가
   * "지금 보는 달에 없는 거래를 저장했는가"를 판단해야 하기 때문이다.
   */
  onSaved?: (occurredOn: string) => void
  /**
   * 삭제 성공 시 닫기 대신 이걸 부른다. 지운 행을 넘기는 이유는 호출부가
   * 실행 취소 스낵바를 띄워야 하고, 되살리려면 값이 필요하기 때문이다.
   * 스낵바는 시트가 닫힌 뒤에도 남아야 하므로 이 컴포넌트가 가질 수 없다.
   */
  onDeleted?: (item: TransactionListItem) => void
}) {
  const isEdit = !!initial

  const [type, setType] = useState<CategoryType>(initial?.type ?? 'expense')
  const [categoryId, setCategoryId] = useState<string | null>(initial?.category_id ?? null)
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [occurredOn, setOccurredOn] = useState(initial?.occurred_on ?? carriedDate ?? today())
  /**
   * 시트를 연 시점의 날짜. dirty 판정 기준이다.
   * today() 와 비교하면 물려받은 날짜 때문에 열자마자 "작성 중"으로 판정돼서,
   * 아무것도 안 하고 닫아도 확인창이 떴다.
   */
  const openedWith = useRef(occurredOn).current
  const [memo, setMemo] = useState(initial?.memo ?? '')
  const [error, setError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)
  /**
   * 상한에 닿아 입력이 잘렸다는 표시.
   *
   * amount.length === AMOUNT_DIGITS 로 판단하지 않는다 — 9자리를 정확히 채운
   * 정상 입력(999,999,999)에도 경고가 붙는다. 잘린 것은 값이 아니라 사건이다.
   */
  const [amountCapped, setAmountCapped] = useState(false)

  /**
   * 자정을 넘겨도 "어제"·"오늘" 버튼과 경고 줄이 같은 날을 가리키게 한다.
   * occurredOn 의 초기값은 열었을 때의 오늘로 남는다 — 사용자가 그걸 보고 열었다.
   */
  const todayIso = useToday()

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
    : categoryId !== null || amount !== '' || memo !== '' || occurredOn !== openedWith

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
      else {
        await create.mutateAsync(payload)
        carriedDate = occurredOn
      }
      if (onSaved) onSaved(occurredOn)
      else onClose()
    } catch (e) {
      /**
       * 원시 Postgres 메시지를 화면에 올리지 않는다. 사용자가 할 수 있는 일이
       * 없는 문장이고("violates check constraint …"), 이 앱의 다른 에러는 전부
       * 한국어 한 줄이다. 진단 정보는 콘솔로 보낸다.
       */
      console.error('거래 저장 실패', e)
      setError('저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    }
  }

  /** id 를 인자로 받는다 — isEdit 분기 안에서만 불리지만 ! 로 타입을 우회하지 않는다. */
  async function confirmDelete(item: TransactionListItem) {
    setError('')
    try {
      await remove.mutateAsync(item.id)
    } catch (e) {
      // 이전에는 catch 가 없어서, 확인까지 누른 삭제가 실패하면 시트가 그대로
      // 남고 아무 메시지도 없었다.
      console.error('거래 삭제 실패', e)
      setError('삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      return
    }
    // 지운 행을 그대로 넘긴다 — 실행 취소를 하려면 되살릴 값이 필요하고,
    // 그 값을 아는 마지막 지점이 여기다(시트는 곧 닫힌다).
    if (onDeleted) onDeleted(item)
    else onClose()
  }

  const busy = create.isPending || update.isPending
  /**
   * 오늘이면 null. 그 자체가 "알릴 게 없다"는 뜻이라 따로 isToday 를 두지 않는다.
   *
   * 수정 시트에서는 띄우지 않는다. 거기 날짜는 기록에서 온 값이라 조용히 틀릴
   * 위험이 없고, 오늘 것이 아닌 거래를 열 때마다 배너가 떠서 소음이 된다.
   */
  const dateNotice = isEdit ? null : relativeDayLabel(occurredOn, todayIso)

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
          type={type}
          recent={recent}
          value={categoryId}
          onChange={setCategoryId}
        />

        <div className="space-y-3 border-t border-line pt-4">
          <div>
            <label className="flex items-center gap-3">
              <span className="w-10 shrink-0 text-label text-ink-muted">금액</span>
              <span className="flex flex-1 items-baseline justify-end gap-1">
                <input
                  inputMode="numeric"
                  placeholder="0"
                  value={amount ? formatAmount(Number(amount)) : ''}
                  onChange={(e) => {
                    const digits = digitsOnly(e.target.value)
                    setAmountCapped(digits.length > AMOUNT_DIGITS)
                    setAmount(digits.slice(0, AMOUNT_DIGITS))
                  }}
                  className="w-full bg-transparent text-right text-xl font-semibold text-ink outline-none placeholder:text-ink-muted"
                />
                <span className="text-label text-ink-muted">원</span>
              </span>
            </label>

            {/* 자리수로 막는 것만으로는 키보드가 안 먹는 것처럼 보인다.
                상한 자체는 옳지만, 왜 안 들어가는지 모르는 것이 문제였다. */}
            {amountCapped && (
              <p className="mt-1 text-right text-caption text-ink-muted">
                최대 {formatAmount(10 ** AMOUNT_DIGITS - 1)}원까지 입력할 수 있어요
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center gap-3">
              <span className="w-10 shrink-0 text-label text-ink-muted">날짜</span>
              <div className="flex flex-1 items-center justify-end gap-1.5">
                {/* 실제 입력의 대부분이 어제/오늘이다. 달력은 예외 경로. */}
                <QuickDate label="어제" value={addDays(todayIso, -1)} current={occurredOn} onPick={setOccurredOn} />
                <QuickDate label="오늘" value={todayIso} current={occurredOn} onPick={setOccurredOn} />
                <input
                  type="date"
                  value={occurredOn}
                  onChange={(e) => e.target.value && setOccurredOn(e.target.value)}
                  // 오늘이 아니면 링 + 굵기로 표시한다. 색을 쓰지 않는 이유는 이 앱의
                  // 강조색이 검정 하나뿐이고(index.css), 빨강은 삭제·초과에 예약돼 있어서다.
                  // 선택된 칩과 같은 장치라 사용자가 이미 학습한 신호다.
                  className={`rounded-control border border-line-2 px-2 py-1.5 text-label text-ink outline-none focus:border-ink ${
                    dateNotice ? 'font-semibold ring-2 ring-ink' : ''
                  }`}
                />
              </div>
            </div>

            {/* 날짜 유지의 대가. 직전 날짜를 물려받으므로, 몰아 적기를 끝낸 뒤
                오늘 것을 넣을 때 안 보고 저장하면 지난 날짜로 들어간다.
                금액·월별 합계·월급 위젯이 함께 틀어지는데 에러는 나지 않는다.
                그래서 없던 줄이 나타나게 했다 — 레이아웃 변화가 색보다 눈에 띈다. */}
            {dateNotice && (
              <p className="mt-2 rounded-control bg-selected px-3 py-1.5 text-right text-caption font-semibold text-ink">
                {dateNotice} 날짜로 저장됩니다
              </p>
            )}
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
                  onClick={() => void confirmDelete(initial)}
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
