import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ habitId: string }> }
) {
    try {
        const { habitId } = await params;
        const { searchParams } = new URL(request.url);
        const days = parseInt(searchParams.get('days') || '30');

        // Get completions
        const completionsResult = await query(
            `SELECT * FROM habit_completions 
       WHERE habit_id = $1 
       AND scheduled_for >= CURRENT_DATE - INTERVAL '${days} days'
       ORDER BY scheduled_for DESC`,
            [habitId]
        );

        const completions = completionsResult.rows;

        // Calculate stats
        const totalCompletions = completions.length;
        const completionRate = totalCompletions / days;
        const currentStreak = completions[0]?.streak_count || 0;
        const longestStreak = Math.max(...completions.map(c => c.streak_count), 0);
        const averageCompletionTime = completions.length > 0
            ? completions.reduce((sum, c) => sum + (c.completion_time_seconds || 0), 0) / completions.length
            : 0;

        // Format completions for calendar view
        const formattedCompletions = completions.map(c => ({
            date: c.scheduled_for,
            completed: true,
            mood: c.mood,
            streak_count: c.streak_count,
            completion_time_seconds: c.completion_time_seconds,
        }));

        return NextResponse.json({
            completions: formattedCompletions,
            stats: {
                total_completions: totalCompletions,
                completion_rate: parseFloat(completionRate.toFixed(2)),
                current_streak: currentStreak,
                longest_streak: longestStreak,
                average_completion_time: Math.round(averageCompletionTime),
            },
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        console.error('Error fetching history:', error);
        return NextResponse.json(
            { error: 'Failed to fetch history', details: message },
            { status: 500 }
        );
    }
}
