import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface ReviewItem {
  title: string
  category_name: string
  priority: string
  done: boolean
  actual_minutes: number
  is_bonus: boolean
  is_prayer: boolean
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.CLAUDE_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Claude API key not configured' }, { status: 500 })

  const { items, weekStart, weekEnd, profileName, categories, weekPlanId } = (await request.json()) as {
    items: ReviewItem[]
    weekStart: string
    weekEnd: string
    profileName: string
    categories: { name: string; color: string }[]
    weekPlanId?: string
  }

  // ── Return cached review if available ──────────────────────────────────────
  if (weekPlanId) {
    const { data: plan } = await supabase
      .from('week_plans')
      .select('review_cache, review_cached_at')
      .eq('id', weekPlanId)
      .single()
    if (plan?.review_cache) {
      return NextResponse.json({ ...plan.review_cache, cached: true, cachedAt: plan.review_cached_at })
    }
  }

  const mainItems = items.filter((it) => !it.is_prayer && !it.is_bonus)
  const bonusItems = items.filter((it) => it.is_bonus)

  // Fetch prayers directly from the prayers table for this week range.
  // Only include prayers with a definitive status (on_time / late / missed) —
  // "pending" means the prayer window hasn't passed yet so it should not be counted.
  const today = new Date().toISOString().split('T')[0]
  const { data: prayerRows } = await supabase
    .from('prayers')
    .select('name, status, date')
    .eq('user_id', user.id)
    .gte('date', weekStart)
    .lte('date', today < weekEnd ? today : weekEnd)
    .in('status', ['on_time', 'late', 'missed'])
    .order('date')
    .order('name')

  const prayers = prayerRows ?? []
  const totalPrayers = prayers.length
  const donePrayers = prayers.filter((p) => p.status === 'on_time' || p.status === 'late').length

  const totalMain = mainItems.length
  const doneMain = mainItems.filter((it) => it.done).length
  const totalBonus = bonusItems.length
  const doneBonus = bonusItems.filter((it) => it.done).length
  const totalMinutes = items.reduce((s, it) => s + (it.actual_minutes ?? 0), 0)

  // Category breakdown
  const catStats = categories.map((cat) => {
    const catItems = mainItems.filter((it) => it.category_name === cat.name)
    const catDone = catItems.filter((it) => it.done).length
    return { name: cat.name, total: catItems.length, done: catDone }
  }).filter((c) => c.total > 0)

  const prompt = `You are a weekly productivity coach. Analyse the week for ${profileName || 'the user'}.

Week: ${weekStart} → ${weekEnd}

STATS:
- Main tasks: ${doneMain}/${totalMain} done (${totalMain > 0 ? Math.round((doneMain / totalMain) * 100) : 0}%)
- Prayers: ${donePrayers}/${totalPrayers} completed
- Bonus tasks: ${doneBonus}/${totalBonus} done
- Total time tracked: ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m

CATEGORY BREAKDOWN:
${catStats.map((c) => `- ${c.name}: ${c.done}/${c.total} (${c.total > 0 ? Math.round((c.done / c.total) * 100) : 0}%)`).join('\n')}

PRAYER DETAILS (date | name | status):
${prayers.length > 0 ? prayers.map((p) => `- ${p.date} | ${p.name} | ${p.status}`).join('\n') : '- No prayer data'}

TASK DETAILS (title | category | priority | done | minutes):
${mainItems.map((it) => `- "${it.title}" | ${it.category_name} | ${it.priority} | ${it.done ? '✓' : '✗'} | ${it.actual_minutes ?? 0}m`).join('\n')}

Return ONLY valid JSON (no markdown fences):
{
  "summary": "2-3 sentences on the overall week performance, honest but encouraging",
  "focusAreas": ["area 1", "area 2", "area 3"],
  "motivation": "one short motivational sentence for next week"
}

focusAreas: 2-3 specific areas to improve next week based on missed tasks, low-completion categories, or skipped priorities. Be concrete (e.g. "Increase PhD thesis writing — only 1/4 tasks done"). Max 3 items.`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: (err as { error?: { message?: string } })?.error?.message ?? 'Claude error' },
        { status: 502 },
      )
    }

    const claudeData = await res.json()
    const text = (claudeData.content[0].text as string).trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Invalid AI response' }, { status: 502 })

    const report = JSON.parse(jsonMatch[0]) as {
      summary: string
      focusAreas: string[]
      motivation: string
    }

    // ── Save to cache ──────────────────────────────────────────────────────
    if (weekPlanId) {
      await supabase
        .from('week_plans')
        .update({ review_cache: report, review_cached_at: new Date().toISOString() })
        .eq('id', weekPlanId)
    }

    return NextResponse.json(report)
  } catch {
    return NextResponse.json({ error: 'Failed to generate review' }, { status: 500 })
  }
}
