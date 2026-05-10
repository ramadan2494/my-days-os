'use client'

import { Prayer, Task, Profile } from '@/lib/supabase/types'
import { formatTime, timeToMinutes } from '@/lib/utils'
import { Lock } from 'lucide-react'

interface DailyTimelineProps {
  prayers: Prayer[]
  tasks: Task[]
  learningSessions: any[]
  profile: Profile | null
}

interface Block {
  id: string
  type: 'prayer' | 'work' | 'learning' | 'buffer'
  label: string
  startMin: number
  endMin: number
  color: string
  bgColor: string
  isProtected: boolean
  status?: string
}

const HOUR_HEIGHT = 48 // px per hour

export default function DailyTimeline({ prayers, tasks, learningSessions, profile }: DailyTimelineProps) {
  const workStart = (profile?.work_start_hour ?? 9) * 60
  const workEnd = workStart + (profile?.work_hours ?? 8) * 60

  const blocks: Block[] = []

  // Prayer blocks
  prayers.forEach(p => {
    const start = timeToMinutes(p.scheduled_time.slice(0, 5))
    blocks.push({
      id: p.id,
      type: 'prayer',
      label: p.name,
      startMin: start,
      endMin: start + 20,
      color: 'text-green-300',
      bgColor: 'bg-green-500/20 border-green-500/40',
      isProtected: true,
      status: p.status,
    })
  })

  // Work block
  blocks.push({
    id: 'work',
    type: 'work',
    label: '💼 Work Block',
    startMin: workStart,
    endMin: workEnd,
    color: 'text-blue-300',
    bgColor: 'bg-blue-500/20 border-blue-500/40',
    isProtected: false,
  })

  // Learning sessions
  learningSessions.forEach(s => {
    if (!s.scheduled_date) return
    const base = 14 * 60 // default 2pm if no time
    blocks.push({
      id: s.id,
      type: 'learning',
      label: `📚 ${s.title}`,
      startMin: base,
      endMin: base + (s.duration_minutes ?? 60),
      color: 'text-purple-300',
      bgColor: 'bg-purple-500/20 border-purple-500/40',
      isProtected: false,
    })
  })

  // Render hours 5am to 11pm
  const startHour = 5
  const endHour = 23
  const totalMinutes = (endHour - startHour) * 60
  const totalHeight = ((endHour - startHour)) * HOUR_HEIGHT

  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const nowOffset = ((nowMin - startHour * 60) / totalMinutes) * totalHeight

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
      <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
        <span className="text-slate-400">📅</span> Daily Timeline
      </h2>

      <div className="relative overflow-hidden" style={{ height: totalHeight }}>
        {/* Hour lines */}
        {Array.from({ length: endHour - startHour + 1 }, (_, i) => {
          const hour = startHour + i
          return (
            <div
              key={hour}
              className="absolute left-0 right-0 flex items-center gap-2"
              style={{ top: i * HOUR_HEIGHT }}
            >
              <span className="text-[10px] text-slate-600 w-10 text-right flex-shrink-0">
                {hour === 12 ? '12pm' : hour < 12 ? `${hour}am` : `${hour - 12}pm`}
              </span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>
          )
        })}

        {/* Blocks */}
        {blocks.map(block => {
          const top = ((block.startMin - startHour * 60) / totalMinutes) * totalHeight
          const height = Math.max(((block.endMin - block.startMin) / totalMinutes) * totalHeight, 20)
          return (
            <div
              key={block.id}
              className={`absolute left-14 right-2 rounded-lg border px-2 py-1 overflow-hidden ${block.bgColor}`}
              style={{ top, height }}
            >
              <div className="flex items-center gap-1">
                {block.isProtected && <Lock size={9} className="text-slate-400 flex-shrink-0" />}
                <span className={`text-[11px] font-medium truncate ${block.color}`}>{block.label}</span>
              </div>
              {block.status && block.status !== 'pending' && (
                <span className={`text-[9px] ${block.status === 'on_time' ? 'text-green-400' : block.status === 'late' ? 'text-yellow-400' : 'text-red-400'}`}>
                  {block.status}
                </span>
              )}
            </div>
          )
        })}

        {/* Current time indicator */}
        {nowMin >= startHour * 60 && nowMin <= endHour * 60 && (
          <div
            className="absolute left-0 right-0 flex items-center gap-2 z-10 pointer-events-none"
            style={{ top: nowOffset }}
          >
            <div className="w-10 flex justify-end">
              <div className="w-2 h-2 rounded-full bg-red-400" />
            </div>
            <div className="flex-1 h-px bg-red-400 opacity-70" />
          </div>
        )}
      </div>
    </div>
  )
}
