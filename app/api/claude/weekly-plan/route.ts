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

  const { week_start, items, focusHint, carryoverItems } = await request.json()

  // User schedule: Sun-Thu = work days, Fri-Sat = vacation
  // Only "Work" (day job) is WORK — Business, PhD, Learning etc. are all FLEXIBLE
  const WORK_ONLY_CATEGORIES = ['Work']
  const inputItems = (items ?? []) as { category_name: string; category_id: string; topic: string; hours_per_week?: number }[]

  // In "continue" mode items may be empty — derive categories from carryover items so AI has valid category IDs
  const carried = (carryoverItems ?? []) as { title: string; category_name: string; category_id: string; priority: string }[]
  const extraCategories: typeof inputItems = []
  if (inputItems.length === 0 && carried.length > 0) {
    const seen = new Set<string>()
    for (const c of carried) {
      if (!seen.has(c.category_id)) {
        seen.add(c.category_id)
        extraCategories.push({ category_id: c.category_id, category_name: c.category_name, topic: 'Continue and build on previous work' })
      }
    }
  }

  const categoryMeta = [...inputItems, ...extraCategories]
    .map((it) => ({
      ...it,
      is_work: WORK_ONLY_CATEGORIES.some((w) => it.category_name.toLowerCase().includes(w.toLowerCase())),
    }))

  const prompt = `You are a weekly productivity planner. The user has described their goals for the week.
Return ONLY a valid JSON array, no explanation, no markdown fences.

Week starts: ${week_start}

USER'S WEEKLY SCHEDULE (Middle-East work week):
- Sunday(0), Monday(1), Tuesday(2), Wednesday(3), Thursday(4): WORK DAYS — have job commitments
- Friday(5) and Saturday(6): WEEKEND / VACATION — free for Learning, PhD, Family, Book

Goals by category:
${categoryMeta
  .map((it) => `- ${it.category_name} (id: ${it.category_id}) [${it.is_work ? 'WORK' : 'FLEXIBLE'}]: ${it.topic}${it.hours_per_week ? ` (${it.hours_per_week}h/week target)` : ''}`)
  .join('\n')}${carried.length > 0 ? `

CARRIED OVER FROM LAST WEEK (incomplete tasks to continue — generate NEW tasks around these, do NOT repeat them in the output):
${carried.map((it) => `- "${it.title}" (${it.category_name}, ${it.priority})`).join('\n')}` : ''}

Return a JSON array where each element has:
{
  "title": "specific actionable task title",
  "category_name": "must exactly match one of the input category names",
  "category_id": "must match the category_id from the input",
  "day_index": 0,
  "priority": "high|medium|low",
  "description": "what to do specifically"
}

day_index: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday

CRITICAL RULES — follow exactly:
1. [WORK] items (Work day-job only) → ONLY on work days: Sun(0), Mon(1), Tue(2), Wed(3), Thu(4). NEVER on Fri(5) or Sat(6).
2. Business, PhD, Learning, Book, Soft Skill are FLEXIBLE → spread across ALL work days AND Fri-Sat. Friday and Saturday are ideal for long sessions.
3. Family items → any day, especially Fri(5) and Sat(6).
4. Each work day (Sun-Thu): 1 Work task + 1-2 FLEXIBLE tasks (PhD/Learning/Business/Soft Skill/Book/Family) = 2-3 tasks.
5. Friday(5) and Saturday(6): FLEXIBLE only — Business/PhD/Learning/Book/Soft Skill/Family, 2-3 tasks each day. No Work.
6. Spread each category across MULTIPLE days — never cluster all PhD on one day.
7. Be specific and actionable in titles.
8. Match each task's category_id exactly from the input.${focusHint ? `\n9. IMPORTANT: The user wants to focus more on: "${focusHint}". Prioritise these areas and assign them more tasks, especially high-priority ones.` : ''}\``

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
