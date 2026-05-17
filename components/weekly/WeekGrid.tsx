'use client'

import { useState } from 'react'
import { DailyItem, WeeklyItem, Category } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import DayColumn from './DayColumn'
import toast from 'react-hot-toast'

interface Props {
  userId: string
  weekStart: string
  weekPlanId: string
  dailyItems: (DailyItem & { categories?: Category })[]
  categories: Category[]
  onItemsChange: (items: (DailyItem & { categories?: Category })[]) => void
  onItemAdd?: (dailyItem: DailyItem & { categories?: Category }, weeklyItem: WeeklyItem & { categories?: Category }) => void
}

export default function WeekGrid({
  userId,
  weekPlanId,
  categories,
  dailyItems,
  weekStart,
  onItemsChange,
  onItemAdd,
}: Props) {
  const supabase = createClient()
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const now = new Date()
  const today = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  ].join('-')

  const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + 'T12:00:00')
    d.setDate(d.getDate() + i)
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-')
  })

  function handleItemDelete(id: string) {
    onItemsChange(dailyItems.filter((it) => it.id !== id))
  }

  function handleItemUpdate(updated: DailyItem & { categories?: Category }) {
    onItemsChange(dailyItems.map((it) => (it.id === updated.id ? updated : it)))
  }

  function handleItemAdd(
    dailyItem: DailyItem & { categories?: Category },
    weeklyItem: WeeklyItem & { categories?: Category },
  ) {
    onItemsChange([...dailyItems, dailyItem])
    onItemAdd?.(dailyItem, weeklyItem)
  }

  async function handleDrop(targetDate: string) {
    if (!draggingId) return
    const item = dailyItems.find((it) => it.id === draggingId)
    if (!item || item.scheduled_date === targetDate) {
      setDraggingId(null)
      return
    }
    const { data, error } = await supabase
      .from('daily_items')
      .update({ scheduled_date: targetDate })
      .eq('id', draggingId)
      .select('*, categories(*)')
      .single()
    if (error) {
      toast.error('Failed to move task')
    } else {
      onItemsChange(dailyItems.map((it) => (it.id === draggingId ? data : it)))
      toast.success(`Moved to ${new Date(targetDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`)
    }
    setDraggingId(null)
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid grid-cols-7 gap-2 min-w-[700px]">
        {days.map((date, i) => (
          <DayColumn
            key={date}
            date={date}
            dayName={DAY_NAMES[i]}
            isToday={date === today}
            items={dailyItems.filter((it) => it.scheduled_date === date)}
            draggingId={draggingId}
            userId={userId}
            weekPlanId={weekPlanId}
            categories={categories}
            onItemUpdate={handleItemUpdate}
            onItemDelete={handleItemDelete}
            onDragStart={(id) => setDraggingId(id)}
            onDragEnd={() => setDraggingId(null)}
            onDrop={handleDrop}
            onItemAdd={handleItemAdd}
          />
        ))}
      </div>
    </div>
  )
}
