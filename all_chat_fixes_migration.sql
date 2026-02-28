-- =====================================================
-- MIGRATION: All chat fixes
-- Run in Supabase SQL Editor.
-- =====================================================

-- 1. Add typing_in column to ac_users (fixes typing indicator AND online indicator poll)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ac_users' AND column_name='typing_in') THEN
    ALTER TABLE ac_users ADD COLUMN typing_in TEXT DEFAULT NULL;
  END IF;
END $$;

-- 2. Ensure read_at column exists on messages (should already exist per schema)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='messages' AND column_name='read_at') THEN
    ALTER TABLE messages ADD COLUMN read_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- 3. Ensure messages UPDATE policy exists (needed for read receipts)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='messages public update') THEN
    CREATE POLICY "messages public update" ON messages FOR UPDATE USING (true);
  END IF;
END $$;

-- 4. Ensure ac_users UPDATE policy exists (needed for typing_in and last_seen_at writes)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ac_users' AND policyname='ac_users public update') THEN
    CREATE POLICY "ac_users public update" ON ac_users FOR UPDATE USING (true);
  END IF;
END $$;

-- 5. Ensure admin_messages table exists
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

-- 6. Add bio and island_name columns to ac_users
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ac_users' AND column_name='bio') THEN
    ALTER TABLE ac_users ADD COLUMN bio TEXT DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ac_users' AND column_name='island_name') THEN
    ALTER TABLE ac_users ADD COLUMN island_name TEXT DEFAULT NULL;
  END IF;
END $$;

-- 7. Add tables to realtime publication
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE ac_users; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE messages; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE admin_messages; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE trade_requests; EXCEPTION WHEN OTHERS THEN NULL; END;
END $$;
