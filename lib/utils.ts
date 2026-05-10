import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTime(time: string): string {
  const [hour, minute] = time.split(':').map(Number)
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const h = hour % 12 || 12
  return `${h}:${String(minute).padStart(2, '0')} ${ampm}`
}

export function getXPForLevel(level: number): number {
  return level * 500
}

export function getLevelTitle(level: number): string {
  const titles: Record<number, string> = {
    1: 'Day One',
    2: 'Awakened Mind',
    3: 'Focused Seeker',
    4: 'Disciplined Scholar',
    5: 'Knowledge Seeker',
    6: 'Present Father',
    7: 'Focused Scholar',
    8: 'Devoted Servant',
    9: 'Master of Days',
    10: 'Life Architect',
  }
  return titles[Math.min(level, 10)] ?? 'Grand Scholar'
}

export function getPrayerXP(status: 'on_time' | 'late' | 'missed'): number {
  return { on_time: 30, late: 10, missed: 0 }[status]
}

export function getTaskXP(isDeepWork: boolean, priority: string): number {
  const base = priority === 'high' ? 40 : priority === 'medium' ? 25 : 15
  return isDeepWork ? base * 2 : base
}

export function getDailyScore(
  prayers: number,
  work: number,
  learning: number,
  family: number
): number {
  return Math.round((prayers * 0.3 + work * 0.3 + learning * 0.25 + family * 0.15) * 100)
}

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function isToday(dateStr: string): boolean {
  return dateStr === new Date().toISOString().split('T')[0]
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export function BADGE_DEFINITIONS() {
  return [
    { key: 'first_prayer', name: 'First Step', description: 'Completed your first prayer', icon: '🕌' },
    { key: 'prayer_streak_7', name: '7-Day Prayer Streak', description: '7 consecutive days all prayers on time', icon: '⭐' },
    { key: 'prayer_streak_30', name: '30-Day Prayer Streak', description: '30 consecutive days all prayers on time', icon: '🌟' },
    { key: 'first_task', name: 'Getting Things Done', description: 'Completed your first task', icon: '✅' },
    { key: 'pomodoro_100', name: 'Pomodoro Master', description: 'Completed 100 Pomodoro sessions', icon: '🍅' },
    { key: 'deep_work_50h', name: 'Deep Work Champion', description: '50 hours of deep work logged', icon: '🧠' },
    { key: 'first_learning_goal', name: 'Scholar Begins', description: 'Completed your first learning goal', icon: '📚' },
    { key: 'learning_streak_7', name: 'Learning Streak', description: '7 days consecutive learning', icon: '📖' },
    { key: 'family_10h', name: 'Present Father', description: '10 hours of family time logged', icon: '👨‍👩‍👦' },
    { key: 'daily_streak_7', name: 'Week Warrior', description: '7-day daily streak', icon: '🔥' },
    { key: 'daily_streak_30', name: 'Month Master', description: '30-day daily streak', icon: '💎' },
    { key: 'perfect_day', name: 'Perfect Day', description: 'Score of 100 in a single day', icon: '🏆' },
    { key: 'level_5', name: 'Level 5', description: 'Reached Level 5', icon: '🌙' },
    { key: 'level_10', name: 'Life Architect', description: 'Reached Level 10', icon: '👑' },
  ]
}
