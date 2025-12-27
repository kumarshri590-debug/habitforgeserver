import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('user_id');
        const status = searchParams.get('status') || 'active';

        if (!userId) {
            return NextResponse.json(
                { error: 'user_id is required' },
                { status: 400 }
            );
        }

        // Get habits with completion stats
        const result = await query(
            `SELECT 
        h.*,
        COUNT(DISTINCT hc.id) FILTER (WHERE hc.scheduled_for >= CURRENT_DATE - INTERVAL '7 days') as completions_7d,
        COUNT(DISTINCT hc.id) FILTER (WHERE hc.scheduled_for >= CURRENT_DATE - INTERVAL '30 days') as completions_30d,
        (
          SELECT streak_count 
          FROM habit_completions 
          WHERE habit_id = h.id 
          ORDER BY completed_at DESC 
          LIMIT 1
        ) as current_streak
      FROM habits h
      LEFT JOIN habit_completions hc ON h.id = hc.habit_id
      WHERE h.user_id = $1 AND h.status = $2
      GROUP BY h.id
      ORDER BY h.created_at DESC`,
            [userId, status]
        );

        const habits = result.rows.map(habit => ({
            ...habit,
            current_streak: habit.current_streak || 0,
            completion_rate_7d: habit.completions_7d / 7,
            completion_rate_30d: habit.completions_30d / 30,
        }));

        return NextResponse.json({ habits });
    } catch (error: unknown) {
        console.error('Error fetching habits:', error);
        return NextResponse.json(
            { error: 'Failed to fetch habits', details: error.message },
            { status: 500 }
        );
    }
}
