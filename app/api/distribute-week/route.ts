import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

interface WeeklyItemInput {
  id: string
  title: string
  category_id: string
  target_days: number
  priority: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.CLAUDE_API_KEY
  if (!apiKey)
    return NextResponse.json({ error: 'Claude API key not configured' }, { status: 500 })

  const { week_plan_id, weekly_items, week_start }: {
    week_plan_id: string
    weekly_items: WeeklyItemInput[]
    week_start: string
  } = await request.json()

  const prompt = `Distribute these weekly items across Monday to Sunday (day_index 0-6).
Each item has target_days — assign to exactly that many different days.
Spread tasks evenly. Avoid overloading one day. Sunday (6) is lighter: max 2 tasks.

Return ONLY a JSON array: [{"weekly_item_id": "uuid", "day_index": 0}]
For items with target_days > 1, include multiple entries for the same item with different day_index values.

Items to distribute:
${weekly_items
  .map(
    (it) =>
      `- id: "${it.id}", title: "${it.title}", target_days: ${it.target_days}, priority: ${it.priority}`
  )
  .join('\n')}`

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
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) return NextResponse.json({ error: 'Claude error' }, { status: 502 })

    const claudeData = await res.json()
    const text = (claudeData.content[0].text as string).trim()
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return NextResponse.json({ error: 'Invalid AI response' }, { status: 502 })

    const assignments: Array<{ weekly_item_id: string; day_index: number }> =
      JSON.parse(jsonMatch[0])

    const itemMap = Object.fromEntries(weekly_items.map((it) => [it.id, it]))
    const weekStartDate = new Date(week_start)

    const dailyItemRows = assignments.map((a) => {
      const item = itemMap[a.weekly_item_id]
      const date = new Date(weekStartDate)
      date.setDate(date.getDate() + (a.day_index ?? 0))
      return {
        user_id: user.id,
        week_plan_id,
        weekly_item_id: a.weekly_item_id,
        category_id: item.category_id,
        title: item.title,
        scheduled_date: date.toISOString().split('T')[0],
        status: 'pending',
      }
    })

    const { error } = await supabase.from('daily_items').insert(dailyItemRows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ created: dailyItemRows.length })
  } catch {
    return NextResponse.json({ error: 'Failed to distribute' }, { status: 500 })
  }
}
