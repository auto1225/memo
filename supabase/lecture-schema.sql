-- ============================================================================
-- JustANotepad · Lecture Mode 스키마 추가본
-- ----------------------------------------------------------------------------
-- 이 파일은 supabase-SETUP-ALL.sql 을 이미 실행한 프로젝트 위에 덧붙이는 것을
-- 전제로 합니다. (profiles, handle_new_user 트리거가 이미 존재해야 함)
--
-- 실행 방법:
--   1. https://app.supabase.com/project/rbscvtnfveakwjwrteux/sql/new
--   2. 이 파일 전체 복사 → 붙여넣기 → Run
-- ============================================================================

-- pgvector 확장 (이미 있으면 no-op)
create extension if not exists vector;

-- ========== 1. 과목 ==========
create table if not exists public.lecture_subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text default '#6ea8ff',
  created_at timestamptz default now()
);
alter table public.lecture_subjects enable row level security;

drop policy if exists "lec_subjects own" on public.lecture_subjects;
create policy "lec_subjects own" on public.lecture_subjects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ========== 2. 수업 세션 ==========
create table if not exists public.lecture_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject_id uuid references public.lecture_subjects(id) on delete set null,
  title text,
  subject_name text,                    -- subject_id 가 없을 때의 프리텍스트
  started_at timestamptz default now(),
  duration_ms integer default 0,
  language text default 'ko-KR',
  -- 원본 오디오/영상 참조 (Supabase Storage 경로 등)
  audio_path text,
  video_path text,
  -- 생성된 산출물
  summary_md text,
  quiz_json jsonb,
  flashcards_json jsonb,
  -- 소프트 삭제
  deleted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
alter table public.lecture_sessions enable row level security;

drop policy if exists "lec_sessions own" on public.lecture_sessions;
create policy "lec_sessions own" on public.lecture_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists lec_sessions_user_idx on public.lecture_sessions(user_id, started_at desc);

-- ========== 3. 노트 블록 (문장·필기·시스템 이벤트) ==========
-- type: ai-transcript | user-text | adopted | summary | system | ink | image
create table if not exists public.lecture_blocks (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lecture_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  text text,
  meta jsonb default '{}'::jsonb,
  time_ms integer not null default 0,   -- 수업 시작부터의 경과
  confidence real,                      -- ASR 신뢰도
  created_at timestamptz default now()
);
alter table public.lecture_blocks enable row level security;
drop policy if exists "lec_blocks own" on public.lecture_blocks;
create policy "lec_blocks own" on public.lecture_blocks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists lec_blocks_session_idx on public.lecture_blocks(session_id, time_ms);

-- ========== 4. Copilot 카드 ==========
-- kind: define | link | quiz | cite | translate | warn | ok | kind
create table if not exists public.lecture_cards (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.lecture_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text,
  body text,
  meta jsonb default '{}'::jsonb,
  time_ms integer default 0,
  adopted boolean default false,
  created_at timestamptz default now()
);
alter table public.lecture_cards enable row level security;
drop policy if exists "lec_cards own" on public.lecture_cards;
create policy "lec_cards own" on public.lecture_cards
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ========== 5. 타임라인 이벤트 (trk: audio|ink|type|ai|slide|video) ==========
create table if not exists public.lecture_events (
  id bigserial primary key,
  session_id uuid not null references public.lecture_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  track text not null check (track in ('audio','ink','type','ai','slide','video')),
  time_ms integer not null,
  label text,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);
alter table public.lecture_events enable row level security;
drop policy if exists "lec_events own" on public.lecture_events;
create policy "lec_events own" on public.lecture_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists lec_events_session_idx on public.lecture_events(session_id, time_ms);

-- ========== 6. 개념(Concept) & Study Graph 링크 ==========
create table if not exists public.lecture_concepts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  subject_id uuid references public.lecture_subjects(id) on delete set null,
  vector vector(1536),           -- OpenAI/Gemini 임베딩. 차원이 다르면 이 부분만 변경.
  created_at timestamptz default now(),
  unique (user_id, name, subject_id)
);
alter table public.lecture_concepts enable row level security;
drop policy if exists "lec_concepts own" on public.lecture_concepts;
create policy "lec_concepts own" on public.lecture_concepts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists lec_concepts_vec_idx
  on public.lecture_concepts using ivfflat (vector vector_cosine_ops) with (lists = 100);

-- 블록 ↔ 개념 N:M
create table if not exists public.lecture_block_concepts (
  block_id uuid not null references public.lecture_blocks(id) on delete cascade,
  concept_id uuid not null references public.lecture_concepts(id) on delete cascade,
  weight real default 1.0,
  primary key (block_id, concept_id)
);
alter table public.lecture_block_concepts enable row level security;
drop policy if exists "lec_bc own" on public.lecture_block_concepts;
create policy "lec_bc own" on public.lecture_block_concepts
  for all using (
    exists (select 1 from public.lecture_blocks b where b.id = block_id and b.user_id = auth.uid())
  ) with check (true);

-- ========== 7. 오답노트 (SM-2 간격반복) ==========
create table if not exists public.lecture_srs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references public.lecture_sessions(id) on delete set null,
  question text not null,
  answer text,
  explanation text,
  source_time_ms integer,
  -- SM-2 상태
  ease real default 2.5,
  interval_days integer default 0,
  repetition integer default 0,
  due_at timestamptz default now(),
  last_reviewed_at timestamptz,
  created_at timestamptz default now()
);
alter table public.lecture_srs enable row level security;
drop policy if exists "lec_srs own" on public.lecture_srs;
create policy "lec_srs own" on public.lecture_srs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists lec_srs_due_idx on public.lecture_srs(user_id, due_at);

-- ========== 8. Storage 버킷 (원본 오디오/영상/슬라이드) ==========
-- Supabase Studio Storage에서 수동 생성이 더 안정적이지만, SQL로도 가능합니다.
insert into storage.buckets (id, name, public)
values ('lecture-media', 'lecture-media', false)
on conflict (id) do nothing;

-- Storage RLS: 자기 경로(user_id/...)만 접근
drop policy if exists "lec_media own" on storage.objects;
create policy "lec_media own" on storage.objects
  for all using (bucket_id = 'lecture-media' and (auth.uid()::text = (storage.foldername(name))[1]))
  with check (bucket_id = 'lecture-media' and (auth.uid()::text = (storage.foldername(name))[1]));

-- ========== 9. 유용한 뷰 ==========
-- 세션당 블록/카드 개수 요약
create or replace view public.lecture_session_stats as
select
  s.id as session_id, s.user_id, s.title, s.subject_name, s.started_at, s.duration_ms,
  (select count(*) from public.lecture_blocks b where b.session_id = s.id) as block_count,
  (select count(*) from public.lecture_cards c where c.session_id = s.id) as card_count,
  (select count(*) from public.lecture_cards c where c.session_id = s.id and c.adopted) as card_adopted
from public.lecture_sessions s
where s.deleted_at is null;

-- 완료!
select 'lecture schema installed' as status;
