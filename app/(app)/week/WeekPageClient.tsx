'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { WeekPlan, WeeklyItem, DailyItem, Category } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { Plus, Grid3X3, List, Trash2, Sparkles, RotateCcw, BarChart2, ChevronLeft, ChevronRight, RefreshCw, Copy } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import WeekGrid from '@/components/weekly/WeekGrid'
import WeekPlanCreator from '@/components/weekly/WeekPlanCreator'
import WeekReviewPanel from '@/components/weekly/WeekReviewPanel'

interface Props {
  userId: string
  weekPlan: WeekPlan | null
  weekStart: string
  categories: Category[]
  weeklyItems: (WeeklyItem & { categories?: Category })[]
  dailyItems: (DailyItem & { categories?: Category })[]
  profileName?: string
}

export interface CarryoverItem {
  id: string
  title: string
  category_id: string
  category_name: string
  priority: string
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500/20 text-red-300 border border-red-500/30',
  medium: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  low: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
}

function shiftWeek(weekStart: string, delta: number): string {
  const d = new Date(weekStart + 'T12:00:00')
  d.setDate(d.getDate() + delta * 7)
  return d.toISOString().split('T')[0]
}

export default function WeekPageClient({
  userId,
  weekPlan,
  weekStart,
  categories,
  weeklyItems: init,
  dailyItems: initDaily,
  profileName = '',
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<'plan' | 'grid'>('plan')
  const [weeklyItems, setWeeklyItems] = useState(init)
  const [dailyItems, setDailyItems] = useState(initDaily)
  const [showCreator, setShowCreator] = useState(false)
  const [planMode, setPlanMode] = useState<'fresh' | 'continue' | null>(null)
  const [carryoverItems, setCarryoverItems] = useState<CarryoverItem[]>([])
  const [loadingCarryover, setLoadingCarryover] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [reviewFocusHint, setReviewFocusHint] = useState('')
  const [distributing, setDistributing] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [form, setForm] = useState({
    title: '',
    category_id: '',
    priority: 'medium',
    target_days: 1,
  })
  const supabase = createClient()

  // Week is "evaluatable" once at least one day in the week has passed
  const today = new Date().toISOString().split('T')[0]
  const canEvaluate = weekStart <= today

  // Compute the Sunday-start week that contains today (client-side)
  const currentWeekStart = (() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay()) // subtract day-of-week (0=Sun)
    return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
  })()
  const isCurrentWeek = weekStart === currentWeekStart

  // Derived week end (6 days after start)
  const weekEndDate = new Date(weekStart + 'T12:00:00')
  weekEndDate.setDate(weekEndDate.getDate() + 6)
  const weekEnd = weekEndDate.toISOString().split('T')[0]
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + 'T12:00:00')
    d.setDate(d.getDate() + i)
    return d
  })
  const weekLabel = `${weekDays[0].toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
  })} – ${weekDays[6].toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}`

  const grouped = categories.reduce<Record<string, typeof weeklyItems>>((acc, cat) => {
    acc[cat.id] = weeklyItems.filter((it) => it.category_id === cat.id)
    return acc
  }, {})

  function navigateWeek(delta: number) {
    router.push(`/week?ws=${shiftWeek(weekStart, delta)}`)
  }

  async function openContinueMode() {
    setLoadingCarryover(true)
    try {
      // Find recent plans before this week (within 4 weeks back), ordered newest first
      const rangeStart = shiftWeek(weekStart, -4)
      const { data: prevPlans } = await supabase
        .from('week_plans')
        .select('id, week_start')
        .eq('user_id', userId)
        .lt('week_start', weekStart)
        .gte('week_start', rangeStart)
        .order('week_start', { ascending: false })
        .limit(8)
      if (!prevPlans || prevPlans.length === 0) {
        toast.error('No previous week plan found')
        setPlanMode('fresh')
        setShowCreator(true)
        return
      }

      // Scan plans newest-first; pick the first one that has weekly_items
      let prevPlan: { id: string; week_start: string } | null = null
      let prevItems: { id: string; title: string; category_id: string; priority: string; categories: unknown }[] | null = null
      for (const plan of prevPlans) {
        const { data: items } = await supabase
          .from('weekly_items')
          .select('id, title, category_id, priority, categories(*)')
          .eq('week_plan_id', plan.id)
        if (items && items.length > 0) {
          prevPlan = plan
          prevItems = items
          break
        }
      }

      if (!prevPlan || !prevItems || prevItems.length === 0) {
        toast('No tasks found from last week — starting fresh', { icon: '📋' })
        setPlanMode('fresh')
        setShowCreator(true)
        return
      }

      // Get daily items to determine which weekly items are fully done
      const { data: prevDaily } = await supabase
        .from('daily_items')
        .select('weekly_item_id, status')
        .eq('week_plan_id', prevPlan.id)
      const doneItemIds = new Set(
        (prevDaily ?? [])
          .filter((d) => d.status === 'done')
          .map((d) => d.weekly_item_id)
      )
      // Only carry items that have at least one undone daily occurrence (or no daily items at all)
      const incomplete = prevItems.filter((it) => {
        const hasDailyItems = (prevDaily ?? []).some((d) => d.weekly_item_id === it.id)
        if (!hasDailyItems) return true // never distributed → carry over
        const allDone = (prevDaily ?? [])
          .filter((d) => d.weekly_item_id === it.id)
          .every((d) => d.status === 'done')
        return !allDone
      })
      const carried: CarryoverItem[] = incomplete.map((it) => ({
        id: it.id,
        title: it.title,
        category_id: it.category_id,
        category_name: (it.categories as Category | null)?.name ?? '',
        priority: it.priority,
      }))
      if (carried.length === 0) {
        toast('All last week\'s tasks were completed — great job! Starting fresh.', { icon: '🎉' })
        setPlanMode('fresh')
        setShowCreator(true)
        return
      }
      setCarryoverItems(carried)
      setPlanMode('continue')
      setShowCreator(true)
    } finally {
      setLoadingCarryover(false)
    }
  }

  function handleOpenPlanCreator(hint?: string) {
    if (hint !== undefined) setReviewFocusHint(hint)
    setPlanMode(null) // show mode selector
    setShowCreator(true)
  }

  async function addItem() {
    if (!form.title.trim() || !form.category_id || !weekPlan) return
    const { data, error } = await supabase
      .from('weekly_items')
      .insert({
        user_id: userId,
        week_plan_id: weekPlan.id,
        category_id: form.category_id,
        title: form.title.trim(),
        priority: form.priority,
        target_days: form.target_days,
      })
      .select('*, categories(*)')
      .single()
    if (error) {
      toast.error('Failed to add item')
      return
    }
    setWeeklyItems((prev) => [...prev, data])
    setForm({ title: '', category_id: '', priority: 'medium', target_days: 1 })
    setShowAddForm(false)
    toast.success('Item added!')
  }

  async function deleteItem(id: string) {
    await supabase.from('daily_items').delete().eq('weekly_item_id', id)
    await supabase.from('weekly_items').delete().eq('id', id)
    setWeeklyItems((prev) => prev.filter((it) => it.id !== id))
    setDailyItems((prev) => prev.filter((it) => it.weekly_item_id !== id))
  }

  async function distribute(overrideItems?: typeof weeklyItems) {
    const itemsToDistribute = overrideItems ?? weeklyItems
    if (!weekPlan || itemsToDistribute.length === 0) return
    setDistributing(true)
    try {
      const res = await fetch('/api/distribute-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_plan_id: weekPlan.id,
          weekly_items: itemsToDistribute.map((it) => ({
            id: it.id,
            title: it.title,
            category_id: it.category_id,
            category_name: it.categories?.name ?? '',
            target_days: it.target_days,
            priority: it.priority,
          })),
          week_start: weekStart,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Failed to distribute')
        return
      }
      const { data: fresh } = await supabase
        .from('daily_items')
        .select('*, categories(*)')
        .eq('week_plan_id', weekPlan.id)
        .order('scheduled_date')
      if (fresh) setDailyItems(fresh)
      toast.success(`${data.created} tasks distributed across the week!`)
      setTab('grid')
    } finally {
      setDistributing(false)
    }
  }

  async function clearPlan() {
    if (!weekPlan) return
    if (!confirm('Clear all items and distributed tasks for this week? This cannot be undone.')) return
    setClearing(true)
    try {
      await supabase.from('daily_items').delete().eq('week_plan_id', weekPlan.id)
      await supabase.from('weekly_items').delete().eq('week_plan_id', weekPlan.id)
      setWeeklyItems([])
      setDailyItems([])
      setTab('plan')
      toast.success('Week plan cleared — start fresh!')
    } finally {
      setClearing(false)
    }
  }

  function onAIItemsCreated(newItems: (WeeklyItem & { categories?: Category })[]) {
    const combined = [...weeklyItems, ...newItems]
    setWeeklyItems(combined)
    setShowCreator(false)
    toast.success(`${newItems.length} items added — distributing to days…`)
    // Auto-distribute with the full combined list (state hasn't re-rendered yet)
    distribute(combined)
  }

  async function deduplicateAndRedistribute() {
    if (!weekPlan) return
    setDistributing(true)
    try {
      // Find duplicates: group by title+category_id, keep the first (oldest by created_at order)
      const seen = new Map<string, string>() // key → id to keep
      const toDelete: string[] = []
      for (const item of weeklyItems) {
        const key = `${item.title}|||${item.category_id}`
        if (seen.has(key)) {
          toDelete.push(item.id)
        } else {
          seen.set(key, item.id)
        }
      }
      if (toDelete.length > 0) {
        // Delete duplicate daily_items first, then the weekly_items
        for (const id of toDelete) {
          await supabase.from('daily_items').delete().eq('weekly_item_id', id)
          await supabase.from('weekly_items').delete().eq('id', id)
        }
        const cleaned = weeklyItems.filter((it) => !toDelete.includes(it.id))
        setWeeklyItems(cleaned)
        toast.success(`Removed ${toDelete.length} duplicate${toDelete.length > 1 ? 's' : ''} — redistributing…`)
        await distribute(cleaned)
      } else {
        toast('No duplicates found — redistributing…', { icon: '✓' })
        await distribute()
      }
    } finally {
      setDistributing(false)
    }
  }

  function handleReviewGenerateNewPlan(hint: string) {
    setShowReview(false)
    handleOpenPlanCreator(hint)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {/* Week navigation */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => navigateWeek(-1)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Previous week"
            >
              <ChevronLeft size={18} />
            </button>
            <div>
              <h1 className="text-xl font-bold text-white">Week Plan</h1>
              <p className="text-slate-400 text-xs mt-0.5">{weekLabel}</p>
            </div>
            <button
              onClick={() => navigateWeek(1)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Next week"
            >
              <ChevronRight size={18} />
            </button>
            {!isCurrentWeek && (
              <button
                onClick={() => router.push('/week')}
                className="ml-1 px-2.5 py-1 text-xs font-medium bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/30 text-blue-400 rounded-lg transition-colors"
                title="Jump to current week"
              >
                Today
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(weeklyItems.length > 0 || dailyItems.length > 0) && (
            <button
              onClick={clearPlan}
              disabled={clearing}
              title="Clear plan and start fresh"
              className="flex items-center gap-1.5 px-3 py-2 bg-red-900/40 hover:bg-red-800/60 border border-red-800/50 text-red-400 text-sm font-medium rounded-xl disabled:opacity-50 transition-colors"
            >
              <RotateCcw size={14} />
              {clearing ? 'Clearing…' : 'Clear'}
            </button>
          )}
          {canEvaluate && dailyItems.length > 0 && (
            <button
              onClick={() => setShowReview(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <BarChart2 size={14} />
              Evaluate
            </button>
          )}
          <button
            onClick={() => handleOpenPlanCreator()}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Sparkles size={14} />
            AI Plan
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
          >
            <Plus size={14} />
            Add
          </button>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl w-fit">
        {(['plan', 'grid'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all',
              tab === t ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            )}
          >
            {t === 'plan' ? <List size={14} /> : <Grid3X3 size={14} />}
            {t === 'plan' ? 'Plan' : 'Week Grid'}
          </button>
        ))}
      </div>

      {/* Plan tab */}
      {tab === 'plan' && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm text-slate-400">
            <span>{weeklyItems.length} items planned</span>
            {dailyItems.length > 0 && (
              <span className="text-green-400">{dailyItems.length} distributed to days ✓</span>
            )}
          </div>

          {weeklyItems.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between gap-4">
              <div>
                {weeklyItems.length !== new Set(weeklyItems.map((i) => `${i.title}|||${i.category_id}`)).size ? (
                  <>
                    <p className="text-amber-300 font-medium text-sm">Duplicates detected!</p>
                    <p className="text-amber-400/70 text-xs mt-0.5">
                      {weeklyItems.length - new Set(weeklyItems.map((i) => `${i.title}|||${i.category_id}`)).size} duplicate{weeklyItems.length - new Set(weeklyItems.map((i) => `${i.title}|||${i.category_id}`)).size > 1 ? 's' : ''} will be removed before distributing
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-amber-300 font-medium text-sm">{dailyItems.length > 0 ? 'Re-distribute to days?' : 'Ready to distribute to days?'}</p>
                    <p className="text-amber-400/70 text-xs mt-0.5">AI assigns each item to specific days based on your schedule</p>
                  </>
                )}
              </div>
              <button
                onClick={deduplicateAndRedistribute}
                disabled={distributing}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold rounded-xl disabled:opacity-50 whitespace-nowrap transition-colors"
              >
                {distributing ? 'Working…' : weeklyItems.length !== new Set(weeklyItems.map((i) => `${i.title}|||${i.category_id}`)).size ? 'Clean & Distribute' : dailyItems.length > 0 ? 'Re-distribute' : 'Distribute'}
              </button>
            </div>
          )}

          {categories.map((cat) => (
            <div
              key={cat.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden"
            >
              <div
                className="flex items-center gap-3 px-5 py-3 border-b border-slate-800"
                style={{ borderLeftColor: cat.color, borderLeftWidth: 3 }}
              >
                <span className="text-lg">{cat.icon}</span>
                <span className="font-semibold text-white">{cat.name}</span>
                <span className="ml-auto text-xs text-slate-500">
                  {(grouped[cat.id] ?? []).length} item
                  {(grouped[cat.id] ?? []).length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="divide-y divide-slate-800">
                {(grouped[cat.id] ?? []).map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{item.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={cn(
                            'text-[10px] px-1.5 py-0.5 rounded font-medium',
                            PRIORITY_COLORS[item.priority]
                          )}
                        >
                          {item.priority}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {item.target_days}d/week
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="p-1 text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                {(grouped[cat.id] ?? []).length === 0 && (
                  <p className="px-5 py-3 text-xs text-slate-700 italic">No items yet</p>
                )}
              </div>
            </div>
          ))}

          {weeklyItems.length === 0 && (
            <div className="text-center py-16">
              <p className="text-slate-400 text-lg font-medium">Your week is empty</p>
              <p className="text-slate-600 text-sm mt-1 mb-6">
                Add items manually or let AI plan your week
              </p>
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => setShowAddForm(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  Add Manually
                </button>
                <button
                  onClick={() => setShowCreator(true)}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium rounded-xl transition-colors"
                >
                  Generate with AI
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grid tab */}
      {tab === 'grid' && (
        <WeekGrid
          userId={userId}
          weekStart={weekStart}
          weekPlanId={weekPlan?.id ?? ''}
          dailyItems={dailyItems}
          categories={categories}
          onItemsChange={setDailyItems}
          onItemAdd={(_, wi) => setWeeklyItems((prev) => [...prev, wi])}
        />
      )}

      {/* Add item drawer */}
      {showAddForm && (
        <div
          className="fixed inset-0 bg-black/60 z-50 flex justify-end"
          onClick={() => setShowAddForm(false)}
        >
          <div
            className="w-full max-w-sm bg-slate-900 border-l border-slate-800 h-full p-6 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-white mb-6">Add Weekly Item</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-1.5 block">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Review thesis chapter 3"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1.5 block">Category</label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="">Select category</option>
                  {categories
                    .filter((c) => c.name !== 'Prayers')
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1.5 block">Priority</label>
                <select
                  value={form.priority}
                  onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1.5 block">
                  Days per week: {form.target_days}
                </label>
                <input
                  type="range"
                  min={1}
                  max={7}
                  value={form.target_days}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, target_days: Number(e.target.value) }))
                  }
                  className="w-full accent-blue-500"
                />
                <div className="flex justify-between text-xs text-slate-600 mt-1">
                  <span>1</span>
                  <span>7</span>
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 py-3 border border-slate-700 rounded-xl text-slate-400 text-sm hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={addItem}
                  disabled={!form.title.trim() || !form.category_id}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl text-white text-sm font-semibold transition-colors"
                >
                  Add Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI creator modal — mode selector first, then creator */}
      {showCreator && planMode === null && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setShowCreator(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-white">Plan next week</h2>
            <p className="text-slate-400 text-sm">How do you want to start?</p>
            <button
              onClick={() => { setPlanMode('fresh'); }}
              className="w-full flex items-start gap-4 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors text-left"
            >
              <RefreshCw size={22} className="text-purple-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-white font-medium">Fresh plan</p>
                <p className="text-slate-400 text-xs mt-0.5">Start from scratch — describe your goals and AI builds the week</p>
              </div>
            </button>
            <button
              onClick={openContinueMode}
              disabled={loadingCarryover}
              className="w-full flex items-start gap-4 p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors text-left disabled:opacity-60"
            >
              <Copy size={22} className="text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-white font-medium">Continue from last week</p>
                <p className="text-slate-400 text-xs mt-0.5">Carry over incomplete tasks + AI predicts new ones for this week</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {showCreator && planMode !== null && (
        <WeekPlanCreator
          userId={userId}
          weekPlan={weekPlan}
          categories={categories}
          focusHint={reviewFocusHint}
          carryoverItems={planMode === 'continue' ? carryoverItems : []}
          onClose={() => { setShowCreator(false); setPlanMode(null); setCarryoverItems([]); setReviewFocusHint('') }}
          onItemsCreated={onAIItemsCreated}
        />
      )}

      {/* Week review panel */}
      {showReview && (
        <WeekReviewPanel
          weekStart={weekStart}
          weekEnd={weekEnd}
          weekPlanId={weekPlan?.id}
          profileName={profileName}
          dailyItems={dailyItems}
          categories={categories}
          onClose={() => setShowReview(false)}
          onGenerateNewPlan={handleReviewGenerateNewPlan}
        />
      )}
    </div>
  )
}
