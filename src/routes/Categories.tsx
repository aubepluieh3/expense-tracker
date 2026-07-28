import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { PostgrestError } from '@supabase/supabase-js'
import { Page } from '@/components/AppLayout'
import { Sheet } from '@/components/ui/Sheet'
import { Button, SubtleButton } from '@/components/ui/Button'
import { List, rowClass, rowEmojiClass } from '@/components/ui/List'
import { ErrorState, ListSkeleton } from '@/components/states'
import { Snackbar, type SnackbarState } from '@/components/ui/Snackbar'
import { CategoryFormSheet } from '@/components/CategoryFormSheet'
import type { Category, CategoryType } from '@/types/database'
import {
  UNIQUE_VIOLATION,
  fetchTransactionCount,
  findDeletedByName,
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useProfile,
  useRestoreCategory,
  useSetSalaryCategory,
  useUpdateCategory,
} from '@/hooks/useCategories'

type SheetState =
  | { mode: 'create' }
  | { mode: 'edit'; category: Category }
  | null

export default function Categories() {
  const [tab, setTab] = useState<CategoryType>('expense')
  const [sheet, setSheet] = useState<SheetState>(null)
  const [confirm, setConfirm] = useState<{ category: Category; txCount: number } | null>(null)
  const [restore, setRestore] = useState<{ category: Category; txCount: number } | null>(null)
  const [snack, setSnack] = useState<SnackbarState>(null)

  const categories = useCategories()
  const profile = useProfile()

  const create = useCreateCategory()
  const update = useUpdateCategory()
  const remove = useDeleteCategory()
  const restoreMutation = useRestoreCategory()
  const setSalary = useSetSalaryCategory()

  const list = (categories.data ?? []).filter((c) => c.type === tab)
  const salaryId = profile.data?.salary_category_id ?? null

  async function handleCreate({ name, emoji }: { name: string; emoji: string }) {
    try {
      await create.mutateAsync({ type: tab, name, emoji })
      return null
    } catch (e) {
      const err = e as PostgrestError
      if (err.code !== UNIQUE_VIOLATION) return err.message

      // 이름이 겹쳤다. 삭제된 동명 카테고리가 있으면 되살리기를 제안한다.
      const deleted = await findDeletedByName(tab, name)
      if (!deleted) return '이미 있는 이름입니다'

      const txCount = await fetchTransactionCount(deleted.id)
      setSheet(null)
      setRestore({ category: deleted, txCount })
      return null
    }
  }

  async function openDelete(category: Category) {
    const txCount = await fetchTransactionCount(category.id)
    setConfirm({ category, txCount })
  }

  async function confirmDelete() {
    if (!confirm) return
    const { category } = confirm
    setConfirm(null)
    await remove.mutateAsync(category.id)
    setSnack({
      message: `'${category.name}'을(를) 삭제했습니다.`,
      actionLabel: '실행 취소',
      onAction: () => void restoreMutation.mutateAsync(category.id),
    })
  }

  return (
    <Page title="카테고리 관리">
      <p className="-mt-2 mb-4">
        <Link to="/settings" className="text-label text-ink-muted hover:text-ink">
          ← 설정
        </Link>
      </p>

      <div className="mb-4 flex gap-1 rounded-control bg-surface-3 p-1">
        {(['expense', 'income'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-control py-2 text-label transition ${
              tab === t ? 'bg-surface font-medium text-ink shadow-sm' : 'text-ink-muted'
            }`}
          >
            {t === 'expense' ? '지출' : '수입'}
          </button>
        ))}
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
            <SubtleButton onClick={() => setSheet({ mode: 'edit', category: c })}>
              수정
            </SubtleButton>
            <SubtleButton tone="danger" onClick={() => void openDelete(c)}>
              삭제
            </SubtleButton>
          </li>
        ))}
      </List>

      {!categories.isPending && list.length === 0 && (
        <p className="py-8 text-center text-label text-ink-muted">카테고리가 없습니다</p>
      )}

      <div className="mt-4">
        <Button variant="ghost" onClick={() => setSheet({ mode: 'create' })}>
          ＋ 카테고리 추가
        </Button>
      </div>

      {/* 삭제된 카테고리 목록은 두지 않는다. 사용자는 삭제했다고 인식하는데
          목록이 남아 있으면 "지웠는데 안 지워진" 느낌을 준다.
          되살리기는 스낵바 실행 취소와 이름 충돌 시 제안, 두 경로로 제공한다. */}

      {sheet?.mode === 'create' && (
        <CategoryFormSheet
          title={`${tab === 'expense' ? '지출' : '수입'} 카테고리 추가`}
          onClose={() => setSheet(null)}
          onSubmit={handleCreate}
        />
      )}

      {sheet?.mode === 'edit' && (
        <CategoryFormSheet
          title="카테고리 수정"
          initial={{ name: sheet.category.name, emoji: sheet.category.emoji }}
          extra={
            // 급여 지정은 수입 카테고리에만 노출한다.
            // 지출 카테고리를 기준으로 삼으면 "월급 남은 돈" 계산이 무의미해진다.
            sheet.category.type === 'income' ? (
              <label className="flex items-center gap-2.5 rounded-control bg-surface-2 px-3.5 py-3">
                <input
                  type="checkbox"
                  className="size-4"
                  defaultChecked={sheet.category.id === salaryId}
                  onChange={(e) =>
                    void setSalary.mutateAsync(e.target.checked ? sheet.category.id : null)
                  }
                />
                <span className="text-label text-ink">월급 위젯 기준으로 사용</span>
              </label>
            ) : undefined
          }
          onClose={() => setSheet(null)}
          onSubmit={async ({ name, emoji }) => {
            try {
              await update.mutateAsync({ id: sheet.category.id, name, emoji })
              return null
            } catch (e) {
              const err = e as PostgrestError
              return err.code === UNIQUE_VIOLATION ? '이미 있는 이름입니다' : err.message
            }
          }}
        />
      )}

      {confirm && (
        <Sheet title="카테고리 삭제" onClose={() => setConfirm(null)}>
          <p className="text-label text-ink-2">
            <strong className="text-ink">'{confirm.category.name}'</strong>을(를)
            삭제합니다.
          </p>
          {confirm.txCount > 0 && (
            <p className="mt-2 text-label text-ink-2">
              기록된 거래 {confirm.txCount}건과 과거 통계는 그대로 유지됩니다.
            </p>
          )}
          <div className="mt-5 space-y-2">
            <Button onClick={() => void confirmDelete()} loading={remove.isPending}>
              삭제
            </Button>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              취소
            </Button>
          </div>
        </Sheet>
      )}

      {restore && (
        <Sheet title="이미 있는 이름입니다" onClose={() => setRestore(null)}>
          <p className="text-label text-ink-2">
            예전에 삭제한{' '}
            <strong className="text-ink">
              {restore.category.emoji} {restore.category.name}
            </strong>{' '}
            이(가) 있습니다.
          </p>
          <p className="mt-2 text-label text-ink-2">
            {restore.txCount > 0
              ? `되살리면 과거 거래 ${restore.txCount}건이 다시 연결됩니다.`
              : '연결된 거래는 없습니다.'}
          </p>
          <div className="mt-5 space-y-2">
            <Button
              loading={restoreMutation.isPending}
              onClick={async () => {
                await restoreMutation.mutateAsync(restore.category.id)
                setRestore(null)
              }}
            >
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
