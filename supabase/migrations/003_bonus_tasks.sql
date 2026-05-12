-- ============================================================
-- MyDayOS: Add is_bonus column to daily_items
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ============================================================

alter table public.daily_items
  add column if not exists is_bonus boolean not null default false;
