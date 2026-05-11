import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const PRAYER_NAMES = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha']

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Accept date from client (local time) so timezone offsets don't produce wrong day
  let today: string
  try {
    const body = await request.json().catch(() => ({}))
    today = typeof body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)
      ? body.date
      : new Date().toISOString().split('T')[0]
  } catch {
    today = new Date().toISOString().split('T')[0]
  }

  const { data: existing } = await supabase
    .from('daily_items')
    .select('title')
    .eq('user_id', user.id)
    .eq('scheduled_date', today)
    .in('title', PRAYER_NAMES)

  const existingNames = new Set((existing ?? []).map((e: { title: string }) => e.title))
  const missing = PRAYER_NAMES.filter((n) => !existingNames.has(n))

  if (missing.length === 0) return NextResponse.json({ created: 0 })

  const { data: prayerCat } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', user.id)
    .eq('name', 'Prayers')
    .single()

  if (!prayerCat) {
    return NextResponse.json(
      { error: 'Prayers category not found — run the backfill SQL first' },
      { status: 400 }
    )
  }

  const rows = missing.map((name) => ({
    user_id: user.id,
    week_plan_id: null,
    weekly_item_id: null,
    category_id: prayerCat.id,
    title: name,
    scheduled_date: today,
    status: 'pending',
  }))

  const { error } = await supabase.from('daily_items').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ created: rows.length })
}
