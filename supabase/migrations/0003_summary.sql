-- =============================================================================
-- 0003_summary.sql — 월별 요약 + 월급 위젯 집계 함수
--
-- 설계 근거: docs/설계.md §4.3, §5.2
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 월별 총수입 / 총지출 / 남은 금액
--
-- 반열린 구간 [start, end) 을 쓴다. BETWEEN 은 말일 경계에서 실수한다.
-- occurred_on 이 date 라 타임존이 개입하지 않는다.
-- -----------------------------------------------------------------------------
create or replace function public.get_month_summary(p_month date)
returns table (
  income  bigint,
  expense bigint,
  net     bigint
)
language sql
security invoker
stable
set search_path = ''
as $$
  select
    coalesce(sum(t.amount) filter (where t.type = 'income'),  0)::bigint,
    coalesce(sum(t.amount) filter (where t.type = 'expense'), 0)::bigint,
    coalesce(sum(case when t.type = 'income' then t.amount else -t.amount end), 0)::bigint
  from public.transactions t
  where t.user_id = auth.uid()
    and t.occurred_on >= date_trunc('month', p_month)::date
    and t.occurred_on <  (date_trunc('month', p_month) + interval '1 month')::date;
$$;

grant execute on function public.get_month_summary(date) to authenticated;


-- -----------------------------------------------------------------------------
-- 월급 위젯
--
-- "월급 남은 돈 = 마지막 급여 금액 − 그 이후 지출". 기준 카테고리는
-- profiles.salary_category_id 가 가리킨다(이름으로 찾지 않는다).
--
-- p_today 를 클라이언트가 넘기는 이유:
--   Supabase 의 DB 타임존은 UTC 라서 current_date 가 KST 와 최대 하루 어긋난다.
--   한국 시간 오전 0~9시 사이에는 current_date 가 '어제'를 가리킨다.
--   거래 입력 폼도 사용자의 로컬 날짜를 쓰므로, 여기서도 같은 기준을 써야
--   "오늘까지 쓴 돈"이 화면과 맞는다.
--
-- 반환 행이 없으면(급여 카테고리 미지정 / 삭제됨 / 급여 거래 없음)
-- 앱이 빈 상태를 표시한다.
-- -----------------------------------------------------------------------------
create or replace function public.get_salary_widget(p_today date default current_date)
returns table (
  salary_amount    bigint,
  salary_date      date,
  spent_since      bigint,
  remaining        bigint,
  upcoming         bigint,
  next_salary_date date
)
language plpgsql
security invoker
stable
set search_path = ''
as $$
declare
  v_cat    uuid;
  v_amount integer;
  v_date   date;
begin
  select p.salary_category_id into v_cat
    from public.profiles p
   where p.id = auth.uid();

  if v_cat is null then
    return;                                    -- 급여 카테고리 미지정
  end if;

  -- 삭제된 카테고리를 가리키고 있으면 위젯을 끈다.
  select t.amount, t.occurred_on
    into v_amount, v_date
    from public.transactions t
    join public.categories c on c.id = t.category_id
   where t.user_id = auth.uid()
     and t.category_id = v_cat
     and c.deleted_at is null
     and t.occurred_on <= p_today             -- 미래에 등록한 급여는 아직 안 받은 돈
   order by t.occurred_on desc, t.created_at desc
   limit 1;

  if not found then
    return;                                    -- 급여 거래 없음
  end if;

  return query
  select
    v_amount::bigint,
    v_date,
    coalesce(s.total, 0)::bigint,
    (v_amount - coalesce(s.total, 0))::bigint,
    coalesce(f.total, 0)::bigint,
    (v_date + interval '1 month')::date        -- 말일은 Postgres 가 보정한다 (1/31 → 2/28)
  from
    -- 급여일부터 오늘까지 쓴 돈
    (select sum(t.amount) as total
       from public.transactions t
      where t.user_id = auth.uid()
        and t.type = 'expense'
        and t.occurred_on >= v_date
        and t.occurred_on <= p_today) s,
    -- 오늘 이후로 등록해 둔 지출. 남은 돈에서 빼지 않고 따로 보여준다 —
    -- 아직 통장에서 안 나간 돈이라 섞으면 숫자가 이상해진다.
    (select sum(t.amount) as total
       from public.transactions t
      where t.user_id = auth.uid()
        and t.type = 'expense'
        and t.occurred_on > p_today) f;
end;
$$;

grant execute on function public.get_salary_widget(date) to authenticated;
