import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, deadline, hoursPerDay, category, context } = await request.json()

  if (!title || !deadline) {
    return NextResponse.json({ error: 'title and deadline are required' }, { status: 400 })
  }

  const apiKey = process.env.CLAUDE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Claude API key not configured' }, { status: 500 })
  }

  const today = new Date().toISOString().split('T')[0]
  const deadlineDate = new Date(deadline)
  const todayDate = new Date(today)
  const totalDays = Math.max(1, Math.ceil((deadlineDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)))

  const totalWeeks = Math.ceil(totalDays / 7)

  const prompt = `You are an expert productivity coach for a PhD student who works remotely. 
Create a structured monthly plan that divides work across weeks and days to achieve this goal by the deadline.

Goal: "${title}"
Today's date: ${today}
Deadline: ${deadline}
Days available: ${totalDays}
Weeks available: ${totalWeeks}
Hours available per day: ${hoursPerDay ?? 2}
Category: ${category ?? 'Work'}
${context ? `Additional context: ${context}` : ''}

Return ONLY valid JSON (no markdown, no explanation):
{
  "overview": "2-sentence summary of the overall plan and strategy",
  "weeks": [
    {
      "week_number": 1,
      "theme": "Short theme for this week (e.g. Foundation & Research)",
      "focus": "What to accomplish this week",
      "milestone": "Measurable milestone to hit by end of week"
    }
  ],
  "daily_tasks": [
    {
      "day_offset": 0,
      "week_number": 1,
      "title": "Specific actionable task title",
      "description": "What exactly to do in this session",
      "estimated_minutes": 90,
      "is_deep_work": true,
      "priority": "high"
    }
  ]
}

Rules:
- Generate exactly ${totalWeeks} week objects
- day_offset 0 = today, 1 = tomorrow, etc. Maximum day_offset: ${totalDays - 1}
- Create ${Math.min(totalDays, 30)} daily_tasks total — one per day (skip weekends if > 14 days)
- week_number in daily_tasks must match the week it falls in (week 1 = day_offset 0-6, week 2 = 7-13, etc.)
- Make tasks SPECIFIC and ACTIONABLE (not vague like "work on project")
- is_deep_work: true for tasks requiring full focus (writing, coding, analysis)
- priority: "high" for critical path tasks, "medium" for supporting tasks, "low" for reviews
- estimated_minutes: 45-120 minutes (max ${Math.round((hoursPerDay ?? 2) * 60)} min/day)
- Tasks should build progressively: foundation → development → integration → review
- Week themes should escalate in depth (e.g. Exploration → Deep Work → Integration → Finalization)
- Last week should include review, polish, and submission/completion tasks`

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
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: 'Unknown' }))
      console.error('Claude API error:', res.status, errBody)
      return NextResponse.json({ error: `Claude API error: ${errBody?.error?.message ?? res.statusText}` }, { status: 502 })
    }

    const claudeData = await res.json()
    const text = claudeData.content[0].text.trim()

    // Parse JSON from Claude response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Invalid AI response' }, { status: 502 })

    const plan = JSON.parse(jsonMatch[0])

    // 1. Create the monthly_plans row first
    const month = today.slice(0, 7) // YYYY-MM
    const { data: monthlyPlan, error: planError } = await supabase
      .from('monthly_plans')
      .insert({
        user_id: user.id,
        title,
        month,
        start_date: today,
        end_date: deadline,
        goal_text: context ?? null,
        overview: plan.overview ?? null,
        ai_plan: { overview: plan.overview, weeks: plan.weeks ?? [] },
        hours_per_day: hoursPerDay ?? 2,
        category: category ?? 'Work',
      })
      .select()
      .single()

    if (planError) {
      console.error('Monthly plan insert error:', planError)
      return NextResponse.json({ error: 'Failed to save monthly plan' }, { status: 500 })
    }

    // 2. Create tasks linked to the monthly plan
    const tasks = (plan.daily_tasks ?? []).map((t: any) => {
      const taskDate = new Date(todayDate)
      taskDate.setDate(taskDate.getDate() + t.day_offset)
      return {
        user_id: user.id,
        title: t.title,
        description: t.description,
        scheduled_date: taskDate.toISOString().split('T')[0],
        due_date: taskDate.toISOString().split('T')[0],
        category: category ?? 'Work',
        priority: t.priority ?? 'medium',
        estimated_minutes: t.estimated_minutes ?? 60,
        is_deep_work: t.is_deep_work ?? false,
        status: 'todo',
        monthly_plan_id: monthlyPlan.id,
      }
    })

    const { data: insertedTasks, error: insertError } = await supabase
      .from('tasks')
      .insert(tasks)
      .select()

    if (insertError) {
      console.error('Insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save tasks' }, { status: 500 })
    }

    return NextResponse.json({
      plan_id: monthlyPlan.id,
      overview: plan.overview,
      weeks: plan.weeks ?? [],
      tasks_created: insertedTasks?.length ?? 0,
      tasks: insertedTasks,
    })
  } catch (e) {
    console.error('Monthly goal error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
