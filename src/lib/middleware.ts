import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, extractTokenFromHeader } from './auth';

export interface AuthenticatedRequest extends NextRequest {
    userId?: string;
    email?: string;
}

export function withAuth(
    handler: (req: AuthenticatedRequest, context?: any) => Promise<NextResponse>
) {
    return async (req: NextRequest, context?: any) => {
        try {
            const authHeader = req.headers.get('authorization');
            const token = extractTokenFromHeader(authHeader);

            if (!token) {
                return NextResponse.json(
                    { error: 'Authentication required' },
                    { status: 401 }
                );
            }

            const payload = verifyToken(token);

            // Attach user info to request
            const authenticatedReq = req as AuthenticatedRequest;
            authenticatedReq.userId = payload.userId;
            authenticatedReq.email = payload.email;

            return handler(authenticatedReq, context);
        } catch (error) {
            return NextResponse.json(
                { error: 'Invalid or expired token' },
                { status: 401 }
            );
        }
    };
}

export function errorResponse(message: string, status: number = 400) {
    return NextResponse.json({ error: message }, { status });
}

export function successResponse(data: any, status: number = 200) {
    return NextResponse.json(data, { status });
}
