-- =====================================================
-- MIGRATION: push_subscriptions table for web push
-- Run in Supabase SQL Editor.
-- =====================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES ac_users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT,
  auth       TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Anyone can insert/update/delete their own subscription (no Supabase Auth — use open policies)
CREATE POLICY "push_subscriptions open read"   ON push_subscriptions FOR SELECT USING (true);
CREATE POLICY "push_subscriptions open insert" ON push_subscriptions FOR INSERT WITH CHECK (true);
CREATE POLICY "push_subscriptions open update" ON push_subscriptions FOR UPDATE USING (true);
CREATE POLICY "push_subscriptions open delete" ON push_subscriptions FOR DELETE USING (true);
