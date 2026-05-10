'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Prayer, PrayerName } from '@/lib/supabase/types'
import { formatTime, getPrayerXP } from '@/lib/utils'
import { determinePrayerStatus } from '@/lib/prayer-times'
import { CheckCircle, Clock, XCircle, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

const PRAYER_COLORS: Record<PrayerName, string> = {
  Fajr: 'border-indigo-500/30 bg-indigo-500/10',
  Dhuhr: 'border-yellow-500/30 bg-yellow-500/10',
  Asr: 'border-orange-500/30 bg-orange-500/10',
  Maghrib: 'border-red-500/30 bg-red-500/10',
  Isha: 'border-blue-500/30 bg-blue-500/10',
}

const PRAYER_ICONS: Record<PrayerName, string> = {
  Fajr: '🌙', Dhuhr: '☀️', Asr: '🌤️', Maghrib: '🌅', Isha: '✨',
}

interface PrayerStripProps {
  prayers: Prayer[]
  userId: string
  date: string
}

export default function PrayerStrip({ prayers, userId, date }: PrayerStripProps) {
  const [localPrayers, setLocalPrayers] = useState(prayers)
  const supabase = createClient()

  const prayerNames: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
  const completedCount = localPrayers.filter(p => p.status !== 'pending').length
  const onTimeCount = localPrayers.filter(p => p.status === 'on_time').length

  async function handleCheckPrayer(prayer: Prayer) {
    if (prayer.status !== 'pending') return

    const now = new Date()
    const status = determinePrayerStatus(prayer.scheduled_time, now, prayer.name)
    const xp = getPrayerXP(status)

    const { data, error } = await supabase
      .from('prayers')
      .update({ status, completed_at: now.toISOString(), xp_earned: xp })
      .eq('id', prayer.id)
      .select()
      .single()

    if (error) { toast.error('Failed to update prayer'); return }

    // Add XP to profile
    await supabase.rpc('increment_xp', { user_id: userId, amount: xp }).then(() => null, () => null)

    setLocalPrayers(prev => prev.map(p => p.id === prayer.id ? data : p))
    toast.success(
      status === 'on_time'
        ? `✅ ${prayer.name} — On Time! +${xp} XP`
        : `✅ ${prayer.name} — Recorded (+${xp} XP)`
    )
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <span className="text-green-400">🕌</span> Prayer Tracker
        </h2>
        <div className="text-xs text-slate-500">
          {completedCount}/5 · {onTimeCount} on time
        </div>
      </div>

      {/* Progress */}
      <div className="h-1.5 bg-slate-800 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / 5) * 100}%` }}
        />
      </div>

      {/* Prayer cards */}
      <div className="grid grid-cols-5 gap-2">
        {prayerNames.map(name => {
          const prayer = localPrayers.find(p => p.name === name)
          const status = prayer?.status ?? 'no_data'
          const isCompleted = status === 'on_time' || status === 'late'
          const isMissed = status === 'missed'

          return (
            <button
              key={name}
              onClick={() => prayer && handleCheckPrayer(prayer)}
              disabled={isCompleted || isMissed || !prayer}
              className={cn(
                'flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all',
                isCompleted ? 'border-green-500/30 bg-green-500/10' :
                isMissed ? 'border-red-500/30 bg-red-500/10' :
                prayer ? `${PRAYER_COLORS[name]} hover:scale-105 cursor-pointer active:scale-95` :
                'border-slate-800 bg-slate-800/30 opacity-50'
              )}
            >
              <span className="text-lg">{PRAYER_ICONS[name]}</span>
              <span className="text-[10px] font-medium text-slate-300">{name}</span>
              {prayer && (
                <span className="text-[9px] text-slate-500">
                  {formatTime(prayer.scheduled_time.slice(0, 5))}
                </span>
              )}
              <div className="mt-0.5">
                {isCompleted ? (
                  <CheckCircle size={14} className={status === 'on_time' ? 'text-green-400' : 'text-yellow-400'} />
                ) : isMissed ? (
                  <XCircle size={14} className="text-red-400" />
                ) : prayer ? (
                  <Clock size={14} className="text-slate-500" />
                ) : (
                  <Lock size={14} className="text-slate-600" />
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
