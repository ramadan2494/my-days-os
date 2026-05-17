import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WeekPageClient from './WeekPageClient'
import { getWeekStart } from '@/lib/week'

export default async function WeekPage({
  searchParams,
}: {
  searchParams: Promise<{ ws?: string }>
}) {
  const { ws } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Load profile for name; week always starts on Sunday (0) to match the Sun-first grid
  const { data: profile } = await supabase.from('profiles').select('week_start_day, full_name').eq('id', user.id).single()

  // Normalize weekStart to the containing Sunday (handles stale ?ws Monday-based URLs too)
  const weekStart = getWeekStart(
    ws && /^\d{4}-\d{2}-\d{2}$/.test(ws) ? new Date(ws + 'T12:00:00') : new Date(),
    0
  )

  // Exact match on Sunday weekStart
  const { data: exactPlan } = await supabase
    .from('week_plans')
    .select('*')
    .eq('user_id', user.id)
    .eq('week_start', weekStart)
    .maybeSingle()

  let weekPlan = exactPlan ?? null

  // Legacy fallback: old plans were stored with Monday start (profile week_start_day=1).
  // Try weekStart+1 (Monday) and silently migrate to Sunday start.
  if (!weekPlan) {
    const legacy = new Date(weekStart + 'T12:00:00')
    legacy.setDate(legacy.getDate() + 1)
    const legacyStart = [legacy.getFullYear(), String(legacy.getMonth() + 1).padStart(2, '0'), String(legacy.getDate()).padStart(2, '0')].join('-')
    const { data: legacyPlan } = await supabase
      .from('week_plans')
      .select('*')
      .eq('user_id', user.id)
      .eq('week_start', legacyStart)
      .maybeSingle()
    if (legacyPlan) {
      // Migrate: update week_start to Sunday so future loads use exact match
      await supabase.from('week_plans').update({ week_start: weekStart }).eq('id', legacyPlan.id)
      weekPlan = { ...legacyPlan, week_start: weekStart }
    }
  }

  if (!weekPlan) {
    const { data: newPlan } = await supabase
      .from('week_plans')
      .insert({ user_id: user.id, week_start: weekStart })
      .select()
      .single()
    weekPlan = newPlan
  }

  const [categoriesRes, weeklyItemsRes, dailyItemsRes] = await Promise.all([
    supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
    supabase
      .from('weekly_items')
      .select('*, categories(*)')
      .eq('week_plan_id', weekPlan?.id ?? '')
      .order('created_at'),
    supabase
      .from('daily_items')
      .select('*, categories(*)')
      .eq('week_plan_id', weekPlan?.id ?? '')
      .order('scheduled_date'),
  ])

  return (
    <WeekPageClient
      userId={user.id}
      weekPlan={weekPlan}
      weekStart={weekStart}
      categories={categoriesRes.data ?? []}
      weeklyItems={weeklyItemsRes.data ?? []}
      dailyItems={dailyItemsRes.data ?? []}
      profileName={profile?.full_name ?? ''}
    />
  )
}
