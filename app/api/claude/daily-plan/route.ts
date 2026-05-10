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

  const today = new Date().toISOString().split('T')[0]

  // Fetch user context
  const [profileRes, tasksRes, goalsRes, prayersRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('tasks').select('*').eq('user_id', user.id).eq('scheduled_date', today).neq('status', 'done'),
    supabase.from('learning_goals').select('*').eq('user_id', user.id).eq('status', 'active').limit(5),
    supabase.from('prayers').select('*').eq('user_id', user.id).eq('date', today).order('scheduled_time'),
  ])

  const profile = profileRes.data
  const tasks = tasksRes.data ?? []
  const goals = goalsRes.data ?? []
  const prayers = prayersRes.data ?? []

  const workStart = profile?.work_start_hour ?? 9
  const workHours = profile?.work_hours ?? 8

  const prompt = `You are an expert daily planner for a PhD student who works remotely ${workHours} hours/day.
Your job is to create an optimal, realistic schedule for TODAY.

Today: ${today}
Work starts at: ${workStart}:00
Work ends at: ${workStart + workHours}:00

ACTIVE LEARNING GOALS:
${goals.length > 0 ? goals.map(g => `- ${g.title} (domain: ${g.domain})`).join('\n') : '- None set'}

PENDING TASKS TODAY:
${tasks.length > 0 ? tasks.map(t => `- [${t.priority}] ${t.title} (${t.estimated_minutes ?? 60}min, ${t.category}${t.is_deep_work ? ', deep work' : ''})`).join('\n') : '- No tasks scheduled'}

PRAYER TIMES TODAY:
${prayers.length > 0 ? prayers.map(p => `- ${p.name}: ${p.scheduled_time.slice(0,5)}`).join('\n') : '- Not synced'}

Return ONLY valid JSON (no markdown):
{
  "motivational_message": "1-2 sentence personalized motivational message for today",
  "focus_of_the_day": "The single most important thing to accomplish today",
  "schedule": [
    {
      "time": "09:00",
      "duration_minutes": 90,
      "activity": "Activity title",
      "type": "deep_work",
      "description": "What exactly to do"
    }
  ],
  "tasks_to_create": [
    {
      "title": "Specific task title",
      "description": "What to do",
      "estimated_minutes": 60,
      "priority": "high",
      "category": "PhD",
      "is_deep_work": true
    }
  ],
  "tips": ["Tip 1 for today", "Tip 2"]
}

Rules for schedule:
- type: "deep_work" | "learning" | "admin" | "break" | "prayer" | "review"
- Include prayer breaks at the right times
- Start with the most cognitively demanding task (deep work first)
- Include a lunch break around 13:00-14:00
- 25-30 min breaks between deep work blocks
- End with lower-energy admin/review tasks
- tasks_to_create: only if there are NO tasks today OR if the current tasks are incomplete — suggest 1-3 specific tasks aligned with active goals`

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

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({ error: 'Unknown' }))
      console.error('Claude API error:', res.status, errBody)
      return NextResponse.json({ error: `Claude API error: ${errBody?.error?.message ?? res.statusText}` }, { status: 502 })
    }

    const claudeData = await res.json()
    const text = claudeData.content[0].text.trim()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Invalid AI response' }, { status: 502 })

    const plan = JSON.parse(jsonMatch[0])

    // Auto-create suggested tasks if any
    if (plan.tasks_to_create?.length > 0 && tasks.length === 0) {
      const newTasks = plan.tasks_to_create.map((t: any) => ({
        user_id: user.id,
        title: t.title,
        description: t.description,
        scheduled_date: today,
        due_date: today,
        category: t.category ?? 'Work',
        priority: t.priority ?? 'medium',
        estimated_minutes: t.estimated_minutes ?? 60,
        is_deep_work: t.is_deep_work ?? false,
        status: 'todo',
      }))
      await supabase.from('tasks').insert(newTasks)
    }

    return NextResponse.json(plan)
  } catch (e) {
    console.error('Daily plan error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
