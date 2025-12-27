import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            user_id,
            name,
            goal,
            frequency_type = 'daily',
            frequency_target = 1,
            initial_difficulty = 3,
            is_ai_managed = true
        } = body;

        // Validation
        if (!user_id || !name) {
            return NextResponse.json(
                { error: 'user_id and name are required' },
                { status: 400 }
            );
        }

        if (initial_difficulty < 1 || initial_difficulty > 10) {
            return NextResponse.json(
                { error: 'initial_difficulty must be between 1 and 10' },
                { status: 400 }
            );
        }

        const result = await query(
            `INSERT INTO habits (
        user_id, name, goal, frequency_type, frequency_target, 
        difficulty_level, initial_difficulty, is_ai_managed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
            [user_id, name, goal, frequency_type, frequency_target, initial_difficulty, initial_difficulty, is_ai_managed]
        );

        return NextResponse.json({
            success: true,
            habit: result.rows[0],
        });
    } catch (error: unknown) {
        console.error('Error creating habit:', error);
        return NextResponse.json(
            { error: 'Failed to create habit', details: error.message },
            { status: 500 }
        );
    }
}
