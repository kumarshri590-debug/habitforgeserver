import { NextRequest, NextResponse } from 'next/server';
import { pushChanges } from '@/src/services/syncService';
import { withAuth, errorResponse, successResponse } from '@/src/lib/middleware';

export const POST = withAuth(async (req) => {
    try {
        const userId = req.userId!;
        const body = await req.json();
        const { changes } = body;

        const result = await pushChanges(userId, changes);

        return successResponse(result);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to push changes';
        return errorResponse(message, 400);
    }
});
