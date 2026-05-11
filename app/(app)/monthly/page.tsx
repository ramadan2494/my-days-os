import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import MonthlyPageClient from './MonthlyPageClient'

export default async function MonthlyPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]
  const currentMonth = today.slice(0, 7)

  // Fetch first & last day of current month for task range
  const [year, month] = currentMonth.split('-').map(Number)
  const firstDay = `${currentMonth}-01`
  const lastDay = new Date(year, month, 0).toISOString().split('T')[0]

  const [plansRes, tasksRes, profileRes] = await Promise.all([
    supabase
      .from('monthly_plans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .gte('scheduled_date', firstDay)
      .lte('scheduled_date', lastDay)
      .order('scheduled_date'),
    supabase.from('profiles').select('*').eq('id', user.id).single(),
  ])

  return (
    <MonthlyPageClient
      userId={user.id}
      initialMonth={currentMonth}
      initialPlans={plansRes.data ?? []}
      initialTasks={tasksRes.data ?? []}
      profile={profileRes.data}
    />
  )
}
