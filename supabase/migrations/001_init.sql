-- Clarity Lab / 명료 연습실 schema
-- Run in the Supabase SQL editor.

create table if not exists public.profiles (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  accent text,
  editor_font_size int default 18,
  last_writing_language text default 'ko',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.sessions (
  id uuid primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null check (type in ('explanation', 'argument', 'debate')),
  status text not null,
  step text not null default 'research',
  topic jsonb not null,
  language text not null,
  stance jsonb,
  durations jsonb default '{}'::jsonb,
  step_started_at timestamptz,
  due_revisions jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.documents (
  id uuid primary key,
  session_id uuid not null references public.sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null,
  version int not null,
  text text not null default '',
  marks jsonb,
  created_at timestamptz default now()
);

create table if not exists public.topic_items (
  id text primary key,
  bank text not null check (bank in ('explanation', 'proposition')),
  title text,
  prompt text,
  claim text,
  background_bullets text[],
  keywords text[],
  tags text[],
  difficulty text,
  source text,
  active boolean default true,
  fetched_at timestamptz default now()
);

create table if not exists public.topic_refreshes (
  id uuid primary key default gen_random_uuid(),
  bank text not null,
  status text not null,
  item_count int,
  note text,
  created_at timestamptz default now()
);

create index if not exists sessions_profile_updated on public.sessions (profile_id, updated_at desc);
create index if not exists documents_session_created on public.documents (session_id, created_at);
create index if not exists topic_items_bank_active on public.topic_items (bank, active);

alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.documents enable row level security;
alter table public.topic_items enable row level security;
alter table public.topic_refreshes enable row level security;

create policy "profiles_own" on public.profiles
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "sessions_own" on public.sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "documents_own" on public.documents
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "topics_read" on public.topic_items
  for select to authenticated using (true);

create policy "refreshes_read" on public.topic_refreshes
  for select to authenticated using (true);
