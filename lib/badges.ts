import { SupabaseClient } from '@supabase/supabase-js'

export interface BadgeDef {
  key: string
  name: string
  icon: string
  description: string
  tier: 'bronze' | 'silver' | 'gold' | 'platinum'
}

export const ALL_BADGES: BadgeDef[] = [
  // XP milestones
  { key: 'first_step',   name: 'First Step',       icon: '🥇', description: 'Earn your first XP',           tier: 'bronze'   },
  { key: 'xp_100',       name: '100 XP Club',       icon: '💯', description: 'Earn 100 total XP',            tier: 'bronze'   },
  { key: 'xp_500',       name: 'Level Up Legend',   icon: '⚡', description: 'Earn 500 total XP',            tier: 'silver'   },
  { key: 'xp_1000',      name: 'Scholar\'s Mark',   icon: '📜', description: 'Earn 1,000 total XP',          tier: 'silver'   },
  { key: 'xp_2500',      name: 'Deep Worker',       icon: '🔥', description: 'Earn 2,500 total XP',          tier: 'gold'     },
  { key: 'xp_5000',      name: 'Grand Scholar',     icon: '🏆', description: 'Earn 5,000 total XP',          tier: 'gold'     },
  { key: 'xp_10000',     name: 'Life Master',       icon: '👑', description: 'Earn 10,000 total XP',         tier: 'platinum' },

  // Level milestones
  { key: 'level_5',      name: 'Knowledge Seeker',  icon: '📚', description: 'Reach Level 5',                tier: 'silver'   },
  { key: 'level_10',     name: 'Life Architect',    icon: '🏗️', description: 'Reach Level 10',               tier: 'gold'     },

  // Streak milestones
  { key: 'streak_3',     name: 'Momentum',          icon: '🌊', description: '3-day streak',                 tier: 'bronze'   },
  { key: 'streak_7',     name: 'Week Warrior',      icon: '🗓️', description: '7-day streak',                 tier: 'silver'   },
  { key: 'streak_30',    name: 'Iron Will',         icon: '🦾', description: '30-day streak',                tier: 'gold'     },

  // Prayer streaks
  { key: 'prayer_streak_7',  name: 'Faithful Week', icon: '🕌', description: '7-day prayer streak',         tier: 'silver'   },
  { key: 'prayer_streak_30', name: 'Devout',        icon: '🌙', description: '30-day prayer streak',        tier: 'gold'     },

  // Task count
  { key: 'tasks_10',     name: 'Getting Started',   icon: '✅', description: 'Complete 10 tasks',            tier: 'bronze'   },
  { key: 'tasks_50',     name: 'Task Machine',      icon: '⚙️', description: 'Complete 50 tasks',            tier: 'silver'   },
  { key: 'tasks_100',    name: 'Centurion',         icon: '💪', description: 'Complete 100 tasks',           tier: 'gold'     },

  // Category-specific
  { key: 'work_10',      name: 'Pro Worker',        icon: '💼', description: 'Complete 10 Work tasks',       tier: 'bronze'   },
  { key: 'learning_10',  name: 'Curious Mind',      icon: '🧠', description: 'Complete 10 Learning tasks',   tier: 'bronze'   },
  { key: 'phd_10',       name: 'Researcher',        icon: '🎓', description: 'Complete 10 PhD tasks',        tier: 'bronze'   },
  { key: 'family_5',     name: 'Family Hero',       icon: '👨‍👩‍👦', description: 'Complete 5 Family tasks',  tier: 'bronze'   },

  // Perfect prayer day
  { key: 'all_prayers',  name: 'Five Pillars',      icon: '⭐', description: 'Complete all 5 prayers in a day', tier: 'silver' },
]

interface BadgeCheckContext {
  totalXp: number
  level: number
  dailyStreak: number
  prayerStreak: number
  totalTasksDone: number
  tasksByCategory: Record<string, number>  // category name → done count
  allPrayersDoneToday: boolean
}

export async function checkAndAwardBadges(
  supabase: SupabaseClient,
  userId: string,
  ctx: BadgeCheckContext
): Promise<BadgeDef[]> {
  const { data: existing } = await supabase
    .from('badges')
    .select('badge_key')
    .eq('user_id', userId)

  const earned = new Set((existing ?? []).map((b: { badge_key: string }) => b.badge_key))

  const toAward: BadgeDef[] = []

  function check(badge: BadgeDef, condition: boolean) {
    if (condition && !earned.has(badge.key)) toAward.push(badge)
  }

  const b = ALL_BADGES.reduce((m, b) => { m[b.key] = b; return m }, {} as Record<string, BadgeDef>)

  // XP milestones
  check(b.first_step,  ctx.totalXp >= 1)
  check(b.xp_100,      ctx.totalXp >= 100)
  check(b.xp_500,      ctx.totalXp >= 500)
  check(b.xp_1000,     ctx.totalXp >= 1000)
  check(b.xp_2500,     ctx.totalXp >= 2500)
  check(b.xp_5000,     ctx.totalXp >= 5000)
  check(b.xp_10000,    ctx.totalXp >= 10000)

  // Level milestones
  check(b.level_5,     ctx.level >= 5)
  check(b.level_10,    ctx.level >= 10)

  // Streak milestones
  check(b.streak_3,    ctx.dailyStreak >= 3)
  check(b.streak_7,    ctx.dailyStreak >= 7)
  check(b.streak_30,   ctx.dailyStreak >= 30)

  // Prayer streak
  check(b.prayer_streak_7,  ctx.prayerStreak >= 7)
  check(b.prayer_streak_30, ctx.prayerStreak >= 30)

  // Task counts
  check(b.tasks_10,  ctx.totalTasksDone >= 10)
  check(b.tasks_50,  ctx.totalTasksDone >= 50)
  check(b.tasks_100, ctx.totalTasksDone >= 100)

  // Category tasks
  check(b.work_10,     (ctx.tasksByCategory['Work'] ?? 0) >= 10)
  check(b.learning_10, (ctx.tasksByCategory['Learning'] ?? 0) >= 10)
  check(b.phd_10,      (ctx.tasksByCategory['PhD'] ?? 0) >= 10)
  check(b.family_5,    (ctx.tasksByCategory['Family'] ?? 0) >= 5)

  // Perfect prayer day
  check(b.all_prayers, ctx.allPrayersDoneToday)

  if (toAward.length > 0) {
    await supabase.from('badges').insert(
      toAward.map((badge) => ({
        user_id: userId,
        badge_key: badge.key,
        badge_name: badge.name,
        badge_icon: badge.icon,
        badge_description: badge.description,
      }))
    )
  }

  return toAward
}
