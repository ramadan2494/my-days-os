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

  const { week_start, items, hours_per_day = 8 } = await request.json()

  const prompt = `You are a weekly productivity planner. The user has described their goals for the week.
Return ONLY a valid JSON array, no explanation, no markdown fences.

Week starts: ${week_start}
Available hours per day: ${hours_per_day}

Goals by category:
${items
  .map((it: { category_name: string; category_id: string; topic: string }) =>
    `- ${it.category_name} (id: ${it.category_id}): ${it.topic}`
  )
  .join('\n')}

Return a JSON array where each element has:
{
  "title": "specific actionable task title",
  "category_name": "must exactly match one of the input category names",
  "category_id": "must match the category_id from the input",
  "day_index": 0,
  "priority": "high|medium|low",
  "description": "what to do specifically"
}

day_index: 0=Monday, 1=Tuesday, 2=Wednesday, 3=Thursday, 4=Friday, 5=Saturday, 6=Sunday
Rules:
- Create 2-4 tasks per day total, spread across Mon-Sun
- Sunday (6) is lighter: max 2 tasks
- Be specific and actionable in titles
- Match each task's category_id exactly from the input`

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
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json(
        { error: (err as { error?: { message?: string } })?.error?.message ?? 'Claude error' },
        { status: 502 }
      )
    }

    const claudeData = await res.json()
    const text = (claudeData.content[0].text as string).trim()
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) return NextResponse.json({ error: 'Invalid AI response' }, { status: 502 })

    const tasks = JSON.parse(jsonMatch[0])
    const weekStartDate = new Date(week_start)

    const tasksWithDates = tasks.map((t: { day_index?: number } & Record<string, unknown>) => {
      const date = new Date(weekStartDate)
      date.setDate(date.getDate() + (t.day_index ?? 0))
      return { ...t, scheduled_date: date.toISOString().split('T')[0] }
    })

    return NextResponse.json({ tasks: tasksWithDates })
  } catch {
    return NextResponse.json({ error: 'Failed to generate plan' }, { status: 500 })
  }
}
