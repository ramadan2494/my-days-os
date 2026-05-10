'use client'

import { useState } from 'react'
import { Sparkles, Clock, Loader2, Brain, Coffee, BookOpen, CheckSquare, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface ScheduleBlock {
  time: string
  duration_minutes: number
  activity: string
  type: 'deep_work' | 'learning' | 'admin' | 'break' | 'prayer' | 'review'
  description: string
}

interface DayPlan {
  motivational_message: string
  focus_of_the_day: string
  schedule: ScheduleBlock[]
  tips: string[]
}

const TYPE_CONFIG = {
  deep_work: { icon: Brain, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/20', label: 'Deep Work' },
  learning: { icon: BookOpen, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', label: 'Learning' },
  admin: { icon: CheckSquare, color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20', label: 'Admin' },
  break: { icon: Coffee, color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', label: 'Break' },
  prayer: { icon: Clock, color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', label: 'Prayer' },
  review: { icon: RefreshCw, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', label: 'Review' },
}

export default function AIDayPlanner() {
  const [loading, setLoading] = useState(false)
  const [plan, setPlan] = useState<DayPlan | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [showSchedule, setShowSchedule] = useState(false)

  async function generatePlan() {
    setLoading(true)
    try {
      const res = await fetch('/api/claude/daily-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!res.ok) {
        const err = await res.json()
        if (err.error?.includes('API key')) {
          toast.error('Add your Claude API key in .env.local to enable AI features')
        } else {
          toast.error(err.error ?? 'Failed to generate plan')
        }
        return
      }

      const data = await res.json()
      setPlan(data)
      setShowSchedule(true)
      toast.success('✨ Today\'s AI plan is ready!')
    } catch {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (!plan) {
    return (
      <div className="bg-gradient-to-br from-purple-950/40 to-pink-950/30 border border-purple-800/30 rounded-2xl p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center flex-shrink-0">
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h2 className="font-semibold text-white">AI Day Planner</h2>
              <p className="text-xs text-slate-400 mt-0.5">Claude builds your optimal schedule based on your goals & tasks</p>
            </div>
          </div>
        </div>

        <button
          onClick={generatePlan}
          disabled={loading}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-60 text-white font-semibold py-3 rounded-xl transition-all active:scale-95"
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Claude is planning your day...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Plan My Day with AI
            </>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="bg-slate-900 border border-purple-800/30 rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start justify-between p-5"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center flex-shrink-0">
            <Sparkles size={18} className="text-white" />
          </div>
          <div className="text-left">
            <h2 className="font-semibold text-white">Today&apos;s AI Plan</h2>
            <p className="text-xs text-purple-300 mt-0.5 font-medium">🎯 {plan.focus_of_the_day}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); setPlan(null) }}
            className="text-xs text-slate-500 hover:text-slate-300 px-2 py-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            Regenerate
          </button>
          {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-800 p-5 space-y-4">
          {/* Motivational message */}
          <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
            <p className="text-sm text-purple-200 italic">&ldquo;{plan.motivational_message}&rdquo;</p>
          </div>

          {/* Schedule toggle */}
          <button
            onClick={() => setShowSchedule(!showSchedule)}
            className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            <Clock size={14} />
            {showSchedule ? 'Hide' : 'Show'} full schedule ({plan.schedule.length} blocks)
            {showSchedule ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {/* Schedule blocks */}
          {showSchedule && (
            <div className="space-y-2">
              {plan.schedule.map((block, i) => {
                const config = TYPE_CONFIG[block.type] ?? TYPE_CONFIG.admin
                const Icon = config.icon
                return (
                  <div key={i} className={cn('flex items-start gap-3 p-3 rounded-xl border', config.bg)}>
                    <div className="flex-shrink-0 text-center w-12">
                      <p className="text-xs font-mono font-bold text-white">{block.time}</p>
                      <p className="text-[10px] text-slate-500">{block.duration_minutes}m</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Icon size={12} className={config.color} />
                        <span className={cn('text-[10px] font-semibold uppercase tracking-wide', config.color)}>{config.label}</span>
                      </div>
                      <p className="text-sm text-white font-medium">{block.activity}</p>
                      {block.description && (
                        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{block.description}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Tips */}
          {plan.tips?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Tips for today</p>
              {plan.tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                  <span className="text-purple-400 flex-shrink-0">•</span>
                  {tip}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
