-- =============================================================================
-- 0002_categories.sql — 이름 정규화 트리거 + create_category RPC
--
-- 설계 근거: docs/설계.md §4.2
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 이름 정규화 (trim + 연속 공백 압축)
--
-- 정규화를 앱이나 create_category 안에서만 하면 UPDATE 경로에서 빠진다.
-- 그러면 '헬스 ' 처럼 공백 하나로 UNIQUE (user_id, type, name) 를 우회할 수 있고,
-- 화면상 같아 보이는 카테고리가 둘 생긴다. 트리거로 한 곳에 모은다.
-- -----------------------------------------------------------------------------
create or replace function public.normalize_category_name()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := regexp_replace(btrim(new.name), '\s+', ' ', 'g');
  return new;
end;
$$;

create trigger categories_normalize_name
  before insert or update of name on public.categories
  for each row
  execute function public.normalize_category_name();


-- -----------------------------------------------------------------------------
-- 카테고리 생성
--
-- RPC 인 이유: 빈 슬롯 조회와 INSERT 가 원자적이어야 한다.
-- 클라이언트에서 두 단계로 하면 동시 요청 시 같은 슬롯이 두 번 배정된다.
--
-- 이름 중복은 여기서 미리 검사하지 않는다. UNIQUE 제약이 곧 검사다 —
-- 위반(23505)이 나면 앱이 같은 이름의 삭제된 카테고리를 찾아 "되살릴까요?" 를 띄운다.
-- -----------------------------------------------------------------------------
create or replace function public.create_category(
  p_type  text,
  p_name  text,
  p_emoji text default '📦'
)
returns public.categories
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_slot smallint;
  v_row  public.categories;
begin
  if p_type not in ('income', 'expense') then
    raise exception 'invalid category type: %', p_type;
  end if;

  -- 활성 카테고리가 쓰지 않는 슬롯 중 가장 작은 번호.
  -- 8개가 모두 쓰이고 있으면 가장 적게 쓰인 슬롯으로 순환한다.
  -- 빈 슬롯은 count = 0 이라 자연히 먼저 뽑힌다.
  select s.slot
    into v_slot
    from generate_series(1, 8) as s(slot)
    left join public.categories c
           on c.user_id = auth.uid()
          and c.type = p_type
          and c.deleted_at is null
          and c.color_slot = s.slot
   group by s.slot
   order by count(c.id), s.slot
   limit 1;

  insert into public.categories (user_id, type, name, emoji, color_slot)
  values (
    auth.uid(),
    p_type,
    p_name,                                        -- 트리거가 정규화한다
    coalesce(nullif(btrim(p_emoji), ''), '📦'),
    v_slot
  )
  returning * into v_row;

  return v_row;
end;
$$;

grant execute on function public.create_category(text, text, text) to authenticated;
