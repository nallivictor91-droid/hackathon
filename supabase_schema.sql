-- ==============================================================================
-- Supabase Database Schema for Gemini Chatbot
-- Run this in your Supabase Dashboard: SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. Create Sessions Table (for grouping conversations)
create table if not exists public.sessions (
  id text primary key,
  title text default 'New Chat',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Messages Table
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  session_id text not null default 'default-session' references public.sessions(id) on delete cascade,
  role text not null check (role in ('user', 'model', 'assistant', 'system')),
  content text not null,
  model text default 'gemini-1.5-flash',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create Index for Fast Chat History Retrieval
create index if not exists idx_messages_session_time 
on public.messages(session_id, created_at asc);

-- 4. Enable Row Level Security (RLS)
alter table public.sessions enable row level security;
alter table public.messages enable row level security;

-- 5. Create Permissive Policies for quick setup with the Anon Key
-- (You can tighten these later if you add Supabase Auth)
create policy "Allow all operations for anon on sessions"
on public.sessions for all
using (true)
with check (true);

create policy "Allow all operations for anon on messages"
on public.messages for all
using (true)
with check (true);

-- 6. Insert Default Session
insert into public.sessions (id, title)
values ('default-session', 'Main Chat Session')
on conflict (id) do nothing;
