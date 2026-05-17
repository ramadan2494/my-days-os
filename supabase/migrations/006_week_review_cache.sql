-- Cache AI week review on the week plan to avoid redundant AI calls
alter table public.week_plans
  add column if not exists review_cache jsonb,
  add column if not exists review_cached_at timestamptz;
