'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Moon,
  CheckSquare,
  BookOpen,
  Heart,
  Brain,
  User,
  Settings,
  LogOut,
  Zap,
} from 'lucide-react'
import { cn, getLevelTitle } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Profile } from '@/lib/supabase/types'

const NAV_ITEMS = [
  { href: '/', icon: LayoutDashboard, label: 'Today', color: 'text-blue-400' },
  { href: '/prayer', icon: Moon, label: 'Prayer', color: 'text-green-400' },
  { href: '/work', icon: CheckSquare, label: 'Work', color: 'text-blue-400' },
  { href: '/learning', icon: BookOpen, label: 'Learning', color: 'text-purple-400' },
  { href: '/family', icon: Heart, label: 'Family', color: 'text-orange-400' },
  { href: '/coaching', icon: Brain, label: 'Coaching', color: 'text-pink-400' },
  { href: '/profile', icon: User, label: 'Profile', color: 'text-slate-400' },
  { href: '/settings', icon: Settings, label: 'Settings', color: 'text-slate-400' },
]

interface SidebarProps {
  profile: Profile | null
}

export default function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const levelTitle = getLevelTitle(profile?.level ?? 1)
  const currentXP = profile?.xp ?? 0
  const nextLevelXP = (profile?.level ?? 1) * 500
  const xpProgress = Math.min((currentXP % nextLevelXP) / nextLevelXP * 100, 100)

  return (
    <aside className="hidden md:flex flex-col w-60 bg-slate-900 border-r border-slate-800 h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
            M
          </div>
          <div>
            <div className="text-white font-bold text-sm">MyDayOS</div>
            <div className="text-slate-500 text-xs">Life Operating System</div>
          </div>
        </div>
      </div>

      {/* XP / Level */}
      <div className="px-5 py-4 border-b border-slate-800">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-xs text-slate-400">Lv.{profile?.level ?? 1} · {levelTitle}</span>
          </div>
          <span className="text-xs text-yellow-400 font-medium">{currentXP} XP</span>
        </div>
        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full transition-all duration-500"
            style={{ width: `${xpProgress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-xs text-slate-600">🔥 {profile?.daily_streak ?? 0} day streak</span>
          <span className="text-xs text-slate-600">{nextLevelXP} XP</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label, color }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                isActive
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              )}
            >
              <Icon className={cn('w-4.5 h-4.5', isActive ? color : 'text-slate-500')} size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Sign out */}
      <div className="px-3 py-3 border-t border-slate-800">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
        >
          <LogOut size={18} className="text-slate-500" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
