import prisma from '../lib/prisma';
import { hashPassword, verifyPassword, generateToken } from '../lib/auth';
import { z } from 'zod';
import type { UpdateUserProfileData } from '../types';


const signupSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    displayName: z.string().optional(),
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string(),
});

export async function signup(data: z.infer<typeof signupSchema>) {
    const validated = signupSchema.parse(data);

    // Check if user exists
    const existing = await prisma.user.findUnique({
        where: { email: validated.email },
    });

    if (existing) {
        throw new Error('User already exists');
    }

    // Create user
    const passwordHash = await hashPassword(validated.password);
    const user = await prisma.user.create({
        data: {
            email: validated.email,
            passwordHash,
            displayName: validated.displayName,
        },
    });

    // Create default preferences
    await prisma.userPreferences.create({
        data: {
            userId: user.id,
        },
    });

    // Generate token
    const token = generateToken({ userId: user.id, email: user.email });

    return {
        user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
        },
        token,
    };
}

export async function login(data: z.infer<typeof loginSchema>) {
    const validated = loginSchema.parse(data);

    // Find user
    const user = await prisma.user.findUnique({
        where: { email: validated.email },
    });

    if (!user) {
        throw new Error('Invalid credentials');
    }

    // Verify password
    const valid = await verifyPassword(validated.password, user.passwordHash);
    if (!valid) {
        throw new Error('Invalid credentials');
    }

    // Generate token
    const token = generateToken({ userId: user.id, email: user.email });

    return {
        user: {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            onboardingCompleted: user.onboardingCompleted,
        },
        token,
    };
}

export async function getUserProfile(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            preferences: true,
        },
    });

    if (!user) {
        throw new Error('User not found');
    }

    return {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        timezone: user.timezone,
        onboardingCompleted: user.onboardingCompleted,
        coachingTone: user.coachingTone,
        preferences: user.preferences,
    };
}

export async function updateUserProfile(userId: string, data: UpdateUserProfileData) {
    const user = await prisma.user.update({
        where: { id: userId },
        data: {
            displayName: data.displayName,
            timezone: data.timezone,
            coachingTone: data.coachingTone,
            onboardingCompleted: data.onboardingCompleted,
        },
    });

    return user;
}
