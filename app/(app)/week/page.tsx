import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WeekPageClient from './WeekPageClient'

function getWeekStart(date = new Date()): string {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  return d.toISOString().split('T')[0]
}

export default async function WeekPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const weekStart = getWeekStart()

  let { data: weekPlan } = await supabase
    .from('week_plans')
    .select('*')
    .eq('user_id', user.id)
    .eq('week_start', weekStart)
    .single()

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
