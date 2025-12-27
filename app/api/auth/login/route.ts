import { NextRequest, NextResponse } from 'next/server';
import { login } from '@/src/services/authService';
import { errorResponse, successResponse } from '@/src/lib/middleware';

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const result = await login(body);

        return successResponse(result);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Login failed';
        return errorResponse(message, 401);
    }
}
