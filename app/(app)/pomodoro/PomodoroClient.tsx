'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Play, Pause, RotateCcw, CheckCircle, ArrowLeft, Coffee } from 'lucide-react'
import toast from 'react-hot-toast'

const MODES = {
  focus:  { label: 'Focus',       minutes: 25, color: 'from-red-600 to-orange-500',   ring: 'ring-red-500/40'   },
  short:  { label: 'Short Break', minutes: 5,  color: 'from-green-600 to-emerald-500', ring: 'ring-green-500/40' },
  long:   { label: 'Long Break',  minutes: 15, color: 'from-blue-600 to-indigo-500',   ring: 'ring-blue-500/40'  },
} as const

type Mode = keyof typeof MODES

export default function PomodoroClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()

  const taskId    = searchParams.get('task_id') ?? null
  const taskTitle = searchParams.get('title')   ?? 'Focus Session'

  const [mode, setMode]       = useState<Mode>('focus')
  const [seconds, setSeconds] = useState(MODES.focus.minutes * 60)
  const [running, setRunning] = useState(false)
  const [sessions, setSessions] = useState(0)
  const [done, setDone]       = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef    = useRef<AudioContext | null>(null)

  const totalSeconds = MODES[mode].minutes * 60
  const progress     = ((totalSeconds - seconds) / totalSeconds) * 100

  // Switch mode — resets timer
  function switchMode(m: Mode) {
    clearInterval(intervalRef.current!)
    setRunning(false)
    setMode(m)
    setSeconds(MODES[m].minutes * 60)
    setDone(false)
  }

  // Tick
  useEffect(() => {
    if (!running) return
    intervalRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          clearInterval(intervalRef.current!)
          setRunning(false)
          setDone(true)
          playChime()
          if (mode === 'focus') setSessions((n) => n + 1)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current!)
  }, [running, mode])

  function playChime() {
    try {
      const ctx = new AudioContext()
      audioRef.current = ctx
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, ctx.currentTime)
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.8)
      gain.gain.setValueAtTime(0.4, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 1.2)
    } catch { /* audio not supported */ }
  }

  function reset() {
    clearInterval(intervalRef.current!)
    setRunning(false)
    setSeconds(MODES[mode].minutes * 60)
    setDone(false)
  }

  async function markTaskDone() {
    if (!taskId) return
    const { error } = await supabase
      .from('daily_items')
      .update({ status: 'done', completed_at: new Date().toISOString(), xp_earned: 15 })
      .eq('id', taskId)
    if (error) {
      toast.error('Failed to mark task done')
    } else {
      toast.success('✅ Task marked done!')
      router.back()
    }
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0')
  const ss = String(seconds % 60).padStart(2, '0')

  // SVG circle progress
  const RADIUS = 110
  const CIRC   = 2 * Math.PI * RADIUS
  const offset = CIRC * (1 - progress / 100)

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      {/* Back */}
      <div className="w-full flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <span className="text-slate-500 text-xs ml-auto">
          🍅 {sessions} session{sessions !== 1 ? 's' : ''} today
        </span>
      </div>

      {/* Task name */}
      <div className="text-center">
        <p className="text-slate-400 text-xs uppercase tracking-widest mb-1">Now focusing on</p>
        <h1 className="text-white text-xl font-bold max-w-sm text-center leading-snug">
          {taskTitle}
        </h1>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 bg-slate-800/80 p-1 rounded-2xl">
        {(Object.keys(MODES) as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            className={cn(
              'px-4 py-2 rounded-xl text-sm font-medium transition-all',
              mode === m ? 'bg-slate-700 text-white shadow' : 'text-slate-500 hover:text-slate-300',
            )}
          >
            {m === 'focus' ? '🍅' : m === 'short' ? '☕' : '🛋️'} {MODES[m].label}
          </button>
        ))}
      </div>

      {/* Timer ring */}
      <div className={cn('relative flex items-center justify-center p-4 rounded-full ring-4', MODES[mode].ring)}>
        <svg width={280} height={280} className="-rotate-90">
          {/* Track */}
          <circle
            cx={140} cy={140} r={RADIUS}
            fill="none"
            stroke="#1e293b"
            strokeWidth={12}
          />
          {/* Progress */}
          <circle
            cx={140} cy={140} r={RADIUS}
            fill="none"
            stroke="url(#grad)"
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            style={{ transition: running ? 'stroke-dashoffset 1s linear' : 'none' }}
          />
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={mode === 'focus' ? '#dc2626' : mode === 'short' ? '#16a34a' : '#2563eb'} />
              <stop offset="100%" stopColor={mode === 'focus' ? '#f97316' : mode === 'short' ? '#10b981' : '#6366f1'} />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className={cn(
            'text-6xl font-mono font-bold tabular-nums',
            done ? 'text-green-400' : 'text-white',
          )}>
            {mm}:{ss}
          </span>
          <span className="text-slate-400 text-sm mt-1">{MODES[mode].label}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        <button
          onClick={reset}
          className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
          title="Reset"
        >
          <RotateCcw size={20} />
        </button>
        <button
          onClick={() => { if (!done) setRunning((r) => !r) }}
          disabled={done}
          className={cn(
            'flex items-center gap-2 px-8 py-4 rounded-2xl text-white font-bold text-lg transition-all shadow-lg',
            done
              ? 'bg-green-600 cursor-default'
              : running
              ? 'bg-slate-700 hover:bg-slate-600'
              : `bg-gradient-to-r ${MODES[mode].color} hover:opacity-90 active:scale-95`,
          )}
        >
          {done ? (
            <><CheckCircle size={22} /> Done!</>
          ) : running ? (
            <><Pause size={22} /> Pause</>
          ) : (
            <><Play size={22} /> {seconds === totalSeconds ? 'Start' : 'Resume'}</>
          )}
        </button>
        {mode === 'focus' && (
          <button
            onClick={() => switchMode('short')}
            className="p-3 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all"
            title="Take a short break"
          >
            <Coffee size={20} />
          </button>
        )}
      </div>

      {/* Done panel */}
      {done && mode === 'focus' && (
        <div className="w-full max-w-sm bg-green-900/30 border border-green-500/30 rounded-2xl p-5 text-center space-y-3">
          <p className="text-green-400 font-semibold text-lg">🎉 Pomodoro complete!</p>
          <p className="text-slate-400 text-sm">Great focus session. Take a break or keep going.</p>
          <div className="flex gap-2">
            <button
              onClick={() => switchMode('short')}
              className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors"
            >
              ☕ Short Break
            </button>
            {taskId && (
              <button
                onClick={markTaskDone}
                className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors"
              >
                ✅ Mark Task Done
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tips */}
      {!running && !done && seconds === totalSeconds && (
        <p className="text-slate-600 text-xs text-center max-w-xs">
          Each 🍅 is 25 minutes of deep focus. After 4 sessions take a long break.
        </p>
      )}
    </div>
  )
}
