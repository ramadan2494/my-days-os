import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import JourneyPageClient from './JourneyPageClient'

export default async function JourneyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileRes, badgesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('badges').select('*').eq('user_id', user.id).order('earned_at'),
  ])

  return (
    <JourneyPageClient
      profile={profileRes.data}
      badges={badgesRes.data ?? []}
    />
  )
}
