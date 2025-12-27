import { Queue, Worker, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

const connection = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null,
});

// Job Types
export const JOB_TYPES = {
    SEND_REMINDERS: 'send_reminders',
    CALCULATE_STREAKS: 'calculate_streaks',
    DETECT_BURNOUT: 'detect_burnout',
    GENERATE_INSIGHTS: 'generate_insights',
    ADJUST_DIFFICULTY: 'adjust_difficulty',
    SYNC_OFFLINE_DATA: 'sync_offline_data',
    PREDICT_INTERVENTION: 'predict_intervention',
} as const;

// Create queues
export const queues = {
    reminders: new Queue('reminders', { connection }),
    streaks: new Queue('streaks', { connection }),
    burnout: new Queue('burnout', { connection }),
    insights: new Queue('insights', { connection }),
    ai: new Queue('ai', { connection }),
    sync: new Queue('sync', { connection }),
};

// Queue events for monitoring
export const queueEvents = {
    reminders: new QueueEvents('reminders', { connection }),
    streaks: new QueueEvents('streaks', { connection }),
    burnout: new QueueEvents('burnout', { connection }),
    insights: new QueueEvents('insights', { connection }),
    ai: new QueueEvents('ai', { connection }),
    sync: new QueueEvents('sync', { connection }),
};

export { connection };
