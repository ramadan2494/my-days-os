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

  const prompt = `You are an expert productivity coach for a PhD student who works remotely. 
Break this monthly goal into specific daily tasks to achieve it by the deadline.

Goal: "${title}"
Today's date: ${today}
Deadline: ${deadline}
Days available: ${totalDays}
Hours available per day: ${hoursPerDay ?? 2}
Category: ${category ?? 'Work'}
${context ? `Additional context: ${context}` : ''}

Return ONLY valid JSON (no markdown, no explanation):
{
  "overview": "2-sentence summary of the plan",
  "daily_tasks": [
    {
      "day_offset": 0,
      "title": "Specific actionable task title",
      "description": "What exactly to do in this session",
      "estimated_minutes": 90,
      "is_deep_work": true,
      "priority": "high"
    }
  ]
}

Rules:
- day_offset 0 = today, 1 = tomorrow, etc.
- Maximum ${totalDays} day offsets
- Create ${Math.min(totalDays, 30)} tasks total — one per day
- Make tasks SPECIFIC and ACTIONABLE (not vague like "work on project")
- is_deep_work: true for tasks requiring full focus (writing, coding, analysis)
- priority: "high" for critical path tasks, "medium" for supporting tasks, "low" for reviews
- estimated_minutes: 45-120 minutes per task
- Tasks should build progressively toward the goal
- Last 2 tasks should be review/polish/finalization`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Claude API error:', err)
      return NextResponse.json({ error: 'AI service error' }, { status: 502 })
    }

    const claudeData = await res.json()
    const text = claudeData.content[0].text.trim()

    // Parse JSON from Claude response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ error: 'Invalid AI response' }, { status: 502 })

    const plan = JSON.parse(jsonMatch[0])

    // Create tasks in the database
    const tasks = plan.daily_tasks.map((t: any) => {
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
      overview: plan.overview,
      tasks_created: insertedTasks?.length ?? 0,
      tasks: insertedTasks,
    })
  } catch (e) {
    console.error('Monthly goal error:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
