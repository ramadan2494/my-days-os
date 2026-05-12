-- ============================================================
-- MyDayOS: Add actual_minutes column to daily_items
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Safe to run multiple times (idempotent via IF NOT EXISTS)
-- ============================================================

alter table public.daily_items
  add column if not exists actual_minutes integer not null default 0;
