import { NextRequest, NextResponse } from 'next/server';
import { getHabitStats } from '@/src/services/habitService';
import { withAuth, errorResponse, successResponse } from '@/src/lib/middleware';

export const GET = withAuth(async (req, { params }: { params: { id: string } }) => {
    try {
        const userId = req.userId!;
        const habitId = params.id;
        const { searchParams } = new URL(req.url);
        const days = parseInt(searchParams.get('days') || '30');

        const stats = await getHabitStats(userId, habitId, days);

        return successResponse({ stats });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to get stats';
        return errorResponse(message, 400);
    }
});
