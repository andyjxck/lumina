-- =====================================================
-- MIGRATION: Add typing_in column to ac_users
-- For typing indicators in chat.
-- Run in Supabase SQL Editor.
-- =====================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ac_users' AND column_name='typing_in') THEN
    ALTER TABLE ac_users ADD COLUMN typing_in TEXT DEFAULT NULL;
  END IF;
END $$;
