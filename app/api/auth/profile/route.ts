import { NextRequest, NextResponse } from 'next/server';
import { getUserProfile, updateUserProfile } from '@/src/services/authService';
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

export const PATCH = withAuth(async (req) => {
    try {
        const userId = req.userId!;
        const body = await req.json();

        const updatedProfile = await updateUserProfile(userId, body);

        return successResponse(updatedProfile);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to update profile';
        return errorResponse(message, 400);
    }
});
