'use client'

import { useState, useRef } from 'react'
import { DailyItem, WeeklyItem, Category } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Circle, GripVertical, Plus, X, Check, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface Props {
  date: string
  dayName: string
  isToday: boolean
  items: (DailyItem & { categories?: Category })[]
  draggingId: string | null
  userId: string
  weekPlanId: string
  categories: Category[]
  onItemUpdate: (item: DailyItem & { categories?: Category }) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDrop: (targetDate: string) => void
  onItemAdd: (dailyItem: DailyItem & { categories?: Category }, weeklyItem: WeeklyItem & { categories?: Category }) => void
}

export default function DayColumn({ date, dayName, isToday, items, draggingId, userId, weekPlanId, categories, onItemUpdate, onDragStart, onDragEnd, onDrop, onItemAdd }: Props) {
  const supabase = createClient()
  const dayNum = new Date(date + 'T12:00:00').getDate()
  const doneCount = items.filter((it) => it.status === 'done').length
  const [isOver, setIsOver] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addTitle, setAddTitle] = useState('')
  const [addCategoryId, setAddCategoryId] = useState('')
  const [addPriority, setAddPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const dragEnterCount = useRef(0)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const editInputRef = useRef<HTMLInputElement>(null)

  const nonPrayerCategories = categories.filter((c) => c.name !== 'Prayers')

  async function toggleItem(item: DailyItem & { categories?: Category }) {
    if (item.status === 'done') {
      // Uncheck: reset to pending
      const { data, error } = await supabase
        .from('daily_items')
        .update({ status: 'pending', xp_earned: 0, completed_at: null })
        .eq('id', item.id)
        .select('*, categories(*)')
        .single()
      if (!error && data) {
        onItemUpdate(data)
        toast(`↩️ ${item.title} unchecked`, { style: { background: '#1e293b', color: '#94a3b8' } })
      }
      return
    }

    const { data, error } = await supabase
      .from('daily_items')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', item.id)
      .select('*, categories(*)')
      .single()

    if (error) {
      toast.error('Failed to update')
      return
    }

    const isPrayer = item.categories?.name === 'Prayers'
    const res = await fetch('/api/award-xp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: item.id,
        category_name: item.categories?.name ?? '',
        priority: 'medium',
        is_prayer: isPrayer,
      }),
    })
    const xpData = await res.json()
    toast.success(`+${xpData.xp_earned ?? 0} XP — ${item.title}`)
    if (xpData.level_up) {
      toast.success(`🎉 Level Up! You reached Level ${xpData.new_level}`, { duration: 4000 })
    }
    onItemUpdate(data)
  }

  async function addItem() {
    if (!addTitle.trim() || !addCategoryId || !weekPlanId) return
    setAdding(true)
    try {
      const { data: wi, error: wiError } = await supabase
        .from('weekly_items')
        .insert({
          user_id: userId,
          week_plan_id: weekPlanId,
          category_id: addCategoryId,
          title: addTitle.trim(),
          priority: addPriority,
          target_days: 1,
        })
        .select('*, categories(*)')
        .single()
      if (wiError || !wi) { toast.error('Failed to add task'); return }

      const { data: di, error: diError } = await supabase
        .from('daily_items')
        .insert({
          user_id: userId,
          week_plan_id: weekPlanId,
          weekly_item_id: wi.id,
          category_id: addCategoryId,
          title: addTitle.trim(),
          scheduled_date: date,
          status: 'pending',
        })
        .select('*, categories(*)')
        .single()
      if (diError || !di) { toast.error('Failed to add to day'); return }

      onItemAdd(di, wi)
      setAddTitle('')
      setAddCategoryId('')
      setAddPriority('medium')
      setShowAddForm(false)
      toast.success(`Added to ${dayName}!`)
    } finally {
      setAdding(false)
    }
  }

  function openAddForm() {
    setShowAddForm(true)
    // focus input on next tick after it mounts
    setTimeout(() => titleInputRef.current?.focus(), 0)
  }

  function startEdit(item: DailyItem & { categories?: Category }) {
    setEditingId(item.id)
    setEditTitle(item.title)
    setTimeout(() => editInputRef.current?.focus(), 0)
  }

  async function saveEdit(item: DailyItem & { categories?: Category }) {
    const trimmed = editTitle.trim()
    setEditingId(null)
    if (!trimmed || trimmed === item.title) return
    const { data, error } = await supabase
      .from('daily_items')
      .update({ title: trimmed })
      .eq('id', item.id)
      .select('*, categories(*)')
      .single()
    if (error) { toast.error('Failed to rename'); return }
    // Also rename the parent weekly_item if linked
    if (item.weekly_item_id) {
      await supabase.from('weekly_items').update({ title: trimmed }).eq('id', item.weekly_item_id)
    }
    onItemUpdate(data)
  }

  return (
    <div
      className={cn(
        'bg-slate-900 border rounded-xl p-3 flex flex-col gap-2 min-h-[140px] transition-colors',
        isToday ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-slate-800',
        isOver && draggingId ? 'border-blue-500/60 bg-blue-500/10' : '',
      )}
      onDragEnter={(e) => { e.preventDefault(); dragEnterCount.current++; setIsOver(true) }}
      onDragLeave={() => { dragEnterCount.current--; if (dragEnterCount.current === 0) setIsOver(false) }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); dragEnterCount.current = 0; setIsOver(false); onDrop(date) }}
    >
      {/* Day header */}
      <div
        className={cn(
          'flex items-start justify-between pb-2 border-b',
          isToday ? 'border-yellow-500/30' : 'border-slate-800'
        )}
      >
        <div className="flex-1 text-center">
          <p
            className={cn(
              'text-xs font-semibold',
              isToday ? 'text-yellow-400' : 'text-slate-400'
            )}
          >
            {dayName}
          </p>
          <p className={cn('text-lg font-bold', isToday ? 'text-yellow-300' : 'text-white')}>
            {dayNum}
          </p>
          {items.length > 0 && (
            <p className="text-[10px] text-slate-500">
              {doneCount}/{items.length}
            </p>
          )}
        </div>
        {weekPlanId && (
          <button
            onClick={openAddForm}
            title={`Add task to ${dayName}`}
            className="p-0.5 text-slate-600 hover:text-blue-400 hover:bg-blue-500/10 rounded transition-colors flex-shrink-0"
          >
            <Plus size={13} />
          </button>
        )}
      </div>

      {/* Progress bar */}
      {items.length > 0 && (
        <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-300"
            style={{ width: `${(doneCount / items.length) * 100}%` }}
          />
        </div>
      )}

      {/* Items */}
      <div className="space-y-1.5 flex-1">
        {items.map((item) => (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move'
              // Delay so browser captures ghost first, then dims the original element
              setTimeout(() => onDragStart(item.id), 0)
            }}
            onDragEnd={onDragEnd}
            className={cn(
              'group/item flex items-start gap-1 p-1.5 rounded-lg text-xs transition-all',
              draggingId === item.id ? 'opacity-50 ring-1 ring-blue-400/50 bg-blue-500/10' : '',
              editingId === item.id ? 'bg-slate-800 ring-1 ring-blue-500/40' : '',
              item.status === 'done' ? 'opacity-60 hover:opacity-80 hover:bg-slate-800 cursor-pointer' : 'hover:bg-slate-800 cursor-grab active:cursor-grabbing',
            )}
          >
            <GripVertical size={10} className="text-slate-700 group-hover/item:text-slate-500 mt-0.5 flex-shrink-0 transition-colors" />
            {editingId === item.id ? (
              <input
                ref={editInputRef}
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit(item)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                onBlur={() => saveEdit(item)}
                onClick={(e) => e.stopPropagation()}
                className="flex-1 bg-transparent border-none outline-none text-white text-[11px] min-w-0"
              />
            ) : (
              <button
                onClick={() => toggleItem(item)}
                className="flex items-start gap-1 flex-1 text-left min-w-0"
              >
                {item.status === 'done' ? (
                  <CheckCircle size={12} className="text-green-400 mt-0.5 flex-shrink-0 group-hover/item:text-red-400 transition-colors" />
                ) : (
                  <Circle size={12} className="text-slate-500 mt-0.5 flex-shrink-0" />
                )}
                <span
                  className={cn(
                    'leading-tight break-words whitespace-normal line-clamp-3',
                    item.status === 'done' ? 'line-through text-slate-500' : 'text-slate-300'
                  )}
                  style={
                    item.categories && item.status !== 'done'
                      ? { color: item.categories.color }
                      : {}
                  }
                >
                  {item.categories?.icon} {item.title}
                </span>
              </button>
            )}
            {editingId !== item.id && item.status !== 'done' && (
              <button
                onClick={(e) => { e.stopPropagation(); startEdit(item) }}
                title="Rename"
                className="opacity-0 group-hover/item:opacity-100 p-0.5 text-slate-600 hover:text-blue-400 flex-shrink-0 transition-all"
              >
                <Pencil size={9} />
              </button>
            )}
          </div>
        ))}
        {items.length === 0 && !showAddForm && (
          <p className={cn('text-[10px] text-center py-3 transition-colors', isOver && draggingId ? 'text-blue-400' : 'text-slate-700')}>
            {isOver && draggingId ? 'Drop here' : '—'}
          </p>
        )}
      </div>

      {/* Inline quick-add form */}
      {showAddForm ? (
        <div className="space-y-1.5 pt-1 border-t border-slate-800">
          <input
            ref={titleInputRef}
            type="text"
            value={addTitle}
            onChange={(e) => setAddTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addItem()
              if (e.key === 'Escape') { setShowAddForm(false); setAddTitle('') }
            }}
            placeholder="Task title…"
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white placeholder-slate-600 focus:outline-none focus:border-blue-500"
          />
          <select
            value={addCategoryId}
            onChange={(e) => setAddCategoryId(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white focus:outline-none focus:border-blue-500"
          >
            <option value="">Category…</option>
            {nonPrayerCategories.map((c) => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
          <div className="flex gap-1">
            {(['high', 'medium', 'low'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setAddPriority(p)}
                className={cn(
                  'flex-1 py-0.5 rounded text-[10px] font-medium transition-colors',
                  addPriority === p
                    ? p === 'high' ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                      : p === 'medium' ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50'
                      : 'bg-slate-600/50 text-slate-300 border border-slate-500/50'
                    : 'bg-slate-800 text-slate-600 border border-slate-700 hover:text-slate-400'
                )}
              >
                {p[0].toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            <button
              onClick={addItem}
              disabled={adding || !addTitle.trim() || !addCategoryId}
              className="flex-1 flex items-center justify-center gap-1 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-[11px] font-medium transition-colors"
            >
              <Check size={10} /> {adding ? '…' : 'Add'}
            </button>
            <button
              onClick={() => { setShowAddForm(false); setAddTitle('') }}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-[11px] transition-colors"
            >
              <X size={10} />
            </button>
          </div>
        </div>
      ) : weekPlanId ? (
        <button
          onClick={openAddForm}
          className="w-full flex items-center justify-center gap-1 py-1 text-slate-700 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg text-[10px] transition-colors border border-dashed border-slate-800 hover:border-blue-500/40"
        >
          <Plus size={10} /> add
        </button>
      ) : null}
    </div>
  )
}
