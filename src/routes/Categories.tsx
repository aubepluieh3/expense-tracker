import { useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { Page } from '@/components/ui/Screen'
import { Sheet } from '@/components/ui/Sheet'
import { Button, SubtleButton } from '@/components/ui/Button'
import { Callout } from '@/components/ui/Callout'
import { TextLink } from '@/components/ui/TextLink'
import { List, rowClass, rowEmojiClass } from '@/components/ui/List'
import { SegmentedControl, TYPE_OPTIONS } from '@/components/ui/SegmentedControl'
import { ErrorState, ListSkeleton } from '@/components/states'
import { Snackbar, type SnackbarState } from '@/components/ui/Snackbar'
import { CategoryFormSheet, HANDLED } from '@/components/CategoryFormSheet'
import type { Category, CategoryType } from '@/types/database'
import {
  UNIQUE_VIOLATION,
  findDeletedByName,
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useProfile,
  useRestoreCategory,
  useSetSalaryCategory,
  useTransactionCount,
  useUpdateCategory,
} from '@/hooks/useCategories'

/**
 * 열려 있는 시트는 항상 하나다.
 * 이전에는 sheet / confirm / restore 세 상태로 나눠 두었는데, 동시에 열릴 수
 * 없는 것들이라 나눌 이유가 없었다. 로컬 상태가 5개였다.
 */
type Sheets =
  | { kind: 'create' }
  | { kind: 'edit'; category: Category }
  | { kind: 'delete'; category: Category }
  | { kind: 'restore'; category: Category }
  | null

/**
 * 원시 Postgres 메시지 대신 한국어 한 줄.
 *
 * 이전에는 UNIQUE 위반이 아닌 에러를 err.message 그대로 올려서
 * "new row for relation ... violates check constraint" 같은 문장이 시트에 떴다.
 * 사용자가 할 수 있는 일이 없는 문장이고 진단은 콘솔이 맡으면 된다.
 */
function toMessage(e: unknown, what: string): string {
  console.error(`${what} 실패`, e)
  return `${what}하지 못했습니다. 잠시 후 다시 시도해 주세요.`
}

/** UNIQUE 위반이면 그 이름의 삭제된 카테고리를 찾아 되살리기를 제안한다. */
async function toRestoreOrMessage(
  e: unknown,
  type: CategoryType,
  name: string,
): Promise<{ restore: Category } | { message: string }> {
  const err = e as PostgrestError
  if (err.code !== UNIQUE_VIOLATION) return { message: toMessage(e, '카테고리 추가') }

  // 되살리기 후보를 찾는 조회도 실패할 수 있다. 그때는 이름 충돌만 알린다.
  try {
    const deleted = await findDeletedByName(type, name)
    if (deleted) return { restore: deleted }
  } catch (lookupError) {
    console.error('삭제된 카테고리 조회 실패', lookupError)
  }
  return { message: '이미 있는 이름입니다' }
}

export default function Categories() {
  const [tab, setTab] = useState<CategoryType>('expense')
  const [sheet, setSheetState] = useState<Sheets>(null)
  const [snack, setSnack] = useState<SnackbarState>(null)
  /**
   * 시트 안에서 일어난 동작의 실패. 시트를 갈아탈 때 반드시 비워야 하므로
   * setSheet 를 거치게 한다 — 남겨 두면 삭제 실패 메시지가 되살리기 시트에 뜬다.
   */
  const [actionError, setActionError] = useState('')

  function setSheet(next: Sheets) {
    setActionError('')
    setSheetState(next)
  }

  const categories = useCategories()
  const profile = useProfile()

  const create = useCreateCategory()
  const update = useUpdateCategory()
  const remove = useDeleteCategory()
  const restore = useRestoreCategory()

  // 삭제·되살리기 안내에 쓰는 거래 건수. 해당 시트가 열릴 때만 조회된다.
  const counted = sheet?.kind === 'delete' || sheet?.kind === 'restore' ? sheet.category : null
  const txCount = useTransactionCount(counted?.id ?? null)

  const list = (categories.data ?? []).filter((c) => c.type === tab)
  const salaryId = profile.data?.salary_category_id ?? null

  async function submitCreate({ name, emoji }: { name: string; emoji: string }) {
    try {
      await create.mutateAsync({ type: tab, name, emoji })
      return null
    } catch (e) {
      const r = await toRestoreOrMessage(e, tab, name)
      if ('message' in r) return r.message
      // 되살리기 시트로 갈아탄다. null 을 반환하면 폼이 성공으로 보고 onClose() 를
      // 불러 방금 띄운 시트를 덮어버린다.
      setSheet({ kind: 'restore', category: r.restore })
      return HANDLED
    }
  }

  async function submitEdit(id: string, { name, emoji }: { name: string; emoji: string }) {
    try {
      await update.mutateAsync({ id, name, emoji })
      return null
    } catch (e) {
      const err = e as PostgrestError
      return err.code === UNIQUE_VIOLATION ? '이미 있는 이름입니다' : toMessage(e, '수정')
    }
  }

  /**
   * 성공한 뒤에 닫는다. 이전에는 setSheet(null) 을 먼저 하고 catch 없이 await 했다 —
   * 실패하면 시트만 닫히고 스낵바도 에러도 없어서, 실패가 성공처럼 보였다.
   */
  async function confirmDelete(category: Category) {
    setActionError('')
    try {
      await remove.mutateAsync(category.id)
    } catch {
      setActionError('삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      return
    }
    setSheetState(null)
    setSnack({
      message: `'${category.name}'을(를) 삭제했습니다.`,
      actionLabel: '실행 취소',
      // 실행 취소는 시트가 이미 닫힌 뒤라 에러를 담을 곳이 스낵바뿐이다.
      onAction: () => void undoDelete(category),
    })
  }

  async function undoDelete(category: Category) {
    try {
      await restore.mutateAsync(category.id)
    } catch {
      setSnack({ message: `'${category.name}'을(를) 되살리지 못했습니다.`, tone: 'error' })
    }
  }

  async function confirmRestore(category: Category) {
    setActionError('')
    try {
      await restore.mutateAsync(category.id)
    } catch {
      setActionError('되살리지 못했습니다. 잠시 후 다시 시도해 주세요.')
      return
    }
    setSheetState(null)
  }

  /**
   * 두 시트가 같은 문장 구조를 쓴다.
   *
   * 조회 실패를 0건과 합치면 안 된다 — 거래 300건이 달린 카테고리를 두고
   * "연결된 거래는 없습니다"를 보여주게 된다. 파괴적 결정 바로 앞의 안내다.
   */
  function countLine(withCount: (n: number) => string) {
    if (txCount.isPending) return '연결된 거래를 확인하는 중…'
    if (txCount.isError) return '연결된 거래를 확인하지 못했습니다.'
    return txCount.data ? withCount(txCount.data) : '연결된 거래는 없습니다.'
  }

  return (
    <Page
      title="카테고리 관리"
      back={
        <TextLink to="/settings" className="font-normal text-label text-ink-muted no-underline">
          ← 설정
        </TextLink>
      }
    >
      <div className="mb-4">
        <SegmentedControl
          label="수입·지출 구분"
          options={TYPE_OPTIONS}
          value={tab}
          onChange={setTab}
        />
      </div>

      {categories.isPending && <ListSkeleton rows={5} />}
      {categories.isError && <ErrorState onRetry={() => void categories.refetch()} />}

      <List>
        {list.map((c) => (
          <li key={c.id} className={rowClass}>
            <span aria-hidden className={rowEmojiClass}>
              {c.emoji}
            </span>
            <span className="min-w-0 flex-1 truncate text-body text-ink">{c.name}</span>
            {c.id === salaryId && (
              <span className="rounded-control bg-surface-3 px-1.5 py-0.5 text-caption text-ink-2">
                월급 기준
              </span>
            )}
            {/* 이전에는 회색 글자라 누를 수 있는 것인지 알 수 없었다. */}
            <SubtleButton onClick={() => setSheet({ kind: 'edit', category: c })}>
              수정
            </SubtleButton>
            <SubtleButton tone="danger" onClick={() => setSheet({ kind: 'delete', category: c })}>
              삭제
            </SubtleButton>
          </li>
        ))}
      </List>

      {!categories.isPending && list.length === 0 && (
        <p className="py-8 text-center text-label text-ink-muted">카테고리가 없습니다</p>
      )}

      <div className="mt-4">
        <Button variant="ghost" onClick={() => setSheet({ kind: 'create' })}>
          ＋ 카테고리 추가
        </Button>
      </div>

      {/* 삭제된 카테고리 목록은 두지 않는다. 사용자는 삭제했다고 인식하는데
          목록이 남아 있으면 "지웠는데 안 지워진" 느낌을 준다.
          되살리기는 스낵바 실행 취소와 이름 충돌 시 제안, 두 경로로 제공한다. */}

      {sheet?.kind === 'create' && (
        <CategoryFormSheet
          title={`${tab === 'expense' ? '지출' : '수입'} 카테고리 추가`}
          onClose={() => setSheet(null)}
          onSubmit={submitCreate}
        />
      )}

      {sheet?.kind === 'edit' && (
        <CategoryFormSheet
          title="카테고리 수정"
          initial={{ name: sheet.category.name, emoji: sheet.category.emoji }}
          extra={
            // 급여 지정은 수입 카테고리에만 노출한다.
            // 지출 카테고리를 기준으로 삼으면 "월급 남은 돈" 계산이 무의미해진다.
            sheet.category.type === 'income' ? (
              <SalaryToggle categoryId={sheet.category.id} current={salaryId} />
            ) : undefined
          }
          onClose={() => setSheet(null)}
          onSubmit={(v) => submitEdit(sheet.category.id, v)}
        />
      )}

      {sheet?.kind === 'delete' && (
        <Sheet title="카테고리 삭제" onClose={() => setSheet(null)}>
          <p className="text-label text-ink-2">
            <strong className="text-ink">'{sheet.category.name}'</strong>을(를) 삭제합니다.
          </p>
          <p className="mt-2 text-label text-ink-2">
            {countLine((n) => `기록된 거래 ${n}건과 과거 통계는 그대로 유지됩니다.`)}
          </p>
          <div className="mt-5 space-y-2">
            {actionError && <Callout tone="error">{actionError}</Callout>}
            {/*
              건수 조회 중에는 비활성이되 "처리 중…" 은 아니다.
              둘을 loading 으로 합쳐 두었더니 시트를 연 순간 — 아직 아무것도
              누르지 않았는데 — 주 버튼이 "처리 중…" 으로 떠 있었다. 삭제가
              이미 시작된 것처럼 보이는 게 파괴적 동작 앞에서 제일 나쁜 오해다.
              기다리는 이유는 아래 안내 문장(연결된 거래 N건)이 아직 안 나왔기
              때문이고, 그건 문장 쪽이 이미 말하고 있다.
            */}
            <Button
              variant="danger"
              loading={remove.isPending}
              disabled={txCount.isPending}
              onClick={() => void confirmDelete(sheet.category)}
            >
              삭제
            </Button>
            <Button variant="ghost" onClick={() => setSheet(null)}>
              취소
            </Button>
          </div>
        </Sheet>
      )}

      {sheet?.kind === 'restore' && (
        <Sheet title="이미 있는 이름입니다" onClose={() => setSheet(null)}>
          <p className="text-label text-ink-2">
            예전에 삭제한{' '}
            <strong className="text-ink">
              {sheet.category.emoji} {sheet.category.name}
            </strong>{' '}
            이(가) 있습니다.
          </p>
          <p className="mt-2 text-label text-ink-2">
            {countLine((n) => `되살리면 과거 거래 ${n}건이 다시 연결됩니다.`)}
          </p>
          <div className="mt-5 space-y-2">
            {actionError && <Callout tone="error">{actionError}</Callout>}
            <Button loading={restore.isPending} onClick={() => void confirmRestore(sheet.category)}>
              되살리기
            </Button>
            {/* "새로 만들기"는 제공하지 않는다. 같은 이름의 카테고리가 둘 생기면
                사용자가 화면에서 구별할 방법이 없어진다(기획서 §9). */}
            <p className="pt-1 text-center text-caption text-ink-muted">
              또는 닫고 다른 이름을 입력하세요
            </p>
          </div>
        </Sheet>
      )}

      <Snackbar state={snack} onDismiss={() => setSnack(null)} />
    </Page>
  )
}

/**
 * 월급 위젯 기준 카테고리 토글.
 *
 * checked 를 profiles.salary_category_id 에서 그대로 읽는다. 이전에는
 * defaultChecked 여서 체크박스가 자기 DOM 상태로 살았고, 저장이 실패하거나
 * 다른 카테고리를 기준으로 옮겨도 표시가 서버를 따라오지 않았다.
 *
 * mutation 을 여기서 갖는 이유: 실패를 보여줄 자리가 이 토글 옆이다.
 * 부모로 올리면 시트 어딘가에 에러를 얹어야 하는데 무엇에 대한 실패인지 멀어진다.
 */
function SalaryToggle({ categoryId, current }: { categoryId: string; current: string | null }) {
  const setSalary = useSetSalaryCategory()
  const [failed, setFailed] = useState(false)

  async function toggle(checked: boolean) {
    setFailed(false)
    try {
      await setSalary.mutateAsync(checked ? categoryId : null)
    } catch {
      setFailed(true)
    }
  }

  return (
    <div>
      <label className="flex items-center gap-2.5 rounded-control bg-surface-2 px-3.5 py-3">
        <input
          type="checkbox"
          className="size-4"
          checked={categoryId === current}
          disabled={setSalary.isPending}
          onChange={(e) => void toggle(e.target.checked)}
        />
        <span className="text-label text-ink">월급 위젯 기준으로 사용</span>
      </label>
      {failed && <p className="mt-1.5 text-caption text-danger">월급 기준을 바꾸지 못했습니다.</p>}
    </div>
  )
}
