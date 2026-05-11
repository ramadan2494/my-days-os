import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const apiKey = process.env.CLAUDE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Claude API key not configured' }, { status: 500 })
  }

  const body = await request.json().catch(() => ({}))
  const targetDate: string = body.date ?? new Date().toISOString().split('T')[0]
  const currentMonth = targetDate.slice(0, 7)

  const [profileRes, existingTasksRes, monthlyPlansRes, learningGoalsRes, prayersRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('tasks').select('*').eq('user_id', user.id).eq('scheduled_date', targetDate),
    supabase
      .from('monthly_plans')
      .select('id, title, month, overview, ai_plan, category, hours_per_day')
      .eq('user_id', user.id)
      .eq('month', currentMonth),
    supabase
      .from('learning_goals')
      .select('id, title, domain, status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .limit(3),
    supabase
      .from('prayers')
      .select('name, scheduled_time')
      .eq('user_id', user.id)
      .eq('date', targetDate)
      .order('scheduled_time'),
  ])

  const profile = profileRes.data
  const existingTasks = existingTasksRes.data ?? []
  const monthlyPlans = monthlyPlansRes.data ?? []
  const learningGoals = learningGoalsRes.data ?? []
  const prayers = prayersRes.data ?? []

  // Fetch planned tasks for this date from monthly plans (tasks with monthly_plan_id)
  const plannedTasksForDay = existingTasks.filter(t => t.monthly_plan_id !== null)
  const manualTasksForDay = existingTasks.filter(t => t.monthly_plan_id === null)

  // Determine which week of each monthly plan we're in
  const dateObj = new Date(targetDate)
  const monthlyPlanContext = monthlyPlans.map(plan => {
    const startDate = new Date(plan.ai_plan ? targetDate : targetDate)
    const weeks = (plan.ai_plan as any)?.weeks ?? []
    return {
      title: plan.title,
      category: plan.category,
      overview: plan.overview,
      weeks,
    }
  })

  const prompt = `You are an expert daily task planner for a PhD student. Generate 3-5 specific, actionable tasks for this exact date.

Date: ${targetDate}
Work hours: ${profile?.work_start_hour ?? 9}:00 - ${(profile?.work_start_hour ?? 9) + (profile?.work_hours ?? 8)}:00

ACTIVE MONTHLY PLANS (use these to know what to work on):
${monthlyPlanContext.length > 0
    ? monthlyPlanContext.map(p => `- "${p.title}" (${p.category})\n  Overview: ${p.overview ?? 'N/A'}\n  Weeks: ${(p.weeks as any[]).map((w: any) => `W${w.week_number}: ${w.theme}`).join(', ')}`).join('\n')
    : '- No monthly plans active'
  }

ALREADY PLANNED FOR TODAY (DO NOT duplicate these):
${plannedTasksForDay.length > 0
    ? plannedTasksForDay.map(t => `- ${t.title} (${t.priority}, ${t.estimated_minutes}min)`).join('\n')
    : '- None'
  }

MANUAL TASKS TODAY:
${manualTasksForDay.length > 0
    ? manualTasksForDay.map(t => `- ${t.title}`).join('\n')
    : '- None'
  }

ACTIVE LEARNING GOALS:
${learningGoals.length > 0
    ? learningGoals.map(g => `- ${g.title} (${g.domain})`).join('\n')
    : '- None'
  }

PRAYER TIMES:
${prayers.length > 0
    ? prayers.map(p => `- ${p.name}: ${(p.scheduled_time as string).slice(0, 5)}`).join('\n')
    : '- Not synced yet'
  }

Return ONLY valid JSON (no markdown):
{
  "rationale": "1-2 sentences explaining what day this is in the monthly plan context and why these tasks were chosen",
  "tasks": [
    {
      "title": "Specific task title (actionable verb + object)",
      "description": "Exactly what to do — specific enough to start immediately",
      "estimated_minutes": 90,
      "priority": "high",
      "category": "PhD",
      "is_deep_work": true
    }
  ]
}

Rules:
- Tasks must align with active monthly plans for this date
- If no monthly plans, use learning goals or suggest productivity tasks
- 3-5 tasks total
- Vary between deep work and lighter tasks
- Category must be one of: Work, TA, PhD, Admin, Personal
- Priority: high (critical path), medium (supporting), low (optional)
- is_deep_work: true only for tasks needing 60+ min unbroken focus`

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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}))
      return NextResponse.json({ error: `Claude API error: ${errBody?.error?.message ?? res.statusText}` }, { status: 502 })
    }

    const claudeData = await res.json()
    const text = (claudeData.content[0]?.text ?? '').trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Invalid AI response' }, { status: 502 })

    const parsed = JSON.parse(jsonMatch[0])
    const aiTasks: Array<{
      title: string
      description: string
      estimated_minutes: number
      priority: string
      category: string
      is_deep_work: boolean
    }> = parsed.tasks ?? []

    const tasksToInsert = aiTasks.map(t => ({
      user_id: user.id,
      title: t.title,
      description: t.description ?? null,
      scheduled_date: targetDate,
      due_date: targetDate,
      category: t.category ?? 'Work',
      priority: t.priority ?? 'medium',
      estimated_minutes: t.estimated_minutes ?? 60,
      is_deep_work: t.is_deep_work ?? false,
      status: 'todo',
    }))

    const { data: insertedTasks, error: insertError } = await supabase
      .from('tasks')
      .insert(tasksToInsert)
      .select()

    if (insertError) {
      console.error('Task insert error:', insertError)
      return NextResponse.json({ error: 'Failed to save generated tasks' }, { status: 500 })
    }

    return NextResponse.json({
      rationale: parsed.rationale ?? '',
      tasks: insertedTasks,
    })
  } catch (e) {
    console.error('Generate day error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
