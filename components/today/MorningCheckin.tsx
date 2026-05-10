'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Sun } from 'lucide-react'

interface MorningCheckinProps {
  userId: string
  date: string
}

export default function MorningCheckin({ userId, date }: MorningCheckinProps) {
  const [mood, setMood] = useState(3)
  const [energy, setEnergy] = useState(3)
  const [focus, setFocus] = useState('')
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  if (dismissed) return null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    await supabase.from('daily_scores').upsert({
      user_id: userId,
      date,
      mood,
      energy,
    }, { onConflict: 'user_id,date' })

    await supabase.from('coaching_logs').insert({
      user_id: userId,
      type: 'morning_checkin',
      content: { mood, energy, focus },
    })

    toast.success('Morning check-in saved! Have a great day ☀️')
    setDismissed(true)
    router.refresh()
    setLoading(false)
  }

  const EMOJIS = ['😔', '😐', '🙂', '😊', '🔥']

  return (
    <div className="bg-gradient-to-br from-amber-950/40 to-orange-950/30 border border-amber-800/30 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sun className="text-yellow-400" size={18} />
          <h2 className="font-semibold text-white">Morning Check-In</h2>
        </div>
        <button onClick={() => setDismissed(true)} className="text-slate-500 hover:text-slate-300 text-xs">Skip</button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm text-slate-400 mb-2 block">How&apos;s your mood?</label>
          <div className="flex gap-2">
            {EMOJIS.map((emoji, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setMood(i + 1)}
                className={`text-2xl p-2 rounded-xl transition-all ${mood === i + 1 ? 'bg-slate-700 scale-110' : 'hover:bg-slate-800'}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-slate-400 mb-2 block">Energy level: <span className="text-white">{energy}/5</span></label>
          <input
            type="range" min="1" max="5" value={energy}
            onChange={e => setEnergy(Number(e.target.value))}
            className="w-full accent-yellow-400"
          />
        </div>

        <div>
          <label className="text-sm text-slate-400 mb-1.5 block">Main focus for today? (optional)</label>
          <input
            type="text"
            value={focus}
            onChange={e => setFocus(e.target.value)}
            placeholder="e.g. Finish chapter 3, deep work on thesis..."
            className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-yellow-500 transition-colors"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-slate-950 font-semibold py-2.5 rounded-xl transition-colors"
        >
          {loading ? 'Saving...' : 'Start My Day ☀️'}
        </button>
      </form>
    </div>
  )
}
