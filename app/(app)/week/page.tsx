import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WeekPageClient from './WeekPageClient'

function getWeekStart(date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

function fmtDate(d: Date) {
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

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

  // If client passed ?ws=YYYY-MM-DD use it; otherwise fall back to server UTC guess
  const weekStart = (ws && /^\d{4}-\d{2}-\d{2}$/.test(ws)) ? ws : getWeekStart()

  // Search ±7 days. Among all matching plans pick the one with actual items (real data plan).
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
      weekStart={weekStart}
      categories={categoriesRes.data ?? []}
      weeklyItems={weeklyItemsRes.data ?? []}
      dailyItems={dailyItemsRes.data ?? []}
    />
  )
}
