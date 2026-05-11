'use client'

import { Profile, Badge, DailyItem, Category } from '@/lib/supabase/types'
import { getLevelTitle } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Zap, Flame, Moon } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'

interface XpLogEntry {
  xp_amount: number
  earned_at: string
}

interface Props {
  profile: Profile | null
  badges: Badge[]
  xpLog: XpLogEntry[]
  dailyItems: (DailyItem & { categories?: Category })[]
  dateRange: { start: string; end: string }
}

const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

export default function StatsPageClient({
  profile,
  badges,
  xpLog,
  dailyItems,
  dateRange,
}: Props) {
  const level = profile?.level ?? 1
  const xp = profile?.xp ?? 0
  const xpInLevel = xp % 500
  const xpProgress = (xpInLevel / 500) * 100

  const todayStr = new Date().toISOString().split('T')[0]

  // Build 7-day array
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(dateRange.start + 'T12:00:00')
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  // XP per day
  const xpByDay = days.map((day) => {
    const total = xpLog
      .filter((e) => e.earned_at.startsWith(day))
      .reduce((sum, e) => sum + e.xp_amount, 0)
    return {
      day: new Date(day + 'T12:00:00').toLocaleDateString('en', { weekday: 'short' }),
      xp: total,
      date: day,
    }
  })

  // Category breakdown
  const catMap = new Map<
    string,
    { name: string; color: string; icon: string; done: number; total: number }
  >()
  dailyItems.forEach((item) => {
    const cat = item.categories as Category | undefined
    if (!cat) return
    if (!catMap.has(cat.id)) {
      catMap.set(cat.id, { name: cat.name, color: cat.color, icon: cat.icon, done: 0, total: 0 })
    }
    const entry = catMap.get(cat.id)!
    entry.total++
    if (item.status === 'done') entry.done++
  })
  const categories = Array.from(catMap.values()).sort((a, b) => b.total - a.total)

  // Prayer grid: 5 prayers × 7 days
  const prayerItems = dailyItems.filter(
    (it) => (it.categories as Category)?.name === 'Prayers',
  )
  const prayerGrid = PRAYER_NAMES.map((name) => ({
    name,
    days: days.map((day) => {
      const item = prayerItems.find(
        (it) => it.title === name && it.scheduled_date === day,
      )
      return { day, status: item?.status ?? null, xpEarned: item?.xp_earned ?? 0 }
    }),
  }))

  const weekXpTotal = xpByDay.reduce((s, d) => s + d.xp, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Stats</h1>
        <p className="text-slate-400 text-sm mt-0.5">Your last 7 days at a glance</p>
      </div>

      {/* Hero: Level + XP + Streaks */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg flex-shrink-0">
            {level}
          </div>
          <div>
            <p className="text-white font-bold text-xl">{getLevelTitle(level)}</p>
            <p className="text-slate-400 text-sm">
              Level {level} · {xp.toLocaleString()} XP total
            </p>
          </div>
        </div>

        <div className="h-3 bg-slate-800 rounded-full overflow-hidden mb-1.5">
          <div
            className="h-full rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 transition-all duration-700"
            style={{ width: `${xpProgress}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500 mb-5">
          <span>{xpInLevel} / 500 XP</span>
          <span>{500 - xpInLevel} to Level {level + 1}</span>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-800 rounded-xl p-3 text-center">
            <Flame size={18} className="text-orange-400 mx-auto mb-1" />
            <p className="text-white font-bold text-lg">{profile?.daily_streak ?? 0}</p>
            <p className="text-slate-500 text-xs">Day Streak</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-3 text-center">
            <Moon size={18} className="text-green-400 mx-auto mb-1" />
            <p className="text-white font-bold text-lg">{profile?.prayer_streak ?? 0}</p>
            <p className="text-slate-500 text-xs">Prayer Streak</p>
          </div>
          <div className="bg-slate-800 rounded-xl p-3 text-center">
            <Zap size={18} className="text-yellow-400 mx-auto mb-1" />
            <p className="text-white font-bold text-lg">{weekXpTotal}</p>
            <p className="text-slate-500 text-xs">XP This Week</p>
          </div>
        </div>
      </div>

      {/* Weekly XP Bar Chart */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="font-semibold text-white mb-4">Weekly XP</h2>
        <ResponsiveContainer width="100%" height={150}>
          <BarChart data={xpByDay} barCategoryGap="25%">
            <XAxis
              dataKey="day"
              tick={{ fill: '#64748b', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              contentStyle={{
                background: '#1e293b',
                border: '1px solid #334155',
                borderRadius: 8,
                color: '#fff',
                fontSize: 12,
              }}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            />
            <Bar dataKey="xp" radius={[4, 4, 0, 0]}>
              {xpByDay.map((entry) => (
                <Cell
                  key={entry.date}
                  fill={entry.date === todayStr ? '#eab308' : '#3b82f6'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Category Breakdown */}
      {categories.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="font-semibold text-white mb-4">Category Breakdown</h2>
          <div className="space-y-3">
            {categories.map((cat) => (
              <div key={cat.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm text-slate-300">
                    {cat.icon} {cat.name}
                  </span>
                  <span className="text-xs text-slate-500">
                    {cat.done}/{cat.total}
                  </span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${cat.total > 0 ? (cat.done / cat.total) * 100 : 0}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Prayer Grid 5×7 */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="font-semibold text-white mb-4">Prayer Grid</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[320px]">
            <thead>
              <tr>
                <th className="text-left text-slate-500 font-normal pb-2 w-16">Prayer</th>
                {days.map((day) => (
                  <th key={day} className="text-center text-slate-500 font-normal pb-2 px-1">
                    {new Date(day + 'T12:00:00').toLocaleDateString('en', {
                      weekday: 'short',
                    })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prayerGrid.map((row) => (
                <tr key={row.name}>
                  <td className="text-slate-400 py-1 pr-2">{row.name}</td>
                  {row.days.map((cell) => (
                    <td key={cell.day} className="text-center py-1 px-1">
                      <div
                        className={cn(
                          'w-6 h-6 rounded-md mx-auto',
                          cell.status === null && 'bg-slate-800',
                          cell.status === 'pending' && 'bg-slate-700',
                          cell.status === 'done' && cell.xpEarned === 20 && 'bg-green-500',
                          cell.status === 'done' && cell.xpEarned === 8 && 'bg-yellow-500',
                          cell.status === 'skipped' && 'bg-red-800',
                        )}
                        title={cell.status ?? 'no data'}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex items-center gap-4 mt-3 text-xs text-slate-500 flex-wrap">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-green-500 inline-block" /> On Time
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-yellow-500 inline-block" /> Late
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-red-800 inline-block" /> Skipped
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-slate-700 inline-block" /> Pending
            </span>
          </div>
        </div>
      </div>

      {/* Badges Wall */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="font-semibold text-white mb-4">
          Badges{' '}
          <span className="text-slate-500 font-normal text-sm">({badges.length})</span>
        </h2>
        {badges.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">
            Complete tasks and prayers to earn badges!
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {badges.map((badge) => (
              <div
                key={badge.id}
                className="bg-slate-800 rounded-xl p-3 flex items-center gap-3"
              >
                <span className="text-2xl flex-shrink-0">
                  {badge.badge_icon ?? '🏆'}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {badge.badge_name}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {new Date(badge.earned_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
