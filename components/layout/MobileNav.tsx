'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, CalendarRange, BarChart2, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const MOBILE_NAV = [
  { href: '/', icon: LayoutDashboard, label: 'Today' },
  { href: '/week', icon: CalendarRange, label: 'Week' },
  { href: '/stats', icon: BarChart2, label: 'Stats' },
  { href: '/settings', icon: Settings, label: 'Settings' },
]

function getLocalWeekStart() {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
}

export default function MobileNav() {
  const pathname = usePathname()

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-50 safe-bottom">
      <div className="flex items-center justify-around px-2 py-2">
        {MOBILE_NAV.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
          const navHref = href === '/week' ? `/week?ws=${getLocalWeekStart()}` : href
          return (
            <Link
              key={href}
              href={navHref}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[44px]',
                isActive ? 'text-blue-400' : 'text-slate-500'
              )}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
