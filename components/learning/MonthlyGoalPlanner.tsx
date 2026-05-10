'use client'

import { useState } from 'react'
import { TaskCategory } from '@/lib/supabase/types'
import { Sparkles, Target, Calendar, Clock, CheckCircle2, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

const CATEGORIES: TaskCategory[] = ['PhD', 'Work', 'TA', 'Admin', 'Personal']

const CATEGORY_COLORS: Record<TaskCategory, string> = {
  PhD: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  Work: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  TA: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
  Admin: 'text-slate-400 bg-slate-500/10 border-slate-500/20',
  Personal: 'text-green-400 bg-green-500/10 border-green-500/20',
}

interface CreatedTask {
  title: string
  scheduled_date: string
  priority: string
  estimated_minutes: number
  is_deep_work: boolean
}

interface PlanResult {
  overview: string
  tasks_created: number
  tasks: CreatedTask[]
}

export default function MonthlyGoalPlanner() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<PlanResult | null>(null)
  const [showAllTasks, setShowAllTasks] = useState(false)

  const [form, setForm] = useState({
    title: '',
    deadline: '',
    hoursPerDay: 2,
    category: 'PhD' as TaskCategory,
    context: '',
  })

  // Default deadline = 30 days from now
  const defaultDeadline = () => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().split('T')[0]
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.deadline) return
    setLoading(true)
    setResult(null)

    try {
      const res = await fetch('/api/claude/monthly-goal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          deadline: form.deadline,
          hoursPerDay: form.hoursPerDay,
          category: form.category,
          context: form.context,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? 'Failed to generate plan')
        return
      }

      setResult(data)
      toast.success(`✨ ${data.tasks_created} tasks scheduled across your timeline!`)
    } catch {
      toast.error('Network error. Try again.')
    } finally {
      setLoading(false)
    }
  }

  const visibleTasks = result
    ? showAllTasks ? result.tasks : result.tasks.slice(0, 5)
    : []

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-5 hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center flex-shrink-0">
            <Sparkles size={18} className="text-white" />
          </div>
          <div className="text-left">
            <h2 className="font-semibold text-white">AI Monthly Goal Planner</h2>
            <p className="text-xs text-slate-400 mt-0.5">Set a goal → Claude schedules daily tasks to hit it</p>
          </div>
        </div>
        {open ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-800 p-5">
          {!result ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Goal title */}
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">What&apos;s your goal?</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  required
                  placeholder="e.g. Write & submit PhD chapter 3 draft"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Deadline */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">
                    <Calendar size={12} className="inline mr-1" />Deadline
                  </label>
                  <input
                    type="date"
                    value={form.deadline || defaultDeadline()}
                    onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                    required
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500 transition-colors text-sm"
                  />
                </div>

                {/* Hours/day */}
                <div>
                  <label className="block text-sm text-slate-400 mb-1.5">
                    <Clock size={12} className="inline mr-1" />Hours/day
                  </label>
                  <input
                    type="number"
                    min={0.5}
                    max={8}
                    step={0.5}
                    value={form.hoursPerDay}
                    onChange={e => setForm(f => ({ ...f, hoursPerDay: Number(e.target.value) }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-purple-500 transition-colors text-sm"
                  />
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, category: cat }))}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
                        form.category === cat
                          ? CATEGORY_COLORS[cat]
                          : 'border-slate-700 text-slate-500 hover:border-slate-600'
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Context */}
              <div>
                <label className="block text-sm text-slate-400 mb-1.5">Context (optional)</label>
                <textarea
                  value={form.context}
                  onChange={e => setForm(f => ({ ...f, context: e.target.value }))}
                  rows={2}
                  placeholder="e.g. I need to write 8,000 words, cover literature review and methodology..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors text-sm resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !form.title}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Claude is building your plan...
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    Generate Daily Task Plan
                  </>
                )}
              </button>

              <p className="text-center text-xs text-slate-600">
                Claude will schedule {Math.ceil(30)} daily tasks in your Work page
              </p>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Success header */}
              <div className="flex items-start gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-xl">
                <CheckCircle2 size={20} className="text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-400 text-sm">{result.tasks_created} tasks scheduled!</p>
                  <p className="text-slate-400 text-xs mt-1">{result.overview}</p>
                </div>
              </div>

              {/* Task preview */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">First tasks scheduled</p>
                {visibleTasks.map((task, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-800 rounded-xl">
                    <div className={cn(
                      'w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0',
                      task.priority === 'high' ? 'bg-red-500' :
                      task.priority === 'medium' ? 'bg-yellow-500' : 'bg-slate-500'
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium">{task.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-slate-500">{task.scheduled_date}</span>
                        <span className="text-xs text-slate-600">·</span>
                        <span className="text-xs text-slate-500">{task.estimated_minutes}min</span>
                        {task.is_deep_work && <span className="text-xs text-purple-400">🧠</span>}
                      </div>
                    </div>
                  </div>
                ))}
                {result.tasks.length > 5 && (
                  <button
                    onClick={() => setShowAllTasks(!showAllTasks)}
                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                  >
                    {showAllTasks ? 'Show less' : `+${result.tasks.length - 5} more tasks`}
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setResult(null); setForm({ title: '', deadline: '', hoursPerDay: 2, category: 'PhD', context: '' }) }}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 transition-colors"
                >
                  Plan Another Goal
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm text-slate-300 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
