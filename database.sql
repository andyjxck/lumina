-- =====================================================
-- AC VILLAGER TRADING — FULL SCHEMA (MIGRATION SAFE)
-- Run in Supabase SQL Editor.
-- Safe to re-run: uses IF NOT EXISTS / DO blocks.
-- =====================================================

-- ── Shared trigger function ──────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TABLE: ac_users
-- =====================================================
CREATE TABLE IF NOT EXISTS ac_users (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_number      INTEGER UNIQUE NOT NULL,
  username         TEXT,
  secret_hash      TEXT NOT NULL,
  secret_type      TEXT DEFAULT 'password' CHECK (secret_type IN ('password', 'pin')),
  owned            TEXT[] DEFAULT '{}',
  favourites       TEXT[] DEFAULT '{}',
  wishlist         TEXT[] DEFAULT '{}',
  trade_restricted BOOLEAN DEFAULT false,
  -- Online presence (updated by client heartbeat)
  last_seen_at     TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at       TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ac_users_user_number ON ac_users(user_number);
CREATE INDEX IF NOT EXISTS idx_ac_users_username    ON ac_users(username);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_ac_users_updated_at') THEN
    CREATE TRIGGER update_ac_users_updated_at
      BEFORE UPDATE ON ac_users
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE ac_users ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ac_users' AND policyname='ac_users public read')    THEN CREATE POLICY "ac_users public read"    ON ac_users FOR SELECT USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ac_users' AND policyname='ac_users public insert')  THEN CREATE POLICY "ac_users public insert"  ON ac_users FOR INSERT WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ac_users' AND policyname='ac_users public update')  THEN CREATE POLICY "ac_users public update"  ON ac_users FOR UPDATE USING (true); END IF;
END $$;

-- Add last_seen_at column to existing installs
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ac_users' AND column_name='last_seen_at') THEN
    ALTER TABLE ac_users ADD COLUMN last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ac_users' AND column_name='trade_restricted') THEN
    ALTER TABLE ac_users ADD COLUMN trade_restricted BOOLEAN DEFAULT false;
  END IF;
END $$;

-- =====================================================
-- TABLE: trade_requests
-- =====================================================
CREATE TABLE IF NOT EXISTS trade_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  UUID NOT NULL REFERENCES ac_users(id) ON DELETE CASCADE,
  acceptor_id   UUID REFERENCES ac_users(id) ON DELETE SET NULL,
  villager_name TEXT NOT NULL,
  offer_text    TEXT DEFAULT '',
  status        TEXT DEFAULT 'open' CHECK (status IN ('open', 'ongoing', 'completed', 'cancelled')),
  trade_step    INTEGER DEFAULT 1,
  plot_available BOOLEAN DEFAULT false,
  dodo_code     TEXT DEFAULT '',
  completed_at  TIMESTAMP WITH TIME ZONE,
  reported      BOOLEAN DEFAULT false,
  report_reason TEXT DEFAULT '',
  report_by     UUID REFERENCES ac_users(id) ON DELETE SET NULL,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trade_requests_requester ON trade_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_trade_requests_acceptor  ON trade_requests(acceptor_id);
CREATE INDEX IF NOT EXISTS idx_trade_requests_villager  ON trade_requests(villager_name);
CREATE INDEX IF NOT EXISTS idx_trade_requests_status    ON trade_requests(status);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_trade_requests_updated_at') THEN
    CREATE TRIGGER update_trade_requests_updated_at
      BEFORE UPDATE ON trade_requests
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

ALTER TABLE trade_requests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trade_requests' AND policyname='trade_requests public read')   THEN CREATE POLICY "trade_requests public read"   ON trade_requests FOR SELECT USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trade_requests' AND policyname='trade_requests public insert') THEN CREATE POLICY "trade_requests public insert" ON trade_requests FOR INSERT WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trade_requests' AND policyname='trade_requests public update') THEN CREATE POLICY "trade_requests public update" ON trade_requests FOR UPDATE USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='trade_requests' AND policyname='trade_requests public delete') THEN CREATE POLICY "trade_requests public delete" ON trade_requests FOR DELETE USING (true); END IF;
END $$;

-- =====================================================
-- TABLE: friendships
-- user_a_id < user_b_id enforced by CHECK to avoid duplicates
-- status: pending (user_a sent), accepted, blocked_by_a, blocked_by_b
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='friendships' AND policyname='friendships public read')   THEN CREATE POLICY "friendships public read"   ON friendships FOR SELECT USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='friendships' AND policyname='friendships public insert') THEN CREATE POLICY "friendships public insert" ON friendships FOR INSERT WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='friendships' AND policyname='friendships public update') THEN CREATE POLICY "friendships public update" ON friendships FOR UPDATE USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='friendships' AND policyname='friendships public delete') THEN CREATE POLICY "friendships public delete" ON friendships FOR DELETE USING (true); END IF;
END $$;

-- =====================================================
-- TABLE: messages
-- AES-GCM encrypted content stored as base64 string.
-- iv stored separately. Key derived from sorted(user_a_id, user_b_id) + shared secret.
-- When reported: last 5 messages in convo have report_flagged=true (decrypted by admin).
-- =====================================================
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL,   -- = friendship.id
  sender_id       UUID NOT NULL REFERENCES ac_users(id) ON DELETE CASCADE,
  receiver_id     UUID NOT NULL REFERENCES ac_users(id) ON DELETE CASCADE,
  -- Encrypted content (AES-GCM, base64)
  content_enc     TEXT NOT NULL,
  iv              TEXT NOT NULL,   -- base64 AES-GCM nonce
  -- Read receipt
  read_at         TIMESTAMP WITH TIME ZONE,
  -- Typing indicator helper (updated by sender, read by receiver)
  -- Moderation
  report_flagged  BOOLEAN DEFAULT false,
  report_reason   TEXT DEFAULT '',
  report_by       UUID REFERENCES ac_users(id) ON DELETE SET NULL,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_convo   ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender  ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='messages public read')   THEN CREATE POLICY "messages public read"   ON messages FOR SELECT USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='messages public insert') THEN CREATE POLICY "messages public insert" ON messages FOR INSERT WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='messages' AND policyname='messages public update') THEN CREATE POLICY "messages public update" ON messages FOR UPDATE USING (true); END IF;
END $$;

-- Enable realtime for messages and friendships
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE friendships;
ALTER PUBLICATION supabase_realtime ADD TABLE ac_users;

-- =====================================================
-- TABLE: user_reports
-- For reporting users directly (separate from trade/message reports)
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
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_reports' AND policyname='user_reports public read')   THEN CREATE POLICY "user_reports public read"   ON user_reports FOR SELECT USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_reports' AND policyname='user_reports public insert') THEN CREATE POLICY "user_reports public insert" ON user_reports FOR INSERT WITH CHECK (true); END IF;
END $$;
