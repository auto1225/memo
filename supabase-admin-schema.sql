-- ============================================================================
-- JustANotepad Admin CMS — Supabase Schema
-- ============================================================================
-- Run this once in your Supabase SQL editor (https://app.supabase.com → SQL).
-- Grants the authenticated role the permissions admin.js needs, and seeds
-- RLS policies so only users with profiles.role = 'admin' can mutate CMS rows.
-- ============================================================================

-- 1) profiles: mirrors auth.users, tracks role + plan
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  role text default 'user' check (role in ('user','admin','banned')),
  plan text default 'free' check (plan in ('free','trial','paid')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.profiles enable row level security;

-- Create profile automatically on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', new.email))
  on conflict (id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Policies: users read their own row; admins read/write everyone
create policy "profiles read own" on public.profiles
  for select using (auth.uid() = id or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));
create policy "profiles update admin" on public.profiles
  for update using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));
create policy "profiles insert admin" on public.profiles
  for insert with check (auth.uid() = id or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- 2) cms_notices: 공지사항
create table if not exists public.cms_notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  pinned boolean default false,
  published boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.cms_notices enable row level security;
create policy "notices read published" on public.cms_notices
  for select using (published or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));
create policy "notices admin all" on public.cms_notices
  for all using (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  )) with check (exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- 3) cms_faq
create table if not exists public.cms_faq (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  answer text,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.cms_faq enable row level security;
create policy "faq read all" on public.cms_faq for select using (true);
create policy "faq admin all" on public.cms_faq
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- 4) cms_popups
create table if not exists public.cms_popups (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  active_from timestamptz,
  active_to timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.cms_popups enable row level security;
create policy "popups read active" on public.cms_popups for select
  using (coalesce(active_from, now()) <= now() and coalesce(active_to, now() + interval '100 years') >= now());
create policy "popups admin all" on public.cms_popups
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- 5) cms_docs: single-row docs (terms, privacy, etc.)
create table if not exists public.cms_docs (
  key text primary key,
  body text,
  updated_at timestamptz default now()
);
alter table public.cms_docs enable row level security;
create policy "docs read all" on public.cms_docs for select using (true);
create policy "docs admin all" on public.cms_docs
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- 6) cms_sections: landing page sections (hero/features/pricing/etc.)
create table if not exists public.cms_sections (
  slug text primary key,
  headline text,
  subhead text,
  body text,
  image_url text,
  updated_at timestamptz default now()
);
alter table public.cms_sections enable row level security;
create policy "sections read all" on public.cms_sections for select using (true);
create policy "sections admin all" on public.cms_sections
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- 7) (선택) 초기 관리자 지정 — YOUR_EMAIL 교체 후 한 번 실행
-- update public.profiles set role = 'admin' where email = 'YOUR_EMAIL@gmail.com';
