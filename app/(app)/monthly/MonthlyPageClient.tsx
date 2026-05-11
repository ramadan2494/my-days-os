'use client'

import { useState, useCallback } from 'react'
import { Task, MonthlyPlan, Profile } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import MonthlyCalendar from '@/components/monthly/MonthlyCalendar'
import DayTasksPanel from '@/components/monthly/DayTasksPanel'
import MonthlyGoalPlanner from '@/components/learning/MonthlyGoalPlanner'
import { ChevronLeft, ChevronRight, Plus, Target, CheckCircle2, Calendar, BarChart2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MonthlyPageClientProps {
  userId: string
  initialMonth: string
  initialPlans: MonthlyPlan[]
  initialTasks: Task[]
  profile: Profile | null
}

function formatMonthLabel(month: string) {
  const [year, m] = month.split('-').map(Number)
  return new Date(year, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function getMonthTaskRange(month: string) {
  const [year, m] = month.split('-').map(Number)
  const first = `${month}-01`
  const last = new Date(year, m, 0).toISOString().split('T')[0]
  return { first, last }
}

export default function MonthlyPageClient({
  userId, initialMonth, initialPlans, initialTasks, profile,
}: MonthlyPageClientProps) {
  const [month, setMonth] = useState(initialMonth)
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [plans, setPlans] = useState<MonthlyPlan[]>(initialPlans)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [showPlanner, setShowPlanner] = useState(false)
  const [loadingMonth, setLoadingMonth] = useState(false)
  const supabase = createClient()

  async function loadMonth(newMonth: string) {
    setLoadingMonth(true)
    setSelectedDay(null)
    const { first, last } = getMonthTaskRange(newMonth)
    const [tasksRes, plansRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('*')
        .eq('user_id', userId)
        .gte('scheduled_date', first)
        .lte('scheduled_date', last)
        .order('scheduled_date'),
      supabase
        .from('monthly_plans')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }),
    ])
    setTasks(tasksRes.data ?? [])
    setPlans(plansRes.data ?? [])
    setLoadingMonth(false)
  }

  function prevMonth() {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    const nm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    setMonth(nm)
    loadMonth(nm)
  }

  function nextMonth() {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m, 1)
    const nm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    setMonth(nm)
    loadMonth(nm)
  }

  const selectedDayTasks = selectedDay
    ? tasks.filter(t => (t.scheduled_date ?? t.due_date) === selectedDay)
    : []

  function handleTasksChange(updatedDayTasks: Task[]) {
    setTasks(prev => {
      const otherDayTasks = prev.filter(t => (t.scheduled_date ?? t.due_date) !== selectedDay)
      return [...otherDayTasks, ...updatedDayTasks]
    })
  }

  // Stats for current month
  const totalTasks = tasks.length
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const deepWorkTasks = tasks.filter(t => t.is_deep_work).length
  const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  // Active plans for this month
  const activePlans = plans.filter(p => p.month === month)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Monthly Plan</h1>
          <p className="text-slate-400 text-sm mt-0.5">Plan your month, divide into days</p>
        </div>
        <button
          onClick={() => setShowPlanner(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
        >
          <Plus size={16} />
          New Monthly Goal
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Tasks" value={totalTasks} icon={<Calendar size={16} className="text-blue-400" />} />
        <StatCard label="Completed" value={doneTasks} icon={<CheckCircle2 size={16} className="text-green-400" />} />
        <StatCard label="Completion" value={`${completionRate}%`} icon={<BarChart2 size={16} className="text-yellow-400" />} />
        <StatCard label="Deep Work" value={deepWorkTasks} icon={<Target size={16} className="text-orange-400" />} />
      </div>

      {/* Active Plans */}
      {activePlans.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Target size={16} className="text-blue-400" />
            Active Plans — {formatMonthLabel(month)}
          </h2>
          <div className="space-y-3">
            {activePlans.map(plan => {
              const planTasks = tasks.filter(t => (t as any).monthly_plan_id === plan.id)
              const planDone = planTasks.filter(t => t.status === 'done').length
              const planTotal = planTasks.length
              const progress = planTotal > 0 ? Math.round((planDone / planTotal) * 100) : 0
              return (
                <div key={plan.id} className="p-3 bg-slate-800 rounded-xl">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-white">{plan.title}</p>
                      {plan.overview && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{plan.overview}</p>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 ml-2 flex-shrink-0">{planDone}/{planTotal}</span>
                  </div>
                  <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {plan.ai_plan?.weeks && plan.ai_plan.weeks.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {plan.ai_plan.weeks.map(w => (
                        <span key={w.week_number} className="text-[10px] px-2 py-0.5 bg-slate-700 rounded-full text-slate-400">
                          W{w.week_number}: {w.theme}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Calendar + Day Panel */}
      <div className={cn(
        'grid gap-6',
        selectedDay ? 'grid-cols-1 lg:grid-cols-[1fr_320px]' : 'grid-cols-1'
      )}>
        {/* Calendar */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={prevMonth}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <h2 className="text-base font-semibold text-white">{formatMonthLabel(month)}</h2>
            <button
              onClick={nextMonth}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {loadingMonth ? (
            <div className="h-64 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <MonthlyCalendar
              tasks={tasks}
              month={month}
              selectedDay={selectedDay}
              onDayClick={d => setSelectedDay(prev => prev === d ? null : d)}
            />
          )}
        </div>

        {/* Day panel */}
        {selectedDay && (
          <DayTasksPanel
            date={selectedDay}
            tasks={selectedDayTasks}
            userId={userId}
            onClose={() => setSelectedDay(null)}
            onTasksChange={handleTasksChange}
          />
        )}
      </div>

      {/* MonthlyGoalPlanner modal */}
      {showPlanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl max-h-[90vh] overflow-y-auto relative">
            <button
              onClick={() => setShowPlanner(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors z-10"
            >
              <X size={18} />
            </button>
            <div className="p-6">
              <MonthlyGoalPlanner onCreated={() => { setShowPlanner(false); loadMonth(month) }} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center gap-3">
      <div className="p-2 rounded-lg bg-slate-800">{icon}</div>
      <div>
        <p className="text-lg font-bold text-white">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  )
}
