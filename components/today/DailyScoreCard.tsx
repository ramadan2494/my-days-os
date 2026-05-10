'use client'

import { DailyScore, Profile } from '@/lib/supabase/types'
import { getLevelTitle, getXPForLevel } from '@/lib/utils'
import { Target, Star, Zap, TrendingUp } from 'lucide-react'

interface DailyScoreCardProps {
  score: DailyScore | null
  profile: Profile | null
}

const SCORE_SEGMENTS = [
  { key: 'prayer_score', label: 'Prayer', color: 'bg-green-500', max: 30 },
  { key: 'work_score', label: 'Work', color: 'bg-blue-500', max: 30 },
  { key: 'learning_score', label: 'Learning', color: 'bg-purple-500', max: 25 },
  { key: 'family_score', label: 'Family', color: 'bg-orange-500', max: 15 },
]

export default function DailyScoreCard({ score, profile }: DailyScoreCardProps) {
  const totalScore = score?.total_score ?? 0
  const scoreColor =
    totalScore >= 80 ? 'text-green-400' :
    totalScore >= 60 ? 'text-yellow-400' :
    totalScore >= 40 ? 'text-orange-400' : 'text-red-400'

  const scoreLabel =
    totalScore >= 90 ? 'Outstanding' :
    totalScore >= 75 ? 'Strong day' :
    totalScore >= 50 ? 'Making progress' :
    totalScore > 0 ? 'Keep going' : 'Day just started'

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-semibold text-white flex items-center gap-2 mb-1">
            <Target size={16} className="text-blue-400" />
            Daily Score
          </h2>
          <p className="text-xs text-slate-500">{scoreLabel}</p>
        </div>
        <div className="text-right">
          <div className={`text-4xl font-bold ${scoreColor}`}>{totalScore}</div>
          <div className="text-xs text-slate-500">/ 100</div>
        </div>
      </div>

      {/* Score breakdown bars */}
      <div className="mt-4 space-y-2">
        {SCORE_SEGMENTS.map(({ key, label, color, max }) => {
          const val = score ? (score as any)[key] ?? 0 : 0
          const pct = (val / max) * 100
          return (
            <div key={key} className="flex items-center gap-3">
              <span className="text-xs text-slate-400 w-14">{label}</span>
              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${color} rounded-full transition-all duration-700`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 w-8 text-right">{val}/{max}</span>
            </div>
          )
        })}
      </div>

      {/* Stats row */}
      <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Zap size={12} className="text-yellow-400" />
            <span className="text-sm font-semibold text-white">{profile?.xp ?? 0}</span>
          </div>
          <p className="text-[10px] text-slate-500">Total XP</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Star size={12} className="text-purple-400" />
            <span className="text-sm font-semibold text-white">Lv.{profile?.level ?? 1}</span>
          </div>
          <p className="text-[10px] text-slate-500">{getLevelTitle(profile?.level ?? 1)}</p>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <TrendingUp size={12} className="text-green-400" />
            <span className="text-sm font-semibold text-white">{score?.xp_earned ?? 0}</span>
          </div>
          <p className="text-[10px] text-slate-500">XP Today</p>
        </div>
      </div>
    </div>
  )
}
