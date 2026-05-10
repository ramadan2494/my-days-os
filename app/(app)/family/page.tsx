import { createClient } from '@/lib/supabase/server'
import FamilyPageClient from './FamilyPageClient'

export default async function FamilyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)

  const [eventsRes, recentRes] = await Promise.all([
    supabase.from('family_events').select('*').eq('user_id', user.id).order('event_date'),
    supabase.from('family_events').select('*').eq('user_id', user.id).gte('event_date', weekAgo.toISOString().split('T')[0]).order('event_date'),
  ])

  return (
    <FamilyPageClient
      userId={user.id}
      initialEvents={eventsRes.data ?? []}
      recentEvents={recentRes.data ?? []}
    />
  )
}
