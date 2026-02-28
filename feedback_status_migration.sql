-- =====================================================
-- MIGRATION: Add feedback_status to user_feedback
-- Run in Supabase SQL Editor.
-- =====================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_feedback' AND column_name='feedback_status') THEN
    ALTER TABLE user_feedback ADD COLUMN feedback_status TEXT DEFAULT 'open' CHECK (feedback_status IN ('open', 'implementing', 'implemented', 'rejected'));
  END IF;
END $$;
