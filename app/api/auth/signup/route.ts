import { NextRequest, NextResponse } from 'next/server';
import { signup } from '@/src/services/authService';
import { errorResponse, successResponse } from '@/src/lib/middleware';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const result = await signup(body);

        return successResponse(result, 201);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Signup failed';
        return errorResponse(message, 400);
    }
}
