'use client'

import { useState } from 'react'
import { FamilyEvent } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/client'
import { cn, todayISO } from '@/lib/utils'
import { Plus, X, Heart, Clock, CheckCircle2, Camera } from 'lucide-react'
import toast from 'react-hot-toast'

interface FamilyPageClientProps {
  userId: string
  initialEvents: FamilyEvent[]
  recentEvents: FamilyEvent[]
}

export default function FamilyPageClient({ userId, initialEvents, recentEvents }: FamilyPageClientProps) {
  const [events, setEvents] = useState(initialEvents)
  const [showAdd, setShowAdd] = useState(false)
  const [showQuickLog, setShowQuickLog] = useState(false)
  const [quickNote, setQuickNote] = useState('')
  const [form, setForm] = useState({
    title: '', description: '', event_date: todayISO(),
    start_time: '', end_time: '', is_recurring: false, recurrence_rule: '',
  })
  const supabase = createClient()
  const today = todayISO()

  const todayEvents = events.filter(e => e.event_date === today)
  const upcomingEvents = events.filter(e => e.event_date && e.event_date > today).slice(0, 5)
  const completedThisWeek = recentEvents.filter(e => e.status === 'completed')
  const hoursThisWeek = completedThisWeek.reduce((sum, e) => {
    if (e.start_time && e.end_time) {
      const [sh, sm] = e.start_time.split(':').map(Number)
      const [eh, em] = e.end_time.split(':').map(Number)
      return sum + (eh * 60 + em - sh * 60 - sm) / 60
    }
    return sum + 1
  }, 0)

  async function addEvent(e: React.FormEvent) {
    e.preventDefault()
    const { data, error } = await supabase.from('family_events').insert({
      user_id: userId, ...form,
    }).select().single()
    if (error) { toast.error('Failed to add event'); return }
    setEvents(prev => [...prev, data].sort((a, b) => (a.event_date ?? '').localeCompare(b.event_date ?? '')))
    setShowAdd(false)
    setForm({ title: '', description: '', event_date: today, start_time: '', end_time: '', is_recurring: false, recurrence_rule: '' })
    toast.success('Family event added! 💛')
  }

  async function markCompleted(event: FamilyEvent) {
    const xp = 20
    const { data } = await supabase.from('family_events').update({
      status: 'completed', xp_earned: xp,
    }).eq('id', event.id).select().single()
    if (data) {
      setEvents(prev => prev.map(ev => ev.id === event.id ? data : ev))
      await supabase.rpc('increment_xp', { user_id: userId, amount: xp }).then(() => null, () => null)
      toast.success(`Family time logged! +${xp} XP 💛`)
    }
  }

  async function quickLog() {
    if (!quickNote.trim()) return
    const { data } = await supabase.from('family_events').insert({
      user_id: userId, title: quickNote, event_date: today,
      status: 'completed', quick_log_note: quickNote, xp_earned: 15,
    }).select().single()
    if (data) {
      setEvents(prev => [data, ...prev])
      await supabase.rpc('increment_xp', { user_id: userId, amount: 15 }).then(() => null, () => null)
      toast.success('Moment logged! +15 XP 📸')
    }
    setQuickNote('')
    setShowQuickLog(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Family Time</h1>
          <p className="text-slate-400 text-sm mt-0.5">Protected time for what matters most</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowQuickLog(true)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 py-2.5 rounded-xl text-sm transition-colors">
            <Camera size={14} /> Quick Log
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
            <Plus size={16} /> Add Event
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Today\'s Events', value: todayEvents.length, color: 'text-orange-400' },
          { label: 'Hours This Week', value: `${hoursThisWeek.toFixed(1)}h`, color: 'text-green-400' },
          { label: 'Done This Week', value: completedThisWeek.length, color: 'text-blue-400' },
        ].map(s => (
          <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Today */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <Heart size={16} className="text-orange-400" /> Today&apos;s Family Time
        </h2>
        {todayEvents.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-slate-400 text-sm">No family events scheduled today.</p>
            <p className="text-slate-500 text-xs mt-1">Make time for your family — they&apos;re why you do all of this.</p>
            <button onClick={() => setShowAdd(true)} className="mt-3 text-orange-400 text-sm hover:underline">Schedule time →</button>
          </div>
        ) : (
          <div className="space-y-2">
            {todayEvents.map(event => (
              <div key={event.id} className={cn(
                'flex items-center gap-3 p-3.5 rounded-xl border transition-all',
                event.status === 'completed' ? 'border-orange-500/20 bg-orange-500/5' : 'border-slate-700 bg-slate-800'
              )}>
                <Heart size={16} className={event.status === 'completed' ? 'text-orange-400' : 'text-slate-500'} />
                <div className="flex-1">
                  <p className={cn('text-sm font-medium', event.status === 'completed' ? 'text-slate-400 line-through' : 'text-white')}>
                    {event.title}
                  </p>
                  {event.start_time && (
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <Clock size={10} /> {event.start_time} {event.end_time && `— ${event.end_time}`}
                    </p>
                  )}
                </div>
                {event.status !== 'completed' && (
                  <button onClick={() => markCompleted(event)}
                    className="text-xs text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 px-3 py-1.5 rounded-lg transition-colors">
                    Done ✓
                  </button>
                )}
                {event.status === 'completed' && <CheckCircle2 size={16} className="text-orange-400" />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upcoming */}
      {upcomingEvents.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h2 className="font-semibold text-white mb-4">Upcoming</h2>
          <div className="space-y-2">
            {upcomingEvents.map(event => (
              <div key={event.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-800">
                <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex flex-col items-center justify-center flex-shrink-0">
                  <span className="text-[10px] text-orange-400 font-medium">
                    {event.event_date ? new Date(event.event_date + 'T12:00').toLocaleDateString('en', { month: 'short' }) : ''}
                  </span>
                  <span className="text-base font-bold text-orange-400">
                    {event.event_date ? new Date(event.event_date + 'T12:00').getDate() : ''}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{event.title}</p>
                  {event.start_time && <p className="text-xs text-slate-500">{event.start_time}</p>}
                  {event.is_recurring && <span className="text-[10px] text-blue-400">↻ Recurring</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Log Modal */}
      {showQuickLog && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white flex items-center gap-2">
                <Camera size={16} className="text-orange-400" /> Quick Family Moment
              </h2>
              <button onClick={() => setShowQuickLog(false)}><X size={18} className="text-slate-500" /></button>
            </div>
            <input
              value={quickNote}
              onChange={e => setQuickNote(e.target.value)}
              placeholder="e.g. Played with Ahmed in the park..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 mb-4"
              onKeyDown={e => e.key === 'Enter' && quickLog()}
              autoFocus
            />
            <button onClick={quickLog} className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 rounded-xl transition-colors">
              Log Moment 📸 (+15 XP)
            </button>
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white">Add Family Event</h2>
              <button onClick={() => setShowAdd(false)}><X size={18} className="text-slate-500" /></button>
            </div>
            <form onSubmit={addEvent} className="space-y-3">
              <input required placeholder="Event title *" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500" />
              <textarea placeholder="Description (optional)" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 resize-none" />
              <div>
                <label className="text-xs text-slate-400 mb-1 block">Date</label>
                <input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Start time</label>
                  <input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">End time</label>
                  <input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500" />
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_recurring} onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked }))}
                  className="w-4 h-4 accent-orange-500" />
                <span className="text-sm text-slate-300">Recurring event</span>
              </label>
              {form.is_recurring && (
                <select value={form.recurrence_rule} onChange={e => setForm(f => ({ ...f, recurrence_rule: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500">
                  <option value="">Select recurrence...</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="weekdays">Weekdays</option>
                  <option value="weekends">Weekends</option>
                </select>
              )}
              <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 rounded-xl transition-colors">
                Add Event 💛
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
