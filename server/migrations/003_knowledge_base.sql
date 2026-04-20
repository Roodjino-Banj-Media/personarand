-- Knowledge base: user-managed markdown entries that get injected into
-- every AI call's system prompt as "USER-SPECIFIC CONTEXT".

CREATE TABLE IF NOT EXISTS knowledge_base (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'note',
    content_md TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    token_estimate INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_active ON knowledge_base(is_active, updated_at DESC);
