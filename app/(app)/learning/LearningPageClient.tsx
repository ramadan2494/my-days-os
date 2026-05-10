'use client'

import { useState } from 'react'
import { LearningGoal, LearningSession, LearningDomain, LearningPlanMode, LearningGoalStatus } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { cn, todayISO } from '@/lib/utils'
import { Plus, X, Sparkles, BookOpen, CheckCircle2, Clock, Play, Pause, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'

interface LearningPageClientProps {
  userId: string
  initialGoals: LearningGoal[]
  initialSessions: LearningSession[]
}

const DOMAINS: LearningDomain[] = ['PhD Research', 'Programming/Tech', 'Soft Skills', 'Productivity']
const DOMAIN_COLORS: Record<LearningDomain, string> = {
  'PhD Research': 'text-blue-400 bg-blue-500/10',
  'Programming/Tech': 'text-purple-400 bg-purple-500/10',
  'Soft Skills': 'text-green-400 bg-green-500/10',
  'Productivity': 'text-yellow-400 bg-yellow-500/10',
}

export default function LearningPageClient({ userId, initialGoals, initialSessions }: LearningPageClientProps) {
  const [goals, setGoals] = useState(initialGoals)
  const [sessions, setSessions] = useState(initialSessions)
  const [showAddGoal, setShowAddGoal] = useState(false)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null)

  const [form, setForm] = useState({
    title: '', domain: 'Programming/Tech' as LearningDomain,
    target_date: '', estimated_hours: 20,
    plan_mode: 'manual' as LearningPlanMode,
    topics: '',
  })

  const supabase = createClient()

  async function generateAIPlan(goalId: string, topics: string[], targetDate: string, title: string) {
    setGeneratingPlan(true)
    try {
      const res = await fetch('/api/claude/learning-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topics, targetDate, title, goalId }),
      })
      if (!res.ok) throw new Error('API failed')
      const { plan } = await res.json()

      // Store plan in goal
      const { data } = await supabase.from('learning_goals')
        .update({ ai_plan: plan }).eq('id', goalId).select().single()
      if (data) setGoals(prev => prev.map(g => g.id === goalId ? data : g))

      // Create sessions from plan
      const newSessions = await Promise.all(
        plan.sessions.map(async (s: any, i: number) => {
          const date = new Date(targetDate)
          date.setDate(date.getDate() - (plan.sessions.length - i) * 2)
          const { data: session } = await supabase.from('learning_sessions').insert({
            user_id: userId, goal_id: goalId,
            title: s.title, duration_minutes: s.duration_minutes,
            scheduled_date: date.toISOString().split('T')[0],
            resources: s.resources,
          }).select().single()
          return session
        })
      )
      setSessions(prev => [...prev, ...newSessions.filter(Boolean)])
      toast.success('AI learning plan generated! 🎓')
    } catch {
      toast.error('Failed to generate plan. Check your Claude API key.')
    }
    setGeneratingPlan(false)
  }

  async function addGoal(e: React.FormEvent) {
    e.preventDefault()
    const topicsArray = form.topics.split(',').map(t => t.trim()).filter(Boolean)

    const { data, error } = await supabase.from('learning_goals').insert({
      user_id: userId,
      title: form.title,
      domain: form.domain,
      target_date: form.target_date || null,
      estimated_hours: form.estimated_hours,
      plan_mode: form.plan_mode,
      topics: topicsArray,
    }).select().single()

    if (error) { toast.error('Failed to create goal'); return }
    setGoals(prev => [data, ...prev])
    setShowAddGoal(false)
    setForm({ title: '', domain: 'Programming/Tech', target_date: '', estimated_hours: 20, plan_mode: 'manual', topics: '' })
    toast.success('Learning goal created!')

    if ((form.plan_mode === 'ai' || form.plan_mode === 'hybrid') && topicsArray.length > 0) {
      await generateAIPlan(data.id, topicsArray, form.target_date || '', form.title)
    }
  }

  async function markSession(session: LearningSession, status: 'done' | 'skipped') {
    const xp = status === 'done' ? Math.round((session.duration_minutes / 60) * 30) : 0
    const { data } = await supabase.from('learning_sessions').update({
      status, xp_earned: xp, completed_at: status === 'done' ? new Date().toISOString() : null,
    }).eq('id', session.id).select().single()

    if (data) {
      setSessions(prev => prev.map(s => s.id === session.id ? data : s))
      if (status === 'done') {
        await supabase.rpc('increment_xp', { user_id: userId, amount: xp }).then(() => null, () => null)
        toast.success(`Session complete! +${xp} XP`)
      }
    }
  }

  async function updateGoalStatus(goalId: string, status: LearningGoalStatus) {
    const { data } = await supabase.from('learning_goals').update({ status }).eq('id', goalId).select().single()
    if (data) setGoals(prev => prev.map(g => g.id === goalId ? data : g))
  }

  const totalHoursThisWeek = sessions
    .filter(s => s.status === 'done' && s.completed_at && isThisWeek(s.completed_at))
    .reduce((sum, s) => sum + s.duration_minutes / 60, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Learning Hub</h1>
          <p className="text-slate-400 text-sm mt-0.5">Goals, AI plans, and session tracking</p>
        </div>
        <button
          onClick={() => setShowAddGoal(true)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} /> New Goal
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Active Goals', value: goals.filter(g => g.status === 'active').length, color: 'text-purple-400' },
          { label: 'Hours This Week', value: `${totalHoursThisWeek.toFixed(1)}h`, color: 'text-blue-400' },
          { label: 'Sessions Done', value: sessions.filter(s => s.status === 'done').length, color: 'text-green-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Goals */}
      {goals.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center">
          <BookOpen className="mx-auto text-slate-600 mb-3" size={32} />
          <p className="text-slate-400 mb-1">No learning goals yet.</p>
          <p className="text-slate-500 text-sm">Create your first goal — manually or with AI planning.</p>
          <button onClick={() => setShowAddGoal(true)} className="mt-4 text-purple-400 hover:text-purple-300 text-sm underline">
            Create a goal →
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map(goal => {
            const goalSessions = sessions.filter(s => s.goal_id === goal.id)
            const doneSessions = goalSessions.filter(s => s.status === 'done')
            const progress = goalSessions.length > 0 ? (doneSessions.length / goalSessions.length) * 100 : 0
            const isExpanded = expandedGoal === goal.id

            return (
              <div key={goal.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div
                  className="flex items-start gap-4 p-5 cursor-pointer"
                  onClick={() => setExpandedGoal(isExpanded ? null : goal.id)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-white">{goal.title}</h3>
                      <span className={cn('text-[11px] px-2 py-0.5 rounded-full', DOMAIN_COLORS[goal.domain])}>
                        {goal.domain}
                      </span>
                      {goal.plan_mode !== 'manual' && (
                        <span className="text-[11px] text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Sparkles size={10} /> AI Plan
                        </span>
                      )}
                      <span className={cn('text-[11px] px-2 py-0.5 rounded-full',
                        goal.status === 'active' ? 'text-green-400 bg-green-500/10' :
                        goal.status === 'paused' ? 'text-yellow-400 bg-yellow-500/10' :
                        'text-slate-400 bg-slate-500/10')}>
                        {goal.status}
                      </span>
                    </div>
                    {goal.target_date && (
                      <p className="text-xs text-slate-500 mt-1">Due: {new Date(goal.target_date + 'T12:00').toLocaleDateString()}</p>
                    )}
                    {/* Progress bar */}
                    <div className="mt-3 flex items-center gap-3">
                      <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-xs text-slate-500">{doneSessions.length}/{goalSessions.length}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {goal.status === 'active' ? (
                      <button onClick={e => { e.stopPropagation(); updateGoalStatus(goal.id, 'paused') }}
                        className="text-xs text-yellow-400 hover:text-yellow-300 p-1.5 rounded-lg hover:bg-yellow-500/10">
                        <Pause size={14} />
                      </button>
                    ) : goal.status === 'paused' ? (
                      <button onClick={e => { e.stopPropagation(); updateGoalStatus(goal.id, 'active') }}
                        className="text-xs text-green-400 hover:text-green-300 p-1.5 rounded-lg hover:bg-green-500/10">
                        <Play size={14} />
                      </button>
                    ) : null}
                    {isExpanded ? <ChevronDown size={16} className="text-slate-500" /> : <ChevronRight size={16} className="text-slate-500" />}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-slate-800 p-5 space-y-2">
                    <h4 className="text-sm font-medium text-slate-400 mb-3">Sessions</h4>
                    {goalSessions.length === 0 ? (
                      <p className="text-slate-500 text-sm">No sessions yet.</p>
                    ) : (
                      goalSessions.map(s => (
                        <div key={s.id} className={cn(
                          'flex items-center gap-3 p-3 rounded-xl border',
                          s.status === 'done' ? 'border-green-500/20 bg-green-500/5' :
                          s.status === 'skipped' ? 'border-slate-800 bg-slate-800/30 opacity-60' :
                          'border-slate-700 bg-slate-800'
                        )}>
                          <div className="flex-1">
                            <p className={cn('text-sm font-medium', s.status === 'done' ? 'line-through text-slate-400' : 'text-white')}>
                              {s.title}
                            </p>
                            <p className="text-xs text-slate-500">{s.duration_minutes} min
                              {s.scheduled_date && ` · ${new Date(s.scheduled_date + 'T12:00').toLocaleDateString()}`}
                            </p>
                          </div>
                          {s.status === 'pending' && (
                            <div className="flex gap-1.5">
                              <button onClick={() => markSession(s, 'done')}
                                className="text-xs text-green-400 bg-green-500/10 hover:bg-green-500/20 px-2 py-1 rounded-lg transition-colors">
                                Done
                              </button>
                              <button onClick={() => markSession(s, 'skipped')}
                                className="text-xs text-slate-400 bg-slate-800 hover:bg-slate-700 px-2 py-1 rounded-lg transition-colors">
                                Skip
                              </button>
                            </div>
                          )}
                          {s.status === 'done' && <CheckCircle2 size={16} className="text-green-400" />}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Add Goal Modal */}
      {showAddGoal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">New Learning Goal</h2>
              <button onClick={() => setShowAddGoal(false)} className="text-slate-500 hover:text-white"><X size={18} /></button>
            </div>
            <form onSubmit={addGoal} className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Goal Title *</label>
                <input required placeholder="e.g. Learn Rust basics" value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Domain</label>
                <select value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value as LearningDomain }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
                  {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Target date</label>
                  <input type="date" value={form.target_date} onChange={e => setForm(f => ({ ...f, target_date: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Est. hours</label>
                  <input type="number" value={form.estimated_hours} min="1"
                    onChange={e => setForm(f => ({ ...f, estimated_hours: Number(e.target.value) }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-purple-500" />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-2 block">Planning Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['manual', 'ai', 'hybrid'] as LearningPlanMode[]).map(mode => (
                    <button key={mode} type="button" onClick={() => setForm(f => ({ ...f, plan_mode: mode }))}
                      className={cn('py-2 rounded-xl text-xs font-medium border transition-all capitalize',
                        form.plan_mode === mode
                          ? 'bg-purple-600 border-purple-500 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600')}>
                      {mode === 'ai' ? '✨ AI' : mode === 'hybrid' ? '🤝 Hybrid' : '✏️ Manual'}
                    </button>
                  ))}
                </div>
              </div>
              {(form.plan_mode === 'ai' || form.plan_mode === 'hybrid') && (
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Topics (comma-separated)</label>
                  <textarea value={form.topics} onChange={e => setForm(f => ({ ...f, topics: e.target.value }))}
                    placeholder="e.g. Ownership, Borrowing, Lifetimes, Traits, Async Rust"
                    rows={3}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none" />
                  <p className="text-xs text-slate-500 mt-1">Claude will generate a structured plan with sessions and resources</p>
                </div>
              )}
              <button type="submit" disabled={generatingPlan}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-colors flex items-center justify-center gap-2">
                {generatingPlan ? (
                  <><span className="animate-spin">✨</span> Generating AI Plan...</>
                ) : (
                  form.plan_mode === 'manual' ? 'Create Goal' : '✨ Create with AI Plan'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function isThisWeek(dateStr: string): boolean {
  const date = new Date(dateStr)
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  return date >= weekStart
}
