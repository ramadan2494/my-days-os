import { createClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/utils'
import PrayerPageClient from './PrayerPageClient'

export default async function PrayerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = todayISO()

  // Get last 30 days for heatmap
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const fromDate = thirtyDaysAgo.toISOString().split('T')[0]

  const [profileRes, todayPrayersRes, historyRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('prayers').select('*').eq('user_id', user.id).eq('date', today).order('scheduled_time'),
    supabase.from('prayers').select('*').eq('user_id', user.id).gte('date', fromDate).order('date'),
  ])

  return (
    <PrayerPageClient
      userId={user.id}
      profile={profileRes.data}
      todayPrayers={todayPrayersRes.data ?? []}
      history={historyRes.data ?? []}
      today={today}
    />
  )
}
