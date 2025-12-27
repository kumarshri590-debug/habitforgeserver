import { NextRequest, NextResponse } from 'next/server';
import { callAI } from '@/lib/ai';
import { query } from '@/lib/db';

interface FallbackHabit {
    name: string;
    difficulty: number;
    explanation: string;
}

interface FallbackResponse {
    fallback_habits: FallbackHabit[];
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { habit_id, user_id, context } = body;

        if (!habit_id || !user_id) {
            return NextResponse.json(
                { error: 'habit_id and user_id are required' },
                { status: 400 }
            );
        }

        // Get habit details
        const habitResult = await query(
            'SELECT * FROM habits WHERE id = $1 AND user_id = $2',
            [habit_id, user_id]
        );

        if (habitResult.rows.length === 0) {
            return NextResponse.json(
                { error: 'Habit not found' },
                { status: 404 }
            );
        }

        const habit = habitResult.rows[0];

        // Build AI prompt
        const prompt = `Generate 2 easier alternative habits for a user who's struggling.

ORIGINAL HABIT: ${habit.name} (difficulty ${habit.difficulty_level})
GOAL: ${habit.goal || 'Not specified'}
CONTEXT: ${context || 'User is having difficulty maintaining consistency'}

REQUIREMENTS:
- Fallback 1: 50% easier (difficulty should be ${Math.max(1, habit.difficulty_level - 3)} to ${Math.max(1, habit.difficulty_level - 4)})
- Fallback 2: 75% easier (difficulty should be ${Math.max(1, habit.difficulty_level - 5)} to ${Math.max(1, habit.difficulty_level - 6)})
- Keep the core intent of the original habit
- Make them achievable in < 5 minutes
- Use encouraging language

Return JSON with this exact structure:
{
  "fallback_habits": [
    {
      "name": "<habit name>",
      "difficulty": <number 1-10>,
      "explanation": "<why this helps>"
    },
    {
      "name": "<habit name>",
      "difficulty": <number 1-10>,
      "explanation": "<why this helps>"
    }
  ]
}`;

        const response = await callAI<FallbackResponse>(prompt);

        // Save fallback habits to database
        for (const fallback of response.fallback_habits) {
            await query(
                `INSERT INTO fallback_habits (
          parent_habit_id, name, description, difficulty_level, generation_context
        ) VALUES ($1, $2, $3, $4, $5)`,
                [
                    habit_id,
                    fallback.name,
                    fallback.explanation,
                    fallback.difficulty,
                    JSON.stringify({ context, original_difficulty: habit.difficulty_level }),
                ]
            );
        }

        // Log AI decision
        await query(
            `INSERT INTO ai_decisions (
        user_id, habit_id, decision_type, input_data, output_data, explanation
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                user_id,
                habit_id,
                'fallback_generation',
                JSON.stringify({ habit_name: habit.name, difficulty: habit.difficulty_level, context }),
                JSON.stringify(response),
                'Generated fallback habits for struggling user',
            ]
        );

        return NextResponse.json(response);
    } catch (error: unknown) {
        console.error('Error generating fallback:', error);
        return NextResponse.json(
            { error: 'Failed to generate fallback habits', details: error.message },
            { status: 500 }
        );
    }
}
