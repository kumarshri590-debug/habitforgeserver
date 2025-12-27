import { NextRequest, NextResponse } from 'next/server';
import { getHabitById, updateHabit, deleteHabit } from '@/src/services/habitService';
import { withAuth, errorResponse, successResponse } from '@/src/lib/middleware';

export const GET = withAuth(async (req, { params }: { params: { id: string } }) => {
    try {
        const userId = req.userId!;
        const habitId = params.id;

        const habit = await getHabitById(userId, habitId);

        return successResponse({ habit });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to get habit';
        return errorResponse(message, 404);
    }
});

export const PATCH = withAuth(async (req, { params }: { params: { id: string } }) => {
    try {
        const userId = req.userId!;
        const habitId = params.id;
        const body = await req.json();

        const habit = await updateHabit(userId, habitId, body);

        return successResponse({ habit });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to update habit';
        return errorResponse(message, 400);
    }
});

export const DELETE = withAuth(async (req, { params }: { params: { id: string } }) => {
    try {
        const userId = req.userId!;
        const habitId = params.id;

        await deleteHabit(userId, habitId);

        return successResponse({ success: true });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to delete habit';
        return errorResponse(message, 400);
    }
});
