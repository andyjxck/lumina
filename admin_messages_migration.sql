-- =====================================================
-- MIGRATION: Create admin_messages table
-- For support chat replies on user_feedback items.
-- Run in Supabase SQL Editor.
-- =====================================================

CREATE TABLE IF NOT EXISTS admin_messages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id  UUID NOT NULL REFERENCES user_feedback(id) ON DELETE CASCADE,
  sender_id  UUID NOT NULL REFERENCES ac_users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_messages_report ON admin_messages(report_id, created_at);

ALTER TABLE admin_messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_messages' AND policyname='admin_messages public read')   THEN CREATE POLICY "admin_messages public read"   ON admin_messages FOR SELECT USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='admin_messages' AND policyname='admin_messages public insert') THEN CREATE POLICY "admin_messages public insert" ON admin_messages FOR INSERT WITH CHECK (true); END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE admin_messages;
