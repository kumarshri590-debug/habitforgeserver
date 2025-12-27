import OpenAI from 'openai';
import prisma from '../lib/prisma';
import { connection as redis } from '../lib/queue';
import type { GenerateInsightsResult } from '../types';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = 'gpt-4o-mini';
const CACHE_TTL = 24 * 60 * 60; // 24 hours in seconds
const MAX_REQUESTS_PER_DAY = 50;

// ============================================
// TYPES
// ============================================

export interface GeneratePlanInput {
    goal: string;
    userContext: {
        experienceLevel?: string;
        availableTime?: string;
        constraints?: string[];
    };
    coachingTone: string;
}

export interface GeneratePlanOutput {
    habitTitle: string;
    microSteps: Array<{ step: string; duration: string }>;
    estimatedDifficulty: number;
    rationale: string;
    suggestedFrequency: string;
    optimalTime: string;
}

export interface AdjustDifficultyInput {
    habitId: string;
    currentDifficulty: number;
    recentPerformance: {
        completionRate7d: number;
        completionRate30d: number;
        consecutiveMisses: number;
        userFeedback: Array<{ date: string; feltTooHard?: boolean; feltTooEasy?: boolean }>;
    };
    context?: {
        energyLevels?: number[];
        timeAvailable?: number[];
    };
}

export interface AdjustDifficultyOutput {
    newDifficulty: number;
    adjustmentReason: string;
    explanation: string;
    recommendedChanges?: {
        microSteps?: Array<{ step: string; duration: string }>;
    };
    confidence: number;
}

export interface BurnoutAnalysisInput {
    userId: string;
    habitsSummary: Array<{
        habitId: string;
        title: string;
        completionRate30d: number;
        completionRate7d: number;
        difficulty: number;
        recentFeedback?: string[];
    }>;
    overallMetrics: {
        totalActiveHabits: number;
        avgCompletionRate: number;
        trend: string;
    };
}

export interface BurnoutAnalysisOutput {
    burnoutDetected: boolean;
    severity: 'none' | 'low' | 'medium' | 'high';
    primaryCauses: string[];
    suggestedActions: Array<{
        action: string;
        habitIds?: string[];
        newDifficulty?: number;
        explanation: string;
    }>;
    supportiveMessage: string;
}

// ============================================
// CACHING
// ============================================

async function getCachedResponse<T>(key: string): Promise<T | null> {
    try {
        const cached = await redis.get(key);
        return cached ? JSON.parse(cached) : null;
    } catch (error) {
        console.error('Cache get error:', error);
        return null;
    }
}

async function setCachedResponse(key: string, data: unknown): Promise<void> {
    try {
        await redis.setex(key, CACHE_TTL, JSON.stringify(data));
    } catch (error) {
        console.error('Cache set error:', error);
    }
}

function generateCacheKey(type: string, input: unknown): string {
    return `ai:${type}:${JSON.stringify(input)}`;
}

// ============================================
// RATE LIMITING
// ============================================

async function checkRateLimit(userId: string): Promise<boolean> {
    const key = `ratelimit:${userId}:${new Date().toISOString().split('T')[0]}`;
    const count = await redis.incr(key);

    if (count === 1) {
        await redis.expire(key, 86400); // 24 hours
    }

    return count <= MAX_REQUESTS_PER_DAY;
}

// ============================================
// COST TRACKING
// ============================================

function calculateCost(tokens: number, model: string): number {
    // GPT-4o-mini pricing: $0.150 / 1M input tokens, $0.600 / 1M output tokens
    // Simplified: average $0.375 / 1M tokens
    return (tokens / 1_000_000) * 0.375;
}

async function logAIDecision(
    userId: string,
    habitId: string | null,
    decisionType: string,
    inputData: any,
    aiResponse: any,
    explanation: string | null,
    tokensUsed: number
) {
    const cost = calculateCost(tokensUsed, MODEL);

    await prisma.aIDecision.create({
        data: {
            userId,
            habitId,
            decisionType,
            inputData,
            aiResponse,
            explanation,
            tokensUsed,
            costUsd: cost,
            modelUsed: MODEL,
        },
    });
}

// ============================================
// AI OPERATIONS
// ============================================

export async function generateHabitPlan(
    userId: string,
    input: GeneratePlanInput
): Promise<GeneratePlanOutput> {
    // Check rate limit
    const allowed = await checkRateLimit(userId);
    if (!allowed) {
        throw new Error('Daily AI request limit exceeded');
    }

    // Check cache
    const cacheKey = generateCacheKey('generate-plan', input);
    const cached = await getCachedResponse<GeneratePlanOutput>(cacheKey);
    if (cached) return cached;

    const prompt = `You are a supportive habit coach. Generate a micro-habit plan.

Input:
${JSON.stringify(input, null, 2)}

Return ONLY valid JSON matching this structure:
{
  "habitTitle": "string",
  "microSteps": [{"step": "string", "duration": "string"}],
  "estimatedDifficulty": number (1-10),
  "rationale": "string (one supportive sentence)",
  "suggestedFrequency": "daily|weekly|custom",
  "optimalTime": "morning|afternoon|evening|anytime"
}

Rules:
- Start small (2-5 micro-steps)
- Be specific and actionable
- Match the coaching tone: ${input.coachingTone}
- No guilt or shame language
- Focus on consistency over intensity`;

    const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}') as GeneratePlanOutput;
    const tokensUsed = response.usage?.total_tokens || 0;

    // Cache and log
    await setCachedResponse(cacheKey, result);
    await logAIDecision(userId, null, 'generate_plan', input, result, result.rationale, tokensUsed);

    return result;
}

export async function adjustDifficulty(
    userId: string,
    input: AdjustDifficultyInput
): Promise<AdjustDifficultyOutput> {
    // Rule-based fallback for simple cases
    const { completionRate7d, consecutiveMisses } = input.recentPerformance;

    if (consecutiveMisses < 3 && (completionRate7d > 0.8 || completionRate7d < 0.4)) {
        return ruleBasedDifficultyAdjust(input);
    }

    // Check rate limit
    const allowed = await checkRateLimit(userId);
    if (!allowed) {
        return ruleBasedDifficultyAdjust(input);
    }

    const prompt = `Analyze habit performance and suggest difficulty adjustment.

Input:
${JSON.stringify(input, null, 2)}

Return ONLY valid JSON:
{
  "newDifficulty": number (1-10),
  "adjustmentReason": "increase|decrease|maintain",
  "explanation": "string (one supportive sentence)",
  "recommendedChanges": {
    "microSteps": [{"step": "string", "duration": "string"}]
  },
  "confidence": number (0-1)
}

Rules:
- Adjust gradually (max ±2 levels)
- Prioritize recovery over perfection
- Be supportive, never use guilt`;

    const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
        response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}') as AdjustDifficultyOutput;
    const tokensUsed = response.usage?.total_tokens || 0;

    await logAIDecision(userId, input.habitId, 'adjust_difficulty', input, result, result.explanation, tokensUsed);

    return result;
}

function ruleBasedDifficultyAdjust(input: AdjustDifficultyInput): AdjustDifficultyOutput {
    const { completionRate7d } = input.recentPerformance;
    const { currentDifficulty } = input;

    if (completionRate7d < 0.5 && currentDifficulty > 1) {
        return {
            newDifficulty: Math.max(1, currentDifficulty - 1),
            adjustmentReason: 'decrease',
            explanation: "Let's make this easier to rebuild your momentum.",
            confidence: 0.9,
        };
    }

    if (completionRate7d > 0.85 && currentDifficulty < 10) {
        return {
            newDifficulty: currentDifficulty + 1,
            adjustmentReason: 'increase',
            explanation: "You're crushing it! Ready for a bigger challenge?",
            confidence: 0.9,
        };
    }

    return {
        newDifficulty: currentDifficulty,
        adjustmentReason: 'maintain',
        explanation: 'Keep going! Your current level is working well.',
        confidence: 1.0,
    };
}

export async function analyzeBurnout(
    userId: string,
    input: BurnoutAnalysisInput
): Promise<BurnoutAnalysisOutput> {
    // Check rate limit
    const allowed = await checkRateLimit(userId);
    if (!allowed) {
        throw new Error('Daily AI request limit exceeded');
    }

    const prompt = `Analyze user's habit patterns for burnout signals.

Input:
${JSON.stringify(input, null, 2)}

Return ONLY valid JSON:
{
  "burnoutDetected": boolean,
  "severity": "none|low|medium|high",
  "primaryCauses": ["string"],
  "suggestedActions": [{
    "action": "reduce_difficulty|pause_habit|add_recovery_day",
    "habitIds": ["string"],
    "newDifficulty": number,
    "explanation": "string"
  }],
  "supportiveMessage": "string (empathetic, no guilt)"
}

Rules:
- Be conservative (prefer false negatives to false positives)
- Suggest gradual adjustments
- Emphasize recovery and adaptation
- Never blame the user`;

    const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
        response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}') as BurnoutAnalysisOutput;
    const tokensUsed = response.usage?.total_tokens || 0;

    await logAIDecision(userId, null, 'burnout_analysis', input, result, result.supportiveMessage, tokensUsed);

    return result;
}

export async function generateInsightNarrative(
    userId: string,
    metrics: Record<string, unknown>
): Promise<GenerateInsightsResult> {
    const cacheKey = generateCacheKey('insights', metrics);
    const cached = await getCachedResponse<GenerateInsightsResult>(cacheKey);
    if (cached) return cached;

    const allowed = await checkRateLimit(userId);
    if (!allowed) {
        throw new Error('Daily AI request limit exceeded');
    }

    const prompt = `Generate personalized habit insights.

Metrics:
${JSON.stringify(metrics, null, 2)}

Return ONLY valid JSON:
{
  "headline": "string (engaging, positive)",
  "insights": [{
    "type": "strength|opportunity|pattern",
    "message": "string"
  }],
  "nextSteps": ["string"]
}

Rules:
- Celebrate wins first
- Frame challenges as opportunities
- Be specific with data
- Keep it actionable`;

    const response = await openai.chat.completions.create({
        model: MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.8,
        response_format: { type: 'json_object' },
    });

    const result = JSON.parse(response.choices[0].message.content || '{}');
    const tokensUsed = response.usage?.total_tokens || 0;

    await setCachedResponse(cacheKey, result);
    await logAIDecision(userId, null, 'generate_insights', metrics, result, null, tokensUsed);

    return result;
}
