import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WeekPageClient from './WeekPageClient'

function getWeekStart(date = new Date()): string {
  // Use local date arithmetic — avoid toISOString() which shifts to UTC
  const d = new Date(date)
  const day = d.getDay() // 0=Sun,1=Mon,...
  // Week starts on Monday (day=1); Sunday (0) goes back 6 days
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

export default async function WeekPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const weekStart = getWeekStart()

  function fmtDate(d: Date) {
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
  }

  // Search a ±7 day window to catch any timezone-drift copies.
  // Among all matching plans, prefer the one with actual items (the original data plan).
  const lo = new Date(weekStart + 'T12:00:00'); lo.setDate(lo.getDate() - 7)
  const hi = new Date(weekStart + 'T12:00:00'); hi.setDate(hi.getDate() + 7)

  const { data: allPlans } = await supabase
    .from('week_plans')
    .select('*')
    .eq('user_id', user.id)
    .gte('week_start', fmtDate(lo))
    .lte('week_start', fmtDate(hi))
    .order('week_start', { ascending: false })

  let weekPlan = null

  if (allPlans && allPlans.length > 0) {
    // Among plans in the window, pick the one that has weekly_items (real data)
    for (const plan of allPlans) {
      const { count } = await supabase
        .from('weekly_items')
        .select('*', { count: 'exact', head: true })
        .eq('week_plan_id', plan.id)
      if ((count ?? 0) > 0) {
        weekPlan = plan
        break
      }
    }
    // If none have items, use the most recent plan (by week_start)
    if (!weekPlan) weekPlan = allPlans[0]
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
      weekStart={weekPlan?.week_start ?? weekStart}
      categories={categoriesRes.data ?? []}
      weeklyItems={weeklyItemsRes.data ?? []}
      dailyItems={dailyItemsRes.data ?? []}
    />
  )
}
