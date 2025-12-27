import { NextRequest, NextResponse } from 'next/server';
import { adjustDifficulty } from '@/src/services/aiService';
import { withAuth, errorResponse, successResponse } from '@/src/lib/middleware';

export const POST = withAuth(async (req) => {
    try {
        const userId = req.userId!;
        const body = await req.json();

        const result = await adjustDifficulty(userId, body);

        return successResponse({ adjustment: result });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to adjust difficulty';
        return errorResponse(message, 400);
    }
});
