-- ============================================================================
-- JustANotepad — 원클릭 Supabase 설정 (스키마 + 초기 랜딩 콘텐츠)
-- ----------------------------------------------------------------------------
-- 실행 방법:
-- 1. https://app.supabase.com/project/rbscvtnfveakwjwrteux/sql/new 접속
-- 2. 이 파일 전체 복사해서 붙여넣기
-- 3. 우측 하단 "Run" 버튼 클릭
-- 4. 성공 메시지 확인 후 한 줄 더 실행:
--      update public.profiles set role='admin' where email='auto0104@gmail.com';
-- ============================================================================

-- ========== 1. profiles (역할/플랜) ==========
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

drop policy if exists "profiles read own" on public.profiles;
drop policy if exists "profiles update admin" on public.profiles;
drop policy if exists "profiles insert admin" on public.profiles;

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

-- ========== 2. cms_content (핵심: 랜딩 페이지 콘텐츠) ==========
create table if not exists public.cms_content (
  key text primary key,
  value text,
  kind text default 'text' check (kind in ('text','html','image','url')),
  note text,
  updated_at timestamptz default now()
);
alter table public.cms_content enable row level security;
drop policy if exists "content read all" on public.cms_content;
drop policy if exists "content admin all" on public.cms_content;

create policy "content read all" on public.cms_content for select using (true);
create policy "content admin all" on public.cms_content
  for all using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ========== 3. cms_notices / cms_faq / cms_popups / cms_docs ==========
create table if not exists public.cms_notices (
  id uuid primary key default gen_random_uuid(),
  title text not null, body text,
  pinned boolean default false, published boolean default true,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.cms_notices enable row level security;
drop policy if exists "notices read published" on public.cms_notices;
drop policy if exists "notices admin all" on public.cms_notices;
create policy "notices read published" on public.cms_notices for select
  using (published or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
create policy "notices admin all" on public.cms_notices for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create table if not exists public.cms_faq (
  id uuid primary key default gen_random_uuid(),
  question text not null, answer text, sort_order int default 0,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.cms_faq enable row level security;
drop policy if exists "faq read all" on public.cms_faq;
drop policy if exists "faq admin all" on public.cms_faq;
create policy "faq read all" on public.cms_faq for select using (true);
create policy "faq admin all" on public.cms_faq for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create table if not exists public.cms_popups (
  id uuid primary key default gen_random_uuid(),
  title text not null, body text,
  active_from timestamptz, active_to timestamptz,
  created_at timestamptz default now(), updated_at timestamptz default now()
);
alter table public.cms_popups enable row level security;
drop policy if exists "popups read active" on public.cms_popups;
drop policy if exists "popups admin all" on public.cms_popups;
create policy "popups read active" on public.cms_popups for select
  using (coalesce(active_from, now()) <= now() and coalesce(active_to, now() + interval '100 years') >= now());
create policy "popups admin all" on public.cms_popups for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create table if not exists public.cms_docs (
  key text primary key, body text, updated_at timestamptz default now()
);
alter table public.cms_docs enable row level security;
drop policy if exists "docs read all" on public.cms_docs;
drop policy if exists "docs admin all" on public.cms_docs;
create policy "docs read all" on public.cms_docs for select using (true);
create policy "docs admin all" on public.cms_docs for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create table if not exists public.cms_sections (
  slug text primary key, headline text, subhead text, body text, image_url text,
  updated_at timestamptz default now()
);
alter table public.cms_sections enable row level security;
drop policy if exists "sections read all" on public.cms_sections;
drop policy if exists "sections admin all" on public.cms_sections;
create policy "sections read all" on public.cms_sections for select using (true);
create policy "sections admin all" on public.cms_sections for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ============================================================================
-- 4. 초기 랜딩 콘텐츠 — 현재 index.html의 텍스트를 그대로 세팅
-- ============================================================================
insert into public.cms_content (key, value, kind, note) values
  -- 네비게이션
  ('nav.brand',    'JustANotepad',      'text', '좌측 상단 브랜드명'),
  ('nav.link1',    '기능',              'text', '상단 메뉴 1'),
  ('nav.link2',    '비교',              'text', '상단 메뉴 2'),
  ('nav.link3',    '자주 묻는 질문',     'text', '상단 메뉴 3'),
  ('nav.signin',   '로그인',            'text', '상단 로그인 버튼'),
  ('nav.signup',   '무료 가입',         'text', '상단 가입 버튼'),
  -- 히어로
  ('hero.eyebrow', '2026 정식 서비스 운영 중', 'text', '히어로 상단 아이브로 태그'),
  ('hero.title',   '적고, <em style="font-family:var(--font-serif); font-style:italic; font-weight:400; color:var(--claude-orange);">그리고</em>,<br />계산하고, <em style="font-family:var(--font-serif); font-style:italic; font-weight:400; color:var(--claude-orange);">정리합니다</em>', 'html', '히어로 메인 헤드라인'),
  ('hero.subtitle','<span class="nb">글씨든 차트든 스케치든,</span> 하나의 파일 안에서. <span class="nb">14가지 역할별 도구</span>와 <span class="nb">16개 AI</span>가 당신을 기다립니다.', 'html', '히어로 서브타이틀'),
  -- 피처드 카드 4개
  ('featured.card1.label', '2026년 4월 · 메이저 업데이트', 'text', '카드1 상단 라벨'),
  ('featured.card1.title', '14가지 역할별 도구 + 클라우드 동기화', 'text', '카드1 제목'),
  ('featured.card1.btn1',  '무료 가입', 'text', '카드1 메인 버튼'),
  ('featured.card1.btn2',  '다운로드', 'text', '카드1 보조 버튼'),
  ('featured.card2.label', '개발자 서한', 'text', '카드2 라벨'),
  ('featured.card2.title', '"그냥 메모장이 되려 했지만…"', 'text', '카드2 제목'),
  ('featured.card2.date',  '2026.04.19', 'text', '카드2 날짜'),
  ('featured.card2.cta',   '읽어보기', 'text', '카드2 CTA'),
  ('featured.card3.label', '공지사항', 'text', '카드3 라벨'),
  ('featured.card3.title', '평생 무료 · 광고 없이 운영합니다', 'text', '카드3 제목'),
  ('featured.card3.date',  '2026.04.19', 'text', '카드3 날짜'),
  ('featured.card3.cta',   '자세히', 'text', '카드3 CTA'),
  ('featured.card4.label', '지금 가입', 'text', '카드4 라벨'),
  ('featured.card4.title', '가입하고 모든 기능 사용하기', 'text', '카드4 제목'),
  ('featured.card4.date',  '30초 소요', 'text', '카드4 날짜'),
  ('featured.card4.cta',   '시작하기', 'text', '카드4 CTA'),
  -- 기능 섹션
  ('features.title',    '<span class="nb">850KB짜리 파일 하나에</span> <span class="nb">이 모든 게 들어있습니다</span>', 'html', '기능 섹션 헤드라인'),
  ('features.subtitle', '<span class="nb">정리 · 검색 · AI · 동기화</span> <span class="nb">· 그림판 · 명함 OCR · 회의 녹음</span> <span class="nb">· 14가지 전용 도구까지.</span> <span class="nb">결제도 구독도 없이, 평생 무료.</span>', 'html', '기능 섹션 서브타이틀'),
  -- 다운로드 섹션
  ('download.eyebrow',  'DOWNLOAD', 'text', '다운로드 아이브로'),
  ('download.title',    '원하는 곳에서 바로', 'text', '다운로드 헤드라인'),
  ('download.subtitle', '웹으로 바로 쓰거나, 앱으로 설치해서 네이티브처럼. 모든 플랫폼에서 동일한 메모.', 'text', '다운로드 서브타이틀'),
  -- CTA
  ('cta.title',    '무료로 시작하세요', 'text', 'CTA 섹션 제목'),
  ('cta.subtitle', '<span class="nb">이메일 하나면 30초 안에</span> 가입 완료. <span class="nb">결제 정보 없이</span> <span class="nb">모든 기능을 평생 무료로.</span>', 'html', 'CTA 섹션 서브타이틀'),
  -- FAQ
  ('faq.title', '자주 묻는 질문', 'text', 'FAQ 섹션 헤드라인')
on conflict (key) do nothing;

-- ============================================================================
-- 5. 완료 후 관리자 지정 (이 쿼리는 아래 한 줄을 별도로 실행)
-- ----------------------------------------------------------------------------
-- update public.profiles set role='admin' where email='auto0104@gmail.com';
-- ============================================================================
