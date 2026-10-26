CREATE TABLE IF NOT EXISTS routine_plans (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  routine JSONB NOT NULL DEFAULT '{}'::jsonb,
  face_scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,
  body_scan_id UUID REFERENCES scans(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE routine_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "routine_plans: own row only" ON routine_plans;
CREATE POLICY "routine_plans: own row only"
  ON routine_plans FOR ALL
  USING (user_id::text = auth.uid()::text)
  WITH CHECK (user_id::text = auth.uid()::text);
