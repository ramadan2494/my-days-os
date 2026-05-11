'use client'

import { useState } from 'react'
import { Task } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { getTaskXP } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { CheckCircle2, Circle, Sword, Zap, Shield, Star, Loader2, Wand2 } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

const CATEGORY_COLORS: Record<string, string> = {
  Work: 'text-blue-400 bg-blue-500/10',
  TA: 'text-cyan-400 bg-cyan-500/10',
  PhD: 'text-purple-400 bg-purple-500/10',
  Admin: 'text-slate-400 bg-slate-500/10',
  Personal: 'text-green-400 bg-green-500/10',
}

interface DailyQuestsProps {
  tasks: Task[]
  userId: string
  date: string
}

type QuestTier = 'main' | 'side' | 'bonus'

function classifyTask(task: Task): QuestTier {
  if (task.priority === 'high' || task.is_deep_work) return 'main'
  if (task.priority === 'medium') return 'side'
  return 'bonus'
}

const TIER_CONFIG = {
  main: {
    label: 'Main Quest',
    icon: Sword,
    color: 'text-red-400',
    border: 'border-red-500/20',
    bg: 'bg-red-500/5',
    xpMultiplier: 1.2,
  },
  side: {
    label: 'Side Quests',
    icon: Shield,
    color: 'text-blue-400',
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/5',
    xpMultiplier: 1.0,
  },
  bonus: {
    label: 'Bonus',
    icon: Star,
    color: 'text-yellow-400',
    border: 'border-yellow-500/20',
    bg: 'bg-yellow-500/5',
    xpMultiplier: 0.8,
  },
}

export default function DailyQuests({ tasks: initialTasks, userId, date }: DailyQuestsProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [xpPop, setXpPop] = useState<{ id: string; xp: number } | null>(null)
  const [generating, setGenerating] = useState(false)
  const supabase = createClient()

  const tiered: Record<QuestTier, Task[]> = { main: [], side: [], bonus: [] }
  for (const t of tasks) tiered[classifyTask(t)].push(t)

  const total = tasks.length
  const done = tasks.filter(t => t.status === 'done').length
  const allDone = total > 0 && done === total

  async function toggleTask(task: Task) {
    const newStatus = task.status === 'done' ? 'todo' : 'done'
    const xp = newStatus === 'done' ? getTaskXP(task.is_deep_work, task.priority) : 0

    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: newStatus,
        completed_at: newStatus === 'done' ? new Date().toISOString() : null,
        xp_earned: xp,
      })
      .eq('id', task.id)
      .select()
      .single()

    if (error) { toast.error('Failed to update task'); return }

    if (newStatus === 'done' && xp > 0) {
      await supabase.rpc('increment_xp', { user_id: userId, amount: xp })
      setXpPop({ id: task.id, xp })
      setTimeout(() => setXpPop(null), 1800)
    }

    setTasks(prev => prev.map(t => t.id === task.id ? (data as Task) : t))
  }

  async function generateDay() {
    setGenerating(true)
    try {
      const res = await fetch('/api/claude/generate-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const newTasks: Task[] = data.tasks ?? []
      setTasks(prev => [...prev, ...newTasks])
      toast.success(`${newTasks.length} quests generated!`)
    } catch {
      toast.error('Failed to generate tasks')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold text-white flex items-center gap-2">
            <span className="text-lg">⚔️</span> Daily Quests
          </h2>
          {total > 0 && (
            <p className="text-xs text-slate-500 mt-0.5">{done}/{total} quests complete</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <div className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300">
              {Math.round((done / total) * 100)}%
            </div>
          )}
          {tasks.length < 2 && (
            <button
              onClick={generateDay}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium transition-colors"
            >
              {generating ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}
              Generate
            </button>
          )}
        </div>
      </div>

      {/* Overall progress bar */}
      {total > 0 && (
        <div className="mb-4 h-2 bg-slate-800 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              allDone ? 'bg-green-400' : 'bg-gradient-to-r from-blue-500 to-purple-500'
            )}
            style={{ width: `${(done / total) * 100}%` }}
          />
        </div>
      )}

      {/* All done banner */}
      {allDone && (
        <div className="mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
          <p className="text-green-400 font-semibold text-sm">🎉 All quests complete! Day conquered!</p>
        </div>
      )}

      {total === 0 ? (
        <div className="text-center py-8 space-y-3">
          <p className="text-slate-400 text-sm">No quests today. Ready to begin?</p>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={generateDay}
              disabled={generating}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium transition-colors"
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              {generating ? 'Generating…' : 'Generate My Day with AI'}
            </button>
            <Link href="/work" className="px-4 py-2 rounded-xl border border-slate-700 text-slate-400 hover:text-white text-sm transition-colors">
              Add manually
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {(['main', 'side', 'bonus'] as QuestTier[]).map(tier => {
            const tierTasks = tiered[tier]
            if (tierTasks.length === 0) return null
            const { label, icon: TierIcon, color, border, bg } = TIER_CONFIG[tier]
            return (
              <div key={tier}>
                <div className={cn('flex items-center gap-2 mb-2')}>
                  <TierIcon size={13} className={color} />
                  <span className={cn('text-xs font-semibold uppercase tracking-wide', color)}>{label}</span>
                </div>
                <div className="space-y-2">
                  {tierTasks.map(task => {
                    const xp = getTaskXP(task.is_deep_work, task.priority)
                    const isPopping = xpPop?.id === task.id
                    return (
                      <div key={task.id} className="relative">
                        {/* XP pop animation */}
                        {isPopping && (
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 flex items-center gap-1 text-yellow-400 font-bold text-sm animate-bounce z-10 pointer-events-none">
                            <Zap size={14} />+{xpPop.xp} XP
                          </div>
                        )}
                        <button
                          onClick={() => toggleTask(task)}
                          className={cn(
                            'w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left',
                            task.status === 'done'
                              ? 'border-slate-800 bg-slate-800/20 opacity-60'
                              : `${border} ${bg} hover:border-opacity-40`
                          )}
                        >
                          {task.status === 'done'
                            ? <CheckCircle2 size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                            : <Circle size={16} className="text-slate-500 flex-shrink-0 mt-0.5" />
                          }
                          <div className="flex-1 min-w-0">
                            <p className={cn('text-sm font-medium leading-tight', task.status === 'done' ? 'line-through text-slate-500' : 'text-white')}>
                              {task.title}
                            </p>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', CATEGORY_COLORS[task.category] ?? 'text-slate-400 bg-slate-500/10')}>
                                {task.category}
                              </span>
                              {task.estimated_minutes && (
                                <span className="text-[10px] text-slate-500">{task.estimated_minutes}m</span>
                              )}
                              {task.is_deep_work && (
                                <span className="text-[10px] text-orange-400">🔥 Focus</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                            <Zap size={11} className="text-yellow-400" />
                            <span className="text-xs font-bold text-yellow-400">{xp}</span>
                          </div>
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
