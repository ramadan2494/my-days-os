-- MyDayOS Supabase Schema
-- Fully idempotent — safe to re-run on an existing database

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  location_lat double precision,
  location_lng double precision,
  city text,
  prayer_method text default 'MWL',
  prayer_notification_offset integer default 10,
  dark_mode boolean default false,
  work_start_hour integer default 9,
  work_hours integer default 8,
  xp integer default 0,
  level integer default 1,
  daily_streak integer default 0,
  prayer_streak integer default 0,
  work_streak integer default 0,
  learning_streak integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- PRAYERS
-- ============================================================
create table if not exists public.prayers (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  name text not null check (name in ('Fajr','Dhuhr','Asr','Maghrib','Isha')),
  scheduled_time time not null,
  status text default 'pending' check (status in ('pending','on_time','late','missed')),
  completed_at timestamptz,
  xp_earned integer default 0,
  created_at timestamptz default now(),
  unique(user_id, date, name)
);

alter table public.prayers enable row level security;
drop policy if exists "Users manage own prayers" on public.prayers;
create policy "Users manage own prayers" on public.prayers for all using (auth.uid() = user_id);

-- ============================================================
-- TASKS
-- ============================================================
create table if not exists public.tasks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  due_date date,
  scheduled_date date,
  priority text default 'medium' check (priority in ('high','medium','low')),
  category text default 'Work' check (category in ('Work','TA','PhD','Admin','Personal')),
  status text default 'todo' check (status in ('todo','in_progress','done')),
  is_recurring boolean default false,
  recurrence_rule text,
  estimated_minutes integer,
  actual_minutes integer,
  is_deep_work boolean default false,
  xp_earned integer default 0,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tasks enable row level security;
drop policy if exists "Users manage own tasks" on public.tasks;
create policy "Users manage own tasks" on public.tasks for all using (auth.uid() = user_id);

-- ============================================================
-- POMODORO SESSIONS
-- ============================================================
create table if not exists public.pomodoro_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  task_id uuid references public.tasks(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes integer default 25,
  completed boolean default false,
  created_at timestamptz default now()
);

alter table public.pomodoro_sessions enable row level security;
drop policy if exists "Users manage own pomodoros" on public.pomodoro_sessions;
create policy "Users manage own pomodoros" on public.pomodoro_sessions for all using (auth.uid() = user_id);

-- ============================================================
-- LEARNING GOALS
-- ============================================================
create table if not exists public.learning_goals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  domain text default 'Programming/Tech' check (domain in ('PhD Research','Programming/Tech','Soft Skills','Productivity')),
  target_date date,
  estimated_hours integer,
  total_hours_done double precision default 0,
  status text default 'active' check (status in ('active','paused','completed')),
  plan_mode text default 'manual' check (plan_mode in ('manual','ai','hybrid')),
  ai_plan jsonb,
  topics text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.learning_goals enable row level security;
drop policy if exists "Users manage own goals" on public.learning_goals;
create policy "Users manage own goals" on public.learning_goals for all using (auth.uid() = user_id);

-- ============================================================
-- LEARNING SESSIONS
-- ============================================================
create table if not exists public.learning_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  goal_id uuid references public.learning_goals(id) on delete cascade not null,
  title text not null,
  scheduled_date date,
  duration_minutes integer default 60,
  status text default 'pending' check (status in ('pending','done','skipped','rescheduled')),
  resources jsonb,
  notes text,
  xp_earned integer default 0,
  completed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.learning_sessions enable row level security;
drop policy if exists "Users manage own sessions" on public.learning_sessions;
create policy "Users manage own sessions" on public.learning_sessions for all using (auth.uid() = user_id);

-- ============================================================
-- FAMILY EVENTS
-- ============================================================
create table if not exists public.family_events (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  event_date date,
  start_time time,
  end_time time,
  is_recurring boolean default false,
  recurrence_rule text,
  status text default 'planned' check (status in ('planned','completed','missed')),
  xp_earned integer default 0,
  quick_log_note text,
  created_at timestamptz default now()
);

alter table public.family_events enable row level security;
drop policy if exists "Users manage own family events" on public.family_events;
create policy "Users manage own family events" on public.family_events for all using (auth.uid() = user_id);

-- ============================================================
-- DAILY SCORES
-- ============================================================
create table if not exists public.daily_scores (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  prayer_score integer default 0,
  work_score integer default 0,
  learning_score integer default 0,
  family_score integer default 0,
  total_score integer default 0,
  xp_earned integer default 0,
  mood integer check (mood between 1 and 5),
  energy integer check (energy between 1 and 5),
  evening_reflection text,
  gratitude text,
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table public.daily_scores enable row level security;
drop policy if exists "Users manage own scores" on public.daily_scores;
create policy "Users manage own scores" on public.daily_scores for all using (auth.uid() = user_id);

-- ============================================================
-- BADGES
-- ============================================================
create table if not exists public.badges (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  badge_key text not null,
  badge_name text not null,
  badge_description text,
  badge_icon text,
  earned_at timestamptz default now(),
  unique(user_id, badge_key)
);

alter table public.badges enable row level security;
drop policy if exists "Users view own badges" on public.badges;
create policy "Users view own badges" on public.badges for all using (auth.uid() = user_id);

-- ============================================================
-- COACHING LOGS
-- ============================================================
create table if not exists public.coaching_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null,
  content jsonb,
  ai_response text,
  created_at timestamptz default now()
);

alter table public.coaching_logs enable row level security;
drop policy if exists "Users manage own coaching" on public.coaching_logs;
create policy "Users manage own coaching" on public.coaching_logs for all using (auth.uid() = user_id);

-- ============================================================
-- WELLBEING PULSES
-- ============================================================
create table if not exists public.wellbeing_pulses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  q1_energy integer check (q1_energy between 1 and 5),
  q2_focus integer check (q2_focus between 1 and 5),
  q3_relations integer check (q3_relations between 1 and 5),
  q4_purpose integer check (q4_purpose between 1 and 5),
  q5_overall integer check (q5_overall between 1 and 5),
  average double precision,
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table public.wellbeing_pulses enable row level security;
drop policy if exists "Users manage own pulses" on public.wellbeing_pulses;
create policy "Users manage own pulses" on public.wellbeing_pulses for all using (auth.uid() = user_id);

-- ============================================================
-- FUNCTION: auto-create profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- MIGRATIONS: idempotent column additions
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city_name text,
  ADD COLUMN IF NOT EXISTS notification_offset_minutes integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS work_hours_per_day integer DEFAULT 8,
  ADD COLUMN IF NOT EXISTS streak_days integer DEFAULT 0;

ALTER TABLE public.wellbeing_pulses
  ADD COLUMN IF NOT EXISTS mood integer CHECK (mood BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS energy integer CHECK (energy BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS clarity integer CHECK (clarity BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS stress integer CHECK (stress BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS connection integer CHECK (connection BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS wellbeing_score double precision;

ALTER TABLE public.coaching_logs
  DROP CONSTRAINT IF EXISTS coaching_logs_type_check;
ALTER TABLE public.coaching_logs
  ADD CONSTRAINT coaching_logs_type_check CHECK (type IN (
    'morning_checkin', 'evening_reflection', 'cbt_tip', 'coaching_message',
    'wellbeing_pulse', 'morning_coaching', 'burnout_warning', 'phd_coaching'
  ));

ALTER TABLE public.learning_goals
  ADD COLUMN IF NOT EXISTS topics text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_plan jsonb;

ALTER TABLE public.learning_sessions
  ADD COLUMN IF NOT EXISTS resources jsonb;

ALTER TABLE public.family_events
  ADD COLUMN IF NOT EXISTS quick_log_note text,
  ADD COLUMN IF NOT EXISTS xp_earned integer DEFAULT 0;

ALTER TABLE public.daily_scores
  ADD COLUMN IF NOT EXISTS mood_score integer,
  ADD COLUMN IF NOT EXISTS total_score integer;

-- ============================================================
-- MONTHLY PLANS
-- ============================================================
create table if not exists public.monthly_plans (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  month text not null, -- YYYY-MM format
  start_date date not null,
  end_date date not null,
  goal_text text,
  overview text,
  ai_plan jsonb,
  hours_per_day integer default 2,
  category text default 'Work',
  created_at timestamptz default now()
);

alter table public.monthly_plans enable row level security;
drop policy if exists "Users manage own monthly plans" on public.monthly_plans;
create policy "Users manage own monthly plans" on public.monthly_plans for all using (auth.uid() = user_id);

alter table public.tasks
  add column if not exists monthly_plan_id uuid references public.monthly_plans(id) on delete set null;

-- ============================================================
-- FUNCTION: increment_xp
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_xp(user_id uuid, amount integer)
RETURNS void AS $$
  UPDATE public.profiles
  SET
    xp = xp + amount,
    level = GREATEST(1, floor((xp + amount) / 500)::integer + 1),
    updated_at = now()
  WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER;


-- ============================================================
-- PROFILES
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  full_name text,
  avatar_url text,
  location_lat double precision,
  location_lng double precision,
  city text,
  prayer_method text default 'MWL', -- MWL | ISNA | Egypt | Makkah
  prayer_notification_offset integer default 10, -- minutes before prayer
  dark_mode boolean default false,
  work_start_hour integer default 9,
  work_hours integer default 8,
  xp integer default 0,
  level integer default 1,
  daily_streak integer default 0,
  prayer_streak integer default 0,
  work_streak integer default 0,
  learning_streak integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- ============================================================
-- PRAYERS
-- ============================================================
create table public.prayers (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  name text not null check (name in ('Fajr','Dhuhr','Asr','Maghrib','Isha')),
  scheduled_time time not null,
  status text default 'pending' check (status in ('pending','on_time','late','missed')),
  completed_at timestamptz,
  xp_earned integer default 0,
  created_at timestamptz default now(),
  unique(user_id, date, name)
);

alter table public.prayers enable row level security;
create policy "Users manage own prayers" on public.prayers for all using (auth.uid() = user_id);

-- ============================================================
-- TASKS
-- ============================================================
create table public.tasks (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  due_date date,
  scheduled_date date,
  priority text default 'medium' check (priority in ('high','medium','low')),
  category text default 'Work' check (category in ('Work','TA','PhD','Admin','Personal')),
  status text default 'todo' check (status in ('todo','in_progress','done')),
  is_recurring boolean default false,
  recurrence_rule text, -- daily | weekly | weekdays
  estimated_minutes integer,
  actual_minutes integer,
  is_deep_work boolean default false,
  xp_earned integer default 0,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.tasks enable row level security;
create policy "Users manage own tasks" on public.tasks for all using (auth.uid() = user_id);

-- ============================================================
-- POMODORO SESSIONS
-- ============================================================
create table public.pomodoro_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  task_id uuid references public.tasks(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes integer default 25,
  completed boolean default false,
  created_at timestamptz default now()
);

alter table public.pomodoro_sessions enable row level security;
create policy "Users manage own pomodoros" on public.pomodoro_sessions for all using (auth.uid() = user_id);

-- ============================================================
-- LEARNING GOALS
-- ============================================================
create table public.learning_goals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  domain text default 'Programming/Tech' check (domain in ('PhD Research','Programming/Tech','Soft Skills','Productivity')),
  target_date date,
  estimated_hours integer,
  total_hours_done double precision default 0,
  status text default 'active' check (status in ('active','paused','completed')),
  plan_mode text default 'manual' check (plan_mode in ('manual','ai','hybrid')),
  ai_plan jsonb, -- full AI-generated plan stored here
  topics text[], -- input topics for AI
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.learning_goals enable row level security;
create policy "Users manage own goals" on public.learning_goals for all using (auth.uid() = user_id);

-- ============================================================
-- LEARNING SESSIONS
-- ============================================================
create table public.learning_sessions (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  goal_id uuid references public.learning_goals(id) on delete cascade not null,
  title text not null,
  scheduled_date date,
  duration_minutes integer default 60,
  status text default 'pending' check (status in ('pending','done','skipped','rescheduled')),
  resources jsonb, -- [{type, title, url}]
  notes text,
  xp_earned integer default 0,
  completed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.learning_sessions enable row level security;
create policy "Users manage own sessions" on public.learning_sessions for all using (auth.uid() = user_id);

-- ============================================================
-- FAMILY EVENTS
-- ============================================================
create table public.family_events (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  event_date date,
  start_time time,
  end_time time,
  is_recurring boolean default false,
  recurrence_rule text,
  status text default 'planned' check (status in ('planned','completed','missed')),
  xp_earned integer default 0,
  quick_log_note text,
  created_at timestamptz default now()
);

alter table public.family_events enable row level security;
create policy "Users manage own family events" on public.family_events for all using (auth.uid() = user_id);

-- ============================================================
-- DAILY SCORES
-- ============================================================
create table public.daily_scores (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  prayer_score integer default 0,   -- 0-25
  work_score integer default 0,     -- 0-25
  learning_score integer default 0, -- 0-25
  family_score integer default 0,   -- 0-25
  total_score integer default 0,    -- 0-100
  xp_earned integer default 0,
  mood integer check (mood between 1 and 5),
  energy integer check (energy between 1 and 5),
  evening_reflection text,
  gratitude text,
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table public.daily_scores enable row level security;
create policy "Users manage own scores" on public.daily_scores for all using (auth.uid() = user_id);

-- ============================================================
-- BADGES
-- ============================================================
create table public.badges (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  badge_key text not null,
  badge_name text not null,
  badge_description text,
  badge_icon text,
  earned_at timestamptz default now(),
  unique(user_id, badge_key)
);

alter table public.badges enable row level security;
create policy "Users view own badges" on public.badges for all using (auth.uid() = user_id);

-- ============================================================
-- COACHING LOGS
-- ============================================================
create table public.coaching_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('morning_checkin','evening_reflection','cbt_tip','coaching_message','wellbeing_pulse')),
  content jsonb,
  ai_response text,
  created_at timestamptz default now()
);

alter table public.coaching_logs enable row level security;
create policy "Users manage own coaching" on public.coaching_logs for all using (auth.uid() = user_id);

-- ============================================================
-- WELLBEING PULSES
-- ============================================================
create table public.wellbeing_pulses (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  q1_energy integer check (q1_energy between 1 and 5),
  q2_focus integer check (q2_focus between 1 and 5),
  q3_relations integer check (q3_relations between 1 and 5),
  q4_purpose integer check (q4_purpose between 1 and 5),
  q5_overall integer check (q5_overall between 1 and 5),
  average double precision,
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table public.wellbeing_pulses enable row level security;
create policy "Users manage own pulses" on public.wellbeing_pulses for all using (auth.uid() = user_id);

-- ============================================================
-- FUNCTION: auto-create profile on signup
-- ============================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- MIGRATION: Add missing columns & functions
-- Run this after the initial schema creation
-- ============================================================

-- Add missing profile columns (idempotent)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS city_name text,
  ADD COLUMN IF NOT EXISTS notification_offset_minutes integer DEFAULT 10,
  ADD COLUMN IF NOT EXISTS work_hours_per_day integer DEFAULT 8,
  ADD COLUMN IF NOT EXISTS work_start_hour integer DEFAULT 9,
  ADD COLUMN IF NOT EXISTS streak_days integer DEFAULT 0;

-- Backfill from old columns
UPDATE public.profiles SET
  city_name = COALESCE(city_name, city),
  notification_offset_minutes = COALESCE(notification_offset_minutes, prayer_notification_offset),
  work_hours_per_day = COALESCE(work_hours_per_day, work_hours),
  streak_days = COALESCE(streak_days, daily_streak);

-- Fix wellbeing_pulses: add columns for mood/energy/clarity/stress/connection
ALTER TABLE public.wellbeing_pulses
  ADD COLUMN IF NOT EXISTS mood integer CHECK (mood BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS energy integer CHECK (energy BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS clarity integer CHECK (clarity BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS stress integer CHECK (stress BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS connection integer CHECK (connection BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS wellbeing_score double precision;

-- Fix coaching_logs type constraint to allow all types used by the app
ALTER TABLE public.coaching_logs
  DROP CONSTRAINT IF EXISTS coaching_logs_type_check;
ALTER TABLE public.coaching_logs
  ADD CONSTRAINT coaching_logs_type_check CHECK (type IN (
    'morning_checkin', 'evening_reflection', 'cbt_tip', 'coaching_message',
    'wellbeing_pulse', 'morning_coaching', 'burnout_warning', 'phd_coaching'
  ));

-- Add missing columns to learning_goals
ALTER TABLE public.learning_goals
  ADD COLUMN IF NOT EXISTS topics text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ai_plan jsonb;

-- Add missing columns to learning_sessions
ALTER TABLE public.learning_sessions
  ADD COLUMN IF NOT EXISTS resources jsonb;

-- Add missing columns to family_events
ALTER TABLE public.family_events
  ADD COLUMN IF NOT EXISTS quick_log_note text,
  ADD COLUMN IF NOT EXISTS xp_earned integer DEFAULT 0;

-- Add daily_scores columns used by app
ALTER TABLE public.daily_scores
  ADD COLUMN IF NOT EXISTS mood_score integer,
  ADD COLUMN IF NOT EXISTS total_score integer;

-- ============================================================
-- MONTHLY PLANS
-- ============================================================
create table if not exists public.monthly_plans (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  month text not null, -- YYYY-MM format
  start_date date not null,
  end_date date not null,
  goal_text text,
  overview text,
  ai_plan jsonb,
  hours_per_day integer default 2,
  category text default 'Work',
  created_at timestamptz default now()
);

alter table public.monthly_plans enable row level security;
create policy "Users manage own monthly plans" on public.monthly_plans for all using (auth.uid() = user_id);

-- Add monthly_plan_id FK to tasks
alter table public.tasks
  add column if not exists monthly_plan_id uuid references public.monthly_plans(id) on delete set null;

-- ============================================================
-- FUNCTION: increment_xp
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_xp(user_id uuid, amount integer)
RETURNS void AS $$
  UPDATE public.profiles
  SET
    xp = xp + amount,
    level = GREATEST(1, floor((xp + amount) / 500)::integer + 1),
    updated_at = now()
  WHERE id = user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- WEEKLY PLANNING SYSTEM
-- ============================================================

-- CATEGORIES
create table if not exists public.categories (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  color text not null default '#3b82f6',
  icon text not null default '📌',
  is_default boolean default false,
  created_at timestamptz default now(),
  unique(user_id, name)
);

alter table public.categories enable row level security;
drop policy if exists "Users manage own categories" on public.categories;
create policy "Users manage own categories" on public.categories for all using (auth.uid() = user_id);

create or replace function public.seed_default_categories(p_user_id uuid)
returns void as $$
begin
  insert into public.categories (user_id, name, color, icon, is_default) values
    (p_user_id, 'Prayers',  '#22c55e', '🕌', true),
    (p_user_id, 'Work',     '#3b82f6', '💼', false),
    (p_user_id, 'PhD',      '#8b5cf6', '🎓', false),
    (p_user_id, 'Learning', '#f59e0b', '📚', false),
    (p_user_id, 'Family',   '#f97316', '👨‍👩‍👦', false),
    (p_user_id, 'Business', '#06b6d4', '📈', false),
    (p_user_id, 'Book',     '#ec4899', '📖', false),
    (p_user_id, 'Sports',   '#ef4444', '🏃', false)
  on conflict (user_id, name) do nothing;
end;
$$ language plpgsql security definer;

-- Update handle_new_user to also seed categories
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  perform public.seed_default_categories(new.id);
  return new;
end;
$$ language plpgsql security definer;

-- WEEK PLANS
create table if not exists public.week_plans (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  week_start date not null,
  title text,
  created_at timestamptz default now(),
  unique(user_id, week_start)
);

alter table public.week_plans enable row level security;
drop policy if exists "Users manage own week plans" on public.week_plans;
create policy "Users manage own week plans" on public.week_plans for all using (auth.uid() = user_id);

-- WEEKLY ITEMS
create table if not exists public.weekly_items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  week_plan_id uuid references public.week_plans(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete cascade not null,
  title text not null,
  description text,
  target_days integer default 1 check (target_days between 1 and 7),
  priority text default 'medium' check (priority in ('high','medium','low')),
  created_at timestamptz default now()
);

alter table public.weekly_items enable row level security;
drop policy if exists "Users manage own weekly items" on public.weekly_items;
create policy "Users manage own weekly items" on public.weekly_items for all using (auth.uid() = user_id);

-- DAILY ITEMS
create table if not exists public.daily_items (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  week_plan_id uuid references public.week_plans(id) on delete cascade,
  weekly_item_id uuid references public.weekly_items(id) on delete set null,
  category_id uuid references public.categories(id) on delete cascade not null,
  title text not null,
  scheduled_date date not null,
  status text default 'pending' check (status in ('pending','done','skipped')),
  xp_earned integer default 0,
  completed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.daily_items enable row level security;
drop policy if exists "Users manage own daily items" on public.daily_items;
create policy "Users manage own daily items" on public.daily_items for all using (auth.uid() = user_id);

-- XP LOG
create table if not exists public.xp_log (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  source_type text not null,
  source_id uuid,
  xp_amount integer not null,
  earned_at timestamptz default now()
);

alter table public.xp_log enable row level security;
drop policy if exists "Users view own xp log" on public.xp_log;
create policy "Users view own xp log" on public.xp_log for all using (auth.uid() = user_id);

-- Backfill default categories for all existing users (safe to re-run)
select public.seed_default_categories(id) from public.profiles;
