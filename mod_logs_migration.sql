-- =====================================================
-- TABLE: mod_logs
-- Admin action log (Reddit-style mod log)
-- =====================================================
CREATE TABLE IF NOT EXISTS mod_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mod_id       UUID NOT NULL REFERENCES ac_users(id) ON DELETE CASCADE,
  target_id    UUID REFERENCES ac_users(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,  -- e.g. 'restrict', 'unrestrict', 'dismiss_report', 'ban'
  title        TEXT,           -- short display title e.g. "Restricted user #42"
  reason       TEXT,
  meta         JSONB,          -- extra context (trade_id, report_id, etc.)
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE mod_logs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mod_logs' AND policyname='mod_logs admin read')
    THEN CREATE POLICY "mod_logs admin read" ON mod_logs FOR SELECT USING (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='mod_logs' AND policyname='mod_logs admin insert')
    THEN CREATE POLICY "mod_logs admin insert" ON mod_logs FOR INSERT WITH CHECK (true); END IF;
END $$;
