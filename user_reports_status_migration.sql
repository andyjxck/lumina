-- Add status column to user_reports
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_reports' AND column_name='status') THEN
    ALTER TABLE user_reports ADD COLUMN status TEXT DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'closed'));
  END IF;
END $$;
