import { NextRequest, NextResponse } from 'next/server';
import { callAI } from '@/lib/ai';
import { query } from '@/lib/db';

interface DifficultyAdjustment {
    new_difficulty: number;
    change: number;
    explanation: string;
    suggested_changes: {
        duration?: string;
        frequency?: string;
    };
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { habit_id, user_id } = body;

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

        // Get recent completions (last 14 days)
        const completionsResult = await query(
            `SELECT * FROM habit_completions 
       WHERE habit_id = $1 
       AND scheduled_for >= CURRENT_DATE - INTERVAL '14 days'
       ORDER BY scheduled_for DESC`,
            [habit_id]
        );

        const completions = completionsResult.rows;
        const last7Days = completions.slice(0, 7);
        const completionRate7d = last7Days.filter(c => c.completed_at).length / 7;
        const completionRate14d = completions.filter(c => c.completed_at).length / 14;
        const struggledCount = last7Days.filter(c => c.mood === 'struggled').length;
        const currentStreak = completions[0]?.streak_count || 0;

        // Build AI prompt
        const prompt = `Analyze this habit completion history and recommend a difficulty adjustment.

HABIT: ${habit.name}
CURRENT DIFFICULTY: ${habit.difficulty_level} (1-10 scale)
COMPLETION RATE (7 days): ${(completionRate7d * 100).toFixed(0)}%
COMPLETION RATE (14 days): ${(completionRate14d * 100).toFixed(0)}%
STRUGGLED COUNT (last 7 days): ${struggledCount}
CURRENT STREAK: ${currentStreak} days

ADJUSTMENT RULES:
- If completion rate < 50% for 7 days: reduce difficulty by 1-2 levels
- If completion rate > 85% for 14 days AND streak >= 7: increase difficulty by 1 level
- If user reported "struggled" 3+ times: reduce difficulty by 1 level
- Never increase difficulty if streak < 7 days
- Max change: ±2 levels per adjustment
- New difficulty must be between 1-10

Return JSON with this exact structure:
{
  "new_difficulty": <number 1-10>,
  "change": <number (positive or negative)>,
  "explanation": "<one supportive sentence>",
  "suggested_changes": {
    "duration": "<specific change or null>",
    "frequency": "<specific change or null>"
  }
}`;

        const adjustment = await callAI<DifficultyAdjustment>(prompt);

        // Validate adjustment
        if (adjustment.new_difficulty < 1 || adjustment.new_difficulty > 10) {
            throw new Error('Invalid difficulty level from AI');
        }

        // Log AI decision
        await query(
            `INSERT INTO ai_decisions (
        user_id, habit_id, decision_type, input_data, output_data, explanation
      ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
                user_id,
                habit_id,
                'difficulty_adjustment',
                JSON.stringify({ completionRate7d, completionRate14d, struggledCount, currentStreak }),
                JSON.stringify(adjustment),
                adjustment.explanation,
            ]
        );

        return NextResponse.json({
            adjustment: {
                ...adjustment,
                should_apply: Math.abs(adjustment.change) > 0,
            },
        });
    } catch (error: unknown) {
        console.error('Error adjusting difficulty:', error);
        return NextResponse.json(
            { error: 'Failed to adjust difficulty', details: error.message },
            { status: 500 }
        );
    }
}
