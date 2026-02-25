-- =====================================================
-- MIGRATION: New tables for friends, messages, user reports
-- Run this in Supabase SQL Editor AFTER the base schema exists.
-- =====================================================

-- Drop and recreate if partially created from a failed run
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS friendships CASCADE;
DROP TABLE IF EXISTS user_reports CASCADE;

-- ── Add last_seen_at to ac_users if missing ──────────
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ac_users' AND column_name='last_seen_at') THEN
    ALTER TABLE ac_users ADD COLUMN last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
END $$;

-- ── Add delete policy to trade_requests if missing ───
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trade_requests' AND policyname='trade_requests public delete') THEN
    CREATE POLICY "trade_requests public delete" ON trade_requests FOR DELETE USING (true);
  END IF;
END $$;

-- =====================================================
-- TABLE: friendships
-- =====================================================
CREATE TABLE IF NOT EXISTS friendships (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id  UUID NOT NULL REFERENCES ac_users(id) ON DELETE CASCADE,
  user_b_id  UUID NOT NULL REFERENCES ac_users(id) ON DELETE CASCADE,
  status     TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'blocked_by_a', 'blocked_by_b')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_a_id, user_b_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_a ON friendships(user_a_id);
CREATE INDEX IF NOT EXISTS idx_friendships_b ON friendships(user_b_id);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_friendships_updated_at') THEN
    CREATE TRIGGER update_friendships_updated_at
      BEFORE UPDATE ON friendships
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='friendships' AND policyname='friendships public read') THEN
    CREATE POLICY "friendships public read" ON friendships FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='friendships' AND policyname='friendships public insert') THEN
    CREATE POLICY "friendships public insert" ON friendships FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='friendships' AND policyname='friendships public update') THEN
    CREATE POLICY "friendships public update" ON friendships FOR UPDATE USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='friendships' AND policyname='friendships public delete') THEN
    CREATE POLICY "friendships public delete" ON friendships FOR DELETE USING (true);
  END IF;
END $$;

-- =====================================================
-- TABLE: messages
-- AES-GCM encrypted. content_enc + iv both base64.
-- Key = AES-GCM derived from sorted(user_a_id||user_b_id).
-- =====================================================
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,
  sender_id       UUID NOT NULL REFERENCES ac_users(id) ON DELETE CASCADE,
  receiver_id     UUID NOT NULL REFERENCES ac_users(id) ON DELETE CASCADE,
  content_enc     TEXT NOT NULL,
  iv              TEXT NOT NULL,
  read_at         TIMESTAMP WITH TIME ZONE,
  report_flagged  BOOLEAN DEFAULT false,
  report_reason   TEXT DEFAULT '',
  report_by       UUID REFERENCES ac_users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_convo    ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender   ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='messages public read') THEN
    CREATE POLICY "messages public read" ON messages FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='messages public insert') THEN
    CREATE POLICY "messages public insert" ON messages FOR INSERT WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='messages public update') THEN
    CREATE POLICY "messages public update" ON messages FOR UPDATE USING (true);
  END IF;
END $$;

-- =====================================================
-- TABLE: user_reports
-- =====================================================
CREATE TABLE IF NOT EXISTS user_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_id UUID NOT NULL REFERENCES ac_users(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES ac_users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE user_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_reports' AND policyname='user_reports public read') THEN
    CREATE POLICY "user_reports public read" ON user_reports FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_reports' AND policyname='user_reports public insert') THEN
    CREATE POLICY "user_reports public insert" ON user_reports FOR INSERT WITH CHECK (true);
  END IF;
END $$;
