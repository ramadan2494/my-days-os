'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Prayer, PrayerName, Profile } from '@/lib/supabase/types'
import { formatTime, getPrayerXP } from '@/lib/utils'
import { determinePrayerStatus } from '@/lib/prayer-times'
import { CheckCircle, Clock, XCircle, RefreshCw, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'
import Link from 'next/link'

const PRAYER_COLORS: Record<PrayerName, string> = {
  Fajr: 'border-indigo-500/40 bg-indigo-500/10 hover:bg-indigo-500/20',
  Dhuhr: 'border-yellow-500/40 bg-yellow-500/10 hover:bg-yellow-500/20',
  Asr: 'border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20',
  Maghrib: 'border-red-500/40 bg-red-500/10 hover:bg-red-500/20',
  Isha: 'border-blue-500/40 bg-blue-500/10 hover:bg-blue-500/20',
}

const PRAYER_ICONS: Record<PrayerName, string> = {
  Fajr: '🌙', Dhuhr: '☀️', Asr: '🌤️', Maghrib: '🌅', Isha: '✨',
}

const PRAYER_NAMES: PrayerName[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

interface PrayerStripProps {
  prayers: Prayer[]
  userId: string
  date: string
  profile: Profile | null
}

export default function PrayerStrip({ prayers: initialPrayers, userId, date, profile }: PrayerStripProps) {
  const [prayers, setPrayers] = useState<Prayer[]>(initialPrayers)
  const [syncing, setSyncing] = useState(false)
  const supabase = createClient()

  const hasLocation = !!(profile?.location_lat && profile?.location_lng)

  const syncPrayers = useCallback(async (silent = false) => {
    if (!hasLocation) return
    setSyncing(true)
    try {
      const res = await fetch('/api/prayers/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      })
      if (!res.ok) {
        const err = await res.json()
        if (!silent) toast.error(err.error ?? 'Sync failed')
        return
      }
      const { data } = await supabase
        .from('prayers')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .order('scheduled_time')
      if (data) setPrayers(data)
      if (!silent) toast.success('Prayer times synced!')
    } catch {
      if (!silent) toast.error('Network error')
    } finally {
      setSyncing(false)
    }
  }, [date, hasLocation, userId, supabase])

  // Auto-sync on mount if no prayers exist and location is set
  useEffect(() => {
    if (initialPrayers.length === 0 && hasLocation) {
      syncPrayers(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

    await supabase.rpc('increment_xp', { user_id: userId, amount: xp }).then(() => null, () => null)

    setPrayers(prev => prev.map(p => p.id === prayer.id ? data : p))
    toast.success(
      status === 'on_time'
        ? `✅ ${prayer.name} — On Time! +${xp} XP`
        : `✅ ${prayer.name} — Recorded (+${xp} XP)`
    )
  }

  const completedCount = prayers.filter(p => p.status !== 'pending').length
  const onTimeCount = prayers.filter(p => p.status === 'on_time').length

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <span className="text-green-400">🕌</span> Prayer Tracker
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">
            {prayers.length > 0 ? `${completedCount}/5 · ${onTimeCount} on time` : 'No times set'}
          </span>
          {hasLocation && (
            <button
              onClick={() => syncPrayers(false)}
              disabled={syncing}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors disabled:opacity-50"
              title="Sync prayer times"
            >
              <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing…' : 'Sync'}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-800 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
          style={{ width: prayers.length > 0 ? `${(completedCount / 5) * 100}%` : '0%' }}
        />
      </div>

      {/* No location banner */}
      {!hasLocation && (
        <div className="flex items-center gap-3 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl mb-4">
          <MapPin size={16} className="text-amber-400 flex-shrink-0" />
          <p className="text-sm text-amber-300">
            Set your location in{' '}
            <Link href="/settings" className="underline hover:text-amber-100">Settings</Link>
            {' '}to sync prayer times.
          </p>
        </div>
      )}

      {/* Syncing skeleton */}
      {syncing && prayers.length === 0 && (
        <div className="grid grid-cols-5 gap-2">
          {PRAYER_NAMES.map(name => (
            <div key={name} className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-slate-700 bg-slate-800/50 animate-pulse">
              <span className="text-lg opacity-40">{PRAYER_ICONS[name]}</span>
              <span className="text-[10px] font-medium text-slate-600">{name}</span>
              <div className="h-2 w-10 bg-slate-700 rounded mt-1" />
            </div>
          ))}
        </div>
      )}

      {/* Prayer cards */}
      {(!syncing || prayers.length > 0) && (
        <div className="grid grid-cols-5 gap-2">
          {PRAYER_NAMES.map(name => {
            const prayer = prayers.find(p => p.name === name)
            const status = prayer?.status ?? 'no_data'
            const isCompleted = status === 'on_time' || status === 'late'
            const isMissed = status === 'missed'
            const isPending = status === 'pending'

            return (
              <button
                key={name}
                onClick={() => prayer && isPending && handleCheckPrayer(prayer)}
                disabled={isCompleted || isMissed || !prayer}
                title={
                  !prayer ? 'Prayer not synced yet' :
                  isCompleted ? `${name} completed ✓` :
                  isMissed ? `${name} missed` :
                  `Tap to mark ${name} as prayed`
                }
                className={cn(
                  'flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all duration-200',
                  isCompleted
                    ? 'border-green-500/30 bg-green-500/10'
                    : isMissed
                    ? 'border-red-500/30 bg-red-500/10'
                    : prayer
                    ? `${PRAYER_COLORS[name]} cursor-pointer hover:scale-105 active:scale-95`
                    : 'border-slate-700 bg-slate-800/30 opacity-40 cursor-default'
                )}
              >
                <span className="text-lg">{PRAYER_ICONS[name]}</span>
                <span className={cn(
                  'text-[10px] font-semibold',
                  isCompleted ? 'text-green-400' :
                  isMissed ? 'text-red-400' :
                  prayer ? 'text-slate-200' : 'text-slate-600'
                )}>
                  {name}
                </span>
                {prayer ? (
                  <span className="text-[9px] text-slate-500">
                    {formatTime(prayer.scheduled_time.slice(0, 5))}
                  </span>
                ) : (
                  <span className="text-[9px] text-slate-600">--:--</span>
                )}
                <div className="mt-0.5">
                  {isCompleted ? (
                    <CheckCircle size={14} className={status === 'on_time' ? 'text-green-400' : 'text-yellow-400'} />
                  ) : isMissed ? (
                    <XCircle size={14} className="text-red-400" />
                  ) : prayer ? (
                    <Clock size={14} className="text-slate-400" />
                  ) : (
                    <span className="text-[10px] text-slate-600">—</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* XP summary */}
      {onTimeCount > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-800 flex items-center gap-2">
          <span className="text-xs text-slate-500">{onTimeCount} on-time ·</span>
          <span className="text-xs text-yellow-400 font-medium">+{onTimeCount * 30} XP earned today</span>
        </div>
      )}
    </div>
  )
}
