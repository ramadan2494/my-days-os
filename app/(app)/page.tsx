import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { todayISO, getLevelTitle, formatTime } from '@/lib/utils'
import PrayerStrip from '@/components/today/PrayerStrip'
import DailyScoreCard from '@/components/today/DailyScoreCard'
import DailyTimeline from '@/components/today/DailyTimeline'
import MorningCheckin from '@/components/today/MorningCheckin'
import AIDayPlanner from '@/components/today/AIDayPlanner'
import DailyQuests from '@/components/today/DailyQuests'
import DailyBoss from '@/components/today/DailyBoss'
import XPProgressBar from '@/components/today/XPProgressBar'
import DailyRewardChest from '@/components/today/DailyRewardChest'
import StreakBanner from '@/components/today/StreakBanner'

export default async function TodayPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = todayISO()

  const [profileRes, prayersRes, tasksRes, scoreRes, learningRes, pomodoroRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('prayers').select('*').eq('user_id', user.id).eq('date', today).order('scheduled_time'),
    supabase.from('tasks').select('*').eq('user_id', user.id).eq('scheduled_date', today).order('priority'),
    supabase.from('daily_scores').select('*').eq('user_id', user.id).eq('date', today).single(),
    supabase.from('learning_sessions').select('*, learning_goals(title)').eq('user_id', user.id).eq('scheduled_date', today),
    supabase.from('pomodoro_sessions').select('id').eq('user_id', user.id).eq('completed', true)
      .gte('started_at', today + 'T00:00:00').lte('started_at', today + 'T23:59:59'),
  ])

  const profile = profileRes.data
  const prayers = prayersRes.data ?? []
  const tasks = tasksRes.data ?? []
  const score = scoreRes.data
  const learningSessions = learningRes.data ?? []
  const pomodorosDone = pomodoroRes.data?.length ?? 0

  const greeting = getGreeting()
  const hasMorningCheckin = !!score?.mood
  const pendingTasks = tasks.filter(t => t.status !== 'done')
  const learningDone = learningSessions.some((s: any) => s.status === 'done')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{greeting}, {profile?.full_name?.split(' ')[0] ?? 'Scholar'} 👋</h1>
        <p className="text-slate-400 text-sm mt-0.5">{formatDate(today)}</p>
      </div>

      {/* XP Progress Bar */}
      <XPProgressBar xp={profile?.xp ?? 0} level={profile?.level ?? 1} />

      {/* Streak Banner */}
      <StreakBanner streak={profile?.daily_streak ?? 0} />

      {/* Morning check-in if not done */}
      {!hasMorningCheckin && <MorningCheckin userId={user.id} date={today} />}

      {/* Daily Reward Chest */}
      <DailyRewardChest
        prayers={prayers}
        tasks={tasks}
        learningDone={learningDone}
        userId={user.id}
        date={today}
      />

      {/* AI Day Planner */}
      <AIDayPlanner />

      {/* Prayer Strip */}
      <PrayerStrip prayers={prayers} userId={user.id} date={today} profile={profile} />

      {/* Daily Score */}
      <DailyScoreCard score={score} profile={profile} />

      {/* Boss Challenge (only shows if there's a high-priority deep work task) */}
      {pendingTasks.some(t => t.is_deep_work && t.priority === 'high') && (
        <DailyBoss tasks={pendingTasks} pomodorosDone={pomodorosDone} />
      )}

      {/* Daily Quests */}
      <DailyQuests tasks={tasks} userId={user.id} date={today} />

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
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${s.status === 'done' ? 'bg-green-400' : 'bg-purple-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white truncate">{s.title}</p>
                  <p className="text-xs text-slate-500">{s.duration_minutes} min · {(s.learning_goals as any)?.title}</p>
                </div>
                <a href="/learning" className={`text-xs ${s.status === 'done' ? 'text-green-400' : 'text-purple-400 hover:text-purple-300'}`}>
                  {s.status === 'done' ? '✓ Done' : 'Start'}
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Timeline */}
      <DailyTimeline prayers={prayers} tasks={pendingTasks} learningSessions={learningSessions} profile={profile} />
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
