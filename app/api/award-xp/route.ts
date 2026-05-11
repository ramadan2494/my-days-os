import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function calcXP({
  category_name,
  priority,
  is_prayer,
  prayer_status,
}: {
  category_name: string
  priority: string
  is_prayer: boolean
  prayer_status?: string
}): number {
  if (is_prayer) return prayer_status === 'on_time' ? 20 : 8
  if (priority === 'high') return 25
  if (priority === 'medium') return 15
  return 10
}

function calcLevel(xp: number): number {
  return Math.floor(xp / 500) + 1
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const {
    item_id,
    category_name = '',
    priority = 'medium',
    is_prayer = false,
    prayer_status,
  } = body

  const xp_earned = calcXP({ category_name, priority, is_prayer, prayer_status })

  await supabase.from('xp_log').insert({
    user_id: user.id,
    source_type: is_prayer ? 'prayer' : 'daily_item',
    source_id: item_id ?? null,
    xp_amount: xp_earned,
  })

  const { data: profile } = await supabase
    .from('profiles')
    .select('xp, level')
    .eq('id', user.id)
    .single()

  const old_level = profile?.level ?? 1
  const new_xp = (profile?.xp ?? 0) + xp_earned
  const new_level = calcLevel(new_xp)

  await supabase
    .from('profiles')
    .update({ xp: new_xp, level: new_level, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  const new_badges = await checkBadges(supabase, user.id, new_xp)

  return NextResponse.json({
    xp_earned,
    new_total_xp: new_xp,
    new_level,
    level_up: new_level > old_level,
    new_badges,
  })
}

async function checkBadges(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  totalXp: number
) {
  const { data: existing } = await supabase
    .from('badges')
    .select('badge_key')
    .eq('user_id', userId)

  const earned = new Set((existing ?? []).map((b: { badge_key: string }) => b.badge_key))
  const toAward: Array<{ key: string; name: string; icon: string; desc: string }> = []

  if (totalXp >= 1 && !earned.has('first_step'))
    toAward.push({ key: 'first_step', name: 'First Step', icon: '🥇', desc: 'Completed your first item' })
  if (totalXp >= 100 && !earned.has('100xp'))
    toAward.push({ key: '100xp', name: '100 XP Club', icon: '💯', desc: 'Earned 100 total XP' })
  if (totalXp >= 500 && !earned.has('500xp'))
    toAward.push({ key: '500xp', name: 'Level Up Legend', icon: '⚡', desc: 'Earned 500 total XP' })

  if (toAward.length > 0) {
    await supabase.from('badges').insert(
      toAward.map((b) => ({
        user_id: userId,
        badge_key: b.key,
        badge_name: b.name,
        badge_icon: b.icon,
        badge_description: b.desc,
      }))
    )
  }
  return toAward
}
