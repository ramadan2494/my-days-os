import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatsPageClient from './StatsPageClient'
import { getWeekStart } from '@/lib/week'

export default async function StatsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
  const weekStartDay: number = profile?.week_start_day ?? 0

  const weekStart = getWeekStart(new Date(), weekStartDay)
  const weekEnd = new Date(weekStart + 'T12:00:00')
  weekEnd.setDate(weekEnd.getDate() + 6)
  const sevenDaysAgo = weekStart
  const today = weekEnd.toISOString().split('T')[0]

  const [profileRes, badgesRes, xpLogRes, dailyItemsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('badges')
      .select('*')
      .eq('user_id', user.id)
      .order('earned_at', { ascending: false }),
    supabase
      .from('xp_log')
      .select('xp_amount, earned_at')
      .eq('user_id', user.id)
      .gte('earned_at', sevenDaysAgo + 'T00:00:00')
      .order('earned_at'),
    supabase
      .from('daily_items')
      .select('*, categories(*)')
      .eq('user_id', user.id)
      .gte('scheduled_date', sevenDaysAgo)
      .lte('scheduled_date', today)
      .order('scheduled_date'),
  ])

  return (
    <StatsPageClient
      profile={profileRes.data}
      badges={badgesRes.data ?? []}
      xpLog={xpLogRes.data ?? []}
      dailyItems={dailyItemsRes.data ?? []}
      dateRange={{ start: sevenDaysAgo, end: today }}
    />
  )
}
