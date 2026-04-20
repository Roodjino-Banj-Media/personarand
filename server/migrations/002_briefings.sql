-- Weekly briefings: AI-generated "here's what to talk about this week" outputs.
-- Persisted so the user can scroll back through prior weeks' briefings.

CREATE TABLE IF NOT EXISTS weekly_briefings (
    id SERIAL PRIMARY KEY,
    week_start DATE NOT NULL,
    news_context TEXT,
    goals_context TEXT,
    output JSONB,
    usage JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_briefings_week ON weekly_briefings(week_start DESC);
