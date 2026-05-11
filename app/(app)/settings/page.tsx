import { createClient } from '@/lib/supabase/server'
import SettingsPageClient from './SettingsPageClient'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [profileRes, categoriesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('categories').select('*').eq('user_id', user.id).order('name'),
  ])

  return (
    <SettingsPageClient
      userId={user.id}
      profile={profileRes.data}
      email={user.email ?? ''}
      initialCategories={categoriesRes.data ?? []}
    />
  )
}
