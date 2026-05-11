'use client'

import { useState } from 'react'
import { Task } from '@/lib/supabase/types'
import { cn, getTaskXP } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle2, Circle, X, Loader2, Wand2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'

const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-red-400',
  medium: 'bg-yellow-400',
  low: 'bg-slate-500',
}

const CATEGORY_BADGE: Record<string, string> = {
  Work: 'text-blue-400 bg-blue-500/10',
  TA: 'text-cyan-400 bg-cyan-500/10',
  PhD: 'text-purple-400 bg-purple-500/10',
  Admin: 'text-slate-400 bg-slate-500/10',
  Personal: 'text-green-400 bg-green-500/10',
}

interface DayTasksPanelProps {
  date: string
  tasks: Task[]
  userId: string
  onClose: () => void
  onTasksChange: (updatedTasks: Task[]) => void
}

function formatDisplayDate(date: string) {
  return new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })
}

export default function DayTasksPanel({ date, tasks: initialTasks, userId, onClose, onTasksChange }: DayTasksPanelProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [generating, setGenerating] = useState(false)
  const supabase = createClient()

  const done = tasks.filter(t => t.status === 'done').length
  const total = tasks.length

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
      toast.success(`+${xp} XP`)
    }

    const updated = tasks.map(t => t.id === task.id ? (data as Task) : t)
    setTasks(updated)
    onTasksChange(updated)
  }

  async function generateDay() {
    setGenerating(true)
    try {
      const res = await fetch('/api/claude/generate-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const data = await res.json()
      const newTasks: Task[] = data.tasks ?? []
      toast.success(`Generated ${newTasks.length} tasks${data.rationale ? ': ' + data.rationale.slice(0, 60) + '…' : ''}`)
      const merged = [...tasks, ...newTasks]
      setTasks(merged)
      onTasksChange(merged)
    } catch {
      toast.error('Failed to generate tasks')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-800">
        <div>
          <p className="text-xs text-slate-500">{formatDisplayDate(date)}</p>
          <p className="text-sm font-semibold text-white mt-0.5">
            {total === 0 ? 'No tasks' : `${done}/${total} done`}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div className="px-4 pt-3">
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-500"
              style={{ width: `${total > 0 ? (done / total) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {tasks.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-500 text-sm">No tasks for this day.</p>
            <p className="text-slate-600 text-xs mt-1">Generate tasks with AI below.</p>
          </div>
        ) : (
          tasks.map(task => (
            <button
              key={task.id}
              onClick={() => toggleTask(task)}
              className={cn(
                'w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left',
                task.status === 'done'
                  ? 'border-slate-800 bg-slate-800/30 opacity-60'
                  : 'border-slate-800 bg-slate-800/50 hover:border-slate-700'
              )}
            >
              {task.status === 'done'
                ? <CheckCircle2 size={16} className="text-green-400 flex-shrink-0 mt-0.5" />
                : <Circle size={16} className="text-slate-500 flex-shrink-0 mt-0.5" />
              }
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium', task.status === 'done' ? 'line-through text-slate-500' : 'text-white')}>
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{task.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', CATEGORY_BADGE[task.category] ?? 'text-slate-400 bg-slate-500/10')}>
                    {task.category}
                  </span>
                  <span className="flex items-center gap-1 text-[10px] text-slate-500">
                    <span className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_DOT[task.priority])} />
                    {task.priority}
                  </span>
                  {task.estimated_minutes && (
                    <span className="text-[10px] text-slate-500">{task.estimated_minutes}m</span>
                  )}
                  {task.is_deep_work && (
                    <span className="text-[10px] text-orange-400">🔥 Deep</span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Actions */}
      <div className="p-4 border-t border-slate-800 space-y-2">
        <button
          onClick={generateDay}
          disabled={generating}
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
        >
          {generating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
          {generating ? 'Generating…' : 'Generate Day with AI'}
        </button>
        <a
          href="/work"
          className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white text-sm transition-colors"
        >
          <Plus size={14} />
          Add task manually
        </a>
      </div>
    </div>
  )
}
