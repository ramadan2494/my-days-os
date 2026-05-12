import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.CLAUDE_API_KEY
  if (!apiKey)
    return NextResponse.json({ error: 'Claude API key not configured' }, { status: 500 })

  const { date } = await request.json()
  if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 })

  // Fetch today's items and user categories in parallel
  const [itemsRes, catsRes, profileRes] = await Promise.all([
    supabase
      .from('daily_items')
      .select('*, categories(name, icon)')
      .eq('user_id', user.id)
      .eq('scheduled_date', date)
      .order('created_at'),
    supabase
      .from('categories')
      .select('id, name, icon')
      .eq('user_id', user.id)
      .neq('name', 'Prayers')
      .order('name'),
    supabase.from('profiles').select('full_name').eq('id', user.id).single(),
  ])

  const items = itemsRes.data ?? []
  const categories = catsRes.data ?? []
  const firstName = profileRes.data?.full_name?.split(' ')[0] ?? 'Scholar'

  const dayOfWeek = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })
  const hour = new Date().getHours()
  const timeOfDay = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'

  // Summarise items for the prompt
  const prayers = items.filter(
    (it) => (it.categories as { name: string } | null)?.name === 'Prayers',
  )
  const tasks = items.filter(
    (it) => (it.categories as { name: string } | null)?.name !== 'Prayers',
  )

  const taskSummary = tasks.length
    ? tasks
        .map((t) => {
          const cat = (t.categories as { name: string; icon: string } | null)
          const status = t.status === 'done' ? '✓ done' : t.status === 'skipped' ? '⏭ skipped' : 'pending'
          return `- [${status}] ${t.title} (${cat?.name ?? 'General'})${t.is_bonus ? ' [BONUS]' : ''}`
        })
        .join('\n')
    : 'No tasks scheduled yet.'

  const prayerSummary = prayers.length
    ? `${prayers.filter((p) => p.status === 'done').length}/${prayers.length} prayers completed`
    : 'No prayers logged yet.'

  const categoryList = categories
    .map((c) => `${c.icon ?? ''} ${c.name} (id: ${c.id})`)
    .join(', ')

  const prompt = `You are a personal day coach for ${firstName}. It is ${timeOfDay} on ${dayOfWeek} (${date}).

TODAY'S PLAN:
${taskSummary}

PRAYERS: ${prayerSummary}

AVAILABLE CATEGORIES: ${categoryList}

Your job:
1. Give a short, encouraging 1-2 sentence review of their day plan.
2. Suggest 0-3 additional tasks they might want to add, based on gaps, balance, or common priorities (PhD work, learning, family, health). Only suggest tasks that are clearly missing — do NOT suggest if the plan is already full (5+ non-prayer tasks).
3. If you have no suggestions, leave the suggestions array empty.

Return ONLY valid JSON, no markdown, no explanation:
{
  "message": "short motivational review (1-2 sentences)",
  "suggestions": [
    {
      "title": "specific actionable task title",
      "category_id": "exact id from the AVAILABLE CATEGORIES list",
      "category_name": "category name",
      "category_icon": "emoji icon",
      "reason": "one short sentence explaining why"
    }
  ]
}`

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
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: (err as { error?: { message?: string } })?.error?.message ?? 'Claude error' },
        { status: res.status },
      )
    }

    const claudeData = await res.json()
    const raw = claudeData.content?.[0]?.text ?? '{}'

    // Strip accidental markdown fences
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(cleaned)

    return NextResponse.json({
      message: parsed.message ?? '',
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    })
  } catch (err) {
    console.error('day-organiser error', err)
    return NextResponse.json({ error: 'Failed to generate plan review' }, { status: 500 })
  }
}
