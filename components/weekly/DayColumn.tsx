'use client'

import { DailyItem, Category } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle, Circle } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

interface Props {
  date: string
  dayName: string
  isToday: boolean
  items: (DailyItem & { categories?: Category })[]
  onItemUpdate: (item: DailyItem & { categories?: Category }) => void
}

export default function DayColumn({ date, dayName, isToday, items, onItemUpdate }: Props) {
  const supabase = createClient()
  const dayNum = new Date(date + 'T12:00:00').getDate()
  const doneCount = items.filter((it) => it.status === 'done').length

  async function toggleItem(item: DailyItem & { categories?: Category }) {
    if (item.status === 'done') return

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
        'bg-slate-900 border rounded-xl p-3 flex flex-col gap-2 min-h-[140px]',
        isToday ? 'border-yellow-500/50 bg-yellow-500/5' : 'border-slate-800'
      )}
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
          <button
            key={item.id}
            onClick={() => toggleItem(item)}
            disabled={item.status === 'done'}
            className={cn(
              'w-full flex items-start gap-1.5 p-1.5 rounded-lg text-left text-xs transition-all',
              item.status === 'done'
                ? 'opacity-50 cursor-default'
                : 'hover:bg-slate-800 active:scale-95 cursor-pointer'
            )}
          >
            {item.status === 'done' ? (
              <CheckCircle size={12} className="text-green-400 mt-0.5 flex-shrink-0" />
            ) : (
              <Circle size={12} className="text-slate-500 mt-0.5 flex-shrink-0" />
            )}
            <span
              className={cn(
                'leading-tight',
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
        ))}
        {items.length === 0 && (
          <p className="text-[10px] text-slate-700 text-center py-3">—</p>
        )}
      </div>
    </div>
  )
}
