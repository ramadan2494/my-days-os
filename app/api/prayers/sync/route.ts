import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { fetchPrayerTimes, PRAYER_METHOD_MAP } from '@/lib/prayer-times'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date } = await request.json()
  const targetDate = date ?? new Date().toISOString().split('T')[0]

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()

  if (!profile?.location_lat || !profile?.location_lng) {
    return NextResponse.json({ error: 'Location not set. Go to Settings to set your city.' }, { status: 400 })
  }

  const method = PRAYER_METHOD_MAP[profile.prayer_method ?? 'MWL'] ?? 3
  const times = await fetchPrayerTimes(profile.location_lat, profile.location_lng, method, targetDate)

  if (!times) {
    return NextResponse.json({ error: 'Failed to fetch prayer times' }, { status: 502 })
  }

  // Fetch prayers that are already completed so we don't overwrite them
  const { data: completedPrayers } = await supabase
    .from('prayers')
    .select('name')
    .eq('user_id', user.id)
    .eq('date', targetDate)
    .neq('status', 'pending')

  const completedNames = new Set(completedPrayers?.map((p: { name: string }) => p.name) ?? [])

  const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const
  // Only upsert prayers that haven't been completed/missed yet
  const inserts = prayers
    .filter(name => !completedNames.has(name))
    .map(name => ({
      user_id: user.id,
      date: targetDate,
      name,
      scheduled_time: times[name],
      status: 'pending',
      xp_earned: 0,
    }))

  if (inserts.length > 0) {
    const { error } = await supabase.from('prayers').upsert(inserts, {
      onConflict: 'user_id,date,name',
      ignoreDuplicates: false, // update scheduled_time for pending prayers
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ times, message: 'Prayer times synced successfully' })
}
