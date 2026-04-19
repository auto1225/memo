-- JustANotepad 기본 AI 사용량 테이블
-- Supabase Dashboard → SQL Editor에 붙여넣고 Run

CREATE TABLE IF NOT EXISTS ai_usage (
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  date date DEFAULT current_date,
  requests int DEFAULT 0,
  tokens int DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_own_usage" ON ai_usage;
CREATE POLICY "user_own_usage" ON ai_usage
  FOR ALL USING (auth.uid() = user_id);

-- 인덱스 (조회 빠르게)
CREATE INDEX IF NOT EXISTS ai_usage_user_date ON ai_usage(user_id, date DESC);

SELECT 'ai_usage 테이블 생성 완료' AS status;
