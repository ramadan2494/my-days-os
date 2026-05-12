import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkAndAwardBadges } from '@/lib/badges'
import { updateOverallStreak, updatePrayerStreak } from '@/lib/streaks'

function calcXP({
  category_name,
  priority,
  is_prayer,
  prayer_status,
}: {
  category_name: string
  priority: string
  is_prayer: boolean
  prayer_status?: string
}): number {
  if (is_prayer) return prayer_status === 'on_time' ? 20 : 8
  if (priority === 'high') return 25
  if (priority === 'medium') return 15
  return 10
}

function calcLevel(xp: number): number {
  return Math.floor(xp / 500) + 1
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    item_id,
    category_name = '',
    priority = 'medium',
    is_prayer = false,
    prayer_status,
  } = body

  const xp_earned = calcXP({ category_name, priority, is_prayer, prayer_status })

  await supabase.from('xp_log').insert({
    user_id: user.id,
    source_type: is_prayer ? 'prayer' : 'daily_item',
    source_id: item_id ?? null,
    xp_amount: xp_earned,
  })

  const { data: profile } = await supabase
    .from('profiles')
    .select('xp, level, daily_streak, prayer_streak')
    .eq('id', user.id)
    .single()

  const old_level = profile?.level ?? 1
  const new_xp = (profile?.xp ?? 0) + xp_earned
  const new_level = calcLevel(new_xp)

  await supabase
    .from('profiles')
    .update({ xp: new_xp, level: new_level, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  // Update streaks
  const [new_daily_streak, new_prayer_streak] = await Promise.all([
    updateOverallStreak(supabase, user.id),
    is_prayer ? updatePrayerStreak(supabase, user.id) : Promise.resolve(profile?.prayer_streak ?? 0),
  ])

  // Build badge context — fetch counts needed
  const [{ count: totalDone }, { data: catCounts }] = await Promise.all([
    supabase
      .from('daily_items')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'done'),
    supabase
      .from('daily_items')
      .select('categories!inner(name), status')
      .eq('user_id', user.id)
      .eq('status', 'done'),
  ])

  const tasksByCategory: Record<string, number> = {}
  for (const row of catCounts ?? []) {
    const name = (row as { categories: { name: string } }).categories?.name
    if (name) tasksByCategory[name] = (tasksByCategory[name] ?? 0) + 1
  }

  // Check if all 5 prayers done today
  const today = new Date().toISOString().split('T')[0]
  const { data: todayPrayers } = await supabase
    .from('daily_items')
    .select('status, title')
    .eq('user_id', user.id)
    .eq('scheduled_date', today)
  const prayerNames = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
  const todayPrayerItems = (todayPrayers ?? []).filter((p: { title: string }) => prayerNames.includes(p.title))
  const allPrayersDoneToday =
    todayPrayerItems.length === 5 &&
    todayPrayerItems.every((p: { status: string }) => p.status === 'done')

  const new_badges = await checkAndAwardBadges(supabase, user.id, {
    totalXp: new_xp,
    level: new_level,
    dailyStreak: new_daily_streak,
    prayerStreak: new_prayer_streak,
    totalTasksDone: totalDone ?? 0,
    tasksByCategory,
    allPrayersDoneToday,
  })

  return NextResponse.json({
    xp_earned,
    new_total_xp: new_xp,
    new_level,
    level_up: new_level > old_level,
    new_daily_streak,
    new_prayer_streak,
    new_badges,
  })_xp,
    level: new_level,
    dailyStreak: new_daily_streak,
    prayerStreak: new_prayer_streak,
    totalTasksDone: totalDone ?? 0,
    tasksByCategory,
    allPrayersDoneToday,
  })

  return NextResponse.json({
    xp_earned,
    new_total_xp: new_xp,
    new_level,
    level_up: new_level > old_level,
    new_daily_streak,
    new_prayer_streak,
    new_badges,
  })
}
