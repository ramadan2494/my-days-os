-- ============================================================
-- MyDayOS: Weekly Planning System Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Safe to run multiple times (idempotent)
-- ============================================================

-- CATEGORIES TABLE
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

-- Function to seed 7 default categories for a user
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
    (p_user_id, 'Book',     '#ec4899', '📖', false)
  on conflict (user_id, name) do nothing;
end;
$$ language plpgsql security definer;

-- Update handle_new_user trigger to also seed categories on signup
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

-- WEEK PLANS TABLE
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

-- WEEKLY ITEMS TABLE
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

-- DAILY ITEMS TABLE
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

-- XP LOG TABLE
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

-- Increment XP function (idempotent)
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
-- Seed default categories for ALL existing users
-- (safe to re-run — uses ON CONFLICT DO NOTHING)
-- ============================================================
select public.seed_default_categories(id) from public.profiles;
