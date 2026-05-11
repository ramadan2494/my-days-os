import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import StatsPageClient from './StatsPageClient'

export default async function StatsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

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
