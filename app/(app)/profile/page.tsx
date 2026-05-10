import { createClient } from '@/lib/supabase/server'
import ProfilePageClient from './ProfilePageClient'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [profileRes, badgesRes, scoresRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('badges').select('*').eq('user_id', user.id).order('earned_at'),
    supabase.from('daily_scores').select('*').eq('user_id', user.id).order('date').limit(30),
  ])

  return (
    <ProfilePageClient
      profile={profileRes.data}
      badges={badgesRes.data ?? []}
      dailyScores={scoresRes.data ?? []}
    />
  )
}
