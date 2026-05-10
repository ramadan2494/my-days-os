'use client'

import { useState } from 'react'
import { Profile, WellbeingPulse, DailyScore } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { todayISO } from '@/lib/utils'
import { Sparkles, Brain, Moon, Lightbulb, Activity, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface CoachingPageClientProps {
  userId: string
  profile: Profile | null
  wellbeingPulses: WellbeingPulse[]
  dailyScores: DailyScore[]
}

const WELLBEING_QUESTIONS = [
  { key: 'mood', label: 'How is your overall mood?', emoji: '😊' },
  { key: 'energy', label: 'Energy level?', emoji: '⚡' },
  { key: 'clarity', label: 'Mental clarity & focus?', emoji: '🧠' },
  { key: 'stress', label: 'Stress level? (lower = better)', emoji: '😤' },
  { key: 'connection', label: 'Family connection today?', emoji: '👨‍👩‍👧‍👦' },
] as const

export default function CoachingPageClient({ userId, profile, wellbeingPulses, dailyScores }: CoachingPageClientProps) {
  const [coachingMessage, setCoachingMessage] = useState('')
  const [coachingLoading, setCoachingLoading] = useState(false)
  const [coachingType, setCoachingType] = useState<string | null>(null)
  const [phdConcern, setPhDConcern] = useState('')
  const [showPulse, setShowPulse] = useState(false)
  const [pulseAnswers, setPulseAnswers] = useState({ mood: 3, energy: 3, clarity: 3, stress: 3, connection: 3 })

  const supabase = createClient()
  const today = todayISO()
  const todayPulse = wellbeingPulses.find(p => p.date === today)
  const latestScore = dailyScores[dailyScores.length - 1]

  // Detect low streaks
  const recentScores = dailyScores.slice(-7)
  const lowDays = recentScores.filter(s => (s.total_score ?? 0) < 40).length

  async function getCoaching(type: string, extra: Record<string, unknown> = {}) {
    setCoachingLoading(true)
    setCoachingType(type)
    setCoachingMessage('')
    try {
      const res = await fetch('/api/claude/coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          context: {
            name: profile?.full_name?.split(' ')[0] ?? 'Friend',
            mood: latestScore?.mood_score ?? 3,
            score: latestScore?.total_score ?? 0,
            prayersCompleted: latestScore?.prayer_score ? Math.round(latestScore.prayer_score / 6) : 0,
            lowDays,
            ...extra,
          },
        }),
      })
      const data = await res.json()
      setCoachingMessage(data.message ?? data.error ?? 'Something went wrong')
    } catch {
      setCoachingMessage('Failed to get coaching. Check your API key in Settings.')
    }
    setCoachingLoading(false)
  }

  async function savePulse() {
    const avg = (Object.values(pulseAnswers).reduce((a, b) => a + b, 0) / 5).toFixed(1)
    await supabase.from('wellbeing_pulses').upsert({
      user_id: userId, date: today, ...pulseAnswers, wellbeing_score: Number(avg),
    }, { onConflict: 'user_id,date' })
    setShowPulse(false)
    toast.success('Wellbeing pulse logged! ✨')
    window.location.reload()
  }

  const chartData = dailyScores.slice(-14).map(s => ({
    date: s.date?.slice(5),
    score: s.total_score ?? 0,
  }))

  const pulseChartData = wellbeingPulses.slice(-14).map(p => ({
    date: p.date?.slice(5),
    mood: p.mood ?? 0,
    energy: p.energy ?? 0,
    clarity: p.clarity ?? 0,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">AI Coaching</h1>
        <p className="text-slate-400 text-sm mt-0.5">Your personal life coach, powered by Claude</p>
      </div>

      {/* Burnout warning */}
      {lowDays >= 3 && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex items-start gap-3">
          <span className="text-2xl">⚠️</span>
          <div className="flex-1">
            <p className="text-red-400 font-medium text-sm">Low-score streak detected ({lowDays} days)</p>
            <p className="text-slate-400 text-xs mt-0.5">You might be heading toward burnout. Get a recovery message.</p>
          </div>
          <button onClick={() => getCoaching('burnout_warning', { lowDays })}
            className="text-xs text-red-400 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-colors">
            Help me
          </button>
        </div>
      )}

      {/* Coach cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { type: 'morning_coaching', icon: Sparkles, title: 'Morning Coaching', desc: 'Get your daily focus message', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { type: 'evening_reflection', icon: Moon, title: 'Evening Reflection', desc: 'Process today & prepare for tomorrow', color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
          { type: 'cbt_tip', icon: Brain, title: 'CBT Tip', desc: 'Reframe a challenge you\'re facing', color: 'text-blue-400', bg: 'bg-blue-500/10', extra: { task: 'feeling overwhelmed' } },
          { type: 'phd_coaching', icon: Lightbulb, title: 'PhD Coach', desc: 'Imposter syndrome, slow days & more', color: 'text-purple-400', bg: 'bg-purple-500/10', showInput: true },
        ].map(({ type, icon: Icon, title, desc, color, bg, extra, showInput }) => (
          <div key={type} className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                <Icon size={18} className={color} />
              </div>
              <div>
                <h3 className="font-semibold text-white text-sm">{title}</h3>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
            </div>
            {showInput && type === 'phd_coaching' && (
              <input
                value={phdConcern} onChange={e => setPhDConcern(e.target.value)}
                placeholder="What's on your mind? e.g. 'My thesis feels stuck'"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 mb-3"
              />
            )}
            <button
              onClick={() => getCoaching(type, type === 'phd_coaching' ? { concern: phdConcern || 'my PhD progress feels slow' } : extra ?? {})}
              className="flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              Ask Claude <ChevronRight size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Coaching response */}
      {(coachingLoading || coachingMessage) && (
        <div className="bg-slate-900 border border-purple-500/30 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles size={14} className="text-purple-400" />
            <span className="text-sm font-medium text-purple-400">Claude says...</span>
          </div>
          {coachingLoading ? (
            <div className="flex items-center gap-3 text-slate-400">
              <span className="animate-spin text-lg">✨</span>
              <span className="text-sm">Thinking...</span>
            </div>
          ) : (
            <p className="text-slate-200 text-sm leading-relaxed">{coachingMessage}</p>
          )}
        </div>
      )}

      {/* Wellbeing Pulse */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-semibold text-white flex items-center gap-2">
              <Activity size={16} className="text-green-400" /> Wellbeing Pulse
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">5-question daily check-in</p>
          </div>
          {!todayPulse && (
            <button onClick={() => setShowPulse(true)}
              className="text-xs text-green-400 bg-green-500/10 hover:bg-green-500/20 px-3 py-1.5 rounded-lg transition-colors">
              Log Today&apos;s Pulse
            </button>
          )}
          {todayPulse && (
            <span className="text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-lg">
              ✓ Score: {todayPulse.wellbeing_score?.toFixed(1)}/5
            </span>
          )}
        </div>

        {pulseChartData.length > 1 && (
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={pulseChartData}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis domain={[1, 5]} tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: 11 }} />
              <Line type="monotone" dataKey="mood" stroke="#facc15" strokeWidth={2} dot={false} name="Mood" />
              <Line type="monotone" dataKey="energy" stroke="#34d399" strokeWidth={2} dot={false} name="Energy" />
              <Line type="monotone" dataKey="clarity" stroke="#818cf8" strokeWidth={2} dot={false} name="Clarity" />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Daily score chart */}
      {chartData.length > 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="font-semibold text-white mb-4">Daily Score (14 days)</h2>
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={chartData}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: 11 }} />
              <Line type="monotone" dataKey="score" stroke="#818cf8" strokeWidth={2} dot={false} name="Score" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Wellbeing Pulse Modal */}
      {showPulse && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <h2 className="font-semibold text-white mb-5">Today&apos;s Wellbeing Pulse</h2>
            <div className="space-y-5">
              {WELLBEING_QUESTIONS.map(({ key, label, emoji }) => (
                <div key={key}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-slate-300">{emoji} {label}</label>
                    <span className="text-sm font-bold text-white">{pulseAnswers[key]}/5</span>
                  </div>
                  <input type="range" min="1" max="5" step="1"
                    value={pulseAnswers[key]}
                    onChange={e => setPulseAnswers(a => ({ ...a, [key]: Number(e.target.value) }))}
                    className="w-full accent-green-500" />
                  <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
                    <span>1 (low)</span><span>3</span><span>5 (high)</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowPulse(false)}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl text-sm transition-colors">
                Cancel
              </button>
              <button onClick={savePulse}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 rounded-xl text-sm transition-colors">
                Save Pulse ✓
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
