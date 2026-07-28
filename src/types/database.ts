/**
 * 0001_init.sql / 0002_categories.sql 과 1:1로 대응하는 수동 작성 타입.
 *
 * Supabase 프로젝트가 생기면 아래 명령으로 자동 생성본으로 교체할 수 있다.
 *   npx supabase gen types typescript --project-id <ref> > src/types/database.ts
 * 스키마를 바꾸면 이 파일도 같이 고쳐야 한다.
 */

export type CategoryType = 'income' | 'expense'

export type ProfileRow = {
  id: string
  nickname: string
  salary_category_id: string | null
}

export type CategoryRow = {
  id: string
  user_id: string
  type: CategoryType
  name: string
  emoji: string
  color_slot: number
  deleted_at: string | null
  created_at: string
}

export type TransactionRow = {
  id: string
  user_id: string
  category_id: string
  type: CategoryType
  amount: number
  occurred_on: string
  memo: string | null
  created_at: string
}

export type MonthSummaryRow = {
  income: number
  expense: number
  /** 그 달 수입 − 지출. "잔액"이 아니라 "남은 금액"이다(통장 잔고가 아님). */
  net: number
}

export type SalaryWidgetRow = {
  salary_amount: number
  salary_date: string
  spent_since: number
  remaining: number
  /** 오늘 이후로 등록해 둔 지출. 남은 돈에서 빼지 않고 따로 표시한다. */
  upcoming: number
  next_salary_date: string
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow
        Insert: Pick<ProfileRow, 'id' | 'nickname'> & { salary_category_id?: string | null }
        Update: Partial<ProfileRow>
        Relationships: []
      }
      categories: {
        Row: CategoryRow
        Insert: Omit<CategoryRow, 'id' | 'deleted_at' | 'created_at'> & {
          id?: string
          deleted_at?: string | null
          created_at?: string
          emoji?: string
        }
        Update: Partial<CategoryRow>
        Relationships: []
      }
      transactions: {
        Row: TransactionRow
        Insert: Omit<TransactionRow, 'id' | 'created_at' | 'memo'> & {
          id?: string
          created_at?: string
          memo?: string | null
        }
        Update: Partial<TransactionRow>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      create_category: {
        Args: { p_type: CategoryType; p_name: string; p_emoji?: string }
        Returns: CategoryRow
      }
      get_month_summary: {
        Args: { p_month: string }
        Returns: MonthSummaryRow[]
      }
      get_salary_widget: {
        Args: { p_today: string }
        Returns: SalaryWidgetRow[]
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type Profile = ProfileRow
export type Category = CategoryRow
export type Transaction = TransactionRow

/** 카테고리 색 팔레트 (기획서 §6.3). color_slot 1~8 에 대응. */
export const CATEGORY_COLORS = [
  '#2a78d6', // 1 파랑
  '#eb6834', // 2 주황
  '#1baf7a', // 3 청록
  '#eda100', // 4 노랑
  '#e87ba4', // 5 마젠타
  '#008300', // 6 초록
  '#4a3aa7', // 7 보라
  '#e34948', // 8 빨강
] as const

export function categoryColor(slot: number) {
  return CATEGORY_COLORS[(slot - 1) % CATEGORY_COLORS.length]
}
