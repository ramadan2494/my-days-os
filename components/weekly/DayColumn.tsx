'use client'

import { useState, useRef } from 'react'
import { DailyItem, Category } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Circle, GripVertical } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface Props {
  date: string
  dayName: string
  isToday: boolean
  items: (DailyItem & { categories?: Category })[]
  draggingId: string | null
  onItemUpdate: (item: DailyItem & { categories?: Category }) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  onDrop: (targetDate: string) => void
}

export default function DayColumn({ date, dayName, isToday, items, draggingId, onItemUpdate, onDragStart, onDragEnd, onDrop }: Props) {
  const supabase = createClient()
  const dayNum = new Date(date + 'T12:00:00').getDate()
  const doneCount = items.filter((it) => it.status === 'done').length
  const [isOver, setIsOver] = useState(false)
  const dragEnterCount = useRef(0)

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
          'text-center pb-2 border-b',
          isToday ? 'border-yellow-500/30' : 'border-slate-800'
        )}
      >
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
              item.status === 'done' ? 'opacity-60 hover:opacity-80 hover:bg-slate-800 cursor-pointer' : 'hover:bg-slate-800 cursor-grab active:cursor-grabbing',
            )}
          >
            <GripVertical size={10} className="text-slate-700 group-hover/item:text-slate-500 mt-0.5 flex-shrink-0 transition-colors" />
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
          </div>
        ))}
        {items.length === 0 && (
          <p className={cn('text-[10px] text-center py-3 transition-colors', isOver && draggingId ? 'text-blue-400' : 'text-slate-700')}>
            {isOver && draggingId ? 'Drop here' : '—'}
          </p>
        )}
      </div>
    </div>
  )
}
