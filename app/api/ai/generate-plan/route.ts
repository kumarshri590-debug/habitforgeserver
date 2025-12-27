import { NextRequest, NextResponse } from 'next/server';
import { generateHabitPlan } from '@/src/services/aiService';
import { withAuth, errorResponse, successResponse } from '@/src/lib/middleware';

export const POST = withAuth(async (req) => {
    try {
        const userId = req.userId!;
        const body = await req.json();

        const plan = await generateHabitPlan(userId, body);

        return successResponse({ plan });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to generate plan';
        return errorResponse(message, 400);
    }
});
