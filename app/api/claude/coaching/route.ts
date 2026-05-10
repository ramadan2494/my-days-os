import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { type, context } = await request.json()

  const apiKey = process.env.CLAUDE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Claude API key not configured' }, { status: 500 })
  }

  const prompts: Record<string, string> = {
    morning_coaching: `You are a warm, direct life coach for a PhD student who also works remotely 8 hours/day and is a husband and father.

Context: ${JSON.stringify(context)}

Give a focused morning coaching message (3-4 sentences max). Be warm but direct, like a mentor. 
Focus on: priority for today, one encouragement, one practical tip.
No lists, no headers. Just flowing, human text.`,

    cbt_tip: `You are a CBT-trained coach. The user feels overwhelmed by: "${context.task}"

Give a single, powerful cognitive reframe (2-3 sentences). 
Start with validation, then reframe the thought, end with one small concrete action.
Tone: calm, direct, compassionate.`,

    evening_reflection: `You are a reflective coach. The user completed their day with:
- Daily score: ${context.score}/100
- Mood: ${context.mood}/5
- Prayers completed: ${context.prayersCompleted}/5

Write a brief, personalised reflection (3-4 sentences). 
Acknowledge what they did well, gently note one area, end with a forward-looking thought for tomorrow.
Warm, not preachy.`,

    phd_coaching: `You are a PhD coach who specialises in helping students with imposter syndrome, thesis anxiety, and slow-progress feelings.

The student says: "${context.concern}"

Respond in 3-4 sentences. Be direct, validating, and practical. 
Draw on the reality that PhD progress is non-linear. End with one actionable step.`,

    burnout_warning: `You are a wellbeing coach. The user has had ${context.lowDays} consecutive low-scoring days.

Write a gentle burnout prevention message (4-5 sentences).
Acknowledge the difficulty, normalise it, suggest one concrete recovery action (rest, nature, disconnection).
Be warm, non-judgmental, practical.`,
  }

  const prompt = prompts[type] ?? prompts.morning_coaching

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
        max_tokens: 512,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) return NextResponse.json({ error: 'Claude API failed' }, { status: 502 })

    const data = await res.json()
    const message = data.content[0]?.text ?? ''

    // Log to coaching_logs
    await supabase.from('coaching_logs').insert({
      user_id: user.id, type, content: context, ai_response: message,
    })

    return NextResponse.json({ message })
  } catch (err) {
    console.error('Coaching API error:', err)
    return NextResponse.json({ error: 'Coaching request failed' }, { status: 500 })
  }
}
