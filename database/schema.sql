-- HabitForge Database Schema
-- PostgreSQL

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  preferences JSONB DEFAULT '{
    "ai_enabled": true,
    "reminder_tone": "supportive",
    "difficulty_preference": "gradual"
  }'::jsonb
);

-- Habits table
CREATE TABLE habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Core fields
  name VARCHAR(255) NOT NULL,
  goal TEXT,
  frequency_type VARCHAR(20) CHECK (frequency_type IN ('daily', 'weekly', 'custom')),
  frequency_target INT DEFAULT 1,
  
  -- Difficulty tracking
  difficulty_level INT DEFAULT 1 CHECK (difficulty_level BETWEEN 1 AND 10),
  initial_difficulty INT DEFAULT 1,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  is_ai_managed BOOLEAN DEFAULT true,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  paused_at TIMESTAMP,
  
  -- AI context
  ai_adjustments JSONB DEFAULT '[]'::jsonb,
  
  CONSTRAINT valid_frequency CHECK (frequency_target > 0)
);

-- Tracking table (append-only log)
CREATE TABLE habit_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  completed_at TIMESTAMP DEFAULT NOW(),
  scheduled_for DATE,
  
  -- Metadata
  completion_time_seconds INT,
  mood VARCHAR(20),
  notes TEXT,
  
  -- Streak context (denormalized for performance)
  streak_count INT DEFAULT 0,
  is_recovery BOOLEAN DEFAULT false
);

-- Fallback habits (AI-generated alternatives)
CREATE TABLE fallback_habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_habit_id UUID REFERENCES habits(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  difficulty_level INT CHECK (difficulty_level BETWEEN 1 AND 10),
  
  -- AI metadata
  generated_at TIMESTAMP DEFAULT NOW(),
  generation_context JSONB,
  times_used INT DEFAULT 0,
  
  is_active BOOLEAN DEFAULT true
);

-- Reminders table
CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID REFERENCES habits(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Scheduling
  time TIME NOT NULL,
  days_of_week INT[] DEFAULT '{1,2,3,4,5,6,7}',
  
  -- Adaptive content
  message TEXT,
  tone VARCHAR(20) DEFAULT 'supportive',
  
  -- AI-driven adaptation
  last_adapted_at TIMESTAMP,
  adaptation_reason TEXT,
  
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- AI decision log (audit trail)
CREATE TABLE ai_decisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,
  
  decision_type VARCHAR(50) NOT NULL,
  input_data JSONB NOT NULL,
  output_data JSONB NOT NULL,
  explanation TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  -- User override tracking
  was_overridden BOOLEAN DEFAULT false,
  override_reason TEXT
);

-- Indexes for performance
CREATE INDEX idx_habits_user_status ON habits(user_id, status);
CREATE INDEX idx_completions_habit_date ON habit_completions(habit_id, scheduled_for DESC);
CREATE INDEX idx_completions_user_date ON habit_completions(user_id, scheduled_for DESC);
CREATE INDEX idx_reminders_user_enabled ON reminders(user_id, is_enabled);
CREATE INDEX idx_ai_decisions_user_type ON ai_decisions(user_id, decision_type, created_at DESC);
