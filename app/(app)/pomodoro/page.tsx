import { Suspense } from 'react'
import PomodoroClient from './PomodoroClient'

export default function PomodoroPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh] text-slate-500 animate-pulse">Loading…</div>}>
      <PomodoroClient />
    </Suspense>
  )
}
