# MyDayOS — Full App Rebuild Plan (Weekly Flow)

## App Flow

```
WEEKLY PLAN → DAILY VIEW (Today) → STATS
```

## Status: ~4 done · ~5 partial · ~21 missing

| Task | Status |
|------|--------|
| TASK-001 Project scaffold | ✅ Done |
| TASK-002 Profiles table | ✅ Done |
| TASK-003 Auth login/signup | ✅ Done |
| TASK-004 App shell + nav | 🔧 Wrong nav items |
| TASK-005 Onboarding | ❌ Missing |
| TASK-006 categories/week_plans/weekly_items tables | ❌ Missing |
| TASK-007 /week page | ❌ Missing |
| TASK-008 Category manager in Settings | ❌ Missing |
| TASK-009 AI weekly plan API | ❌ Missing |
| TASK-010 AI generate button | ❌ Missing |
| TASK-011 Prayer times API | ✅ Done |
| TASK-012 daily_items table | ❌ Missing |
| TASK-013 Auto-seed prayers | ❌ Missing |
| TASK-014 AI distribute week | ❌ Missing |
| TASK-015 Manual distribute | ❌ Missing |
| TASK-016 /today page | 🔧 Wrong model |
| TASK-017 /api/award-xp + xp_log | ❌ Missing |
| TASK-018 XP animation + level-up toast | ❌ Missing |
| TASK-019 Prayer 3-button row | 🔧 Partial |
| TASK-020 Streaks logic | 🔧 Partial |
| TASK-021 Badges system | 🔧 Partial |
| TASK-022 Badge notification | ❌ Missing |
| TASK-023 Stats page | ❌ Missing |
| TASK-024 Badges wall | ❌ Missing |
| TASK-025 Week summary strip | ❌ Missing |
| TASK-026 Empty states + skeletons | ❌ Missing |
| TASK-027 Dark mode | 🔧 Partial |
| TASK-028 Prayer notifications | ❌ Missing |
| TASK-029 Past-day view | ❌ Missing |
| TASK-030 PWA | ❌ Missing |

## XP Rules
| Action | XP |
|--------|----|
| Prayer on time | 20 |
| Prayer late | 8 |
| High priority | 25 |
| Medium priority | 15 |
| Low priority | 10 |

## Level Titles
1-4 Beginner · 5-9 Knowledge Seeker · 10-14 Focused Scholar
15-19 Deep Worker · 20-29 Present Father · 30-49 PhD Warrior · 50+ Life Master

## Default Categories
Prayers 🕌 #22c55e · Work 💼 #3b82f6 · PhD 🎓 #8b5cf6
Learning 📚 #f59e0b · Family 👨‍👩‍👦 #f97316 · Business 📈 #06b6d4 · Book 📖 #ec4899

---

## Phase 1 — New Data Model (SQL + types) ✅
- [x] Add `categories` table + trigger to seed 7 defaults on signup
- [x] Add `week_plans` table
- [x] Add `weekly_items` table (FK → week_plans, categories)
- [x] Add `daily_items` table (FK → weekly_items nullable, categories)
- [x] Add `xp_log` table
- [x] Update supabase/schema.sql
- [x] Add Category, WeekPlan, WeeklyItem, DailyItem, XpLog types to lib/supabase/types.ts

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
- [x] Prayers group first with On Time/Late/Skip buttons
- [x] XP float animation + level-up toast + badge popup
- [x] ?date= param support + prev/next arrows

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

## Phase 7 — Badges + Streaks
- [ ] lib/badges.ts — checkAndAwardBadges()
- [ ] lib/streaks.ts — updateOverallStreak() + updatePrayerStreak()

## Phase 8 - GAMIFICATION SCREEN THAT SHOW LEVEL AND ICON OR MY IMAGE MOVE AS LEVELS OR ROAD MOVE ON IT

## Phase 9 - enhancements: in today section can click next to show next day until end of week 

## Phase 10  — Week grid: add task per day
Add a '+' button to each day column in the week grid view. Tapping it opens a quick-add form (title, category, priority) that saves the new task to both the weekly plan and that specific day — instantly reflected in both views.

Phase 10 addition — Sports category
Add Sports 🏃 #ef4444 to the default categories list and include it in the Supabase trigger that seeds categories on new user signup.



// not now
## Phase 1000 — Month plan view with expandable week rows
Add a /plan page showing the current month as rows of weeks. Each week row shows a summary strip (total items, completion %, category color dots) and expands on click to reveal the existing week grid component with its '+' per day button. AI generation works at both levels — generate a full month plan (Claude distributes items across all 4 weeks) or generate a single week inside the month. Clicking any day in the expanded grid navigates to /today?date=YYYY-MM-DD. All items created here reflect in the existing weekly_items and daily_items tables — no new data model needed.



## Phase 1001 — Growth Roadmap
Add a /roadmap page with a tab in the nav. On first visit, an AI wizard asks 3–4 questions: current role/level, tech or domain knowledge, and what the user wants to become. Claude generates a structured multi-level roadmap (e.g. Junior → Mid → Senior → Architect) with skills, topics, and milestones per level. Each level shows as a card with expandable skill areas. A "Load into Plan" button takes any level's topics and sends them to the existing AI week/month plan generator to distribute across time. Roadmap is saved to a new roadmaps table so it persists and can be updated as the user progresses.