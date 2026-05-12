'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Profile, DailyItem, Category, DailyItemStatus } from '@/lib/supabase/types'
import { getLevelTitle } from '@/lib/utils'
import { cn } from '@/lib/utils'
import {
  ChevronLeft,
  ChevronRight,
  Zap,
  CheckCircle,
  Circle,
  SkipForward,
  Clock,
  RotateCcw,
  RefreshCw,
  Link2,
  Timer,
  Plus,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Play,
  StopCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'

const PRAYER_ORDER = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

const PRAYER_ICONS: Record<string, string> = {
  Fajr: '🌙',
  Dhuhr: '☀️',
  Asr: '🌤️',
  Maghrib: '🌅',
  Isha: '✨',
}

const PRAYER_COLORS: Record<string, string> = {
  Fajr: 'border-indigo-500/30 bg-indigo-500/5',
  Dhuhr: 'border-yellow-500/30 bg-yellow-500/5',
  Asr: 'border-orange-500/30 bg-orange-500/5',
  Maghrib: 'border-red-500/30 bg-red-500/5',
  Isha: 'border-blue-500/30 bg-blue-500/5',
}

interface XPFloat {
  id: number
  amount: number
}

interface Props {
  userId: string
  profile: Profile | null
  initialItems: (DailyItem & { categories?: Category })[]
  date: string
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 5) return 'Good night'
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  if (hour < 21) return 'Good evening'
  return 'Good night'
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function getLocalDateStr(d = new Date()) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-')
}

// Saturday of the week that contains `from` (week starts Sunday)
function getWeekEnd(from = new Date()) {
  const d = new Date(from)
  const daysUntilSat = (6 - d.getDay() + 7) % 7
  d.setDate(d.getDate() + daysUntilSat)
  return getLocalDateStr(d)
}

function formatTimerDisplay(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatMins(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function TodayPageClient({ userId, profile, initialItems, date }: Props) {
  const [items, setItems] = useState(initialItems)
  const [xpFloats, setXpFloats] = useState<XPFloat[]>([])
  const [currentProfile, setCurrentProfile] = useState(profile)
  const router = useRouter()
  const supabase = createClient()
  const floatCounter = useRef(0)
  const seedingRef = useRef(false)
  const [activeTimerId, setActiveTimerId] = useState<string | null>(null)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const timerStartRef = useRef<number>(0)
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Compute client-side local date (server runs UTC so it may be off by ±1 day)
  const todayStr = getLocalDateStr()
  const weekEndStr = getWeekEnd()
  const isCurrentDay = date === todayStr

  // If server guessed the wrong date (UTC offset), silently re-fetch client-side — no redirect
  // When router.refresh() runs, server sends new initialItems — sync them into state
  useEffect(() => {
    setItems(initialItems)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialItems])

  // Stop timer when navigating to a different day
  useEffect(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    setActiveTimerId(null)
    setTimerSeconds(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  // Cleanup on unmount
  useEffect(() => {
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current) }
  }, [])

  const [dateReady, setDateReady] = useState(true)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (!params.has('date') && date !== todayStr) {
      // Don't redirect — just fetch the correct day's data directly
      supabase
        .from('daily_items')
        .select('*, categories(*)')
        .eq('user_id', userId)
        .eq('scheduled_date', todayStr)
        .order('created_at')
        .then(({ data }) => { if (data) setItems(data) })
      router.replace(`/?date=${todayStr}`, { scroll: false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const prayerItems = items
    .filter((it) => (it.categories as Category)?.name === 'Prayers')
    .sort((a, b) => PRAYER_ORDER.indexOf(a.title) - PRAYER_ORDER.indexOf(b.title))

  const taskItems = items.filter((it) => (it.categories as Category)?.name !== 'Prayers')

  // Seed prayers for any day within the current week if missing
  useEffect(() => {
    if (prayerItems.length === 0 && !seedingRef.current) {
      seedingRef.current = true
      fetch('/api/prayers/seed-today', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      })
        .then((r) => r.json())
        .then(async (data) => {
          if (data.created > 0) {
            const { data: newItems } = await supabase
              .from('daily_items')
              .select('*, categories(*)')
              .eq('user_id', userId)
              .eq('scheduled_date', date)
              .order('created_at')
            if (newItems) setItems(newItems)
          }
        })
        .finally(() => { seedingRef.current = false })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date])

  function prevDay() {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    router.push(`/?date=${getLocalDateStr(d)}`)
  }

  function nextDay() {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    const next = getLocalDateStr(d)
    if (next > weekEndStr) return
    router.push(`/?date=${next}`)
  }

  function startTimer(itemId: string) {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
    setActiveTimerId(itemId)
    setTimerSeconds(0)
    timerStartRef.current = Date.now()
    timerIntervalRef.current = setInterval(() => {
      setTimerSeconds(Math.floor((Date.now() - timerStartRef.current) / 1000))
    }, 1000)
  }

  async function stopTimer() {
    if (!activeTimerId) return
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null }
    const elapsed = Math.max(1, Math.round((Date.now() - timerStartRef.current) / 60000))
    const id = activeTimerId
    setActiveTimerId(null)
    setTimerSeconds(0)
    const item = items.find((it) => it.id === id)
    if (!item) return
    const newMinutes = (item.actual_minutes ?? 0) + elapsed
    const { error } = await supabase.from('daily_items').update({ actual_minutes: newMinutes }).eq('id', id)
    if (error) { toast.error('Failed to save time'); return }
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, actual_minutes: newMinutes } : it))
    toast(`⏱ +${elapsed}m tracked on "${item.title}"`, { style: { background: '#1e293b', color: '#94a3b8' } })
  }

  function spawnFloat(amount: number) {
    const id = floatCounter.current++
    setXpFloats((prev) => [...prev, { id, amount }])
    setTimeout(() => setXpFloats((prev) => prev.filter((f) => f.id !== id)), 1200)
  }

  async function awardXP(
    itemId: string,
    categoryName: string,
    isPrayer: boolean,
    prayerStatus?: string,
  ) {
    const res = await fetch('/api/award-xp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: itemId,
        category_name: categoryName,
        priority: 'medium',
        is_prayer: isPrayer,
        prayer_status: prayerStatus,
      }),
    })
    const data = await res.json()
    if (!res.ok) return

    spawnFloat(data.xp_earned)

    if (data.level_up) {
      toast.success(`🎉 Level Up! Level ${data.new_level} — ${getLevelTitle(data.new_level)}`, {
        duration: 4000,
        icon: '⚡',
        style: { background: '#7c3aed', color: '#fff', fontWeight: 'bold' },
      })
    }
    if (data.new_badges?.length > 0) {
      data.new_badges.forEach((b: { icon: string; name: string }) => {
        toast.success(`${b.icon} Badge Earned: ${b.name}!`, {
          duration: 4000,
          style: { background: '#1e40af', color: '#fff' },
        })
      })
    }

    setCurrentProfile((prev) =>
      prev ? { ...prev, xp: data.new_total_xp, level: data.new_level } : prev,
    )
  }

  async function handlePrayer(
    item: DailyItem & { categories?: Category },
    action: 'on_time' | 'late' | 'skipped' | 'undo',
  ) {
    // Undo: reset prayer back to pending and remove XP
    if (action === 'undo') {
      const xpToRemove = item.xp_earned ?? 0
      const { data, error } = await supabase
        .from('daily_items')
        .update({ status: 'pending', xp_earned: 0, completed_at: null })
        .eq('id', item.id)
        .select('*, categories(*)')
        .single()
      if (error) { toast.error('Failed to undo prayer'); return }
      setItems((prev) => prev.map((it) => (it.id === item.id ? data : it)))
      if (xpToRemove > 0) {
        const { data: profile } = await supabase.from('profiles').select('xp, level').eq('id', userId).single()
        const newXp = Math.max(0, (profile?.xp ?? 0) - xpToRemove)
        const newLevel = Math.max(1, Math.floor(newXp / 500) + 1)
        await supabase.from('profiles').update({ xp: newXp, level: newLevel, updated_at: new Date().toISOString() }).eq('id', userId)
        await supabase.from('xp_log').delete().eq('source_id', item.id)
        setCurrentProfile((prev) => prev ? { ...prev, xp: newXp, level: newLevel } : prev)
        spawnFloat(-xpToRemove)
        toast(`↩️ ${item.title} reset — -${xpToRemove} XP`, { style: { background: '#1e293b', color: '#f87171' } })
      } else {
        toast(`↩️ ${item.title} reset`, { style: { background: '#1e293b', color: '#94a3b8' } })
      }
      return
    }

    if (item.status !== 'pending') return

    const newStatus: DailyItemStatus = action === 'skipped' ? 'skipped' : 'done'
    const xpEarned = action === 'on_time' ? 20 : action === 'late' ? 8 : 0

    const { data, error } = await supabase
      .from('daily_items')
      .update({
        status: newStatus,
        xp_earned: xpEarned,
        completed_at: action !== 'skipped' ? new Date().toISOString() : null,
      })
      .eq('id', item.id)
      .select('*, categories(*)')
      .single()

    if (error) {
      toast.error('Failed to update prayer')
      return
    }
    setItems((prev) => prev.map((it) => (it.id === item.id ? data : it)))

    if (action !== 'skipped') {
      await awardXP(item.id, 'Prayers', true, action)
      toast.success(
        `${PRAYER_ICONS[item.title] ?? '🕌'} ${item.title} — ${action === 'on_time' ? '+20 XP' : '+8 XP'}`,
      )
    } else {
      toast(`${PRAYER_ICONS[item.title] ?? '🕌'} ${item.title} skipped`, {
        icon: '⏭️',
        style: { background: '#1e293b', color: '#94a3b8' },
      })
    }
  }

  async function handleToggleItem(item: DailyItem & { categories?: Category }) {
    if (item.status === 'done') {
      // Uncheck: revert to pending and subtract XP
      const xpToRemove = item.xp_earned ?? 0
      const { data, error } = await supabase
        .from('daily_items')
        .update({ status: 'pending', xp_earned: 0, completed_at: null })
        .eq('id', item.id)
        .select('*, categories(*)')
        .single()
      if (error) { toast.error('Failed to uncheck task'); return }
      setItems((prev) => prev.map((it) => (it.id === item.id ? data : it)))
      if (xpToRemove > 0) {
        // Subtract XP from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('xp, level')
          .eq('id', userId)
          .single()
        const newXp = Math.max(0, (profile?.xp ?? 0) - xpToRemove)
        const newLevel = Math.max(1, Math.floor(newXp / 500) + 1)
        await supabase
          .from('profiles')
          .update({ xp: newXp, level: newLevel, updated_at: new Date().toISOString() })
          .eq('id', userId)
        // Remove the xp_log entry for this item
        await supabase.from('xp_log').delete().eq('source_id', item.id)
        setCurrentProfile((prev) => prev ? { ...prev, xp: newXp, level: newLevel } : prev)
        spawnFloat(-xpToRemove)
        toast(`-${xpToRemove} XP removed`, {
          icon: '↩️',
          style: { background: '#1e293b', color: '#f87171' },
        })
      }
      return
    }

    // Check: mark done and award XP
    const categoryName = (item.categories as Category)?.name ?? ''
    const xpEarned = 15
    const { data, error } = await supabase
      .from('daily_items')
      .update({ status: 'done', xp_earned: xpEarned, completed_at: new Date().toISOString() })
      .eq('id', item.id)
      .select('*, categories(*)')
      .single()
    if (error) { toast.error('Failed to update task'); return }
    setItems((prev) => prev.map((it) => (it.id === item.id ? data : it)))
    await awardXP(item.id, categoryName, false)
  }

  const doneCount = items.filter((it) => it.status !== 'pending').length
  const totalCount = items.length
  const xp = currentProfile?.xp ?? 0
  const level = currentProfile?.level ?? 1

  if (!dateReady) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-slate-500 text-sm animate-pulse">Loading today…</div>
      </div>
    )
  }

  return (
    <div className="space-y-5 relative">
      {/* XP Float Animations */}
      <div className="fixed top-20 right-6 z-50 pointer-events-none flex flex-col items-end gap-1">
        {xpFloats.map((f) => (
          <div
            key={f.id}
            className="animate-float-up flex items-center gap-1 text-yellow-400 font-bold text-base drop-shadow-lg"
          >
            <Zap size={14} />+{f.amount} XP
          </div>
        ))}
      </div>

      {/* Header + Date Navigation */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isCurrentDay
              ? `${getGreeting()}, ${currentProfile?.full_name?.split(' ')[0] ?? 'Scholar'} 👋`
              : formatDate(date)}
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {isCurrentDay ? formatDate(date) : date > todayStr ? 'Upcoming day' : 'Past day view'}
          </p>
        </div>
        <div className="flex items-center gap-1.5 mt-1">
          <button
            onClick={() => router.refresh()}
            title="Sync latest changes"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={prevDay}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={nextDay}
            disabled={date >= weekEndStr}
            className={cn(
              'p-2 rounded-xl transition-colors',
              date < weekEndStr
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white'
                : 'bg-slate-900 text-slate-700 cursor-not-allowed',
            )}
          >
            <ChevronRight size={16} />
          </button>
          {date !== todayStr && (
            <button
              onClick={() => router.push('/')}
              className="text-xs text-blue-400 px-3 py-1.5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 transition-colors"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* XP Progress Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-white font-bold text-sm">
              {level}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">{getLevelTitle(level)}</p>
              <p className="text-[10px] text-slate-500">Level {level}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Zap size={14} className="text-yellow-400" />
            <span className="text-sm font-bold text-yellow-400">{xp.toLocaleString()}</span>
            <span className="text-xs text-slate-500">XP</span>
          </div>
        </div>
        <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 transition-all duration-700"
            style={{ width: `${Math.min(((xp % 500) / 500) * 100, 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-slate-600">
            🔥 {currentProfile?.daily_streak ?? 0} day streak
          </span>
          <span className="text-[10px] text-slate-600">
            {xp % 500} / 500 XP to level {level + 1}
          </span>
        </div>
      </div>

      {/* Day Progress */}
      {totalCount > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-white">Day Progress</span>
            <span className="text-sm text-slate-400">
              {doneCount} / {totalCount}
            </span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
              style={{ width: `${totalCount > 0 ? (doneCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Prayers Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="font-semibold text-white flex items-center gap-2 mb-4">
          <span>🕌</span> Prayers
          <span className="ml-auto text-xs text-slate-500 font-normal">
            {prayerItems.filter((p) => p.status !== 'pending').length}/{prayerItems.length}
          </span>
        </h2>

        {prayerItems.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-4">
            {seedingRef.current
              ? 'Setting up prayers...'
              : 'No prayers yet. Configure your location in Settings to sync prayer times.'}
          </p>
        ) : (
          <div className="space-y-2.5">
            {prayerItems.map((item) => (
              <div
                key={item.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border transition-all',
                  PRAYER_COLORS[item.title] ?? 'border-slate-700 bg-slate-800/50',
                  item.status !== 'pending' && 'opacity-70',
                )}
              >
                <span className="text-lg w-7 text-center">
                  {PRAYER_ICONS[item.title] ?? '🕌'}
                </span>
                <span
                  className={cn(
                    'flex-1 text-sm font-medium',
                    item.status !== 'pending' ? 'text-slate-400 line-through' : 'text-white',
                  )}
                >
                  {item.title}
                </span>

                {item.status === 'pending' ? (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handlePrayer(item, 'on_time')}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-white text-xs font-medium transition-colors"
                    >
                      <CheckCircle size={11} /> On Time
                    </button>
                    <button
                      onClick={() => handlePrayer(item, 'late')}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-yellow-700 hover:bg-yellow-600 text-white text-xs font-medium transition-colors"
                    >
                      <Clock size={11} /> Late
                    </button>
                    <button
                      onClick={() => handlePrayer(item, 'skipped')}
                      className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium transition-colors"
                    >
                      <SkipForward size={11} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span
                      className={cn(
                        'text-xs font-medium px-2 py-1 rounded-lg',
                        item.status === 'done' && item.xp_earned === 20 &&
                          'bg-green-500/20 text-green-400',
                        item.status === 'done' && item.xp_earned === 8 &&
                          'bg-yellow-500/20 text-yellow-400',
                        item.status === 'skipped' && 'bg-slate-700 text-slate-500',
                      )}
                    >
                      {item.status === 'skipped'
                        ? 'Skipped'
                        : item.xp_earned === 20
                          ? 'On Time ✓'
                          : 'Late ✓'}
                    </span>
                    <button
                      onClick={() => handlePrayer(item, 'undo')}
                      title="Undo"
                      className="p-1 rounded-lg bg-slate-700 hover:bg-red-900/50 text-slate-400 hover:text-red-400 transition-colors"
                    >
                      <RotateCcw size={11} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI Day Organiser — only on current day */}
      {isCurrentDay && (
        <AIDayOrganiser
          date={date}
          userId={userId}
          onAdd={(item) => setItems((prev) => [...prev, item])}
        />
      )}

      {/* Tasks — grouped by category section */}
      {taskItems.filter((it) => !it.is_bonus).length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
          <p className="text-slate-400 text-sm">No tasks for today</p>
          <a href="/week" className="text-blue-400 text-sm hover:underline mt-1 inline-block">
            Plan your week →
          </a>
        </div>
      ) : (
        <TaskSections
          items={taskItems.filter((it) => !it.is_bonus)}
          onToggle={handleToggleItem}
          activeTimerId={activeTimerId}
          timerSeconds={timerSeconds}
          onStartTimer={startTimer}
          onStopTimer={stopTimer}
        />
      )}

      {/* Bonus Tasks Section */}
      <BonusSection
        items={taskItems.filter((it) => it.is_bonus)}
        onToggle={handleToggleItem}
        userId={userId}
        date={date}
        onAdd={(item) => setItems((prev) => [...prev, item])}
        activeTimerId={activeTimerId}
        timerSeconds={timerSeconds}
        onStartTimer={startTimer}
        onStopTimer={stopTimer}
      />
    </div>
  )
}

// ─── AI Day Organiser ──────────────────────────────────────────────────────────
interface Suggestion {
  title: string
  category_id: string
  category_name: string
  category_icon: string
  reason: string
}

function AIDayOrganiser({
  date,
  userId,
  onAdd,
}: {
  date: string
  userId: string
  onAdd: (item: DailyItem & { categories?: Category }) => void
}) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [adding, setAdding] = useState<string | null>(null) // suggestion title being added
  const [addedTitles, setAddedTitles] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  async function review() {
    setLoading(true)
    setError('')
    setMessage('')
    setSuggestions([])
    setAddedTitles(new Set())
    try {
      const res = await fetch('/api/claude/day-organiser', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Something went wrong'); return }
      setMessage(data.message ?? '')
      setSuggestions(data.suggestions ?? [])
      setOpen(true)
    } catch {
      setError('Failed to reach AI. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function addSuggestion(s: Suggestion) {
    setAdding(s.title)
    try {
      const { data, error: err } = await supabase
        .from('daily_items')
        .insert({
          user_id: userId,
          category_id: s.category_id,
          title: s.title,
          scheduled_date: date,
          status: 'pending',
          is_bonus: false,
          link: null,
        })
        .select('*, categories(*)')
        .single()
      if (err) { toast.error('Failed to add task'); return }
      onAdd(data)
      setAddedTitles((prev) => new Set([...prev, s.title]))
      toast.success(`✅ Added: ${s.title}`)
    } finally {
      setAdding(null)
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      {/* Header row */}
      <div className="flex items-center gap-2 px-4 py-3">
        <Sparkles size={15} className="text-violet-400 flex-shrink-0" />
        <span className="font-semibold text-white text-sm flex-1">AI Day Review</span>
        {(message || error) && (
          <button
            onClick={() => setOpen((v) => !v)}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
          >
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
        <button
          onClick={review}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
        >
          {loading ? (
            <span className="animate-pulse">Reviewing…</span>
          ) : (
            <>
              <Sparkles size={11} /> Review Plan
            </>
          )}
        </button>
      </div>

      {/* Content */}
      {open && (message || error) && (
        <div className="border-t border-slate-800 px-4 py-4 space-y-3">
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {message && (
            <p className="text-slate-300 text-sm leading-relaxed">{message}</p>
          )}

          {suggestions.length > 0 && (
            <div className="space-y-2 pt-1">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                Suggested additions
              </p>
              {suggestions.map((s) => {
                const isAdded = addedTitles.has(s.title)
                const isAdding = adding === s.title
                return (
                  <div
                    key={s.title}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-xl border transition-all',
                      isAdded
                        ? 'border-green-500/20 bg-green-500/5 opacity-60'
                        : 'border-slate-700 bg-slate-800/50',
                    )}
                  >
                    <span className="text-lg flex-shrink-0 mt-0.5">{s.category_icon || '📌'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{s.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{s.reason}</p>
                    </div>
                    <button
                      onClick={() => !isAdded && addSuggestion(s)}
                      disabled={isAdded || isAdding}
                      className={cn(
                        'flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors',
                        isAdded
                          ? 'bg-green-500/20 text-green-400 cursor-default'
                          : 'bg-violet-600 hover:bg-violet-500 text-white',
                      )}
                    >
                      {isAdded ? '✓ Added' : isAdding ? '…' : '+ Add'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {suggestions.length === 0 && message && (
            <p className="text-xs text-slate-600 italic">No suggestions — your plan looks good!</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Category group definitions ────────────────────────────────────────────────
const TASK_SECTIONS = [
  {
    key: 'work',
    label: 'Work',
    icon: '💼',
    accent: '#3b82f6',
    match: (name: string) => name === 'Work',
  },
  {
    key: 'knowledge',
    label: 'Learning & PhD & Book',
    icon: '🎓',
    accent: '#8b5cf6',
    match: (name: string) => ['Learning', 'PhD', 'Book'].includes(name),
  },
  {
    key: 'business',
    label: 'Business',
    icon: '📈',
    accent: '#06b6d4',
    match: (name: string) => name === 'Business',
  },
  {
    key: 'family',
    label: 'Family',
    icon: '👨‍👩‍👦',
    accent: '#f97316',
    match: (name: string) => name === 'Family',
  },
  {
    key: 'softskill',
    label: 'Soft Skills',
    icon: '🧠',
    accent: '#14b8a6',
    match: (name: string) => name === 'Soft Skill',
  },
  {
    key: 'other',
    label: 'Other',
    icon: '📌',
    accent: '#64748b',
    match: (name: string) =>
      !['Work', 'Learning', 'PhD', 'Book', 'Business', 'Family', 'Soft Skill'].includes(name),
  },
]

function TaskRow({
  item,
  onToggle,
  isTimerActive,
  timerSeconds,
  onStartTimer,
  onStopTimer,
}: {
  item: DailyItem & { categories?: Category }
  onToggle: (item: DailyItem & { categories?: Category }) => void
  isTimerActive: boolean
  timerSeconds: number
  onStartTimer: () => void
  onStopTimer: () => void
}) {
  const router = useRouter()
  return (
    <div
      className={cn(
        'group/row flex items-center gap-3 p-3 bg-slate-800/60 rounded-xl transition-all',
        item.status === 'done' && 'opacity-55',
      )}
    >
      <button
        onClick={() => onToggle(item)}
        title={item.status === 'done' ? 'Click to uncheck' : 'Mark as done'}
        className={cn(
          'flex-shrink-0 transition-colors',
          item.status === 'done'
            ? 'text-green-400 hover:text-red-400'
            : 'text-slate-400 hover:text-green-400',
        )}
      >
        {item.status === 'done' ? <CheckCircle size={18} /> : <Circle size={18} />}
      </button>
      {item.link && item.status !== 'done' ? (
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 text-sm min-w-0 truncate text-white hover:text-blue-400 transition-colors flex items-center gap-1.5 group"
        >
          <span className="truncate">{item.title}</span>
          <Link2 size={12} className="flex-shrink-0 text-slate-500 group-hover:text-blue-400 transition-colors" />
        </a>
      ) : (
        <p
          className={cn(
            'flex-1 text-sm min-w-0 truncate',
            item.status === 'done' ? 'text-slate-500 line-through' : 'text-white',
          )}
        >
          {item.title}
        </p>
      )}
      {(item.actual_minutes ?? 0) > 0 && (
        <span className="text-[10px] font-mono text-slate-600 flex-shrink-0">
          {formatMins(item.actual_minutes)}
        </span>
      )}
      {item.status === 'done' && item.xp_earned > 0 && (
        <span className="text-xs text-yellow-400 font-medium flex-shrink-0">
          +{item.xp_earned} XP
        </span>
      )}
      {item.status !== 'done' && (
        isTimerActive ? (
          <div className="flex items-center gap-1 flex-shrink-0">
            <span className="text-xs font-mono text-orange-400">
              {formatTimerDisplay(timerSeconds)}
            </span>
            <button
              onClick={onStopTimer}
              title="Stop timer"
              className="p-1 rounded-lg text-orange-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <StopCircle size={14} />
            </button>
          </div>
        ) : (
          <div className="opacity-0 group-hover/row:opacity-100 flex items-center gap-0.5 flex-shrink-0">
            <button
              onClick={onStartTimer}
              title="Track time"
              className="p-1 rounded-lg text-slate-500 hover:text-orange-400 hover:bg-orange-500/10 transition-all"
            >
              <Play size={14} />
            </button>
            <button
              onClick={() =>
                router.push(`/pomodoro?task_id=${item.id}&title=${encodeURIComponent(item.title)}`)
              }
              title="Focus with Pomodoro"
              className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <Timer size={14} />
            </button>
          </div>
        )
      )}
    </div>
  )
}

function TaskSections({
  items,
  onToggle,
  activeTimerId,
  timerSeconds,
  onStartTimer,
  onStopTimer,
}: {
  items: (DailyItem & { categories?: Category })[]
  onToggle: (item: DailyItem & { categories?: Category }) => void
  activeTimerId: string | null
  timerSeconds: number
  onStartTimer: (id: string) => void
  onStopTimer: () => void
}) {
  return (
    <div className="space-y-3">
      {TASK_SECTIONS.map((section) => {
        const sectionItems = items.filter((it) =>
          section.match((it.categories as Category)?.name ?? ''),
        )
        if (sectionItems.length === 0) return null
        const done = sectionItems.filter((it) => it.status === 'done').length
        return (
          <div
            key={section.key}
            className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
            style={{ borderLeftColor: section.accent, borderLeftWidth: 3 }}
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800/60">
              <span>{section.icon}</span>
              <span className="font-semibold text-white text-sm">{section.label}</span>
              <span className="ml-auto text-xs text-slate-500">
                {done}/{sectionItems.length}
              </span>
            </div>
            <div className="p-3 space-y-2">
              {sectionItems.map((item) => (
                <TaskRow
                  key={item.id}
                  item={item}
                  onToggle={onToggle}
                  isTimerActive={activeTimerId === item.id}
                  timerSeconds={timerSeconds}
                  onStartTimer={() => onStartTimer(item.id)}
                  onStopTimer={onStopTimer}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Bonus Section ─────────────────────────────────────────────────────────────
function BonusSection({
  items,
  onToggle,
  userId,
  date,
  onAdd,
  activeTimerId,
  timerSeconds,
  onStartTimer,
  onStopTimer,
}: {
  items: (DailyItem & { categories?: Category })[]
  onToggle: (item: DailyItem & { categories?: Category }) => void
  userId: string
  date: string
  onAdd: (item: DailyItem & { categories?: Category }) => void
  activeTimerId: string | null
  timerSeconds: number
  onStartTimer: (id: string) => void
  onStopTimer: () => void
}) {
  const supabase = createClient()
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [link, setLink] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .neq('name', 'Prayers')
      .order('name')
      .then(({ data }) => {
        if (data) {
          setCategories(data)
          if (data.length > 0) setCategoryId(data[0].id)
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  async function addBonus() {
    if (!title.trim() || !categoryId) return
    setAdding(true)
    try {
      const { data, error } = await supabase
        .from('daily_items')
        .insert({
          user_id: userId,
          category_id: categoryId,
          title: title.trim(),
          scheduled_date: date,
          status: 'pending',
          is_bonus: true,
          link: link.trim() || null,
        })
        .select('*, categories(*)')
        .single()
      if (error) { toast.error('Failed to add bonus task'); return }
      onAdd(data)
      setTitle('')
      setLink('')
      setShowForm(false)
      toast.success('⭐ Bonus task added!')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="bg-slate-900 border border-yellow-500/30 rounded-2xl overflow-hidden" style={{ borderLeftColor: '#eab308', borderLeftWidth: 3 }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-800/60">
        <span>⭐</span>
        <span className="font-semibold text-yellow-400 text-sm">Bonus Tasks</span>
        <span className="text-[10px] text-slate-600 ml-1 font-normal">101%</span>
        <span className="ml-auto text-xs text-slate-500">
          {items.filter((it) => it.status === 'done').length}/{items.length}
        </span>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="p-1 rounded-lg text-slate-500 hover:text-yellow-400 hover:bg-yellow-500/10 transition-colors"
          title="Add bonus task"
        >
          {showForm ? <X size={14} /> : <Plus size={14} />}
        </button>
      </div>

      <div className="p-3 space-y-2">
        {items.length === 0 && !showForm && (
          <p className="text-slate-600 text-xs text-center py-2">
            No bonus tasks yet — add something extra ⭐
          </p>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'group/row flex items-center gap-3 p-3 bg-yellow-500/5 border border-yellow-500/10 rounded-xl transition-all',
              item.status === 'done' && 'opacity-55',
            )}
          >
            <button
              onClick={() => onToggle(item)}
              className={cn(
                'flex-shrink-0 transition-colors',
                item.status === 'done'
                  ? 'text-green-400 hover:text-red-400'
                  : 'text-yellow-500 hover:text-green-400',
              )}
            >
              {item.status === 'done' ? <CheckCircle size={18} /> : <Circle size={18} />}
            </button>
            {item.link && item.status !== 'done' ? (
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-sm text-white hover:text-blue-400 flex items-center gap-1.5 group truncate"
              >
                <span className="truncate">{item.title}</span>
                <Link2 size={12} className="flex-shrink-0 text-slate-500 group-hover:text-blue-400" />
              </a>
            ) : (
              <p className={cn('flex-1 text-sm truncate', item.status === 'done' ? 'text-slate-500 line-through' : 'text-white')}>
                {item.title}
              </p>
            )}
            <span className="text-[10px] text-yellow-500 font-bold flex-shrink-0">BONUS</span>
            {(item.actual_minutes ?? 0) > 0 && (
              <span className="text-[10px] font-mono text-slate-600 flex-shrink-0">
                {formatMins(item.actual_minutes)}
              </span>
            )}
            {item.status === 'done' && item.xp_earned > 0 && (
              <span className="text-xs text-yellow-400 font-medium flex-shrink-0">+{item.xp_earned} XP</span>
            )}
            {item.status !== 'done' && (
              activeTimerId === item.id ? (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-xs font-mono text-orange-400">
                    {formatTimerDisplay(timerSeconds)}
                  </span>
                  <button
                    onClick={onStopTimer}
                    title="Stop timer"
                    className="p-1 rounded-lg text-orange-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <StopCircle size={14} />
                  </button>
                </div>
              ) : (
                <div className="opacity-0 group-hover/row:opacity-100 flex items-center gap-0.5 flex-shrink-0">
                  <button
                    onClick={() => onStartTimer(item.id)}
                    title="Track time"
                    className="p-1 rounded-lg text-slate-500 hover:text-orange-400 hover:bg-orange-500/10 transition-all"
                  >
                    <Play size={14} />
                  </button>
                  <button
                    onClick={() => router.push(`/pomodoro?task_id=${item.id}&title=${encodeURIComponent(item.title)}`)}
                    title="Focus with Pomodoro"
                    className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Timer size={14} />
                  </button>
                </div>
              )
            )}
          </div>
        ))}

        {showForm && (
          <div className="space-y-2 pt-1 border-t border-yellow-500/10">
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addBonus(); if (e.key === 'Escape') setShowForm(false) }}
              placeholder="Bonus task title…"
              className="w-full bg-slate-800 border border-yellow-500/30 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-yellow-500"
            />
            {categories.length > 0 && (
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-yellow-500"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                ))}
              </select>
            )}
            <input
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="Link (optional)…"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-yellow-500"
            />
            <div className="flex gap-2">
              <button
                onClick={addBonus}
                disabled={adding || !title.trim() || !categoryId}
                className="flex-1 py-2.5 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-slate-900 rounded-xl text-sm font-bold transition-colors"
              >
                {adding ? '…' : '+ Add Bonus'}
              </button>
              <button
                onClick={() => { setShowForm(false); setTitle(''); setLink('') }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
