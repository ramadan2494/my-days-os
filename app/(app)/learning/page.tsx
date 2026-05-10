import { createClient } from '@/lib/supabase/server'
import LearningPageClient from './LearningPageClient'
import MonthlyGoalPlanner from '@/components/learning/MonthlyGoalPlanner'

export default async function LearningPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [goalsRes, sessionsRes] = await Promise.all([
    supabase.from('learning_goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('learning_sessions').select('*').eq('user_id', user.id).order('scheduled_date'),
  ])

  return (
    <div className="space-y-6">
      <MonthlyGoalPlanner />
      <LearningPageClient
        userId={user.id}
        initialGoals={goalsRes.data ?? []}
        initialSessions={sessionsRes.data ?? []}
      />
    </div>
  )
}
