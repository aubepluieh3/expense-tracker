-- =============================================================================
-- 0004_stats.sql — 카테고리별 지출 통계 + 누적
--
-- 설계 근거: docs/설계.md §4.3, §5.3
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 카테고리별 지출 (지출만, 금액 내림차순)
--
-- deleted_at 을 보지 않는다. 이것이 "과거 통계 보존"의 구현이다 —
-- 삭제한 카테고리도 원래 이름·이모지·색 그대로 과거 달에 남아야 한다.
--
-- 상위 7개 + "기타" 묶기는 클라이언트에서 한다. 기타를 펼치려면 전체 목록이
-- 필요하기 때문이다.
-- -----------------------------------------------------------------------------
create or replace function public.get_category_stats(p_month date)
returns table (
  category_id uuid,
  name        text,
  emoji       text,
  color_slot  smallint,
  total       bigint
)
language sql
security invoker
stable
set search_path = ''
as $$
  select c.id, c.name, c.emoji, c.color_slot, sum(t.amount)::bigint
  from public.transactions t
  join public.categories c on c.id = t.category_id
  where t.user_id = auth.uid()
    and t.type = 'expense'
    and t.occurred_on >= date_trunc('month', p_month)::date
    and t.occurred_on <  (date_trunc('month', p_month) + interval '1 month')::date
  group by c.id, c.name, c.emoji, c.color_slot
  order by sum(t.amount) desc, c.name;
$$;

grant execute on function public.get_category_stats(date) to authenticated;


-- -----------------------------------------------------------------------------
-- 앱 사용 이후 누적 (전체 수입 − 전체 지출)
--
-- "통장 잔고"라고 부르지 않는다. 초기 자산을 입력받지 않으므로 실제 잔고를
-- 알 수 없다. "앱 쓰기 시작한 뒤로 모은 돈"이라는 정직한 의미로 두면
-- 초기 자산 설정 기능이 불필요해진다.
-- -----------------------------------------------------------------------------
create or replace function public.get_lifetime_net()
returns bigint
language sql
security invoker
stable
set search_path = ''
as $$
  select coalesce(
    sum(case when t.type = 'income' then t.amount else -t.amount end), 0
  )::bigint
  from public.transactions t
  where t.user_id = auth.uid();
$$;

grant execute on function public.get_lifetime_net() to authenticated;
