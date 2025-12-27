import { NextRequest, NextResponse } from 'next/server';
import { getUserProfile } from '@/src/services/authService';
import { withAuth, errorResponse, successResponse } from '@/src/lib/middleware';

export const GET = withAuth(async (req) => {
    try {
        const userId = req.userId!;
        const profile = await getUserProfile(userId);

        return successResponse(profile);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to get profile';
        return errorResponse(message, 400);
    }
});
