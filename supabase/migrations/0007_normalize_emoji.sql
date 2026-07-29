-- =============================================================================
-- 0007_normalize_emoji.sql — 이모지 정규화를 UPDATE 경로에도 적용한다
--
-- 설계 근거: docs/설계.md §4.2 (0002 의 이름 정규화와 같은 논리)
--
-- 버그: 이모지 기본값 대체가 create_category RPC 안에만 있었다.
--
--   coalesce(nullif(btrim(p_emoji), ''), '📦')      -- 0002, INSERT 경로만
--
-- 카테고리 수정은 RPC 를 거치지 않고 테이블을 직접 UPDATE 한다
-- (hooks/useCategories.ts 의 useUpdateCategory). 그래서 이모지 직접 입력 칸을
-- 비우고 저장하면 emoji = '' 가 그대로 내려가 categories_emoji_len CHECK 가
-- 터졌고, 원시 Postgres 메시지가 화면에 떴다.
--
-- 이것은 0002 가 이름 정규화에서 이미 지적한 실수와 같은 형태다:
--
--   "정규화를 앱이나 create_category 안에서만 하면 UPDATE 경로에서 빠진다"
--
-- 그때는 이름만 트리거로 옮기고 이모지는 RPC 에 남겨 뒀다. 같은 트리거로
-- 두 컬럼을 함께 처리해서 경로가 갈릴 여지를 없앤다.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 이름 + 이모지 정규화
--
-- 함수 이름을 바꾼다 — 하는 일이 이름 하나가 아니게 됐다.
-- 트리거를 먼저 지워야 함수를 지울 수 있다.
--
-- 한 트랜잭션으로 감싼다. 트리거가 없는 순간이 생기면 그 사이에 들어온 쓰기가
-- 이름 정규화를 건너뛰고, 0002 가 막으려던 UNIQUE 우회('헬스 ' 같은 값)가
-- 그 순간 다시 열린다. DDL 도 Postgres 에서는 트랜잭션 안에서 롤백된다 —
-- 중간에 실패하면 아무것도 바뀌지 않은 상태로 돌아간다.
-- -----------------------------------------------------------------------------
begin;

drop trigger if exists categories_normalize_name on public.categories;
drop function if exists public.normalize_category_name();

create or replace function public.normalize_category()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name := regexp_replace(btrim(new.name), '\s+', ' ', 'g');

  -- 빈 이모지는 CHECK(1~8자) 위반이다. 사용자가 "이모지 없음"을 의도할 수는
  -- 없으므로(스키마가 허용하지 않는다) 기본값으로 되돌린다.
  -- 대체 값은 create_category 와 같은 📦 다.
  new.emoji := coalesce(nullif(btrim(new.emoji), ''), '📦');

  return new;
end;
$$;

-- of name, emoji — 두 컬럼 중 하나만 바뀌어도 발동한다.
-- 안 바뀐 쪽은 기존 값을 다시 정규화하므로 멱등하다.
--
-- drop 을 먼저 하는 이유: create trigger 에는 if not exists 가 없어서, 이 파일을
-- 두 번 실행하면 42710 "trigger already exists" 로 멈춘다. 마이그레이션을 손으로
-- 실행하는 워크플로에서는 재시도가 정상 경로라 파일 전체가 멱등해야 한다.
drop trigger if exists categories_normalize on public.categories;

create trigger categories_normalize
  before insert or update of name, emoji on public.categories
  for each row
  execute function public.normalize_category();


-- -----------------------------------------------------------------------------
-- create_category 의 coalesce 는 남겨 둔다.
--
-- 이제 트리거와 중복이지만, RPC 를 다시 만들어야 지울 수 있고 지워서 얻는 게
-- 없다. 두 곳이 같은 기본값을 쓰는 것은 모순이 아니다 — 서로 다른 값을 쓰는
-- 것이 모순이다.
-- -----------------------------------------------------------------------------

comment on function public.normalize_category() is
  '이름·이모지 정규화. INSERT/UPDATE 양쪽을 덮어 경로에 따라 갈리지 않게 한다. 0007 참조.';

commit;


-- -----------------------------------------------------------------------------
-- 기존 데이터는 건드리지 않는다.
--
-- 트리거는 앞으로의 쓰기에만 걸리므로, 이미 저장된 공백 이모지는 그대로 남는다.
-- 그런 행이 있는지는 먼저 세어 보고 판단한다 — 있는지도 모르는 채로 UPDATE 를
-- 돌리는 것이 이 파일에서 유일하게 실제 데이터를 바꾸는 일이 된다.
--
--   select id, type, name, emoji
--     from public.categories
--    where btrim(emoji) = '';
--
-- 나오는 행이 있으면 아래를 실행한다. 없으면 실행할 필요가 없다.
--
--   update public.categories set emoji = '📦' where btrim(emoji) = '';
--
-- 0006 은 기존 계정 보정을 파일 안에 넣었지만, 그건 순서가 비결정적이라 반드시
-- 고쳐야 하는 값이었다. 이쪽은 보이기만 어색한 값이라 확인 후 선택으로 둔다.
-- -----------------------------------------------------------------------------
