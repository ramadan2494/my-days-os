'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { Task } from '@/lib/supabase/types'

const CATEGORY_COLORS: Record<string, string> = {
  Work: 'bg-blue-500/80',
  TA: 'bg-cyan-500/80',
  PhD: 'bg-purple-500/80',
  Admin: 'bg-slate-500/80',
  Personal: 'bg-green-500/80',
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

interface MonthlyCalendarProps {
  tasks: Task[]
  month: string // YYYY-MM
  selectedDay: string | null
  onDayClick: (date: string) => void
}

function buildCalendarDays(month: string) {
  const [year, m] = month.split('-').map(Number)
  const firstDay = new Date(year, m - 1, 1)
  const lastDay = new Date(year, m, 0)
  const startOffset = firstDay.getDay() // 0=Sun

  const days: Array<{ date: string; dayNum: number } | null> = []
  for (let i = 0; i < startOffset; i++) days.push(null)
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = `${month}-${String(d).padStart(2, '0')}`
    days.push({ date, dayNum: d })
  }
  // Pad to complete the last row
  while (days.length % 7 !== 0) days.push(null)
  return days
}

export default function MonthlyCalendar({ tasks, month, selectedDay, onDayClick }: MonthlyCalendarProps) {
  const today = new Date().toISOString().split('T')[0]

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const task of tasks) {
      const d = task.scheduled_date ?? task.due_date
      if (!d) continue
      if (!map[d]) map[d] = []
      map[d].push(task)
    }
    return map
  }, [tasks])

  const days = useMemo(() => buildCalendarDays(month), [month])

  return (
    <div className="select-none">
      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-xs font-medium text-slate-500 py-2">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} />

          const { date, dayNum } = day
          const dayTasks = tasksByDate[date] ?? []
          const isToday = date === today
          const isSelected = date === selectedDay
          const isPast = date < today
          const doneTasks = dayTasks.filter(t => t.status === 'done').length

          return (
            <button
              key={date}
              onClick={() => onDayClick(date)}
              className={cn(
                'rounded-xl p-1.5 min-h-[72px] flex flex-col gap-1 transition-all text-left border',
                isSelected
                  ? 'border-blue-500 bg-blue-500/10'
                  : isToday
                    ? 'border-yellow-500/50 bg-yellow-500/5'
                    : 'border-transparent hover:border-slate-700 hover:bg-slate-800/50',
                isPast && !isToday && !isSelected ? 'opacity-50' : ''
              )}
            >
              <span className={cn(
                'text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full',
                isToday ? 'bg-yellow-400 text-slate-900' : 'text-slate-300'
              )}>
                {dayNum}
              </span>

              {/* Task chips */}
              <div className="flex flex-col gap-0.5 flex-1">
                {dayTasks.slice(0, 3).map(task => (
                  <div
                    key={task.id}
                    className={cn(
                      'text-[9px] px-1.5 py-0.5 rounded-full truncate leading-tight font-medium text-white',
                      CATEGORY_COLORS[task.category] ?? 'bg-slate-500/80',
                      task.status === 'done' ? 'opacity-50 line-through' : ''
                    )}
                  >
                    {task.title}
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-[9px] text-slate-500 pl-1">+{dayTasks.length - 3} more</span>
                )}
              </div>

              {/* Progress indicator */}
              {dayTasks.length > 0 && (
                <div className="w-full h-0.5 bg-slate-700 rounded-full overflow-hidden mt-auto">
                  <div
                    className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${(doneTasks / dayTasks.length) * 100}%` }}
                  />
                </div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
