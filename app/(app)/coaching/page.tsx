import { createClient } from '@/lib/supabase/server'
import CoachingPageClient from './CoachingPageClient'

export default async function CoachingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [profileRes, pulsesRes, scoresRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('wellbeing_pulses').select('*').eq('user_id', user.id).gte('date', thirtyDaysAgo.toISOString().split('T')[0]).order('date'),
    supabase.from('daily_scores').select('*').eq('user_id', user.id).gte('date', thirtyDaysAgo.toISOString().split('T')[0]).order('date'),
  ])

  return (
    <CoachingPageClient
      userId={user.id}
      profile={profileRes.data}
      wellbeingPulses={pulsesRes.data ?? []}
      dailyScores={scoresRes.data ?? []}
    />
  )
}
