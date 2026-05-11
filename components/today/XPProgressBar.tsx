'use client'

import { Zap } from 'lucide-react'
import { getLevelTitle } from '@/lib/utils'
import { cn } from '@/lib/utils'

interface XPProgressBarProps {
  xp: number
  level: number
  pulse?: boolean
}

export default function XPProgressBar({ xp, level, pulse = false }: XPProgressBarProps) {
  const xpPerLevel = 500
  const xpInLevel = xp % xpPerLevel
  const progress = (xpInLevel / xpPerLevel) * 100
  const title = getLevelTitle(level)

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
            {level}
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="text-[10px] text-slate-500">Level {level}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Zap size={14} className="text-yellow-400" />
          <span className="text-sm font-bold text-yellow-400">{xp.toLocaleString()}</span>
          <span className="text-xs text-slate-500">XP</span>
        </div>
      </div>

      <div className="relative h-3 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700 bg-gradient-to-r from-yellow-400 via-yellow-500 to-orange-400',
            pulse ? 'animate-pulse' : ''
          )}
          style={{ width: `${progress}%` }}
        />
        {/* Shimmer overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
      </div>

      <div className="flex justify-between mt-1.5">
        <span className="text-[10px] text-slate-600">{xpInLevel} / {xpPerLevel} XP</span>
        <span className="text-[10px] text-slate-600">{xpPerLevel - xpInLevel} to Level {level + 1}</span>
      </div>
    </div>
  )
}
