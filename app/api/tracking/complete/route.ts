import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

// Calculate streak from completions
function calculateStreak(completions: any[]): number {
    if (completions.length === 0) return 0;

    const sorted = completions.sort((a, b) =>
        new Date(b.scheduled_for).getTime() - new Date(a.scheduled_for).getTime()
    );

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < sorted.length; i++) {
        const completionDate = new Date(sorted[i].scheduled_for);
        completionDate.setHours(0, 0, 0, 0);

        const expectedDate = new Date(today);
        expectedDate.setDate(today.getDate() - streak);

        const daysDiff = Math.floor(
            (expectedDate.getTime() - completionDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysDiff === 0) {
            streak++;
        } else if (daysDiff === 1) {
            // Grace day - allow 1 day gap
            streak++;
        } else {
            break;
        }
    }

    return streak;
}

// Check if this is a recovery completion (after missing yesterday)
function isRecoveryCompletion(habitId: string, recentCompletions: any[]): boolean {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const yesterdayCompletion = recentCompletions.find(c => {
        const date = new Date(c.scheduled_for);
        date.setHours(0, 0, 0, 0);
        return date.getTime() === yesterday.getTime();
    });

    return !yesterdayCompletion;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            habit_id,
            user_id,
            scheduled_for,
            completion_time_seconds,
            mood,
            notes
        } = body;

        if (!habit_id || !user_id || !scheduled_for) {
            return NextResponse.json(
                { error: 'habit_id, user_id, and scheduled_for are required' },
                { status: 400 }
            );
        }

        // Get recent completions to calculate streak
        const recentResult = await query(
            `SELECT * FROM habit_completions 
       WHERE habit_id = $1 
       ORDER BY scheduled_for DESC 
       LIMIT 30`,
            [habit_id]
        );

        const recentCompletions = recentResult.rows;
        const newStreak = calculateStreak(recentCompletions) + 1;
        const isRecovery = isRecoveryCompletion(habit_id, recentCompletions);

        // Insert completion
        const result = await query(
            `INSERT INTO habit_completions (
        habit_id, user_id, scheduled_for, completion_time_seconds, 
        mood, notes, streak_count, is_recovery
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
            [habit_id, user_id, scheduled_for, completion_time_seconds, mood, notes, newStreak, isRecovery]
        );

        // Get habit to check if AI adjustment is needed
        const habitResult = await query(
            'SELECT * FROM habits WHERE id = $1',
            [habit_id]
        );

        const habit = habitResult.rows[0];
        let aiFeedback = null;

        if (habit.is_ai_managed) {
            // Simple AI feedback logic
            const completionRate = recentCompletions.length / 7;

            if (newStreak >= 7 && completionRate > 0.85) {
                aiFeedback = {
                    message: "Great job maintaining your streak! You're building real momentum.",
                    should_adjust_difficulty: true,
                    suggested_adjustment: 1,
                };
            } else if (isRecovery) {
                aiFeedback = {
                    message: "Welcome back! Every restart is a step forward.",
                    should_adjust_difficulty: false,
                };
            } else {
                aiFeedback = {
                    message: `Day ${newStreak} complete! Keep going.`,
                    should_adjust_difficulty: false,
                };
            }
        }

        return NextResponse.json({
            success: true,
            completion: result.rows[0],
            ai_feedback: aiFeedback,
        });
    } catch (error: unknown) {
        console.error('Error completing habit:', error);
        return NextResponse.json(
            { error: 'Failed to complete habit', details: error.message },
            { status: 500 }
        );
    }
}
