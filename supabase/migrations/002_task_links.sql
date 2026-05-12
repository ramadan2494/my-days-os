-- ============================================================
-- MyDayOS: Add link column to weekly_items and daily_items
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Safe to run multiple times (idempotent via ALTER TABLE IF NOT EXISTS pattern)
-- ============================================================

alter table public.weekly_items
  add column if not exists link text;

alter table public.daily_items
  add column if not exists link text;
