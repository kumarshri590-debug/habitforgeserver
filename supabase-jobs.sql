-- HabitForge: pg_cron Job Setup for Supabase
-- Run this in Supabase SQL Editor after enabling pg_cron extension

-- ============================================
-- 1. Enable pg_cron Extension
-- ============================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Grant permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- ============================================
-- 2. Create Job Functions
-- ============================================

-- Function to process burnout detection
CREATE OR REPLACE FUNCTION process_burnout_detection()
RETURNS void AS $$
BEGIN
    -- This will be called by your backend API endpoint
    -- We'll trigger it via HTTP request from pg_cron
    RAISE NOTICE 'Burnout detection job triggered at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to process smart reminders
CREATE OR REPLACE FUNCTION process_smart_reminders()
RETURNS void AS $$
BEGIN
    -- This will be called by your backend API endpoint
    RAISE NOTICE 'Smart reminders job triggered at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to calculate streaks
CREATE OR REPLACE FUNCTION calculate_all_streaks()
RETURNS void AS $$
BEGIN
    -- This will be called by your backend API endpoint
    RAISE NOTICE 'Streak calculation job triggered at %', NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. Schedule Jobs with pg_cron
-- ============================================

-- Burnout Detection: Every 6 hours
SELECT cron.schedule(
    'burnout-detection',
    '0 */6 * * *',  -- Every 6 hours
    $$SELECT process_burnout_detection()$$
);

-- Smart Reminders: Every 15 minutes
SELECT cron.schedule(
    'smart-reminders',
    '*/15 * * * *',  -- Every 15 minutes
    $$SELECT process_smart_reminders()$$
);

-- Streak Calculation: Every hour
SELECT cron.schedule(
    'streak-calculation',
    '0 * * * *',  -- Every hour
    $$SELECT calculate_all_streaks()$$
);

-- ============================================
-- 4. View Scheduled Jobs
-- ============================================
SELECT * FROM cron.job;

-- ============================================
-- 5. View Job Run History
-- ============================================
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;

-- ============================================
-- 6. Unschedule Jobs (if needed)
-- ============================================
-- SELECT cron.unschedule('burnout-detection');
-- SELECT cron.unschedule('smart-reminders');
-- SELECT cron.unschedule('streak-calculation');

-- ============================================
-- NOTES:
-- ============================================
-- 
-- pg_cron runs in UTC timezone by default
-- Adjust cron expressions based on your needs:
-- 
-- Cron format: minute hour day month weekday
-- Examples:
--   '0 0 * * *'      - Daily at midnight
--   '*/30 * * * *'   - Every 30 minutes
--   '0 */2 * * *'    - Every 2 hours
--   '0 9 * * 1'      - Every Monday at 9 AM
-- 
-- For production, you'll want to:
-- 1. Create API endpoints for each job
-- 2. Use pg_net extension to call these endpoints
-- 3. Or implement the logic directly in PostgreSQL functions
