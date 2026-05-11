'use client'

import { Task } from '@/lib/supabase/types'
import { getTaskXP } from '@/lib/utils'
import { Skull, Zap, Clock } from 'lucide-react'

interface DailyBossProps {
  tasks: Task[]
  pomodorosDone?: number
}

export default function DailyBoss({ tasks, pomodorosDone = 0 }: DailyBossProps) {
  // Pick the highest-priority deep work task as the boss
  const boss = tasks
    .filter(t => t.status !== 'done')
    .sort((a, b) => {
      const score = (t: Task) => (t.is_deep_work ? 2 : 0) + (t.priority === 'high' ? 3 : t.priority === 'medium' ? 1 : 0)
      return score(b) - score(a)
    })[0]

  if (!boss) return null

  const xp = getTaskXP(boss.is_deep_work, boss.priority)
  // Boss HP: estimated pomodoros = ceil(estimated_minutes / 25), default 4
  const totalPomodoros = Math.max(1, Math.ceil((boss.estimated_minutes ?? 100) / 25))
  const hpPercent = Math.max(0, Math.min(100, 100 - (pomodorosDone / totalPomodoros) * 100))

  return (
    <div className="bg-gradient-to-br from-red-950/40 to-slate-900 border border-red-900/40 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Skull size={16} className="text-red-400" />
        <span className="text-xs font-semibold uppercase tracking-wide text-red-400">Boss Challenge</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-white leading-tight">{boss.title}</p>
          {boss.description && (
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{boss.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <Clock size={12} />
              {boss.estimated_minutes ?? 90}m
            </span>
            <span className="flex items-center gap-1 text-xs text-yellow-400 font-bold">
              <Zap size={12} />
              {xp} XP
            </span>
            {boss.is_deep_work && (
              <span className="text-xs text-orange-400">🔥 Deep Work</span>
            )}
          </div>
        </div>

        {/* Boss HP orb */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <div className="relative w-14 h-14">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="22" fill="none" stroke="#1e293b" strokeWidth="6" />
              <circle
                cx="28" cy="28" r="22" fill="none"
                stroke="#ef4444" strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 22}`}
                strokeDashoffset={`${2 * Math.PI * 22 * (1 - hpPercent / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-red-400">
              {Math.round(hpPercent)}%
            </span>
          </div>
          <span className="text-[10px] text-slate-500">HP</span>
        </div>
      </div>

      {/* HP bar */}
      <div className="mt-3 h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-700"
          style={{ width: `${hpPercent}%` }}
        />
      </div>
      <p className="text-[10px] text-slate-600 mt-1">
        {pomodorosDone}/{totalPomodoros} pomodoros · Defeat this boss to earn {xp} XP
      </p>
    </div>
  )
}
