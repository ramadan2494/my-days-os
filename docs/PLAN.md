# MyDayOS — Full App Rebuild Plan (Weekly Flow)

## App Flow

```
WEEKLY PLAN → DAILY VIEW (Today) → STATS
```

## Status Overview

| Task | Status |
|------|--------|
| TASK-001 Project scaffold | ✅ Done |
| TASK-002 Profiles table | ✅ Done |
| TASK-003 Auth login/signup | ✅ Done |
| TASK-004 App shell + nav | ✅ Done |
| TASK-005 Onboarding | ✅ Done |
| TASK-006 categories/week_plans/weekly_items tables | ✅ Done |
| TASK-007 /week page | ✅ Done |
| TASK-008 Category manager in Settings | ✅ Done |
| TASK-009 AI weekly plan API | ✅ Done |
| TASK-010 AI generate button | ✅ Done |
| TASK-011 Prayer times API | ✅ Done |
| TASK-012 daily_items table | ✅ Done |
| TASK-013 Auto-seed prayers | ✅ Done |
| TASK-014 AI distribute week | ✅ Done |
| TASK-015 Manual task add | ✅ Done |
| TASK-016 /today page rebuild | ✅ Done |
| TASK-017 /api/award-xp + xp_log | ✅ Done |
| TASK-018 XP animation + level-up toast | ✅ Done |
| TASK-019 Prayer 3-button row | ✅ Done |
| TASK-020 Streaks logic | 🔧 Partial |
| TASK-021 Badges system | 🔧 Partial |
| TASK-022 Badge notification | ✅ Done |
| TASK-023 Stats page | ✅ Done |
| TASK-024 Badges wall | ✅ Done |
| TASK-025 Week summary strip | ❌ Missing |
| TASK-026 Empty states + skeletons | 🔧 Partial |
| TASK-027 Dark mode | 🔧 Partial |
| TASK-028 Prayer notifications | ❌ Missing |
| TASK-029 Past-day view | ✅ Done |
| TASK-030 PWA | ❌ Missing |

---

## XP Rules

| Action | XP |
|--------|----|
| Prayer on time | 20 |
| Prayer late | 8 |
| High priority task | 25 |
| Medium priority task | 15 |
| Low priority task | 10 |

## Level Titles

1–4 Beginner · 5–9 Knowledge Seeker · 10–14 Focused Scholar
15–19 Deep Worker · 20–29 Present Father · 30–49 PhD Warrior · 50+ Life Master

## Default Categories

Prayers 🕌 #22c55e · Work 💼 #3b82f6 · PhD 🎓 #8b5cf6
Learning 📚 #f59e0b · Family 👨‍👩‍👦 #f97316 · Business 📈 #06b6d4 · Book 📖 #ec4899
Soft Skill 🧠 #14b8a6 · Sports 🏃 #ef4444

---

## Phase 1 — New Data Model (SQL + types) ✅

- [x] Add `categories` table + trigger to seed defaults on signup
- [x] Add `week_plans` table
- [x] Add `weekly_items` table (FK → week_plans, categories)
- [x] Add `daily_items` table (FK → weekly_items nullable, categories)
- [x] Add `xp_log` table
- [x] Update `supabase/schema.sql`
- [x] Add Category, WeekPlan, WeeklyItem, DailyItem, XpLog types to `lib/supabase/types.ts`

## Phase 2 — API Routes ✅

- [x] POST /api/award-xp
- [x] POST /api/claude/weekly-plan
- [x] POST /api/distribute-week
- [x] POST /api/prayers/seed-today

## Phase 3 — /week Page ✅

- [x] app/(app)/week/page.tsx
- [x] app/(app)/week/WeekPageClient.tsx
- [x] components/weekly/WeekPlanCreator.tsx
- [x] components/weekly/WeekGrid.tsx
- [x] components/weekly/DayColumn.tsx

## Phase 4 — /today Rebuild ✅

- [x] Rewrite app/(app)/page.tsx (daily_items model)
- [x] Prayers group first with On Time / Late / Skip buttons
- [x] XP float animation + level-up toast + badge popup
- [x] ?date= param support + prev/next day arrows

## Phase 5 — /stats Page ✅

- [x] app/(app)/stats/page.tsx + StatsPageClient.tsx
- [x] Hero: level, XP bar, streaks
- [x] Recharts weekly bar chart
- [x] Category breakdown rows
- [x] Prayer grid 5×7
- [x] Badges wall

## Phase 6 — Nav + Settings + Onboarding ✅

- [x] Rewrite Sidebar: Week / Today / Stats / Settings
- [x] Rewrite MobileNav: Today / Week / Stats / Settings
- [x] Add Categories section to Settings
- [x] app/(app)/onboarding/page.tsx (3-step)
- [x] Update proxy.ts publicPaths

## Phase 7 — Badges + Streaks 🔧 Partial

- [x] lib/badges.ts — `checkAndAwardBadges()`
- [x] lib/streaks.ts — `updateOverallStreak()` + `updatePrayerStreak()`

## Phase 8 — Gamification Journey Screen ✅

- [x] `/journey` page with hero card: current level icon, XP bar, day/prayer streaks
- [x] Vertical level road — 10 nodes, each showing icon, title, XP required; completed/current/locked states with glow animation on the current level
- [x] Badges wall — all badge definitions with earned/locked state, tier colours (bronze/silver/gold/platinum), and earned date
- [x] Journey linked in both Sidebar and MobileNav

## Phase 9 — Today Day Navigation ✅

Navigate forward/backward through the current week from the Today view using prev/next arrows. The next button is disabled past the end of the current week.

## Phase 10 — Week Grid: Quick Add Task Per Day ✅

- [x] `+` button on each day column opens an inline quick-add form (title, category, priority, optional link)
- [x] Saves to both `weekly_items` and `daily_items`, reflected instantly in both views
- [x] Sports 🏃 #ef4444 added to default categories and seeded on signup

## Phase 10b — Task Links ✅

- [x] Optional link field on `weekly_items` and `daily_items` (migration: `002_task_links.sql`)
- [x] Task title becomes a clickable link in the Today view and Week grid
- [x] Link input in the manual add form and day quick-add form

## Phase 11 — Day Organiser ✅

- [x] Bonus tasks — add ad-hoc tasks with a `⭐ BONUS` tag directly from Today view (migration: `003_bonus_tasks.sql`)
- [x] Pomodoro timer — `/pomodoro` page with 25/5/15 min modes, SVG ring, chime, and "Mark task done" button; accessible via 🍅 icon on each task row
- [x] AI day organiser — `POST /api/claude/day-organiser` calls Claude Haiku with today's task list; returns a short motivational review + 0–3 suggested tasks; "AI Day Review" card on the Today page lets you add suggestions with one tap

## Phase 12 — Time Tracking ✅

- [x] `actual_minutes` column on `daily_items` (migration: `004_time_tracking.sql`, default 0)
- [x] Live stopwatch per task on Today view — hover to reveal ▶ button; shows `MM:SS` counter while running; ■ stop button saves elapsed minutes to DB and shows a toast
- [x] Only one task can be timed at a time; timer resets automatically when navigating to a different day
- [x] Tracked time badge (`1h 23m`) displayed on any task row with logged time
- [x] Stats page — new “Time Tracked” section: total time this week, time-by-category horizontal bars, top 5 tasks by time
---

## Phase 13 — Bonus Tasks Polish & Week Grid Full CRUD ✅

- [x] **Bonus tasks are graded separately** — Day Progress bar counts only main (non-prayer, non-bonus) tasks; bonus tasks have their own `done/total` counter inside the Bonus section
- [x] **Delete bonus tasks** — hover any bonus row to reveal ✕ button; removes from DB and UI instantly
- [x] **Edit bonus tasks** — hover any bonus row to reveal ✎ button; inline rename, Enter to save / Escape to cancel
- [x] **Week grid — delete items** — hover any task chip to reveal 🗑 button; deletes the `daily_item` and its parent `weekly_item`
- [x] **Week grid — mark as bonus when adding** — quick-add form has a "⭐ Mark as bonus" toggle; sets `is_bonus: true` on the `daily_item`; bonus items show a ⭐ icon badge in the grid
- [x] Week grid drag & drop was already working; delete + edit + bonus marking complete the full CRUD cycle


### Phase 1000 — Monthly Plan View with Expandable Week Rows

Add a `/plan` page showing the current month as rows of weeks. Each week row displays a summary strip (total items, completion %, category color dots) and expands on click to reveal the existing week grid component with its `+` per-day button. AI generation works at both levels — generate a full month plan (Claude distributes items across all 4 weeks) or generate a single week inside the month. Clicking any day in the expanded grid navigates to `/today?date=YYYY-MM-DD`. All items created here use the existing `weekly_items` and `daily_items` tables — no new data model needed.

### Phase 1001 — Growth Roadmap

Add a `/roadmap` page with a tab in the nav. On first visit, an AI wizard asks 3–4 questions: current role/level, tech or domain knowledge, and what the user wants to become. Claude generates a structured multi-level roadmap (e.g. Junior → Mid → Senior → Architect) with skills, topics, and milestones per level. Each level shows as a card with expandable skill areas. A "Load into Plan" button sends any level's topics to the existing AI week/month plan generator to distribute across time. The roadmap is saved to a new `roadmaps` table so it persists and can be updated as the user progresses.
