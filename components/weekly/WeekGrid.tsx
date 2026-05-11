'use client'

import { DailyItem, Category } from '@/lib/supabase/types'
import DayColumn from './DayColumn'

interface Props {
  userId: string
  weekStart: string
  weekPlanId: string
  dailyItems: (DailyItem & { categories?: Category })[]
  categories: Category[]
  onItemsChange: (items: (DailyItem & { categories?: Category })[]) => void
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function WeekGrid({
  dailyItems,
  weekStart,
  onItemsChange,
}: Props) {
  const today = new Date().toISOString().split('T')[0]

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d.toISOString().split('T')[0]
  })

  function handleItemUpdate(updated: DailyItem & { categories?: Category }) {
    onItemsChange(dailyItems.map((it) => (it.id === updated.id ? updated : it)))
  }

  if (dailyItems.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-slate-400 font-medium">No tasks distributed yet</p>
        <p className="text-slate-600 text-sm mt-1">
          Go to the Plan tab and click &quot;Distribute&quot; to assign items to days
        </p>
      </div>
    )
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
            onItemUpdate={handleItemUpdate}
          />
        ))}
      </div>
    </div>
  )
}
