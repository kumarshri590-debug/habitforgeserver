import { NextRequest, NextResponse } from 'next/server';
import { logHabitCompletion } from '@/src/services/habitService';
import { withAuth, errorResponse, successResponse } from '@/src/lib/middleware';

export const POST = withAuth(async (req, { params }: { params: { id: string } }) => {
    try {
        const userId = req.userId!;
        const habitId = params.id;
        const body = await req.json();

        const log = await logHabitCompletion(userId, habitId, body);

        return successResponse({ log }, 201);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to log completion';
        return errorResponse(message, 400);
    }
});
