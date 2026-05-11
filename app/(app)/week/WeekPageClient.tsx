'use client'

import { useState } from 'react'
import { WeekPlan, WeeklyItem, DailyItem, Category } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { Plus, Grid3X3, List, Trash2, Sparkles } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'
import WeekGrid from '@/components/weekly/WeekGrid'
import WeekPlanCreator from '@/components/weekly/WeekPlanCreator'

interface Props {
  userId: string
  weekPlan: WeekPlan | null
  weekStart: string
  categories: Category[]
  weeklyItems: (WeeklyItem & { categories?: Category })[]
  dailyItems: (DailyItem & { categories?: Category })[]
}

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-red-500/20 text-red-300 border border-red-500/30',
  medium: 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  low: 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
}

export default function WeekPageClient({
  userId,
  weekPlan,
  weekStart,
  categories,
  weeklyItems: init,
  dailyItems: initDaily,
}: Props) {
  const [tab, setTab] = useState<'plan' | 'grid'>('plan')
  const [weeklyItems, setWeeklyItems] = useState(init)
  const [dailyItems, setDailyItems] = useState(initDaily)
  const [showCreator, setShowCreator] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [distributing, setDistributing] = useState(false)
  const [form, setForm] = useState({
    title: '',
    category_id: '',
    priority: 'medium',
    target_days: 1,
  })
  const supabase = createClient()

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
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
    await supabase.from('weekly_items').delete().eq('id', id)
    setWeeklyItems((prev) => prev.filter((it) => it.id !== id))
  }

  async function distribute() {
    if (!weekPlan || weeklyItems.length === 0) return
    setDistributing(true)
    try {
      const res = await fetch('/api/distribute-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_plan_id: weekPlan.id,
          weekly_items: weeklyItems.map((it) => ({
            id: it.id,
            title: it.title,
            category_id: it.category_id,
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

  function onAIItemsCreated(newItems: (WeeklyItem & { categories?: Category })[]) {
    setWeeklyItems((prev) => [...prev, ...newItems])
    setShowCreator(false)
    toast.success(`${newItems.length} items added to plan!`)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Week Plan</h1>
          <p className="text-slate-400 text-sm mt-0.5">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreator(true)}
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

          {weeklyItems.length > 0 && dailyItems.length === 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-amber-300 font-medium text-sm">Ready to distribute to days?</p>
                <p className="text-amber-400/70 text-xs mt-0.5">
                  AI will assign items to specific days based on target_days
                </p>
              </div>
              <button
                onClick={distribute}
                disabled={distributing}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold rounded-xl disabled:opacity-50 whitespace-nowrap transition-colors"
              >
                {distributing ? 'Working…' : 'Distribute'}
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

      {/* AI creator modal */}
      {showCreator && (
        <WeekPlanCreator
          userId={userId}
          weekPlan={weekPlan}
          categories={categories}
          onClose={() => setShowCreator(false)}
          onItemsCreated={onAIItemsCreated}
        />
      )}
    </div>
  )
}
