import prisma from '../lib/prisma';
import { z } from 'zod';
import { generateHabitPlan } from './aiService';
import type { UpdateHabitData, LogCompletionData } from '../types';

const createHabitSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().optional(),
    category: z.string().optional(),
    frequency: z.enum(['daily', 'weekly', 'custom']),
    targetDays: z.array(z.number()).optional(),
    timeOfDay: z.enum(['morning', 'afternoon', 'evening', 'anytime']).optional(),
    useAI: z.boolean().default(true),
    goal: z.string().optional(),
    userContext: z.object({
        experienceLevel: z.string().optional(),
        availableTime: z.string().optional(),
        constraints: z.array(z.string()).optional(),
    }).optional(),
});

export async function createHabit(userId: string, data: z.infer<typeof createHabitSchema>) {
    const validated = createHabitSchema.parse(data);

    let microSteps = null;
    let aiRationale = null;
    let estimatedDifficulty = 3;

    // Generate AI plan if requested
    if (validated.useAI && validated.goal) {
        const user = await prisma.user.findUnique({ where: { id: userId } });

        const aiPlan = await generateHabitPlan(userId, {
            goal: validated.goal,
            userContext: validated.userContext || {},
            coachingTone: user?.coachingTone || 'supportive',
        });

        microSteps = aiPlan.microSteps;
        aiRationale = aiPlan.rationale;
        estimatedDifficulty = aiPlan.estimatedDifficulty;
    }

    // Create habit
    const habit = await prisma.habit.create({
        data: {
            userId,
            title: validated.title,
            description: validated.description,
            category: validated.category,
            frequency: validated.frequency,
            targetDays: validated.targetDays as any,
            timeOfDay: validated.timeOfDay,
            currentDifficulty: estimatedDifficulty,
            baseDifficulty: estimatedDifficulty,
            microSteps: microSteps as any,
            aiRationale,
        },
    });

    // Create streak record
    await prisma.streak.create({
        data: {
            habitId: habit.id,
            userId,
        },
    });

    return habit;
}

export async function getHabits(userId: string, status: string = 'active') {
    const habits = await prisma.habit.findMany({
        where: {
            userId,
            status,
        },
        include: {
            streak: true,
            logs: {
                take: 30,
                orderBy: { completedAt: 'desc' },
            },
        },
        orderBy: { createdAt: 'desc' },
    });

    return habits;
}

export async function getHabitById(userId: string, habitId: string) {
    const habit = await prisma.habit.findFirst({
        where: {
            id: habitId,
            userId,
        },
        include: {
            streak: true,
            logs: {
                take: 90,
                orderBy: { completedAt: 'desc' },
            },
            fallbackHabit: true,
        },
    });

    if (!habit) {
        throw new Error('Habit not found');
    }

    return habit;
}

export async function updateHabit(userId: string, habitId: string, data: UpdateHabitData) {
    // Verify ownership
    const existing = await prisma.habit.findFirst({
        where: { id: habitId, userId },
    });

    if (!existing) {
        throw new Error('Habit not found');
    }

    const habit = await prisma.habit.update({
        where: { id: habitId },
        data: {
            title: data.title,
            description: data.description,
            category: data.category,
            frequency: data.frequency,
            targetDays: data.targetDays,
            timeOfDay: data.timeOfDay,
            status: data.status,
            lockedDifficulty: data.lockedDifficulty,
            currentDifficulty: data.currentDifficulty,
        },
    });

    return habit;
}

export async function deleteHabit(userId: string, habitId: string) {
    // Verify ownership
    const existing = await prisma.habit.findFirst({
        where: { id: habitId, userId },
    });

    if (!existing) {
        throw new Error('Habit not found');
    }

    await prisma.habit.delete({
        where: { id: habitId },
    });

    return { success: true };
}

export async function logHabitCompletion(userId: string, habitId: string, data: LogCompletionData) {
    // Verify habit exists and belongs to user
    const habit = await prisma.habit.findFirst({
        where: { id: habitId, userId },
    });

    if (!habit) {
        throw new Error('Habit not found');
    }

    // Create log
    const log = await prisma.habitLog.create({
        data: {
            habitId,
            userId,
            completedAt: data.completedAt ? new Date(data.completedAt) : new Date(),
            difficultyAtCompletion: habit.currentDifficulty,
            energyLevel: data.energyLevel,
            timeAvailable: data.timeAvailable,
            dayType: data.dayType,
            feltTooEasy: data.feltTooEasy,
            feltTooHard: data.feltTooHard,
            notes: data.notes,
            synced: true,
            clientCreatedAt: data.clientCreatedAt ? new Date(data.clientCreatedAt) : null,
        },
    });

    // Update habit's last completed timestamp
    await prisma.habit.update({
        where: { id: habitId },
        data: { lastCompletedAt: log.completedAt },
    });

    // Update streak (simplified - should be done in background job)
    await updateStreak(habitId, userId);

    return log;
}

async function updateStreak(habitId: string, userId: string) {
    const habit = await prisma.habit.findUnique({
        where: { id: habitId },
        include: {
            logs: {
                orderBy: { completedAt: 'desc' },
                take: 30,
            },
            streak: true,
        },
    });

    if (!habit || !habit.streak) return;

    // Calculate current streak
    let currentStreak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Simple streak calculation (can be enhanced)
    const sortedLogs = habit.logs.sort((a, b) => b.completedAt.getTime() - a.completedAt.getTime());

    for (let i = 0; i < sortedLogs.length; i++) {
        const logDate = new Date(sortedLogs[i].completedAt);
        logDate.setHours(0, 0, 0, 0);

        const daysDiff = Math.floor((today.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysDiff === i) {
            currentStreak++;
        } else {
            break;
        }
    }

    await prisma.streak.update({
        where: { habitId },
        data: {
            currentStreak,
            longestStreak: Math.max(habit.streak.longestStreak, currentStreak),
        },
    });
}

export async function getHabitStats(userId: string, habitId: string, days: number = 30) {
    const habit = await prisma.habit.findFirst({
        where: { id: habitId, userId },
        include: {
            logs: {
                where: {
                    completedAt: {
                        gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
                    },
                },
                orderBy: { completedAt: 'desc' },
            },
            streak: true,
        },
    });

    if (!habit) {
        throw new Error('Habit not found');
    }

    const totalDays = days;
    const completedDays = habit.logs.length;
    const completionRate = completedDays / totalDays;

    return {
        habitId: habit.id,
        title: habit.title,
        currentStreak: habit.streak?.currentStreak || 0,
        longestStreak: habit.streak?.longestStreak || 0,
        completionRate,
        totalCompletions: completedDays,
        currentDifficulty: habit.currentDifficulty,
        recentLogs: habit.logs.slice(0, 7),
    };
}
