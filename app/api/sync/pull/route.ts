import { NextRequest, NextResponse } from 'next/server';
import { pullChanges, pushChanges } from '@/src/services/syncService';
import { withAuth, errorResponse, successResponse } from '@/src/lib/middleware';

export const GET = withAuth(async (req) => {
    try {
        const userId = req.userId!;
        const { searchParams } = new URL(req.url);
        const lastSync = searchParams.get('since');

        const changes = await pullChanges(userId, lastSync || undefined);

        return successResponse(changes);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to pull changes';
        return errorResponse(message, 400);
    }
});
