import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TodayPageClient from './TodayPageClient'

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>
}) {
  const { date: dateParam } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Server computes UTC date as best guess. Client will silently re-fetch if the
  // local timezone date differs (no redirect — avoids double page load).
  const now = new Date()
  const today = dateParam ?? [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')

  const [profileRes, dailyItemsRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('daily_items')
      .select('*, categories(*)')
      .eq('user_id', user.id)
      .eq('scheduled_date', today)
      .order('created_at'),
  ])

  return (
    <TodayPageClient
      userId={user.id}
      profile={profileRes.data}
      initialItems={dailyItemsRes.data ?? []}
      date={today}
    />
  )
}
