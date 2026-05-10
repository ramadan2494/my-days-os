'use client'

import { Profile, Badge, DailyScore } from '@/lib/supabase/types'
import { getXPForLevel, getLevelTitle, BADGE_DEFINITIONS } from '@/lib/utils'
import { BarChart2, Zap, Flame, Shield, Star } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface ProfilePageClientProps {
  profile: Profile | null
  badges: Badge[]
  dailyScores: DailyScore[]
}

export default function ProfilePageClient({ profile, badges, dailyScores }: ProfilePageClientProps) {
  if (!profile) return null

  const level = profile.level ?? 1
  const xp = profile.xp ?? 0
  const xpForLevel = getXPForLevel(level)
  const xpForNext = getXPForLevel(level + 1)
  const xpProgress = xpForNext > xpForLevel ? ((xp - xpForLevel) / (xpForNext - xpForLevel)) * 100 : 100
  const levelTitle = getLevelTitle(level)

  const earnedBadgeIds = new Set(badges.map(b => b.badge_key ?? b.badge_id))
  const allBadgeDefs = BADGE_DEFINITIONS()

  const chartData = dailyScores.slice(-14).map(s => ({
    date: s.date?.slice(5) ?? '',
    score: s.total_score ?? 0,
    prayer: s.prayer_score ?? 0,
    work: s.work_score ?? 0,
    learning: s.learning_score ?? 0,
  }))

  const stats = [
    { label: 'Daily Streak', value: `${profile.streak_days ?? profile.daily_streak ?? 0}d`, icon: Flame, color: 'text-orange-400' },
    { label: 'Total XP', value: (xp).toLocaleString(), icon: Zap, color: 'text-yellow-400' },
    { label: 'Level', value: level, icon: Star, color: 'text-purple-400' },
    { label: 'Badges', value: badges.length, icon: Shield, color: 'text-blue-400' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Profile & Stats</h1>
        <p className="text-slate-400 text-sm mt-0.5">Your journey at a glance</p>
      </div>

      {/* Player card */}
      <div className="bg-gradient-to-br from-purple-900/40 to-slate-900 border border-purple-500/20 rounded-2xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-purple-600 flex items-center justify-center text-2xl font-bold text-white">
            {profile.full_name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white">{profile.full_name}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-purple-400">Level {level}</span>
              <span className="text-slate-600">·</span>
              <span className="text-sm text-slate-400">{levelTitle}</span>
            </div>
          </div>
        </div>
        <div className="mt-5">
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>{xp.toLocaleString()} XP</span>
            <span>Next: {xpForNext.toLocaleString()} XP</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-purple-600 to-blue-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, xpProgress)}%` }} />
          </div>
          <p className="text-xs text-slate-500 mt-1.5 text-right">
            {Math.max(0, xpForNext - xp).toLocaleString()} XP to Level {level + 1}
          </p>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
            <Icon size={18} className={`${color} mx-auto mb-1.5`} />
            <div className={`text-xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* XP Bar chart */}
      {chartData.length > 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
            <BarChart2 size={16} className="text-purple-400" /> Daily Scores (last 14 days)
          </h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barSize={8} barGap={2}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#64748b' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#64748b' }} />
              <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: 11 }} />
              <Bar dataKey="prayer" stackId="a" fill="#34d399" name="Prayer" />
              <Bar dataKey="work" stackId="a" fill="#60a5fa" name="Work" />
              <Bar dataKey="learning" stackId="a" fill="#a78bfa" name="Learning" />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-3 justify-center">
            {[['Prayer', '#34d399'], ['Work', '#60a5fa'], ['Learning', '#a78bfa']].map(([label, color]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm" style={{ background: color }} />
                <span className="text-xs text-slate-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Badges */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Shield size={16} className="text-blue-400" /> Badges
          <span className="text-xs text-slate-500">({badges.length}/{allBadgeDefs.length} earned)</span>
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
          {allBadgeDefs.map(def => {
            const earned = earnedBadgeIds.has(def.key)
            return (
              <div key={def.key} className={`rounded-xl p-3 text-center border transition-all ${
                earned ? 'border-yellow-500/30 bg-yellow-500/5' : 'border-slate-800 bg-slate-800/40 opacity-40'
              }`}>
                <div className="text-2xl mb-1.5">{earned ? def.icon : '🔒'}</div>
                <div className="text-[11px] font-medium text-white leading-tight">{def.name}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">{def.description}</div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
