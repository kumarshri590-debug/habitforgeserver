import prisma from '../lib/prisma';

interface SyncChange {
    table: string;
    recordId: string;
    action: 'create' | 'update' | 'delete';
    data: any;
    updatedAt: string;
    clientVersion?: number;
}

interface ConflictResolution {
    recordId: string;
    table: string;
    strategy: 'server_wins' | 'client_wins' | 'merged' | 'keep_both';
    serverData: any;
    clientData: any;
    mergedData?: any;
}

export async function pullChanges(userId: string, lastSyncTimestamp?: string) {
    const since = lastSyncTimestamp ? new Date(lastSyncTimestamp) : new Date(0);

    // Fetch all changes since last sync
    const [habits, habitLogs, streaks, notifications] = await Promise.all([
        prisma.habit.findMany({
            where: {
                userId,
                updatedAt: { gt: since },
            },
        }),
        prisma.habitLog.findMany({
            where: {
                userId,
                completedAt: { gt: since },
            },
        }),
        prisma.streak.findMany({
            where: {
                userId,
                updatedAt: { gt: since },
            },
        }),
        prisma.notification.findMany({
            where: {
                userId,
                scheduledFor: { gt: since },
            },
        }),
    ]);

    return {
        habits,
        habitLogs,
        streaks,
        notifications,
        timestamp: new Date().toISOString(),
    };
}

export async function pushChanges(userId: string, changes: SyncChange[]) {
    const conflicts: ConflictResolution[] = [];
    const applied: string[] = [];

    for (const change of changes) {
        try {
            const conflict = await applyChange(userId, change);

            if (conflict) {
                conflicts.push(conflict);
            } else {
                applied.push(change.recordId);
            }
        } catch (error) {
            console.error(`Error applying change for ${change.recordId}:`, error);
        }
    }

    return {
        applied,
        conflicts,
        timestamp: new Date().toISOString(),
    };
}

async function applyChange(
    userId: string,
    change: SyncChange
): Promise<ConflictResolution | null> {
    const { table, recordId, action, data, updatedAt } = change;

    // Handle different tables
    switch (table) {
        case 'habits':
            return await applyHabitChange(userId, recordId, action, data, updatedAt);

        case 'habit_logs':
            return await applyHabitLogChange(userId, recordId, action, data, updatedAt);

        default:
            throw new Error(`Unsupported table: ${table}`);
    }
}

async function applyHabitChange(
    userId: string,
    recordId: string,
    action: string,
    data: any,
    clientUpdatedAt: string
): Promise<ConflictResolution | null> {
    if (action === 'create') {
        // Check if already exists
        const existing = await prisma.habit.findUnique({ where: { id: recordId } });

        if (existing) {
            // Conflict: client thinks it's new, but server has it
            return {
                recordId,
                table: 'habits',
                strategy: 'server_wins',
                serverData: existing,
                clientData: data,
            };
        }

        // Create new habit
        await prisma.habit.create({
            data: {
                id: recordId,
                userId,
                ...data,
            },
        });

        return null;
    }

    if (action === 'update') {
        const serverRecord = await prisma.habit.findUnique({ where: { id: recordId } });

        if (!serverRecord) {
            // Record doesn't exist on server, treat as create
            await prisma.habit.create({
                data: {
                    id: recordId,
                    userId,
                    ...data,
                },
            });
            return null;
        }

        // Check for conflict
        const serverUpdatedAt = serverRecord.updatedAt.toISOString();
        const clientUpdatedAtDate = new Date(clientUpdatedAt);

        if (serverRecord.updatedAt > clientUpdatedAtDate) {
            // Server is newer - conflict!
            const merged = mergeHabitData(serverRecord, data);

            await prisma.habit.update({
                where: { id: recordId },
                data: merged,
            });

            return {
                recordId,
                table: 'habits',
                strategy: 'merged',
                serverData: serverRecord,
                clientData: data,
                mergedData: merged,
            };
        }

        // Client is newer, apply update
        await prisma.habit.update({
            where: { id: recordId },
            data,
        });

        return null;
    }

    if (action === 'delete') {
        await prisma.habit.delete({ where: { id: recordId } });
        return null;
    }

    return null;
}

async function applyHabitLogChange(
    userId: string,
    recordId: string,
    action: string,
    data: any,
    clientUpdatedAt: string
): Promise<ConflictResolution | null> {
    if (action === 'create') {
        // Habit logs are append-only, check for duplicates
        const existing = await prisma.habitLog.findUnique({ where: { id: recordId } });

        if (existing) {
            // Already exists, no conflict (idempotent)
            return null;
        }

        await prisma.habitLog.create({
            data: {
                id: recordId,
                userId,
                habitId: data.habitId,
                completedAt: new Date(data.completedAt),
                difficultyAtCompletion: data.difficultyAtCompletion,
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

        return null;
    }

    // Logs are typically not updated or deleted
    return null;
}

function mergeHabitData(serverData: any, clientData: any): any {
    // Merge strategy: client wins for user-editable fields, server wins for AI fields
    return {
        title: clientData.title ?? serverData.title,
        description: clientData.description ?? serverData.description,
        category: clientData.category ?? serverData.category,
        frequency: clientData.frequency ?? serverData.frequency,
        targetDays: clientData.targetDays ?? serverData.targetDays,
        timeOfDay: clientData.timeOfDay ?? serverData.timeOfDay,
        status: clientData.status ?? serverData.status,
        lockedDifficulty: clientData.lockedDifficulty ?? serverData.lockedDifficulty,

        // Server wins for AI-managed fields
        currentDifficulty: serverData.currentDifficulty,
        microSteps: serverData.microSteps,
        aiRationale: serverData.aiRationale,

        updatedAt: new Date(),
    };
}

export async function getConflicts(userId: string) {
    // Get unresolved conflicts from sync metadata
    const conflicts = await prisma.syncMetadata.findMany({
        where: {
            userId,
            conflictResolution: { not: null },
        },
        orderBy: { lastSyncedAt: 'desc' },
        take: 50,
    });

    return conflicts;
}

export async function resolveConflict(
    userId: string,
    recordId: string,
    resolution: 'accept_server' | 'accept_client' | 'accept_merged'
) {
    // Update sync metadata
    await prisma.syncMetadata.updateMany({
        where: {
            userId,
            recordId,
        },
        data: {
            conflictResolution: resolution === 'accept_server' ? 'server_wins' :
                resolution === 'accept_client' ? 'client_wins' : 'merged',
            lastSyncedAt: new Date(),
        },
    });

    return { success: true };
}
