-- =============================================================================
-- 0001_init.sql — 스키마 · RLS · 가입 트리거
-- Personal Expense Tracker
--
-- 설계 근거: docs/설계.md §2 ~ §4.1
-- 실행 위치: Supabase 대시보드 → SQL Editor (또는 supabase db push)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  nickname           text not null,
  salary_category_id uuid,

  constraint profiles_nickname_len check (char_length(nickname) between 1 and 20)
);

comment on table  public.profiles is
  '사용자 프로필. 이메일·비밀번호·가입시각은 auth.users 가 보유하므로 중복 저장하지 않는다.';
comment on column public.profiles.salary_category_id is
  '월급 위젯 기준 카테고리. NULL 이거나 가리키는 카테고리가 삭제 상태면 위젯은 빈 상태.';


-- -----------------------------------------------------------------------------
-- categories
-- -----------------------------------------------------------------------------
create table public.categories (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  type       text        not null,
  name       text        not null,
  emoji      text        not null default '📦',
  color_slot smallint    not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),

  constraint categories_type_chk  check (type in ('income', 'expense')),
  constraint categories_name_len  check (char_length(name)  between 1 and 20),
  constraint categories_emoji_len check (char_length(emoji) between 1 and 8),
  constraint categories_slot_rng  check (color_slot between 1 and 8),

  -- 삭제된 것까지 포함한다.
  -- 부분 인덱스(where deleted_at is null)로 만들면 같은 이름을 새로 만들 수 있게 되어
  -- "예전에 삭제한 X 가 있습니다 → 되살릴까요?" 감지가 불가능해진다.
  constraint categories_name_uq unique (user_id, type, name),

  -- 복합 FK 대상 (profiles / transactions 가 참조)
  constraint categories_id_user_uq      unique (id, user_id),
  constraint categories_id_user_type_uq unique (id, user_id, type)
);

create index categories_active_idx
  on public.categories (user_id, type)
  where deleted_at is null;

comment on column public.categories.color_slot is
  '1~8 순환 배정. 유니크 제약이 없으며 중복은 정상 상태다. 개수 제한의 근거로 쓰지 않는다.';
comment on column public.categories.deleted_at is
  '소프트 삭제 시각. 완전 삭제는 하지 않는다(실행 취소가 불가능해지므로).';
comment on column public.categories.created_at is
  '등록 화면 칩 그리드의 정렬 기준. 순서가 고정돼야 근육 기억이 생긴다.';

-- profiles → categories
-- (categories 가 만들어진 뒤에 추가해야 하므로 여기서 ALTER)
-- profiles.id 가 곧 user_id 이므로, 이 복합 FK 가 "남의 카테고리 참조"를 DB 에서 차단한다.
-- ON DELETE 절은 두지 않는다(NO ACTION) — 카테고리는 항상 소프트 삭제라 발동할 일이 없다.
alter table public.profiles
  add constraint profiles_salary_category_fk
  foreign key (salary_category_id, id)
  references public.categories (id, user_id);


-- -----------------------------------------------------------------------------
-- transactions
-- -----------------------------------------------------------------------------
create table public.transactions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users (id) on delete cascade,
  category_id uuid        not null,
  type        text        not null,
  amount      integer     not null,
  occurred_on date        not null,
  memo        text,
  created_at  timestamptz not null default now(),

  constraint transactions_type_chk   check (type in ('income', 'expense')),
  constraint transactions_amount_chk check (amount > 0),
  constraint transactions_memo_len   check (memo is null or char_length(memo) <= 100),

  -- 3열 복합 FK 가 세 가지를 한 번에 강제한다.
  --   1) 타입 일치   지출 거래에 수입 카테고리를 붙일 수 없다
  --   2) 소유권      남의 카테고리 id 를 붙일 수 없다 (FK 검사는 RLS 를 우회한다)
  --   3) 참조 무결성 거래가 있는 카테고리의 완전 삭제를 막는다
  constraint transactions_category_fk
    foreign key (category_id, user_id, type)
    references public.categories (id, user_id, type)
    on delete restrict
);

create index transactions_user_date_idx on public.transactions (user_id, occurred_on desc);
create index transactions_category_idx  on public.transactions (category_id);

comment on column public.transactions.amount is
  '원 단위 양수. 부호는 type 이 결정한다. 음수를 허용하면 "지출 -5000"이 실질 수입이 된다.';
comment on column public.transactions.occurred_on is
  'date 타입. timestamptz 로 두면 자정 근처 거래가 타임존 차이로 옆 달에 잡힌다.';


-- -----------------------------------------------------------------------------
-- RLS
--   FOR ALL 하나로 SELECT/INSERT/UPDATE/DELETE 가 덮인다.
--   USING 은 읽기·수정 대상을 거르고, WITH CHECK 는 쓰는 값을 검증한다.
--   둘 다 있어야 "남의 user_id 로 쓰기"까지 막힌다.
-- -----------------------------------------------------------------------------
alter table public.profiles     enable row level security;
alter table public.categories   enable row level security;
alter table public.transactions enable row level security;

create policy profiles_own on public.profiles
  for all to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy categories_own on public.categories
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy transactions_own on public.transactions
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- 가입 트리거
--   프로필 + 기본 카테고리 10개 + 급여 카테고리 지정을 한 트랜잭션에서 처리한다.
--
--   앱 코드가 아니라 트리거인 이유:
--   가입 직후 앱에서 insert 하면 그 요청이 실패했을 때 "카테고리가 하나도 없는 유저"가
--   생긴다. 앱은 그 상태를 가정하지 않으므로 깨진다. 트리거는 가입과 같은 트랜잭션이다.
--
--   security definer + search_path = '' 이므로 모든 식별자를 스키마까지 적는다.
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
  -- 닉네임은 signUp({ options: { data: { nickname } } }) 로 넘어온다.
  -- 길이 초과로 CHECK 가 터지면 가입 자체가 실패하므로 방어적으로 자른다.
  v_nickname := left(btrim(coalesce(new.raw_user_meta_data ->> 'nickname', '')), 20);
  if v_nickname = '' then
    v_nickname := '사용자';
  end if;

  insert into public.profiles (id, nickname)
  values (new.id, v_nickname);

  insert into public.categories (user_id, type, name, emoji, color_slot) values
    (new.id, 'expense', '식비',      '🍚', 1),
    (new.id, 'expense', '카페·간식', '☕', 2),
    (new.id, 'expense', '교통',      '🚌', 3),
    (new.id, 'expense', '주거·통신', '🏠', 4),
    (new.id, 'expense', '생활용품',  '🛒', 5),
    (new.id, 'expense', '문화·여가', '🎬', 6),
    (new.id, 'income',  '급여',      '💼', 1),
    (new.id, 'income',  '용돈',      '💰', 2),
    (new.id, 'income',  '금융수입',  '📈', 3),
    (new.id, 'income',  '기타수입',  '📦', 4);

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

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
