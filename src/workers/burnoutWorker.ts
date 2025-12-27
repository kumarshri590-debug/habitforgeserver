import { Worker, Job } from 'bullmq';
import { connection } from '../lib/queue';
import prisma from '../lib/prisma';
import { analyzeBurnout } from '../services/aiService';

export function createBurnoutWorker() {
    return new Worker(
        'burnout',
        async (job: Job) => {
            console.log(`Processing burnout detection job: ${job.id}`);

            // Get all active users
            const users = await prisma.user.findMany({
                where: { onboardingCompleted: true },
                select: { id: true },
            });

            for (const user of users) {
                try {
                    await detectUserBurnout(user.id);
                } catch (error) {
                    console.error(`Error detecting burnout for user ${user.id}:`, error);
                }
            }

            return { processed: users.length };
        },
        { connection }
    );
}

async function detectUserBurnout(userId: string) {
    // Get user's active habits with recent logs
    const habits = await prisma.habit.findMany({
        where: {
            userId,
            status: 'active',
        },
        include: {
            logs: {
                where: {
                    completedAt: {
                        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
                    },
                },
                orderBy: { completedAt: 'desc' },
            },
        },
    });

    if (habits.length === 0) return;

    // Calculate metrics for each habit
    const habitsSummary = habits.map((habit) => {
        const logs7d = habit.logs.filter(
            (log) => log.completedAt >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        );
        const logs30d = habit.logs;

        const completionRate7d = logs7d.length / 7;
        const completionRate30d = logs30d.length / 30;

        const recentFeedback = logs7d
            .filter((log) => log.feltTooHard)
            .map(() => 'too_hard');

        return {
            habitId: habit.id,
            title: habit.title,
            completionRate30d,
            completionRate7d,
            difficulty: habit.currentDifficulty,
            recentFeedback,
        };
    });

    // Rule-based detection first
    let burnoutDetected = false;
    let severity: 'none' | 'low' | 'medium' | 'high' = 'none';

    for (const habit of habitsSummary) {
        const drop = habit.completionRate30d - habit.completionRate7d;

        if (drop > 0.3) {
            burnoutDetected = true;
            severity = drop > 0.5 ? 'high' : 'medium';
            break;
        }

        if (habit.recentFeedback.length >= 3) {
            burnoutDetected = true;
            severity = 'medium';
            break;
        }
    }

    if (!burnoutDetected) return;

    // Check if we already have an unresolved signal
    const existingSignal = await prisma.burnoutSignal.findFirst({
        where: {
            userId,
            resolved: false,
        },
    });

    if (existingSignal) return; // Don't create duplicate signals

    // Get AI analysis
    const avgCompletionRate =
        habitsSummary.reduce((sum, h) => sum + h.completionRate30d, 0) / habitsSummary.length;

    const aiAnalysis = await analyzeBurnout(userId, {
        userId,
        habitsSummary,
        overallMetrics: {
            totalActiveHabits: habits.length,
            avgCompletionRate,
            trend: 'declining',
        },
    });

    // Create burnout signal
    await prisma.burnoutSignal.create({
        data: {
            userId,
            severity: aiAnalysis.severity,
            completionRateDrop: habitsSummary[0]?.completionRate30d - habitsSummary[0]?.completionRate7d,
            consecutiveMisses: 0,
            difficultyComplaints: habitsSummary.reduce(
                (sum, h) => sum + h.recentFeedback.length,
                0
            ),
            aiAnalysis: aiAnalysis as any,
            suggestedActions: aiAnalysis.suggestedActions as any,
        },
    });

    console.log(`Burnout detected for user ${userId} - Severity: ${aiAnalysis.severity}`);
}
