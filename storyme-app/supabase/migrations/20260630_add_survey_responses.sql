-- ============================================
-- Generic survey responses
-- One reusable table for ALL surveys (workshop feedback, NPS, teacher, ...).
-- A new survey = a new survey_slug, never a new table.
-- ============================================
--
-- Principle 3 (Scalable Schema): flexible JSONB `answers` so different surveys
--   with different questions share one table; slug + type let you filter and
--   group by individual round AND by kind of survey.
-- Principle 1 (Security): RLS enabled with NO public policies. The public never
--   touches this table directly — submissions go through the service-role API
--   route (which bypasses RLS), and reads are service-role/admin only. So the
--   table is effectively write-only to the world and readable only by you.

CREATE TABLE IF NOT EXISTS survey_responses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  survey_slug  TEXT NOT NULL,                         -- which round, e.g. 'summer-2026-storyteller'
  survey_type  TEXT NOT NULL DEFAULT 'workshop_feedback', -- which kind, e.g. 'workshop_feedback' | 'nps' | 'teacher'

  answers      JSONB NOT NULL DEFAULT '{}'::jsonb,    -- all question -> answer pairs

  name         TEXT,                                  -- optional contact (Q8)
  email        TEXT,                                  -- optional contact (Q8)

  user_agent   TEXT,                                  -- light metadata for spam triage
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Common query patterns: list/aggregate one round, or one type over time.
CREATE INDEX IF NOT EXISTS idx_survey_responses_slug ON survey_responses(survey_slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_responses_type ON survey_responses(survey_type, created_at DESC);

COMMENT ON TABLE  survey_responses             IS 'Generic store for all surveys; one row per submission, keyed by survey_slug.';
COMMENT ON COLUMN survey_responses.survey_slug IS 'Identifies the individual survey/round (e.g. summer-2026-storyteller).';
COMMENT ON COLUMN survey_responses.survey_type IS 'Groups surveys by kind (workshop_feedback, nps, teacher, ...).';
COMMENT ON COLUMN survey_responses.answers     IS 'Flexible JSONB of question_key -> answer; shape can differ per survey.';

-- Principle 1 (Security): RLS on, no public policies → only service role can read/write.
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
