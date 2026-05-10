'use client'

import { useState, useEffect, useRef } from 'react'
import { Task, Profile, TaskCategory, TaskPriority, TaskStatus } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { cn, getTaskXP, todayISO } from '@/lib/utils'
import {
  Plus, Play, Pause, RotateCcw, Brain, CheckCircle2, Circle,
  Clock, Flame, ChevronDown, X, Timer, BarChart2
} from 'lucide-react'
import toast from 'react-hot-toast'

interface WorkPageClientProps {
  userId: string
  profile: Profile | null
  initialTasks: Task[]
  pomodoros: any[]
  today: string
}

const CATEGORIES: TaskCategory[] = ['Work', 'TA', 'PhD', 'Admin', 'Personal']
const PRIORITIES: TaskPriority[] = ['high', 'medium', 'low']
const STATUSES: TaskStatus[] = ['todo', 'in_progress', 'done']

const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', done: 'Done' }
const PRIORITY_DOT = { high: 'bg-red-500', medium: 'bg-yellow-500', low: 'bg-slate-500' }
const CATEGORY_STYLE = {
  Work: 'text-blue-400 bg-blue-500/10',
  TA: 'text-cyan-400 bg-cyan-500/10',
  PhD: 'text-purple-400 bg-purple-500/10',
  Admin: 'text-slate-400 bg-slate-500/10',
  Personal: 'text-green-400 bg-green-500/10',
}

const POMODORO_MINUTES = 25
const BREAK_MINUTES = 5

export default function WorkPageClient({ userId, profile, initialTasks, pomodoros, today }: WorkPageClientProps) {
  const [tasks, setTasks] = useState(initialTasks)
  const [view, setView] = useState<'today' | 'kanban' | 'all'>('today')
  const [showAddTask, setShowAddTask] = useState(false)
  const [deepWorkMode, setDeepWorkMode] = useState(false)
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)

  // Pomodoro timer
  const [pomodoroActive, setPomodoroActive] = useState(false)
  const [isBreak, setIsBreak] = useState(false)
  const [timeLeft, setTimeLeft] = useState(POMODORO_MINUTES * 60)
  const [pomodoroCount, setPomodoroCount] = useState(
    pomodoros.filter(p => p.completed && new Date(p.started_at).toDateString() === new Date().toDateString()).length
  )
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const supabase = createClient()

  // Task form
  const [form, setForm] = useState({
    title: '', description: '', due_date: '', priority: 'medium' as TaskPriority,
    category: 'Work' as TaskCategory, is_deep_work: false, estimated_minutes: 60,
    scheduled_date: today,
  })

  // Timer logic
  useEffect(() => {
    if (pomodoroActive) {
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleTimerEnd()
            return isBreak ? POMODORO_MINUTES * 60 : BREAK_MINUTES * 60
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [pomodoroActive, isBreak])

  async function handleTimerEnd() {
    setPomodoroActive(false)
    if (!isBreak) {
      // Save completed pomodoro
      await supabase.from('pomodoro_sessions').insert({
        user_id: userId, task_id: activeTaskId,
        started_at: new Date(Date.now() - POMODORO_MINUTES * 60000).toISOString(),
        ended_at: new Date().toISOString(),
        duration_minutes: POMODORO_MINUTES, completed: true,
      })
      await supabase.rpc('increment_xp', { user_id: userId, amount: 20 }).then(() => null, () => null)
      setPomodoroCount(c => c + 1)
      toast.success('🍅 Pomodoro complete! +20 XP. Take a break.')
      setIsBreak(true)
      setTimeLeft(BREAK_MINUTES * 60)
    } else {
      toast('Break over! Ready for the next session.')
      setIsBreak(false)
      setTimeLeft(POMODORO_MINUTES * 60)
    }
  }

  function formatTimer(secs: number) {
    const m = Math.floor(secs / 60).toString().padStart(2, '0')
    const s = (secs % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return

    const { data, error } = await supabase.from('tasks').insert({
      user_id: userId, ...form,
    }).select().single()

    if (error) { toast.error('Failed to add task'); return }
    setTasks(prev => [data, ...prev])
    setForm({ title: '', description: '', due_date: '', priority: 'medium', category: 'Work', is_deep_work: false, estimated_minutes: 60, scheduled_date: today })
    setShowAddTask(false)
    toast.success('Task added!')
  }

  async function updateTaskStatus(task: Task, status: TaskStatus) {
    const xp = status === 'done' ? getTaskXP(task.is_deep_work, task.priority) : 0
    const { data, error } = await supabase.from('tasks').update({
      status, xp_earned: xp,
      completed_at: status === 'done' ? new Date().toISOString() : null,
    }).eq('id', task.id).select().single()
    if (error) { toast.error('Update failed'); return }
    if (status === 'done') {
      await supabase.rpc('increment_xp', { user_id: userId, amount: xp }).then(() => null, () => null)
      toast.success(`Done! +${xp} XP`)
    }
    setTasks(prev => prev.map(t => t.id === task.id ? data : t))
  }

  async function deleteTask(id: string) {
    await supabase.from('tasks').delete().eq('id', id)
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const todayTasks = tasks.filter(t => t.scheduled_date === today)
  const doneTodayCount = todayTasks.filter(t => t.status === 'done').length
  const completedPomodorosToday = pomodoroCount
  const hoursTracked = completedPomodorosToday * (POMODORO_MINUTES / 60)

  if (deepWorkMode) {
    const activeTask = tasks.find(t => t.id === activeTaskId)
    return (
      <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col items-center justify-center p-8">
        <button onClick={() => setDeepWorkMode(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white">
          <X size={20} />
        </button>
        <div className="text-center max-w-md">
          <Brain className="text-purple-400 mx-auto mb-4" size={40} />
          <h2 className="text-2xl font-bold text-white mb-1">Deep Work Mode</h2>
          {activeTask && <p className="text-slate-400 mb-8">{activeTask.title}</p>}
          <div className={cn('text-7xl font-bold font-mono mb-8', isBreak ? 'text-green-400' : 'text-white')}>
            {formatTimer(timeLeft)}
          </div>
          <p className="text-sm text-slate-500 mb-6">{isBreak ? '☕ Break time' : '🧠 Focus time'}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setPomodoroActive(a => !a)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-medium"
            >
              {pomodoroActive ? <Pause size={18} /> : <Play size={18} />}
              {pomodoroActive ? 'Pause' : 'Start'}
            </button>
            <button
              onClick={() => { setPomodoroActive(false); setTimeLeft(POMODORO_MINUTES * 60); setIsBreak(false) }}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white px-4 py-3 rounded-xl"
            >
              <RotateCcw size={16} />
            </button>
          </div>
          <p className="text-slate-600 text-xs mt-8">🍅 {completedPomodorosToday} pomodoros today</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Work Board</h1>
          <p className="text-slate-400 text-sm mt-0.5">Tasks, focus, and daily progress</p>
        </div>
        <button
          onClick={() => setShowAddTask(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
        >
          <Plus size={16} /> Add Task
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Today Done', value: `${doneTodayCount}/${todayTasks.length}`, color: 'text-green-400' },
          { label: 'Pomodoros', value: `${completedPomodorosToday}`, color: 'text-red-400', icon: '🍅' },
          { label: 'Hours', value: `${hoursTracked.toFixed(1)}h`, color: 'text-blue-400' },
          { label: 'Work Streak', value: `${profile?.work_streak ?? 0}d`, color: 'text-orange-400', icon: '🔥' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
            <div className={`text-lg font-bold ${s.color}`}>{s.icon}{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pomodoro Timer */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Timer size={16} className="text-red-400" /> Pomodoro Timer
          </h2>
          <button
            onClick={() => setDeepWorkMode(true)}
            className="flex items-center gap-1.5 text-xs text-purple-400 bg-purple-500/10 px-3 py-1.5 rounded-lg hover:bg-purple-500/20 transition-colors"
          >
            <Brain size={12} /> Deep Work Mode
          </button>
        </div>

        <div className="flex items-center gap-6">
          <div className={cn('text-4xl font-bold font-mono', isBreak ? 'text-green-400' : 'text-white')}>
            {formatTimer(timeLeft)}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPomodoroActive(a => !a)}
              className={cn('flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors',
                isBreak ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700', 'text-white')}
            >
              {pomodoroActive ? <Pause size={14} /> : <Play size={14} />}
              {pomodoroActive ? 'Pause' : isBreak ? 'Start Break' : 'Start'}
            </button>
            <button
              onClick={() => { setPomodoroActive(false); setTimeLeft(POMODORO_MINUTES * 60); setIsBreak(false) }}
              className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl transition-colors"
            >
              <RotateCcw size={14} />
            </button>
          </div>
          <div className="text-sm text-slate-500">
            {isBreak ? '☕ Break' : '🧠 Focus'} · 🍅 {completedPomodorosToday}
          </div>
        </div>

        {/* Select task for pomodoro */}
        {todayTasks.filter(t => t.status !== 'done').length > 0 && (
          <div className="mt-3">
            <label className="text-xs text-slate-500 mb-1 block">Working on:</label>
            <select
              value={activeTaskId ?? ''}
              onChange={e => setActiveTaskId(e.target.value || null)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 w-full max-w-xs"
            >
              <option value="">Select a task...</option>
              {todayTasks.filter(t => t.status !== 'done').map(t => (
                <option key={t.id} value={t.id}>{t.title}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {(['today', 'kanban', 'all'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all',
              view === v ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white')}
          >
            {v === 'today' ? 'Today' : v === 'kanban' ? 'Kanban' : 'All Tasks'}
          </button>
        ))}
      </div>

      {/* Task List - Today view */}
      {view === 'today' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="font-semibold text-white mb-4">Today&apos;s Tasks</h2>
          <TaskList
            tasks={todayTasks}
            onStatusChange={updateTaskStatus}
            onDelete={deleteTask}
            onStartPomodoro={(id) => { setActiveTaskId(id); setPomodoroActive(true) }}
          />
        </div>
      )}

      {/* Kanban view */}
      {view === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {STATUSES.map(status => (
            <div key={status} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-medium text-white text-sm">{STATUS_LABELS[status]}</h3>
                <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                  {tasks.filter(t => t.status === status).length}
                </span>
              </div>
              <TaskList
                tasks={tasks.filter(t => t.status === status)}
                onStatusChange={updateTaskStatus}
                onDelete={deleteTask}
                onStartPomodoro={(id) => { setActiveTaskId(id); setPomodoroActive(true) }}
                compact
              />
            </div>
          ))}
        </div>
      )}

      {/* All tasks */}
      {view === 'all' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="font-semibold text-white mb-4">All Tasks ({tasks.length})</h2>
          <TaskList
            tasks={tasks}
            onStatusChange={updateTaskStatus}
            onDelete={deleteTask}
            onStartPomodoro={(id) => { setActiveTaskId(id); setPomodoroActive(true) }}
          />
        </div>
      )}

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">New Task</h2>
              <button onClick={() => setShowAddTask(false)} className="text-slate-500 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={addTask} className="space-y-3">
              <input
                placeholder="Task title *"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                required
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
              <textarea
                placeholder="Description (optional)"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as TaskPriority }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500">
                    {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Category</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as TaskCategory }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500">
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Schedule for</label>
                  <input type="date" value={form.scheduled_date}
                    onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Est. minutes</label>
                  <input type="number" value={form.estimated_minutes}
                    onChange={e => setForm(f => ({ ...f, estimated_minutes: Number(e.target.value) }))}
                    min="5" step="5"
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_deep_work}
                  onChange={e => setForm(f => ({ ...f, is_deep_work: e.target.checked }))}
                  className="w-4 h-4 accent-purple-500" />
                <span className="text-sm text-slate-300">🧠 Deep Work (2× XP)</span>
              </label>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl transition-colors">
                Add Task
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function TaskList({ tasks, onStatusChange, onDelete, onStartPomodoro, compact = false }: {
  tasks: Task[]
  onStatusChange: (task: Task, status: TaskStatus) => void
  onDelete: (id: string) => void
  onStartPomodoro: (id: string) => void
  compact?: boolean
}) {
  if (tasks.length === 0) {
    return <p className="text-slate-500 text-sm text-center py-4">No tasks here</p>
  }

  const PRIORITY_DOT: Record<string, string> = { high: 'bg-red-500', medium: 'bg-yellow-500', low: 'bg-slate-500' }
  const CATEGORY_STYLE: Record<string, string> = {
    Work: 'text-blue-400 bg-blue-500/10', TA: 'text-cyan-400 bg-cyan-500/10',
    PhD: 'text-purple-400 bg-purple-500/10', Admin: 'text-slate-400 bg-slate-500/10',
    Personal: 'text-green-400 bg-green-500/10',
  }

  return (
    <div className="space-y-2">
      {tasks.map(task => (
        <div key={task.id} className={cn(
          'flex items-start gap-3 p-3 rounded-xl border transition-all group',
          task.status === 'done' ? 'bg-slate-800/20 border-slate-800 opacity-60' : 'bg-slate-800 border-slate-700'
        )}>
          <button
            onClick={() => onStatusChange(task, task.status === 'done' ? 'todo' : 'done')}
            className="mt-0.5 flex-shrink-0"
          >
            {task.status === 'done'
              ? <CheckCircle2 size={16} className="text-green-400" />
              : <Circle size={16} className="text-slate-500 hover:text-blue-400 transition-colors" />}
          </button>
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm font-medium truncate', task.status === 'done' ? 'line-through text-slate-500' : 'text-white')}>
              {task.title}
            </p>
            {!compact && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <div className={cn('w-1.5 h-1.5 rounded-full', PRIORITY_DOT[task.priority])} />
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-md', CATEGORY_STYLE[task.category])}>{task.category}</span>
                {task.is_deep_work && <span className="text-[10px] text-purple-400">🧠</span>}
                {task.estimated_minutes && <span className="text-[10px] text-slate-500">{task.estimated_minutes}min</span>}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {task.status !== 'done' && (
              <button onClick={() => onStartPomodoro(task.id)}
                className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Start Pomodoro">
                <Timer size={13} />
              </button>
            )}
            <button onClick={() => onDelete(task.id)}
              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
              <X size={13} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
