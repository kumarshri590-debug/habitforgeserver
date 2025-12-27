import { Worker, Job } from 'bullmq';
import { connection } from '../lib/queue';
import prisma from '../lib/prisma';
import { addHours, format, parseISO } from 'date-fns';

export function createReminderWorker() {
    return new Worker(
        'reminders',
        async (job: Job) => {
            console.log(`Processing reminders job: ${job.id}`);

            const now = new Date();
            const upcoming = addHours(now, 1); // Next hour

            // Find pending notifications scheduled for the next hour
            const notifications = await prisma.notification.findMany({
                where: {
                    status: 'pending',
                    scheduledFor: {
                        gte: now,
                        lte: upcoming,
                    },
                },
                include: {
                    user: {
                        include: {
                            preferences: true,
                        },
                    },
                    habit: true,
                },
            });

            for (const notification of notifications) {
                try {
                    await sendNotification(notification);

                    // Mark as sent
                    await prisma.notification.update({
                        where: { id: notification.id },
                        data: {
                            status: 'sent',
                            sentAt: new Date(),
                        },
                    });
                } catch (error) {
                    console.error(`Error sending notification ${notification.id}:`, error);

                    await prisma.notification.update({
                        where: { id: notification.id },
                        data: { status: 'failed' },
                    });
                }
            }

            return { sent: notifications.length };
        },
        { connection }
    );
}

async function sendNotification(notification: any) {
    // Check quiet hours
    if (notification.user.preferences) {
        const { quietHoursStart, quietHoursEnd } = notification.user.preferences;

        if (quietHoursStart && quietHoursEnd) {
            const now = new Date();
            const currentHour = now.getHours();
            const startHour = parseInt(quietHoursStart.split(':')[0]);
            const endHour = parseInt(quietHoursEnd.split(':')[0]);

            if (currentHour >= startHour && currentHour < endHour) {
                console.log(`Skipping notification during quiet hours for user ${notification.userId}`);
                return;
            }
        }
    }

    // In production, this would integrate with Expo Push Notifications
    // For now, we'll just log it
    console.log(`📱 Sending notification to user ${notification.userId}:`);
    console.log(`   Title: ${notification.title}`);
    console.log(`   Body: ${notification.body}`);
    console.log(`   Type: ${notification.type}`);

    // TODO: Integrate with Expo Push Notifications
    // const message = {
    //   to: notification.user.pushToken,
    //   sound: 'default',
    //   title: notification.title,
    //   body: notification.body,
    //   data: { habitId: notification.habitId, type: notification.type },
    // };
    // await expo.sendPushNotificationsAsync([message]);
}

export async function scheduleHabitReminders(habitId: string) {
    const habit = await prisma.habit.findUnique({
        where: { id: habitId },
        include: {
            user: {
                include: {
                    preferences: true,
                },
            },
            logs: {
                take: 30,
                orderBy: { completedAt: 'desc' },
            },
        },
    });

    if (!habit || !habit.user.preferences?.remindersEnabled) return;

    // Find optimal time based on past completions
    const optimalHour = findOptimalTime(habit.logs, habit.timeOfDay);

    // Schedule for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(optimalHour, 0, 0, 0);

    // Create notification
    await prisma.notification.create({
        data: {
            userId: habit.userId,
            habitId: habit.id,
            type: 'reminder',
            title: habit.title,
            body: `Time to ${habit.title.toLowerCase()}! You've got this 💪`,
            scheduledFor: tomorrow,
            optimalTime: true,
            contextAware: true,
        },
    });
}

function findOptimalTime(logs: any[], preferredTime?: string | null): number {
    if (logs.length === 0) {
        // Default based on preference
        return getHourFromTimeOfDay(preferredTime);
    }

    // Find most common completion hour
    const hours = logs.map((log) => new Date(log.completedAt).getHours());
    const hourCounts = hours.reduce((acc, hour) => {
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
    }, {} as Record<number, number>);

    const mostCommonHour = Object.entries(hourCounts).reduce((a, b) =>
        a[1] > b[1] ? a : b
    )[0];

    return parseInt(mostCommonHour);
}

function getHourFromTimeOfDay(timeOfDay?: string | null): number {
    switch (timeOfDay) {
        case 'morning':
            return 9;
        case 'afternoon':
            return 14;
        case 'evening':
            return 19;
        default:
            return 10;
    }
}
