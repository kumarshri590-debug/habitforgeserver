import { NextRequest, NextResponse } from 'next/server';
import { createHabit, getHabits } from '@/src/services/habitService';
import { withAuth, errorResponse, successResponse } from '@/src/lib/middleware';

export const GET = withAuth(async (req) => {
    try {
        const userId = req.userId!;
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status') || 'active';

        const habits = await getHabits(userId, status);

        return successResponse({ habits });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to get habits';
        return errorResponse(message, 400);
    }
});

export const POST = withAuth(async (req) => {
    try {
        const userId = req.userId!;
        const body = await req.json();

        const habit = await createHabit(userId, body);

        return successResponse({ habit }, 201);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create habit';
        return errorResponse(message, 400);
    }
});
