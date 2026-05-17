import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  const { error } = await supabase.from('profiles').update({
    full_name: body.full_name,
    prayer_method: body.prayer_method,
    location_lat: body.location_lat ?? null,
    location_lng: body.location_lng ?? null,
    city: body.city,
    prayer_notification_offset: body.prayer_notification_offset,
    work_start_hour: body.work_start_hour,
    work_hours: body.work_hours,
    week_start_day: body.week_start_day ?? 0,
    updated_at: new Date().toISOString(),
  }).eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
