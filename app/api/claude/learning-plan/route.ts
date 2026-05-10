import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { topics, targetDate, title, goalId } = await request.json()

  if (!topics?.length || !title) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const apiKey = process.env.CLAUDE_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Claude API key not configured' }, { status: 500 })
  }

  const today = new Date().toISOString().split('T')[0]
  const deadline = targetDate || 'in 4 weeks'

  const prompt = `You are an expert learning coach. Create a structured learning plan for the following goal.

Goal: ${title}
Topics to cover: ${topics.join(', ')}
Today's date: ${today}
Target completion: ${deadline}

Return ONLY valid JSON in this exact structure (no markdown, no explanation):
{
  "overview": "2-3 sentence overview of the learning journey",
  "estimated_weeks": 4,
  "sessions": [
    {
      "week": 1,
      "day": "Monday",
      "title": "Session title",
      "duration_minutes": 60,
      "description": "What this session covers",
      "resources": [
        { "type": "article", "title": "Resource name", "url": "https://..." },
        { "type": "video", "title": "Video name", "url": "https://youtube.com/..." }
      ]
    }
  ]
}

Guidelines:
- Create 6-15 sessions total depending on scope
- Each session should be 45-90 minutes
- Order topics from fundamentals to advanced
- Include practical exercises and real resources
- Distribute evenly across the time period
- Resource types: article, video, book, paper`

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
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('Claude API error:', err)
      return NextResponse.json({ error: 'Claude API failed' }, { status: 502 })
    }

    const data = await res.json()
    const text = data.content[0]?.text ?? ''

    let plan
    try {
      plan = JSON.parse(text)
    } catch {
      // Try to extract JSON from text
      const match = text.match(/\{[\s\S]*\}/)
      if (match) plan = JSON.parse(match[0])
      else throw new Error('No valid JSON in response')
    }

    return NextResponse.json({ plan })
  } catch (err) {
    console.error('Learning plan generation error:', err)
    return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 })
  }
}
