'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Prayer, Task } from '@/lib/supabase/types'
import { Package, Lock, CheckCircle2, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface DailyRewardChestProps {
  prayers: Prayer[]
  tasks: Task[]
  learningDone: boolean
  userId: string
  date: string
}

const CHEST_XP = 50
const STORAGE_KEY = (date: string) => `chest_opened_${date}`

export default function DailyRewardChest({ prayers, tasks, learningDone, userId, date }: DailyRewardChestProps) {
  const [opened, setOpened] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem(STORAGE_KEY(date)) === '1'
  })
  const [claiming, setClaiming] = useState(false)
  const supabase = createClient()

  const prayersDone = prayers.filter(p => p.status === 'on_time' || p.status === 'late').length
  const tasksDone = tasks.length > 0 && tasks.every(t => t.status === 'done')
  const criteria = [
    { label: 'Prayers (4+)', met: prayersDone >= 4, value: `${prayersDone}/5` },
    { label: 'All quests', met: tasksDone, value: tasksDone ? '✓' : `${tasks.filter(t => t.status === 'done').length}/${tasks.length}` },
    { label: 'Learning session', met: learningDone, value: learningDone ? '✓' : '—' },
  ]
  const allMet = criteria.every(c => c.met)

  async function claimReward() {
    if (!allMet || opened || claiming) return
    setClaiming(true)
    try {
      await supabase.rpc('increment_xp', { user_id: userId, amount: CHEST_XP })
      localStorage.setItem(STORAGE_KEY(date), '1')
      setOpened(true)
      toast.success(`🎁 Chest opened! +${CHEST_XP} bonus XP!`)
    } catch {
      toast.error('Failed to claim reward')
    } finally {
      setClaiming(false)
    }
  }

  return (
    <div className={cn(
      'border rounded-2xl p-4 transition-all duration-500',
      opened
        ? 'bg-yellow-500/5 border-yellow-500/30'
        : allMet
          ? 'bg-yellow-950/30 border-yellow-500/40 cursor-pointer hover:border-yellow-400/60'
          : 'bg-slate-900 border-slate-800'
    )} onClick={allMet && !opened ? claimReward : undefined}>
      <div className="flex items-center gap-4">
        {/* Chest icon */}
        <div className={cn(
          'w-14 h-14 rounded-xl flex items-center justify-center text-2xl transition-all duration-500 flex-shrink-0',
          opened ? 'bg-yellow-500/20 scale-110' : allMet ? 'bg-yellow-500/10 animate-pulse' : 'bg-slate-800'
        )}>
          {opened ? '🎁' : allMet ? '🔓' : '🔒'}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white">Daily Reward Chest</p>
            {allMet && !opened && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400 font-medium border border-yellow-400/20">
                Tap to open!
              </span>
            )}
          </div>

          {opened ? (
            <div className="flex items-center gap-1 mt-0.5">
              <CheckCircle2 size={12} className="text-green-400" />
              <span className="text-xs text-green-400">+{CHEST_XP} XP claimed. Epic day!</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 mt-1.5">
              {criteria.map(c => (
                <div key={c.label} className="flex items-center gap-1">
                  <div className={cn('w-1.5 h-1.5 rounded-full', c.met ? 'bg-green-400' : 'bg-slate-600')} />
                  <span className={cn('text-[10px]', c.met ? 'text-green-400' : 'text-slate-500')}>
                    {c.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* XP reward badge */}
        <div className={cn(
          'flex items-center gap-1 px-2.5 py-1.5 rounded-lg flex-shrink-0',
          opened ? 'bg-yellow-500/20' : 'bg-slate-800'
        )}>
          <Zap size={12} className={opened ? 'text-yellow-400' : 'text-slate-500'} />
          <span className={cn('text-sm font-bold', opened ? 'text-yellow-400' : 'text-slate-500')}>
            +{CHEST_XP}
          </span>
        </div>
      </div>
    </div>
  )
}
