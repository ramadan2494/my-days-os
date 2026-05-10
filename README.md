# MyDayOS 🕌

A gamified personal life OS for a PhD student — built with Next.js, Tailwind CSS, Supabase, and Claude AI.

## Stack

- **Next.js 16** — App Router, TypeScript
- **Tailwind CSS** — dark-first UI, no CSS files
- **Supabase** — database, auth, real-time
- **Claude (claude-3-5-haiku)** — AI coaching and learning plans

## Setup

### 1. Clone & install

```bash
npm install
```

### 2. Create Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project
2. In SQL Editor, run the full `supabase/schema.sql` (includes migration at the bottom)
3. Enable Google OAuth under Authentication → Providers (optional)

### 3. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in:
- `NEXT_PUBLIC_SUPABASE_URL` — from Project Settings → API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Project Settings → API
- `CLAUDE_API_KEY` — from [console.anthropic.com](https://console.anthropic.com)

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 5. Deploy to Vercel

```bash
npx vercel
```

Add the same env vars in Vercel dashboard → Project → Settings → Environment Variables.

## Features

| Module | Description |
|--------|-------------|
| Today | Dashboard with prayer strip, task list, timeline, morning check-in |
| Prayer | 5-prayer tracker, Qibla, 30-day heatmap, XP gamification |
| Work | Kanban + Pomodoro timer + Deep Work mode + task CRUD |
| Learning | Goal creation, AI plan generation (Claude), session tracking |
| Family | Protected time blocks, quick moment logging, weekly report |
| Coaching | Morning coaching, CBT tips, PhD coaching, wellbeing pulse, burnout detection |
| Profile | XP/level/badges, daily score chart, streaks |
| Settings | Prayer method, location, work hours, notification offset |

## XP System

| Action | XP |
|--------|----|
| Prayer on-time | 30 |
| Prayer late | 10 |
| Task high priority | 40 |
| Task medium | 25 |
| Task low | 15 |
| Deep Work task | x2 |
| Pomodoro session | 20 |
| Family event done | 20 |
| Learning session done | ~30/hr |

## Level Titles

1 Day One → 2 Awakened Mind → 3 Focused Seeker → 4 Disciplined Scholar →
5 Knowledge Seeker → 6 Present Father → 7 Focused Scholar → 8 Devoted Servant →
9 Master of Days → 10 Life Architect
