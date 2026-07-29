-- =============================================================================
-- 0006_category_order.sql — 칩 순서를 실제로 고정한다
--
-- 설계 근거: docs/설계.md §2.3, §9 · 기획서 §5.3
--
-- 버그: 기본 카테고리 10개의 created_at 이 전부 동일하다. handle_new_user()
-- 가 한 INSERT 문으로 넣으므로 now() 가 같은 값이다.
--
-- ORDER BY created_at 은 값이 같으면 순서를 정하지 못한다. Postgres 는 UPDATE
-- 시 새 행 버전을 힙 끝에 쓰기 때문에, 카테고리 이름·이모지를 한 번 고치거나
-- 삭제·되살리기를 하면 스캔 순서가 바뀐다. 실측 결과:
--
--   변경 전        교통 → 주거·통신 → 생활용품 → 문화·여가 → 식비 → 카페·간식
--   이모지 UPDATE  주거·통신 → 생활용품 → 문화·여가 → 식비 → 교통 → 카페·간식
--                                                        ↑ 교통이 1번에서 5번으로
--
-- 기획서 §5.3 은 "칩 순서는 생성순 고정 — 위치가 고정돼야 안 보고 누른다"고
-- 약속했는데, 그 약속이 이미 깨져 있었다. 위치가 조용히 바뀌면 익숙한 자리를
-- 안 보고 누른 사용자가 다른 카테고리로 저장하고도 알 수 없다.
--
-- 고치는 방법은 두 겹이다.
--   1) 시드가 순서대로 다른 created_at 을 갖게 한다 (의도한 순서를 데이터로)
--   2) 클라이언트 쿼리에 id 를 동순위 기준으로 추가한다 (다시는 흔들리지 않게)
-- 이 파일은 1)과 기존 계정 보정을 담당한다. 2)는 hooks/useCategories.ts 다.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. 시드를 순서대로 다른 시각으로 넣는다
--
-- 같은 트랜잭션 안에서 1ms 씩 벌린다. 트랜잭션이 원자적인 것과 행마다 다른
-- 타임스탬프를 갖는 것은 무관하다 — 실제로 그 순서로 만들었으므로 거짓도 아니다.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nickname  text;
  v_salary_id uuid;
begin
  v_nickname := left(btrim(coalesce(new.raw_user_meta_data ->> 'nickname', '')), 20);
  if v_nickname = '' then
    v_nickname := '사용자';
  end if;

  insert into public.profiles (id, nickname)
  values (new.id, v_nickname);

  insert into public.categories (user_id, type, name, emoji, color_slot, created_at)
  select new.id, s.type, s.name, s.emoji, s.color_slot,
         now() + (s.seq * interval '1 millisecond')
    from (values
      (1,  'expense', '식비',      '🍚', 1::smallint),
      (2,  'expense', '카페·간식', '☕', 2),
      (3,  'expense', '교통',      '🚌', 3),
      (4,  'expense', '주거·통신', '🏠', 4),
      (5,  'expense', '생활용품',  '🛒', 5),
      (6,  'expense', '문화·여가', '🎬', 6),
      (7,  'income',  '급여',      '💼', 1),
      (8,  'income',  '용돈',      '💰', 2),
      (9,  'income',  '금융수입',  '📈', 3),
      (10, 'income',  '기타수입',  '📦', 4)
    ) as s(seq, type, name, emoji, color_slot);

  -- 이름으로 카테고리를 찾는 것은 이 시드 시점뿐이다. 이후로는 id 로만 참조한다.
  select c.id
    into v_salary_id
    from public.categories c
   where c.user_id = new.id
     and c.type = 'income'
     and c.name = '급여';

  update public.profiles
     set salary_category_id = v_salary_id
   where id = new.id;

  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- 2. 이미 만들어진 계정 보정
--
-- created_at 이 겹치는 행들을 의도한 순서로 벌린다. 기준은 기본 카테고리
-- 목록의 위치이고, 이름을 바꾼 카테고리나 직접 추가한 것은 목록에 없으므로
-- 뒤로 보낸 뒤 id 로 정렬한다 — 임의 순서지만 두 번 다시 바뀌지 않는다.
--
-- 이름으로 찾는 것은 이 보정 한 번뿐이다. 이후 코드는 id 만 쓴다.
-- -----------------------------------------------------------------------------
with ordered as (
  select
    c.id,
    c.created_at,
    row_number() over (
      partition by c.user_id, c.created_at
      order by coalesce(d.seq, 999), c.id
    ) - 1 as offset_ms
  from public.categories c
  left join (values
    ('expense', '식비', 1), ('expense', '카페·간식', 2), ('expense', '교통', 3),
    ('expense', '주거·통신', 4), ('expense', '생활용품', 5), ('expense', '문화·여가', 6),
    ('income', '급여', 7), ('income', '용돈', 8),
    ('income', '금융수입', 9), ('income', '기타수입', 10)
  ) as d(type, name, seq) on d.type = c.type and d.name = c.name
  where exists (
    select 1 from public.categories x
     where x.user_id = c.user_id
       and x.created_at = c.created_at
       and x.id <> c.id
  )
)
update public.categories c
   set created_at = o.created_at + (o.offset_ms * interval '1 millisecond')
  from ordered o
 where c.id = o.id
   and o.offset_ms > 0;


-- -----------------------------------------------------------------------------
-- 3. 다시는 겹치지 않게 — 사용자별 created_at 유일
--
-- 같은 사용자 안에서 created_at 이 겹치면 그 순간 정렬이 무의미해진다.
-- create_category RPC 는 한 번에 한 행만 넣으므로 이 제약과 충돌하지 않는다.
-- 제약으로 못 박아 두면 나중에 벌크 INSERT 를 넣을 때 조용히 재발하지 않는다.
-- -----------------------------------------------------------------------------
create unique index if not exists categories_user_created_uq
  on public.categories (user_id, created_at);

comment on index public.categories_user_created_uq is
  '칩 정렬이 created_at 이므로 사용자 안에서 값이 겹치면 순서가 비결정적이 된다. 0006 참조.';
