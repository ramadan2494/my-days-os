import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { todayISO, getLevelTitle, formatTime } from '@/lib/utils'
import PrayerStrip from '@/components/today/PrayerStrip'
import DailyScoreCard from '@/components/today/DailyScoreCard'
import TodayTasks from '@/components/today/TodayTasks'
import DailyTimeline from '@/components/today/DailyTimeline'
import MorningCheckin from '@/components/today/MorningCheckin'
import AIDayPlanner from '@/components/today/AIDayPlanner'
import { Zap, Flame } from 'lucide-react'

export default async function TodayPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = todayISO()

  const [profileRes, prayersRes, tasksRes, scoreRes, learningRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('prayers').select('*').eq('user_id', user.id).eq('date', today).order('scheduled_time'),
    supabase.from('tasks').select('*').eq('user_id', user.id).eq('scheduled_date', today).neq('status', 'done').order('priority'),
    supabase.from('daily_scores').select('*').eq('user_id', user.id).eq('date', today).single(),
    supabase.from('learning_sessions').select('*, learning_goals(title)').eq('user_id', user.id).eq('scheduled_date', today).eq('status', 'pending'),
  ])

  const profile = profileRes.data
  const prayers = prayersRes.data ?? []
  const tasks = tasksRes.data ?? []
  const score = scoreRes.data
  const learningSessions = learningRes.data ?? []

  const greeting = getGreeting()
  const levelTitle = getLevelTitle(profile?.level ?? 1)
  const hasMorningCheckin = !!score?.mood

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">{greeting}, {profile?.full_name?.split(' ')[0] ?? 'Scholar'} 👋</h1>
          <p className="text-slate-400 text-sm mt-0.5">{formatDate(today)}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
            <Zap size={14} className="text-yellow-400" />
            <span className="text-sm font-medium text-yellow-400">{profile?.xp ?? 0}</span>
            <span className="text-xs text-slate-500">XP</span>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2">
            <Flame size={14} className="text-orange-400" />
            <span className="text-sm font-medium text-orange-400">{profile?.daily_streak ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Morning check-in if not done */}
      {!hasMorningCheckin && <MorningCheckin userId={user.id} date={today} />}

      {/* AI Day Planner */}
      <AIDayPlanner />

      {/* Prayer Strip */}
      <PrayerStrip prayers={prayers} userId={user.id} date={today} profile={profile} />

      {/* Daily Score */}
      <DailyScoreCard score={score} profile={profile} />

      {/* Two column on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Tasks */}
        <TodayTasks tasks={tasks} userId={user.id} />

        {/* Today's Learning */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white flex items-center gap-2">
              <span className="text-purple-400">📚</span> Today&apos;s Learning
            </h2>
            <span className="text-xs text-slate-500">{learningSessions.length} session{learningSessions.length !== 1 ? 's' : ''}</span>
          </div>
          {learningSessions.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-slate-400 text-sm">No sessions scheduled today.</p>
              <a href="/learning" className="text-purple-400 text-sm hover:underline mt-1 inline-block">Add learning sessions →</a>
            </div>
          ) : (
            <div className="space-y-2">
              {learningSessions.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 p-3 bg-slate-800 rounded-xl">
                  <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{s.title}</p>
                    <p className="text-xs text-slate-500">{s.duration_minutes} min · {(s.learning_goals as any)?.title}</p>
                  </div>
                  <a href="/learning" className="text-xs text-purple-400 hover:text-purple-300">Start</a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Timeline */}
      <DailyTimeline prayers={prayers} tasks={tasks} learningSessions={learningSessions} profile={profile} />
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 5) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  if (hour < 21) return 'Good evening'
  return 'Good night'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}
