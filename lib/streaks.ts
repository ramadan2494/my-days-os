import { SupabaseClient } from '@supabase/supabase-js'

function getLocalDateStr(d = new Date()) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function daysBefore(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() - n)
  return getLocalDateStr(d)
}

/**
 * Recalculates `daily_streak` on the profile.
 * A day counts if the user completed at least 1 non-prayer daily_item on that date.
 * Streak increments only when today is an active day (so calling this after marking done is safe).
 */
export async function updateOverallStreak(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const today = getLocalDateStr()

  // Fetch last 60 days of completed daily_items (non-prayer)
  const since = daysBefore(today, 60)
  const { data: items } = await supabase
    .from('daily_items')
    .select('scheduled_date')
    .eq('user_id', userId)
    .eq('status', 'done')
    .neq('categories.name', 'Prayers')
    .gte('scheduled_date', since)
    .order('scheduled_date', { ascending: false })

  // Build a set of dates that have at least 1 completed item
  const activeDays = new Set((items ?? []).map((it: { scheduled_date: string }) => it.scheduled_date))

  // Walk backwards from today counting consecutive active days
  let streak = 0
  let cursor = today
  while (activeDays.has(cursor)) {
    streak++
    cursor = daysBefore(cursor, 1)
  }

  await supabase
    .from('profiles')
    .update({ daily_streak: streak, streak_days: streak, updated_at: new Date().toISOString() })
    .eq('id', userId)

  return streak
}

/**
 * Recalculates `prayer_streak` on the profile.
 * A day counts if all 5 prayers have status !== 'pending' (i.e. the user did something with them).
 * Strict mode: all 5 must be on_time or late (not missed/skipped) — we count on_time+late only.
 */
export async function updatePrayerStreak(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const today = getLocalDateStr()
  const since = daysBefore(today, 60)

  // Get all prayer daily_items in the last 60 days
  const { data: prayers } = await supabase
    .from('daily_items')
    .select('scheduled_date, status, title')
    .eq('user_id', userId)
    .gte('scheduled_date', since)
    .order('scheduled_date', { ascending: false })

  // Group by date — find dates where all 5 prayers are done (on_time or late = status 'done')
  const byDate = new Map<string, { done: number; total: number }>()
  for (const p of prayers ?? []) {
    // Only count items from the Prayers category by title matching prayer names
    const prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
    if (!prayerNames.includes(p.title)) continue
    const entry = byDate.get(p.scheduled_date) ?? { done: 0, total: 0 }
    entry.total++
    if (p.status === 'done') entry.done++
    byDate.set(p.scheduled_date, entry)
  }

  // A day is "perfect" if all 5 prayers were done
  const perfectDays = new Set(
    Array.from(byDate.entries())
      .filter(([, v]) => v.total === 5 && v.done === 5)
      .map(([date]) => date)
  )

  // Walk backwards from today counting consecutive perfect prayer days
  let streak = 0
  let cursor = today
  while (perfectDays.has(cursor)) {
    streak++
    cursor = daysBefore(cursor, 1)
  }

  await supabase
    .from('profiles')
    .update({ prayer_streak: streak, updated_at: new Date().toISOString() })
    .eq('id', userId)

  return streak
}
