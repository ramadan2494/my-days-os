'use client'

import { useState } from 'react'
import { Prayer, Profile, PrayerName } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { formatTime, getPrayerXP } from '@/lib/utils'
import { determinePrayerStatus, getQiblaDirection } from '@/lib/prayer-times'
import { CheckCircle, Clock, XCircle, Flame, Navigation } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

interface PrayerPageClientProps {
  userId: string
  profile: Profile | null
  todayPrayers: Prayer[]
  history: Prayer[]
  today: string
}

const PRAYER_INFO: Record<PrayerName, { emoji: string; desc: string }> = {
  Fajr: { emoji: '🌙', desc: 'Pre-dawn prayer' },
  Dhuhr: { emoji: '☀️', desc: 'Midday prayer' },
  Asr: { emoji: '🌤️', desc: 'Afternoon prayer' },
  Maghrib: { emoji: '🌅', desc: 'Sunset prayer' },
  Isha: { emoji: '✨', desc: 'Night prayer' },
}

export default function PrayerPageClient({ userId, profile, todayPrayers, history, today }: PrayerPageClientProps) {
  const [prayers, setPrayers] = useState(todayPrayers)
  const supabase = createClient()

  const prayerNames: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']
  const completedCount = prayers.filter(p => p.status !== 'pending').length
  const onTimeCount = prayers.filter(p => p.status === 'on_time').length
  const totalXP = prayers.reduce((sum, p) => sum + p.xp_earned, 0)

  // Build heatmap data
  const heatmapDays = buildHeatmap(history)

  async function handlePrayer(prayer: Prayer) {
    const isCompleted = prayer.status === 'on_time' || prayer.status === 'late'

    if (isCompleted) {
      // Undo: reset back to pending and reverse XP
      const { data, error } = await supabase
        .from('prayers')
        .update({ status: 'pending', completed_at: null, xp_earned: 0 })
        .eq('id', prayer.id)
        .select()
        .single()
      if (error) { toast.error('Failed to undo prayer'); return }
      await supabase.rpc('increment_xp', { user_id: userId, amount: -prayer.xp_earned }).then(() => null, () => null)
      setPrayers(prev => prev.map(p => p.id === prayer.id ? data : p))
      toast.success(`↩️ ${prayer.name} unchecked`)
      return
    }

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

    if (error) { toast.error('Failed to record prayer'); return }

    await supabase.rpc('increment_xp', { user_id: userId, amount: xp }).then(() => null, () => null)
    setPrayers(prev => prev.map(p => p.id === prayer.id ? data : p))

    const msg = status === 'on_time'
      ? `✅ ${prayer.name} — On Time! +${xp} XP`
      : `⚠️ ${prayer.name} — Recorded (late) +${xp} XP`
    toast.success(msg)
  }

  const qibla = profile?.location_lat && profile?.location_lng
    ? getQiblaDirection(profile.location_lat, profile.location_lng)
    : null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Prayer Tracker</h1>
        <p className="text-slate-400 text-sm mt-0.5">Your sacred daily anchors</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Today', value: `${completedCount}/5`, color: 'text-green-400' },
          { label: 'On Time', value: onTimeCount, color: 'text-blue-400' },
          { label: 'Streak', value: `${profile?.prayer_streak ?? 0}d`, color: 'text-orange-400', icon: <Flame size={14} /> },
          { label: 'XP Today', value: `+${totalXP}`, color: 'text-yellow-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
            <div className={`text-lg font-bold ${stat.color} flex items-center justify-center gap-1`}>
              {stat.icon}{stat.value}
            </div>
            <div className="text-xs text-slate-500 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Today's Prayers */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="font-semibold text-white mb-4">Today&apos;s Prayers</h2>
        <div className="space-y-2">
          {prayerNames.map(name => {
            const prayer = prayers.find(p => p.name === name)
            if (!prayer) return (
              <div key={name} className="flex items-center gap-4 p-4 bg-slate-800/30 rounded-xl border border-slate-800">
                <span className="text-2xl">{PRAYER_INFO[name].emoji}</span>
                <div className="flex-1">
                  <p className="font-medium text-slate-400">{name}</p>
                  <p className="text-xs text-slate-600">Time not loaded — check settings</p>
                </div>
              </div>
            )

            const isCompleted = prayer.status === 'on_time' || prayer.status === 'late'
            const isMissed = prayer.status === 'missed'

            return (
              <button
                key={name}
                onClick={() => handlePrayer(prayer)}
                disabled={isMissed}
                className={cn(
                  'w-full flex items-center gap-4 p-4 rounded-xl border transition-all text-left',
                  isCompleted ? 'bg-green-500/10 border-green-500/30' :
                  isMissed ? 'bg-red-500/10 border-red-500/20' :
                  'bg-slate-800 border-slate-700 hover:border-green-500/40 hover:bg-slate-700 active:scale-[0.98]'
                )}
              >
                <span className="text-2xl">{PRAYER_INFO[name].emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-white">{name}</p>
                    <span className="text-xs text-slate-500">{PRAYER_INFO[name].desc}</span>
                  </div>
                  <p className="text-sm text-slate-400 mt-0.5">
                    {formatTime(prayer.scheduled_time.slice(0, 5))}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {isCompleted ? (
                    <>
                      <CheckCircle size={20} className={prayer.status === 'on_time' ? 'text-green-400' : 'text-yellow-400'} />
                      <span className="text-[10px] text-slate-500">+{prayer.xp_earned} XP</span>
                    </>
                  ) : isMissed ? (
                    <XCircle size={20} className="text-red-400" />
                  ) : (
                    <>
                      <Clock size={20} className="text-slate-500" />
                      <span className="text-[10px] text-slate-600">Tap to mark</span>
                    </>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Qibla */}
      {qibla !== null && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
            <Navigation size={16} className="text-green-400" /> Qibla Direction
          </h2>
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20">
              <div className="w-20 h-20 rounded-full border-2 border-slate-700 flex items-center justify-center">
                <div
                  className="w-1 h-8 bg-green-400 rounded-full origin-bottom"
                  style={{ transform: `rotate(${qibla}deg)`, transformOrigin: 'bottom center' }}
                />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{Math.round(qibla)}°</p>
              <p className="text-sm text-slate-400">from North</p>
              {profile?.city && <p className="text-xs text-slate-500 mt-1">From {profile.city}</p>}
            </div>
          </div>
        </div>
      )}

      {/* 30-day heatmap */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="font-semibold text-white mb-4">30-Day Consistency</h2>
        <div className="flex flex-wrap gap-1">
          {heatmapDays.map(day => (
            <div
              key={day.date}
              title={`${day.date}: ${day.completed}/5 prayers`}
              className={cn(
                'w-5 h-5 rounded-sm transition-colors',
                day.completed === 5 ? 'bg-green-500' :
                day.completed >= 3 ? 'bg-green-700' :
                day.completed >= 1 ? 'bg-green-900' :
                day.isFuture ? 'bg-slate-800' : 'bg-red-950'
              )}
            />
          ))}
        </div>
        <div className="flex items-center gap-3 mt-3">
          <span className="text-xs text-slate-500">Less</span>
          {['bg-slate-800', 'bg-green-900', 'bg-green-700', 'bg-green-500'].map(c => (
            <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
          ))}
          <span className="text-xs text-slate-500">More</span>
        </div>
      </div>
    </div>
  )
}

function buildHeatmap(history: Prayer[]) {
  const today = new Date()
  const days = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]
    const dayPrayers = history.filter(p => p.date === dateStr)
    const completed = dayPrayers.filter(p => p.status !== 'pending' && p.status !== 'missed').length
    days.push({ date: dateStr, completed, isFuture: d > today })
  }
  return days
}
