-- =============================================================
-- 학식 티어리스트 — Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에 전체를 붙여넣고 Run 하세요.
-- 여러 번 실행해도 안전하도록 작성되어 있습니다.
-- =============================================================

-- ---------- 0. 서울대 메일 확인 함수 ----------
create or replace function public.is_snu()
returns boolean
language sql stable
as $$
  select coalesce(lower(auth.jwt() ->> 'email') like '%@snu.ac.kr', false);
$$;

-- ---------- 1. 가입 자체를 서울대 메일로 제한 ----------
-- 화면에서 막는 것과 별개로, 서버에서 @snu.ac.kr 이 아닌 가입을 거부합니다.
create or replace function public.enforce_snu_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email is null or lower(new.email) not like '%@snu.ac.kr' then
    raise exception '서울대 메일(@snu.ac.kr)만 가입할 수 있습니다';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_snu_email on auth.users;
create trigger enforce_snu_email
  before insert or update of email on auth.users
  for each row execute function public.enforce_snu_email();

-- ---------- 2. 테이블 ----------
create table if not exists public.restaurants (
  id         bigint generated always as identity primary key,
  name       text not null unique,
  location   text,
  sort_order int  not null default 0
);

create table if not exists public.menus (
  id            bigint generated always as identity primary key,
  restaurant_id bigint not null references public.restaurants(id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 80),
  price         int,            -- 원 단위, 모르면 null
  corner        text,           -- 코너/매장 (예: 천원의아침밥, 경성 돈카츠)
  created_by    uuid references auth.users(id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  unique (restaurant_id, name)
);
-- 이전 버전 스키마를 이미 실행했다면 컬럼만 추가
alter table public.menus add column if not exists price int;
alter table public.menus add column if not exists corner text;
-- 이전 버전은 메뉴 이름 길이 제한이 40자였음(뷔페 코너를 조합 메뉴 하나로 합치면서 80자로 완화)
alter table public.menus drop constraint if exists menus_name_check;
alter table public.menus add constraint menus_name_check check (char_length(btrim(name)) between 1 and 80);

-- 티어 투표: S=5, A=4, B=3, C=2, D=1, F=0. 한 사람당 메뉴별 1표(바꾸면 덮어씀)
create table if not exists public.votes (
  menu_id    bigint not null references public.menus(id) on delete cascade,
  user_id    uuid   not null references auth.users(id) on delete cascade default auth.uid(),
  score      smallint not null check (score between 0 and 5),
  updated_at timestamptz not null default now(),
  primary key (menu_id, user_id)
);

-- 리뷰: 한 사람당 메뉴별 1개(수정 가능)
create table if not exists public.reviews (
  id         bigint generated always as identity primary key,
  menu_id    bigint not null references public.menus(id) on delete cascade,
  user_id    uuid   not null references auth.users(id) on delete cascade default auth.uid(),
  body       text   not null check (char_length(btrim(body)) between 1 and 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (menu_id, user_id)
);

create index if not exists menus_restaurant_idx on public.menus(restaurant_id);
create index if not exists reviews_menu_idx on public.reviews(menu_id, created_at desc);

-- ---------- 3. 메뉴별 집계 뷰 ----------
drop view if exists public.menu_stats;
create view public.menu_stats
with (security_invoker = true) as
select
  m.id            as menu_id,
  m.restaurant_id,
  m.name,
  m.price,
  m.corner,
  m.created_at,
  count(v.score)::int                     as vote_count,
  round(avg(v.score)::numeric, 2)         as avg_score,
  count(*) filter (where v.score = 5)::int as s_count,
  count(*) filter (where v.score = 4)::int as a_count,
  count(*) filter (where v.score = 3)::int as b_count,
  count(*) filter (where v.score = 2)::int as c_count,
  count(*) filter (where v.score = 1)::int as d_count,
  count(*) filter (where v.score = 0)::int as f_count,
  (select count(*) from public.reviews r where r.menu_id = m.id)::int as review_count
from public.menus m
left join public.votes v on v.menu_id = m.id
group by m.id;

-- ---------- 4. 보안 규칙(RLS) ----------
alter table public.restaurants enable row level security;
alter table public.menus       enable row level security;
alter table public.votes       enable row level security;
alter table public.reviews     enable row level security;

-- 읽기: 누구나(로그인 안 해도) 티어리스트와 리뷰를 볼 수 있음
drop policy if exists "read restaurants" on public.restaurants;
create policy "read restaurants" on public.restaurants for select using (true);
drop policy if exists "read menus" on public.menus;
create policy "read menus" on public.menus for select using (true);
drop policy if exists "read votes" on public.votes;
create policy "read votes" on public.votes for select using (true);
drop policy if exists "read reviews" on public.reviews;
create policy "read reviews" on public.reviews for select using (true);

-- 메뉴 추가: 서울대 메일로 로그인한 사람만
drop policy if exists "snu add menu" on public.menus;
create policy "snu add menu" on public.menus for insert to authenticated
  with check (public.is_snu() and created_by = auth.uid());

-- 투표: 본인 표만 추가/수정/삭제
drop policy if exists "snu vote insert" on public.votes;
create policy "snu vote insert" on public.votes for insert to authenticated
  with check (public.is_snu() and user_id = auth.uid());
drop policy if exists "snu vote update" on public.votes;
create policy "snu vote update" on public.votes for update to authenticated
  using (user_id = auth.uid()) with check (public.is_snu() and user_id = auth.uid());
drop policy if exists "snu vote delete" on public.votes;
create policy "snu vote delete" on public.votes for delete to authenticated
  using (user_id = auth.uid());

-- 리뷰: 본인 리뷰만 추가/수정/삭제
drop policy if exists "snu review insert" on public.reviews;
create policy "snu review insert" on public.reviews for insert to authenticated
  with check (public.is_snu() and user_id = auth.uid());
drop policy if exists "snu review update" on public.reviews;
create policy "snu review update" on public.reviews for update to authenticated
  using (user_id = auth.uid()) with check (public.is_snu() and user_id = auth.uid());
drop policy if exists "snu review delete" on public.reviews;
create policy "snu review delete" on public.reviews for delete to authenticated
  using (user_id = auth.uid());

-- ---------- 5. 식당 목록 (서울대 생협 식단 페이지 기준) ----------
insert into public.restaurants (name, sort_order) values
  ('학생회관식당',        1),
  ('자하연식당 3층',      2),
  ('자하연식당 2층',      3),
  ('예술계식당',          4),
  ('두레미담',            5),
  ('동원관식당',          6),
  ('기숙사식당',          7),
  ('3식당',               8),
  ('302동식당',           9),
  ('301동식당',           10),
  ('버거운버거',          11),
  ('공대간이식당',        12),
  ('75-1동 4층 푸드코트', 13),
  ('220동식당',           14)
on conflict (name) do update set sort_order = excluded.sort_order;

-- 예전 스키마의 '자하연식당'(층 구분 없음)은 메뉴가 없으면 정리
delete from public.restaurants r
where r.name = '자하연식당' and not exists (select 1 from public.menus m where m.restaurant_id = r.id);
