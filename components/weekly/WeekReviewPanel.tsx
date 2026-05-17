'use client'

import { useState, useEffect } from 'react'
import { X, Sparkles, ChevronRight, Clock, Target, Star, Moon } from 'lucide-react'
import { DailyItem, Category } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

interface ReviewReport {
  summary: string
  focusAreas: string[]
  motivation: string
  cached?: boolean
  cachedAt?: string
}

interface Props {
  weekStart: string
  weekEnd: string
  weekPlanId?: string
  profileName: string
  dailyItems: (DailyItem & { categories?: Category })[]
  categories: Category[]
  onClose: () => void
  onGenerateNewPlan: (focusHint: string) => void
}

function formatMins(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

export default function WeekReviewPanel({
  weekStart,
  weekEnd,
  weekPlanId,
  profileName,
  dailyItems,
  categories,
  onClose,
  onGenerateNewPlan,
}: Props) {
  const [report, setReport] = useState<ReviewReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // ── Computed stats ──────────────────────────────────────────────────────────
  const prayerItems = dailyItems.filter((it) => it.categories?.name === 'Prayers')
  const bonusItems = dailyItems.filter((it) => it.is_bonus && it.categories?.name !== 'Prayers')
  const mainItems = dailyItems.filter((it) => it.categories?.name !== 'Prayers' && !it.is_bonus)

  const doneMain = mainItems.filter((it) => it.status === 'done').length
  const totalMain = mainItems.length
  const donePrayers = prayerItems.filter((it) => it.status === 'done').length
  const totalPrayers = prayerItems.length
  const doneBonus = bonusItems.filter((it) => it.status === 'done').length
  const totalBonus = bonusItems.length
  const totalMins = dailyItems.reduce((s, it) => s + (it.actual_minutes ?? 0), 0)

  const mainPct = totalMain > 0 ? Math.round((doneMain / totalMain) * 100) : 0
  const prayerPct = totalPrayers > 0 ? Math.round((donePrayers / totalPrayers) * 100) : 0

  useEffect(() => {
    fetchReport(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function fetchReport(force = false) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/claude/week-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: dailyItems.map((it) => ({
            title: it.title,
            category_name: it.categories?.name ?? '',
            priority: 'medium',
            done: it.status === 'done',
            actual_minutes: it.actual_minutes ?? 0,
            is_bonus: it.is_bonus ?? false,
            is_prayer: it.categories?.name === 'Prayers',
          })),
          weekStart,
          weekEnd,
          profileName,
          categories: categories.map((c) => ({ name: c.name, color: c.color })),
          weekPlanId: force ? undefined : weekPlanId,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to generate review')
        return
      }
      setReport(data as ReviewReport)
    } catch {
      setError('Network error — check your connection')
    } finally {
      setLoading(false)
    }
  }

  function handleGenerateNewPlan() {
    const hint = report?.focusAreas?.length
      ? `Focus more on: ${report.focusAreas.join(', ')}`
      : ''
    onGenerateNewPlan(hint)
  }

  // ── Week label ───────────────────────────────────────────────────────────────
  const weekLabel = `${new Date(weekStart + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric' })} – ${new Date(weekEnd + 'T12:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}`

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Sparkles size={18} className="text-purple-400" />
              Week Review
            </h2>
            <p className="text-slate-400 text-xs mt-0.5">{weekLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            {report?.cached && (
              <button
                onClick={() => { setReport(null); fetchReport(true) }}
                disabled={loading}
                title="Regenerate review (uses AI quota)"
                className="text-xs text-slate-500 hover:text-amber-400 transition-colors px-2 py-1 rounded-lg hover:bg-slate-800 disabled:opacity-40"
              >
                ↺ Refresh
              </button>
            )}
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-5">
          {/* ── 1. Progress snapshot ─────────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
              Progress Snapshot
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {/* Tasks */}
              <StatCard
                icon={<Target size={16} className="text-blue-400" />}
                label="Tasks"
                value={`${doneMain}/${totalMain}`}
                sub={`${mainPct}% complete`}
                color="blue"
                pct={mainPct}
              />
              {/* Prayers */}
              <StatCard
                icon={<Moon size={16} className="text-green-400" />}
                label="Prayers"
                value={`${donePrayers}/${totalPrayers}`}
                sub={`${prayerPct}% complete`}
                color="green"
                pct={prayerPct}
              />
              {/* Bonus */}
              <StatCard
                icon={<Star size={16} className="text-yellow-400" />}
                label="Bonus Tasks"
                value={`${doneBonus}/${totalBonus}`}
                sub={totalBonus > 0 ? 'extra effort' : 'none added'}
                color="yellow"
                pct={totalBonus > 0 ? Math.round((doneBonus / totalBonus) * 100) : 0}
              />
              {/* Time */}
              <StatCard
                icon={<Clock size={16} className="text-purple-400" />}
                label="Time Tracked"
                value={formatMins(totalMins)}
                sub={totalMins > 0 ? 'logged this week' : 'no time logged'}
                color="purple"
                pct={null}
              />
            </div>
          </section>

          {/* ── 2. AI Report ─────────────────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
              AI Report
            </h3>

            {loading && (
              <div className="space-y-3">
                <div className="h-4 bg-slate-800 rounded-full animate-pulse w-full" />
                <div className="h-4 bg-slate-800 rounded-full animate-pulse w-4/5" />
                <div className="h-4 bg-slate-800 rounded-full animate-pulse w-3/5 mb-4" />
                <div className="h-3 bg-slate-800 rounded-full animate-pulse w-1/3 mt-4" />
                <div className="h-3 bg-slate-800 rounded-full animate-pulse w-full" />
                <div className="h-3 bg-slate-800 rounded-full animate-pulse w-4/5" />
                <div className="h-3 bg-slate-800 rounded-full animate-pulse w-3/5" />
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-sm text-red-300">
                {error}
                <button onClick={() => fetchReport(false)} className="ml-2 underline hover:no-underline">
                  Retry
                </button>
              </div>
            )}

            {report && (
              <div className="space-y-4">
                {/* Cached badge */}
                {report.cached && report.cachedAt && (
                  <p className="text-xs text-slate-600">
                    Saved review from {new Date(report.cachedAt).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}
                {/* Summary */}
                <p className="text-slate-300 text-sm leading-relaxed">{report.summary}</p>

                {/* Focus areas */}
                {report.focusAreas.length > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                    <p className="text-amber-400 text-xs font-semibold uppercase tracking-wide mb-2">
                      Focus areas for next week
                    </p>
                    <ul className="space-y-1.5">
                      {report.focusAreas.map((area, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-amber-200/80">
                          <ChevronRight size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                          {area}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Motivation */}
                <p className="text-slate-500 text-xs italic border-l-2 border-purple-500/40 pl-3">
                  {report.motivation}
                </p>
              </div>
            )}
          </section>

          {/* ── 3. Next step ─────────────────────────────────────────────────── */}
          <section className="flex gap-3 pt-2 border-t border-slate-800">
            <button
              onClick={handleGenerateNewPlan}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Sparkles size={14} />
              Generate New Week Plan
            </button>
            <button
              onClick={onClose}
              className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-xl transition-colors"
            >
              Close
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}

// ── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  sub,
  color,
  pct,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  color: 'blue' | 'green' | 'yellow' | 'purple'
  pct: number | null
}) {
  const barColors: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    yellow: 'bg-yellow-500',
    purple: 'bg-purple-500',
  }
  const bgColors: Record<string, string> = {
    blue: 'bg-blue-500/10 border-blue-500/20',
    green: 'bg-green-500/10 border-green-500/20',
    yellow: 'bg-yellow-500/10 border-yellow-500/20',
    purple: 'bg-purple-500/10 border-purple-500/20',
  }

  return (
    <div className={cn('rounded-xl p-3 border', bgColors[color])}>
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <span className="text-[11px] text-slate-400 font-medium">{label}</span>
      </div>
      <p className="text-white text-lg font-bold leading-none">{value}</p>
      <p className="text-slate-500 text-[11px] mt-0.5">{sub}</p>
      {pct !== null && (
        <div className="mt-2 h-1 bg-slate-700 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', barColors[color])}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  )
}
