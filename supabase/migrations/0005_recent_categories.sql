-- =============================================================================
-- 0005_recent_categories.sql — 최근 사용한 카테고리 순서
--
-- 설계 근거: docs/설계.md §4.4, §9
--
-- 칩 그리드의 정렬은 생성순 고정을 유지한다. 이 함수는 그리드 위에 따로 붙는
-- "최근" 줄에만 쓰인다 — 그리드 전체를 사용순으로 재정렬하면 입력할 때마다
-- 칩 위치가 바뀌어, 안 보고 누르는 사람이 조용히 다른 카테고리로 저장한다.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 카테고리를 마지막으로 사용한 순서 (최근 → 오래된)
--
-- occurred_on 이 아니라 created_at 으로 정렬한다. occurred_on 은 사용자가 고른
-- 거래 날짜라서, 주말에 지난주를 몰아 적으면 방금 입력한 카테고리가 오히려
-- 뒤로 밀린다. "최근에 쓴 것"은 입력 시각이지 거래 날짜가 아니다.
--
-- 삭제된 카테고리는 제외한다. 노출용 순서이므로 과거 통계와 달리 보존할
-- 이유가 없다.
--
-- 반환은 순서가 곧 값이다. 타입 구분과 개수 제한은 클라이언트가 한다 —
-- 이미 타입별로 걸러진 칩 목록을 들고 있어서 교집합만 취하면 되고,
-- 그러면 노출 개수를 바꿀 때 마이그레이션이 필요 없다.
-- -----------------------------------------------------------------------------
create or replace function public.get_recent_category_ids()
returns table (category_id uuid)
language sql
security invoker
stable
set search_path = ''
as $$
  select t.category_id
  from public.transactions t
  join public.categories c on c.id = t.category_id
  where t.user_id = auth.uid()
    and c.deleted_at is null
  group by t.category_id
  order by max(t.created_at) desc;
$$;

grant execute on function public.get_recent_category_ids() to authenticated;
