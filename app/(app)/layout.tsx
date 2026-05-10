import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import MobileNav from '@/components/layout/MobileNav'

export const dynamic = 'force-dynamic'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Desktop Sidebar */}
      <Sidebar profile={profile} />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
        <div className="max-w-5xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <MobileNav />
    </div>
  )
}
