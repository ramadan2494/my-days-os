import { createClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/utils'
import WorkPageClient from './WorkPageClient'

export default async function WorkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const today = todayISO()
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)

  const [profileRes, tasksRes, pomodorosRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('pomodoro_sessions').select('*').eq('user_id', user.id).gte('started_at', weekAgo.toISOString()),
  ])

  return (
    <WorkPageClient
      userId={user.id}
      profile={profileRes.data}
      initialTasks={tasksRes.data ?? []}
      pomodoros={pomodorosRes.data ?? []}
      today={today}
    />
  )
}
