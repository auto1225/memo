-- JustANotepad Supabase 스키마
-- Supabase Dashboard → SQL Editor 에서 전체 복사·실행

-- ═════════════════════════════════════════════════════════
-- 1. 사용자 프로필 (auth.users 자동 연동)
-- ═════════════════════════════════════════════════════════
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  photo_url text,
  plan text default 'free' check (plan in ('free','premium')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ═════════════════════════════════════════════════════════
-- 2. 사용자 데이터 (전체 state JSON 저장)
-- ═════════════════════════════════════════════════════════
create table if not exists user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null,
  version int default 1,
  updated_at timestamptz default now()
);

-- ═════════════════════════════════════════════════════════
-- 3. 공유 탭 (링크로 공유)
-- ═════════════════════════════════════════════════════════
create table if not exists shared_tabs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  tab_id text,
  tab_name text,
  tab_html text,
  access_mode text default 'read' check (access_mode in ('read','edit')),
  password_hash text,
  expires_at timestamptz,
  view_count int default 0,
  created_at timestamptz default now()
);
create index if not exists shared_tabs_owner on shared_tabs(owner_id);

-- ═════════════════════════════════════════════════════════
-- 4. Row Level Security — 사용자는 자기 데이터만
-- ═════════════════════════════════════════════════════════
alter table profiles enable row level security;
alter table user_data enable row level security;
alter table shared_tabs enable row level security;

-- profiles
drop policy if exists "자기 프로필 조회" on profiles;
drop policy if exists "자기 프로필 수정" on profiles;
create policy "자기 프로필 조회" on profiles for select using (auth.uid() = id);
create policy "자기 프로필 수정" on profiles for all using (auth.uid() = id);

-- user_data
drop policy if exists "자기 데이터 접근" on user_data;
create policy "자기 데이터 접근" on user_data for all using (auth.uid() = user_id);

-- shared_tabs: 소유자는 전체, 비소유자는 SELECT만 (만료 전)
drop policy if exists "공유 탭 소유자 전체" on shared_tabs;
drop policy if exists "공유 탭 공개 조회" on shared_tabs;
create policy "공유 탭 소유자 전체" on shared_tabs for all using (auth.uid() = owner_id);
create policy "공유 탭 공개 조회" on shared_tabs for select using (expires_at is null or expires_at > now());

-- ═════════════════════════════════════════════════════════
-- 5. 자동 프로필 생성 트리거 (새 사용자 가입 시)
-- ═════════════════════════════════════════════════════════
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, photo_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ═════════════════════════════════════════════════════════
-- 6. updated_at 자동 갱신 트리거
-- ═════════════════════════════════════════════════════════
create or replace function update_modified()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

drop trigger if exists user_data_updated on user_data;
create trigger user_data_updated before update on user_data
  for each row execute function update_modified();

-- ═════════════════════════════════════════════════════════
-- 완료 확인
-- ═════════════════════════════════════════════════════════
select 'Schema 적용 완료' as status;
