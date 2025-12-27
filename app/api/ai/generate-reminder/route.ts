import { NextRequest, NextResponse } from 'next/server';
import { callAI } from '@/lib/ai';

interface ReminderResponse {
    message: string;
    tone: string;
    explanation: string;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            habit_name,
            time_of_day = 'morning',
            recent_completion_rate = 0.7,
            tone_preference = 'supportive'
        } = body;

        if (!habit_name) {
            return NextResponse.json(
                { error: 'habit_name is required' },
                { status: 400 }
            );
        }

        // Build AI prompt
        const prompt = `Generate a reminder message for this habit.

HABIT: ${habit_name}
TIME: ${time_of_day}
COMPLETION RATE (7d): ${(recent_completion_rate * 100).toFixed(0)}%
TONE: ${tone_preference}

RULES:
- If completion_rate > 0.7: motivational, celebrate momentum
- If completion_rate 0.4-0.7: supportive, reduce pressure
- If completion_rate < 0.4: gentle, emphasize small wins
- Max 15 words
- No guilt or "you should" language
- Be specific to the habit

Return JSON with this exact structure:
{
  "message": "<reminder text>",
  "tone": "<tone used>",
  "explanation": "<why this message>"
}`;

        const reminder = await callAI<ReminderResponse>(prompt);

        return NextResponse.json({ reminder });
    } catch (error: unknown) {
        console.error('Error generating reminder:', error);
        return NextResponse.json(
            { error: 'Failed to generate reminder', details: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
