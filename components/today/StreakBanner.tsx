'use client'

import { cn } from '@/lib/utils'
import { Flame } from 'lucide-react'

interface StreakBannerProps {
  streak: number
}

function streakStyle(streak: number) {
  if (streak >= 30) return { bg: 'bg-purple-500/10 border-purple-500/30', text: 'text-purple-400', flame: 'text-purple-400', label: 'Legendary Streak' }
  if (streak >= 7) return { bg: 'bg-red-500/10 border-red-500/30', text: 'text-red-400', flame: 'text-red-400', label: 'On Fire!' }
  if (streak >= 3) return { bg: 'bg-orange-500/10 border-orange-500/30', text: 'text-orange-400', flame: 'text-orange-400', label: 'Building Momentum' }
  return { bg: 'bg-slate-900 border-slate-800', text: 'text-slate-300', flame: 'text-orange-400', label: 'Start your streak' }
}

export default function StreakBanner({ streak }: StreakBannerProps) {
  if (streak === 0) return null
  const { bg, text, flame, label } = streakStyle(streak)

  return (
    <div className={cn('flex items-center gap-3 px-4 py-3 rounded-2xl border', bg)}>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: Math.min(streak, 7) }).map((_, i) => (
          <Flame
            key={i}
            size={i === Math.min(streak, 7) - 1 ? 20 : 14}
            className={cn(flame, i === Math.min(streak, 7) - 1 ? 'animate-pulse' : 'opacity-60')}
          />
        ))}
      </div>
      <div>
        <p className={cn('text-sm font-bold', text)}>{streak}-Day Streak!</p>
        <p className="text-xs text-slate-500">{label} — don&apos;t break it now</p>
      </div>
    </div>
  )
}
