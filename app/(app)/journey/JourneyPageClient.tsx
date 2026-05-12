'use client'

import { Profile, Badge } from '@/lib/supabase/types'
import { getLevelTitle } from '@/lib/utils'
import { ALL_BADGES } from '@/lib/badges'
import { cn } from '@/lib/utils'
import { Zap, Flame, Moon, Lock } from 'lucide-react'

interface Props {
  profile: Profile | null
  badges: Badge[]
}

const LEVEL_ICONS: Record<number, string> = {
  1: '🌱',
  2: '📖',
  3: '🔍',
  4: '⚡',
  5: '📚',
  6: '🧠',
  7: '🎯',
  8: '🔥',
  9: '🌟',
  10: '👑',
}

const LEVEL_COLORS: Record<number, { from: string; to: string; glow: string }> = {
  1:  { from: '#64748b', to: '#94a3b8', glow: 'shadow-slate-500/40' },
  2:  { from: '#059669', to: '#34d399', glow: 'shadow-emerald-500/40' },
  3:  { from: '#0891b2', to: '#22d3ee', glow: 'shadow-cyan-500/40' },
  4:  { from: '#7c3aed', to: '#a78bfa', glow: 'shadow-violet-500/40' },
  5:  { from: '#d97706', to: '#fbbf24', glow: 'shadow-amber-500/40' },
  6:  { from: '#0284c7', to: '#38bdf8', glow: 'shadow-sky-500/40' },
  7:  { from: '#be185d', to: '#f472b6', glow: 'shadow-pink-500/40' },
  8:  { from: '#b45309', to: '#f97316', glow: 'shadow-orange-500/40' },
  9:  { from: '#eab308', to: '#fde047', glow: 'shadow-yellow-400/40' },
  10: { from: '#dc2626', to: '#fbbf24', glow: 'shadow-red-500/40' },
}

const MAX_DISPLAY_LEVEL = 10

export default function JourneyPageClient({ profile, badges }: Props) {
  const level = profile?.level ?? 1
  const xp = profile?.xp ?? 0
  const xpInLevel = xp % 500
  const xpProgress = (xpInLevel / 500) * 100
  const badgeKeys = new Set(badges.map((b) => b.badge_key))

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Journey</h1>
        <p className="text-slate-400 text-sm mt-0.5">Your path to mastery</p>
      </div>

      {/* Current level hero card */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 border border-slate-700"
        style={{
          background: `linear-gradient(135deg, ${LEVEL_COLORS[Math.min(level, 10)].from}22, ${LEVEL_COLORS[Math.min(level, 10)].to}11)`,
        }}
      >
        {/* Glow blob */}
        <div
          className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: LEVEL_COLORS[Math.min(level, 10)].from }}
        />

        <div className="flex items-center gap-5">
          {/* Avatar circle */}
          <div
            className={cn('w-20 h-20 rounded-2xl flex items-center justify-center text-4xl flex-shrink-0 shadow-xl', LEVEL_COLORS[Math.min(level, 10)].glow)}
            style={{
              background: `linear-gradient(135deg, ${LEVEL_COLORS[Math.min(level, 10)].from}, ${LEVEL_COLORS[Math.min(level, 10)].to})`,
            }}
          >
            {LEVEL_ICONS[Math.min(level, 10)] ?? '👑'}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                Level {level}
              </span>
            </div>
            <p className="text-xl font-bold text-white">{getLevelTitle(level)}</p>
            <p className="text-white/50 text-sm">{xp.toLocaleString()} total XP</p>
          </div>
        </div>

        {/* XP bar */}
        <div className="mt-5">
          <div className="flex justify-between text-xs text-white/50 mb-1.5">
            <span>{xpInLevel} / 500 XP</span>
            <span>{500 - xpInLevel} to Level {level + 1}</span>
          </div>
          <div className="h-3 bg-black/30 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${xpProgress}%`,
                background: `linear-gradient(90deg, ${LEVEL_COLORS[Math.min(level, 10)].from}, ${LEVEL_COLORS[Math.min(level, 10)].to})`,
              }}
            />
          </div>
        </div>

        {/* Streaks */}
        <div className="flex gap-3 mt-4">
          <div className="flex items-center gap-1.5 bg-black/20 rounded-xl px-3 py-2">
            <Flame size={14} className="text-orange-400" />
            <span className="text-white text-sm font-semibold">{profile?.daily_streak ?? 0}</span>
            <span className="text-white/40 text-xs">day streak</span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/20 rounded-xl px-3 py-2">
            <Moon size={14} className="text-green-400" />
            <span className="text-white text-sm font-semibold">{profile?.prayer_streak ?? 0}</span>
            <span className="text-white/40 text-xs">prayer streak</span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/20 rounded-xl px-3 py-2">
            <Zap size={14} className="text-yellow-400" />
            <span className="text-white text-sm font-semibold">{xp.toLocaleString()}</span>
            <span className="text-white/40 text-xs">XP</span>
          </div>
        </div>
      </div>

      {/* Level Road */}
      <div>
        <h2 className="font-semibold text-white mb-4">Level Road</h2>
        <div className="relative">
          {/* Vertical spine line */}
          <div className="absolute left-10 top-0 bottom-0 w-0.5 bg-slate-800 rounded-full" />

          <div className="space-y-1">
            {Array.from({ length: MAX_DISPLAY_LEVEL }, (_, i) => i + 1).map((lvl) => {
              const isCompleted = lvl < level
              const isCurrent = lvl === level
              const isLocked = lvl > level
              const colors = LEVEL_COLORS[lvl]
              const title = getLevelTitle(lvl)
              const icon = LEVEL_ICONS[lvl] ?? '🏆'
              const xpRequired = (lvl - 1) * 500

              return (
                <div key={lvl} className="relative flex items-start gap-4 pl-3">
                  {/* Node on spine */}
                  <div className="relative z-10 flex-shrink-0 mt-3">
                    <div
                      className={cn(
                        'w-14 h-14 rounded-xl flex items-center justify-center text-2xl transition-all duration-300',
                        isCurrent && `shadow-lg ${colors.glow}`,
                        isLocked && 'opacity-30 grayscale',
                      )}
                      style={
                        !isLocked
                          ? { background: `linear-gradient(135deg, ${colors.from}, ${colors.to})` }
                          : { background: '#1e293b', border: '1px solid #334155' }
                      }
                    >
                      {isLocked ? <Lock size={18} className="text-slate-500" /> : icon}
                    </div>
                    {isCurrent && (
                      <div
                        className="absolute -inset-1 rounded-xl animate-pulse opacity-40 -z-10"
                        style={{ background: `linear-gradient(135deg, ${colors.from}, ${colors.to})` }}
                      />
                    )}
                  </div>

                  {/* Content */}
                  <div
                    className={cn(
                      'flex-1 rounded-xl p-4 mb-2 border transition-all',
                      isCurrent
                        ? 'border-white/10 bg-white/5'
                        : isCompleted
                        ? 'border-slate-800 bg-slate-900/50'
                        : 'border-slate-800/50 bg-slate-900/20 opacity-40',
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={cn('font-semibold', isCurrent ? 'text-white' : isCompleted ? 'text-slate-300' : 'text-slate-500')}>
                          {title}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Level {lvl} · {xpRequired.toLocaleString()} XP required
                        </p>
                      </div>
                      {isCompleted && (
                        <span className="text-green-400 text-xl">✓</span>
                      )}
                      {isCurrent && (
                        <span
                          className="text-xs font-semibold px-2 py-1 rounded-full"
                          style={{ background: `${colors.from}33`, color: colors.to }}
                        >
                          Current
                        </span>
                      )}
                    </div>

                    {isCurrent && (
                      <div className="mt-3">
                        <div className="h-1.5 bg-black/30 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${xpProgress}%`,
                              background: `linear-gradient(90deg, ${colors.from}, ${colors.to})`,
                            }}
                          />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">{xpInLevel} / 500 XP</p>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}

            {/* "And beyond..." node */}
            <div className="relative flex items-center gap-4 pl-3">
              <div className="z-10 flex-shrink-0">
                <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl bg-gradient-to-br from-yellow-500 to-orange-500 opacity-30">
                  ∞
                </div>
              </div>
              <p className="text-slate-600 text-sm italic">More levels await beyond Level 10…</p>
            </div>
          </div>
        </div>
      </div>

      {/* Badges section */}
      <div>
        <h2 className="font-semibold text-white mb-4">
          Badges{' '}
          <span className="text-slate-500 font-normal text-sm">
            {badges.length}/{ALL_BADGES.length}
          </span>
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {ALL_BADGES.map((def) => {
            const earned = badgeKeys.has(def.key)
            const earnedBadge = badges.find((b) => b.badge_key === def.key)
            const tierColors = {
              bronze:   { bg: '#78350f22', border: '#78350f', text: '#d97706' },
              silver:   { bg: '#1e293b', border: '#475569', text: '#94a3b8' },
              gold:     { bg: '#45270022', border: '#d97706', text: '#fbbf24' },
              platinum: { bg: '#1e103022', border: '#7c3aed', text: '#a78bfa' },
            }[def.tier]

            return (
              <div
                key={def.key}
                className={cn(
                  'rounded-xl p-3 border transition-all flex items-center gap-3',
                  earned ? '' : 'opacity-30 grayscale',
                )}
                style={
                  earned
                    ? { background: tierColors.bg, borderColor: tierColors.border }
                    : { background: '#0f172a', borderColor: '#1e293b' }
                }
              >
                <span className="text-2xl flex-shrink-0">{def.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{def.name}</p>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5 line-clamp-2">
                    {def.description}
                  </p>
                  {earned && earnedBadge && (
                    <p className="text-[10px] mt-1" style={{ color: tierColors.text }}>
                      {new Date(earnedBadge.earned_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                  {!earned && (
                    <p className="text-[10px] text-slate-600 mt-0.5">Locked</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
