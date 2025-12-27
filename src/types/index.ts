// Type definitions for HabitForge backend

// User & Auth Types
export interface UpdateUserProfileData {
    displayName?: string;
    email?: string;
    coachingTone?: 'supportive' | 'direct' | 'playful';
    onboardingCompleted?: boolean;
    quietHoursStart?: number;
    quietHoursEnd?: number;
    timezone?: string;
}

// Habit Types
export interface CreateHabitData {
    name: string;
    description?: string;
    frequency: 'daily' | 'weekly' | 'custom';
    targetDays?: number[];
    difficulty?: 'easy' | 'medium' | 'hard';
    category?: string;
    reminderTime?: string;
    aiGenerated?: boolean;
}

export interface UpdateHabitData {
    title?: string;
    name?: string;
    description?: string;
    frequency?: 'daily' | 'weekly' | 'custom';
    targetDays?: number[];
    difficulty?: 'easy' | 'medium' | 'hard';
    category?: string;
    reminderTime?: string;
    timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'anytime';
    status?: 'active' | 'paused' | 'archived';
    currentStreak?: number;
    longestStreak?: number;
    lockedDifficulty?: boolean;
    currentDifficulty?: number;
}

export interface LogCompletionData {
    completedAt?: string;
    notes?: string;
    mood?: 'great' | 'good' | 'okay' | 'struggling';
    energyLevel?: number;
    timeOfDay?: 'morning' | 'afternoon' | 'evening';
    timeAvailable?: number;
    dayType?: string;
    feltTooEasy?: boolean;
    feltTooHard?: boolean;
    clientCreatedAt?: string;
}

// AI Service Types
export interface GeneratePlanInput {
    goal: string;
    timeAvailable?: string;
    experienceLevel?: string;
    preferences?: string[];
}

export interface AdjustDifficultyInput {
    habitId: string;
    currentDifficulty: string;
    recentPerformance: {
        completionRate: number;
        streak: number;
        missedDays: number;
    };
}

export interface AIResponse {
    content: string;
    cached?: boolean;
    tokensUsed?: number;
}

export interface CachedAIResponse {
    data: unknown;
    timestamp: number;
    expiresAt: number;
}

export interface AIUsageLog {
    userId: string;
    operation: string;
    inputData: Record<string, unknown>;
    aiResponse: unknown;
    tokensUsed: number;
    cached: boolean;
    cost: number;
}

export interface GenerateInsightsResult {
    headline: string;
    insights: Array<{
        type: string;
        message: string;
        data?: unknown;
    }>;
    nextSteps: string[];
}

// Sync Types
export interface SyncChange {
    id: string;
    type: 'habit' | 'completion' | 'user';
    operation: 'create' | 'update' | 'delete';
    data: Record<string, unknown>;
    timestamp: string;
    clientId?: string;
}

export interface ConflictResolution {
    changeId: string;
    resolution: 'server' | 'client' | 'merge';
    serverData: Record<string, unknown>;
    clientData: Record<string, unknown>;
    mergedData?: Record<string, unknown>;
}

export interface MergedHabitData {
    name: string;
    description?: string;
    currentStreak: number;
    longestStreak: number;
    lastCompletedAt?: string;
    status: string;
    [key: string]: unknown;
}

// Notification Types
export interface NotificationData {
    userId: string;
    habitId: string;
    habitName: string;
    message: string;
    scheduledFor: Date;
    type: 'reminder' | 'encouragement' | 'streak';
}

// Completion Types
export interface CompletionRecord {
    id: string;
    habitId: string;
    userId: string;
    completedAt: Date;
    notes?: string;
    mood?: string;
    createdAt: Date;
}

// Query Types
export interface DatabaseQueryParams {
    text: string;
    params?: (string | number | boolean | null)[];
}

// Middleware Types
export interface SuccessResponse<T = unknown> {
    success: true;
    data: T;
}

export interface ErrorResponse {
    success: false;
    error: string;
    details?: unknown;
}

// AI Schema Types
export interface AIPromptOptions {
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    schema?: Record<string, unknown>;
}
