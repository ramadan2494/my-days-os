-- Phase 15a: Configurable week start day
-- week_start_day: 0 = Sunday, 1 = Monday, ..., 6 = Saturday (default 0 = Sunday)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS week_start_day smallint NOT NULL DEFAULT 0
    CHECK (week_start_day >= 0 AND week_start_day <= 6);
