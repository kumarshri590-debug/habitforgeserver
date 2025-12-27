import { queues } from '../lib/queue';
import { createBurnoutWorker } from './burnoutWorker';
import { createReminderWorker } from './reminderWorker';

// Initialize workers
const burnoutWorker = createBurnoutWorker();
const reminderWorker = createReminderWorker();

// Schedule recurring jobs
async function scheduleRecurringJobs() {
    // Burnout detection - every 6 hours
    await queues.burnout.add(
        'detect-burnout',
        {},
        {
            repeat: {
                pattern: '0 */6 * * *', // Every 6 hours
            },
        }
    );

    // Send reminders - every 15 minutes
    await queues.reminders.add(
        'send-reminders',
        {},
        {
            repeat: {
                pattern: '*/15 * * * *', // Every 15 minutes
            },
        }
    );

    console.log('✅ Recurring jobs scheduled');
}

// Start workers
async function start() {
    console.log('🚀 Starting background workers...');

    await scheduleRecurringJobs();

    console.log('✅ Workers started successfully');
    console.log('   - Burnout detection worker');
    console.log('   - Reminder worker');
}

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('Shutting down workers...');
    await burnoutWorker.close();
    await reminderWorker.close();
    process.exit(0);
});

// Start if run directly
if (require.main === module) {
    start().catch((error) => {
        console.error('Failed to start workers:', error);
        process.exit(1);
    });
}

export { burnoutWorker, reminderWorker };
