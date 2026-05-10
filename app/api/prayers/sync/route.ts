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

  const prayers = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as const
  const inserts = prayers.map(name => ({
    user_id: user.id,
    date: targetDate,
    name,
    scheduled_time: times[name],
    status: 'pending',
    xp_earned: 0,
  }))

  const { error } = await supabase.from('prayers').upsert(inserts, {
    onConflict: 'user_id,date,name',
    ignoreDuplicates: true, // never overwrite status of already-recorded prayers
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ times, message: 'Prayer times synced successfully' })
}
