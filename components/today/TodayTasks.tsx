'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Task } from '@/lib/supabase/types'
import { cn, getTaskXP } from '@/lib/utils'
import { CheckCircle2, Circle, ChevronRight, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

const PRIORITY_COLORS = {
  high: 'bg-red-500',
  medium: 'bg-yellow-500',
  low: 'bg-slate-500',
}

const CATEGORY_COLORS = {
  Work: 'text-blue-400 bg-blue-500/10',
  TA: 'text-cyan-400 bg-cyan-500/10',
  PhD: 'text-purple-400 bg-purple-500/10',
  Admin: 'text-slate-400 bg-slate-500/10',
  Personal: 'text-green-400 bg-green-500/10',
}

interface TodayTasksProps {
  tasks: Task[]
  userId: string
}

export default function TodayTasks({ tasks, userId }: TodayTasksProps) {
  const [localTasks, setLocalTasks] = useState(tasks)
  const supabase = createClient()

  const completedToday = localTasks.filter(t => t.status === 'done').length
  const total = localTasks.length

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
      await supabase.rpc('increment_xp', { user_id: userId, amount: xp }).then(() => null, () => null)
      toast.success(`Task done! +${xp} XP`)
    }

    setLocalTasks(prev => prev.map(t => t.id === task.id ? data : t))
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <span className="text-blue-400">✅</span> Today&apos;s Tasks
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">{completedToday}/{total}</span>
          <Link href="/work" className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
            <Plus size={16} />
          </Link>
        </div>
      </div>

      {localTasks.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-slate-400 text-sm">No tasks for today. Great start!</p>
          <Link href="/work" className="text-blue-400 text-sm hover:underline mt-1 inline-block">Add tasks →</Link>
        </div>
      ) : (
        <div className="space-y-2">
          {localTasks.map(task => (
            <button
              key={task.id}
              onClick={() => toggleTask(task)}
              className={cn(
                'w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all',
                task.status === 'done' ? 'bg-slate-800/30 opacity-60' : 'bg-slate-800 hover:bg-slate-700'
              )}
            >
              {task.status === 'done' ? (
                <CheckCircle2 size={18} className="text-green-400 flex-shrink-0" />
              ) : (
                <Circle size={18} className="text-slate-500 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-medium truncate', task.status === 'done' ? 'line-through text-slate-500' : 'text-white')}>
                  {task.title}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_COLORS[task.priority])} />
                  <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md font-medium', CATEGORY_COLORS[task.category])}>
                    {task.category}
                  </span>
                  {task.is_deep_work && <span className="text-[10px] text-purple-400">🧠 Deep</span>}
                </div>
              </div>
              <ChevronRight size={14} className="text-slate-600 flex-shrink-0" />
            </button>
          ))}
        </div>
      )}

      {localTasks.length > 0 && (
        <Link href="/work" className="flex items-center justify-center gap-1 text-xs text-slate-500 hover:text-slate-300 mt-3 transition-colors">
          View all tasks <ChevronRight size={12} />
        </Link>
      )}
    </div>
  )
}
