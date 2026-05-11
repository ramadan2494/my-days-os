'use client'

import { useState } from 'react'
import { Category, WeekPlan, WeeklyItem } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { X, Sparkles, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface GeneratedTask {
  title: string
  category_name: string
  category_id: string
  day_index: number
  priority: string
  description: string
  scheduled_date: string
}

interface Props {
  userId: string
  weekPlan: WeekPlan | null
  categories: Category[]
  onClose: () => void
  onItemsCreated: (items: (WeeklyItem & { categories?: Category })[]) => void
}

export default function WeekPlanCreator({
  userId,
  weekPlan,
  categories,
  onClose,
  onItemsCreated,
}: Props) {
  const [tab, setTab] = useState<'ai' | 'manual'>('ai')
  const [topics, setTopics] = useState<Record<string, string>>({})
  const [hoursPerWeek, setHoursPerWeek] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<GeneratedTask[] | null>(null)
  const [manualForm, setManualForm] = useState({
    title: '',
    category_id: '',
    priority: 'medium',
    target_days: 1,
  })
  const supabase = createClient()

  const aiCategories = categories.filter((c) => c.name !== 'Prayers')

  async function generatePlan() {
    const items = Object.entries(topics)
      .filter(([, v]) => v.trim())
      .map(([catId, topic]) => {
        const cat = categories.find((c) => c.id === catId)
        return { category_id: catId, category_name: cat?.name ?? '', topic, hours_per_week: Number(hoursPerWeek[catId]) || undefined }
      })

    if (items.length === 0) {
      toast.error('Add at least one topic')
      return
    }

    setLoading(true)
    setPreview(null)
    try {
      const res = await fetch('/api/claude/weekly-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_start: weekPlan?.week_start ?? new Date().toISOString().split('T')[0],
          items,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Generation failed')
        return
      }
      setPreview(data.tasks)
    } finally {
      setLoading(false)
    }
  }

  async function confirmAI() {
    if (!preview || !weekPlan) return
    setLoading(true)
    try {
      const rows = preview.map((t) => ({
        user_id: userId,
        week_plan_id: weekPlan.id,
        category_id: t.category_id,
        title: t.title,
        description: t.description ?? null,
        target_days: 1,
        priority: t.priority ?? 'medium',
      }))
      const { data, error } = await supabase
        .from('weekly_items')
        .insert(rows)
        .select('*, categories(*)')
      if (error) {
        toast.error(error.message)
        return
      }
      onItemsCreated(data ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function addManual() {
    if (!manualForm.title.trim() || !manualForm.category_id || !weekPlan) return
    const { data, error } = await supabase
      .from('weekly_items')
      .insert({
        user_id: userId,
        week_plan_id: weekPlan.id,
        category_id: manualForm.category_id,
        title: manualForm.title.trim(),
        priority: manualForm.priority,
        target_days: manualForm.target_days,
      })
      .select('*, categories(*)')
      .single()
    if (error) {
      toast.error(error.message)
      return
    }
    onItemsCreated([data])
    setManualForm({ title: '', category_id: '', priority: 'medium', target_days: 1 })
    toast.success('Item added!')
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800">
          <h2 className="text-lg font-semibold text-white">Build This Week&apos;s Plan</h2>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-1 m-5 mb-0 bg-slate-800 p-1 rounded-xl">
          <button
            onClick={() => setTab('ai')}
            className={cn(
              'flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5',
              tab === 'ai' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            )}
          >
            <Sparkles size={14} />
            AI Generate
          </button>
          <button
            onClick={() => setTab('manual')}
            className={cn(
              'flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5',
              tab === 'manual' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            )}
          >
            <Plus size={14} />
            Manual Add
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* AI tab — topic entry */}
          {tab === 'ai' && !preview && (
            <>
              <p className="text-slate-400 text-sm">
                Describe your goals for each category. AI will create specific tasks spread across
                the week.
              </p>
              {aiCategories.map((cat) => (
                <div key={cat.id}>
                  <label
                    className="flex items-center gap-2 text-sm font-medium mb-1.5"
                    style={{ color: cat.color }}
                  >
                    <span>{cat.icon}</span>
                    {cat.name}
                  </label>
                  <textarea
                    rows={2}
                    value={topics[cat.id] ?? ''}
                    onChange={(e) =>
                      setTopics((prev) => ({ ...prev, [cat.id]: e.target.value }))
                    }
                    placeholder={`What do you want to achieve in ${cat.name} this week?`}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 resize-none"
                  />
                  {topics[cat.id]?.trim() && cat.name !== 'Work' && (
                    <div className="flex items-center gap-2 mt-1.5">
                      <label className="text-xs text-slate-500 whitespace-nowrap">Hours / week:</label>
                      <input
                        type="number"
                        min={1}
                        max={40}
                        value={hoursPerWeek[cat.id] ?? ''}
                        onChange={(e) => setHoursPerWeek((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                        placeholder="e.g. 5"
                        className="w-20 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  )}
                </div>
              ))}
              <button
                onClick={generatePlan}
                disabled={loading}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl text-white font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Sparkles size={16} />
                {loading ? 'Generating…' : 'Generate Plan'}
              </button>
            </>
          )}

          {/* AI tab — preview */}
          {tab === 'ai' && preview && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-white font-medium">{preview.length} tasks generated</p>
                <button
                  onClick={() => setPreview(null)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  ← Edit topics
                </button>
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {preview.map((task, i) => {
                  const cat = categories.find((c) => c.id === task.category_id)
                  return (
                    <div key={i} className="flex items-start gap-3 p-3 bg-slate-800 rounded-xl">
                      <span className="text-lg">{cat?.icon ?? '📌'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white">{task.title}</p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {cat?.name} · {task.priority}
                        </p>
                      </div>
                      <button
                        onClick={() =>
                          setPreview((prev) => prev?.filter((_, j) => j !== i) ?? null)
                        }
                        className="text-slate-600 hover:text-red-400 transition-colors flex-shrink-0"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )
                })}
              </div>
              <button
                onClick={confirmAI}
                disabled={loading || preview.length === 0}
                className="w-full py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-xl text-white font-semibold transition-colors"
              >
                {loading ? 'Saving…' : `Add ${preview.length} Items to Plan`}
              </button>
            </>
          )}

          {/* Manual tab */}
          {tab === 'manual' && (
            <div className="space-y-4">
              <div>
                <label className="text-sm text-slate-400 mb-1.5 block">Title</label>
                <input
                  type="text"
                  value={manualForm.title}
                  onChange={(e) => setManualForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g. Read 30 pages of book"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-sm text-slate-400 mb-1.5 block">Category</label>
                <select
                  value={manualForm.category_id}
                  onChange={(e) =>
                    setManualForm((f) => ({ ...f, category_id: e.target.value }))
                  }
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-slate-400 mb-1.5 block">Priority</label>
                  <select
                    value={manualForm.priority}
                    onChange={(e) =>
                      setManualForm((f) => ({ ...f, priority: e.target.value }))
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm text-slate-400 mb-1.5 block">
                    Days/week: {manualForm.target_days}
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={7}
                    value={manualForm.target_days}
                    onChange={(e) =>
                      setManualForm((f) => ({ ...f, target_days: Number(e.target.value) }))
                    }
                    className="w-full mt-3 accent-blue-500"
                  />
                </div>
              </div>
              <button
                onClick={addManual}
                disabled={!manualForm.title.trim() || !manualForm.category_id}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl text-white font-semibold transition-colors"
              >
                Add Item
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
