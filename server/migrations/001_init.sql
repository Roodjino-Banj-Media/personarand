-- PersonaBrand schema — Postgres (Supabase).
-- Paste this whole file into the Supabase SQL Editor and click Run.
-- Safe to re-run: all tables use IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS content_calendar (
    id SERIAL PRIMARY KEY,
    week INTEGER NOT NULL,
    day TEXT,
    title TEXT NOT NULL,
    description TEXT,
    content_type TEXT,
    platforms JSONB DEFAULT '[]'::jsonb,
    funnel_layer TEXT,
    status TEXT DEFAULT 'planned',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS generated_content (
    id SERIAL PRIMARY KEY,
    calendar_id INTEGER REFERENCES content_calendar(id) ON DELETE SET NULL,
    content_type TEXT,
    platform TEXT,
    title TEXT,
    body TEXT,
    metadata JSONB,
    performance_notes TEXT,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS performance_metrics (
    id SERIAL PRIMARY KEY,
    week_start DATE,
    platform TEXT,
    followers INTEGER,
    posts_count INTEGER,
    reach INTEGER,
    engagement_total INTEGER,
    top_post_link TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commercial_outcomes (
    id SERIAL PRIMARY KEY,
    outcome_type TEXT,
    description TEXT,
    value DOUBLE PRECISION,
    source TEXT,
    date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS visual_inspiration (
    id SERIAL PRIMARY KEY,
    filename TEXT,
    filepath TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carousel_designs (
    id SERIAL PRIMARY KEY,
    title TEXT,
    slides JSONB DEFAULT '[]'::jsonb,
    template_style TEXT,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS weekly_reviews (
    id SERIAL PRIMARY KEY,
    week_start DATE NOT NULL UNIQUE,
    what_worked TEXT,
    what_didnt TEXT,
    next_focus TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    company TEXT,
    title TEXT,
    source TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'active',
    engagement_score INTEGER DEFAULT 0,
    subscribed_at TIMESTAMPTZ DEFAULT NOW(),
    last_engagement_at TIMESTAMPTZ,
    total_opens INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    welcome_email_1_sent_at TIMESTAMPTZ,
    welcome_email_2_sent_at TIMESTAMPTZ,
    welcome_email_3_sent_at TIMESTAMPTZ,
    unsubscribe_token TEXT
);

CREATE TABLE IF NOT EXISTS newsletter_issues (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    subject_line TEXT NOT NULL,
    content_md TEXT,
    content_html TEXT,
    template_type TEXT,
    scheduled_send TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    total_sent INTEGER DEFAULT 0,
    total_opens INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_unsubscribes INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS newsletter_engagement (
    id SERIAL PRIMARY KEY,
    subscriber_id INTEGER NOT NULL REFERENCES newsletter_subscribers(id) ON DELETE CASCADE,
    issue_id INTEGER NOT NULL REFERENCES newsletter_issues(id) ON DELETE CASCADE,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    links_clicked JSONB,
    bounced_at TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    resend_message_id TEXT,
    UNIQUE (subscriber_id, issue_id)
);

CREATE TABLE IF NOT EXISTS newsletter_content_links (
    newsletter_id INTEGER NOT NULL REFERENCES newsletter_issues(id) ON DELETE CASCADE,
    content_id INTEGER NOT NULL REFERENCES generated_content(id) ON DELETE CASCADE,
    PRIMARY KEY (newsletter_id, content_id)
);

CREATE TABLE IF NOT EXISTS signup_forms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    headline TEXT,
    subheadline TEXT,
    cta TEXT,
    placeholder TEXT,
    success_message TEXT,
    default_tags JSONB DEFAULT '[]'::jsonb,
    style TEXT DEFAULT 'dark',
    signups_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prospects (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    company TEXT,
    title TEXT,
    email TEXT UNIQUE,
    phone TEXT,
    linkedin_url TEXT,
    linkedin_context TEXT,
    website TEXT,
    industry TEXT,
    pain_points TEXT,
    status TEXT DEFAULT 'cold',
    stage TEXT DEFAULT 'prospecting',
    source TEXT,
    deal_value DOUBLE PRECISION,
    notes TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_contact TIMESTAMPTZ,
    next_action TEXT,
    next_action_date DATE
);

CREATE TABLE IF NOT EXISTS email_templates (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    subject_line TEXT NOT NULL,
    body TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    best_for TEXT,
    times_used INTEGER DEFAULT 0,
    times_replied INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS email_outreach (
    id SERIAL PRIMARY KEY,
    prospect_id INTEGER NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    template_id INTEGER REFERENCES email_templates(id) ON DELETE SET NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    personalization_notes TEXT,
    content_shared_id INTEGER REFERENCES generated_content(id) ON DELETE SET NULL,
    resend_message_id TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    reply_text TEXT,
    sequence_id INTEGER,
    sequence_position INTEGER
);

CREATE TABLE IF NOT EXISTS meetings (
    id SERIAL PRIMARY KEY,
    prospect_id INTEGER NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    scheduled_date TIMESTAMPTZ NOT NULL,
    duration INTEGER DEFAULT 30,
    meeting_type TEXT,
    location TEXT,
    status TEXT DEFAULT 'scheduled',
    outcome TEXT,
    prep_notes TEXT,
    meeting_notes TEXT,
    key_takeaways TEXT,
    pain_points_identified TEXT,
    budget_signals TEXT,
    decision_makers TEXT,
    timeline TEXT,
    next_steps TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS sequences (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    steps JSONB DEFAULT '[]'::jsonb,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS prospect_sequences (
    id SERIAL PRIMARY KEY,
    prospect_id INTEGER NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    sequence_id INTEGER NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
    current_position INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_sent_at TIMESTAMPTZ,
    stopped_at TIMESTAMPTZ,
    stop_reason TEXT
);

CREATE TABLE IF NOT EXISTS prospect_subscriber_link (
    prospect_id INTEGER NOT NULL REFERENCES prospects(id) ON DELETE CASCADE,
    subscriber_id INTEGER NOT NULL REFERENCES newsletter_subscribers(id) ON DELETE CASCADE,
    linked_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (prospect_id, subscriber_id)
);

CREATE TABLE IF NOT EXISTS attribution_chain (
    id SERIAL PRIMARY KEY,
    content_id INTEGER REFERENCES generated_content(id) ON DELETE SET NULL,
    newsletter_id INTEGER REFERENCES newsletter_issues(id) ON DELETE SET NULL,
    prospect_id INTEGER REFERENCES prospects(id) ON DELETE CASCADE,
    email_id INTEGER REFERENCES email_outreach(id) ON DELETE SET NULL,
    meeting_id INTEGER REFERENCES meetings(id) ON DELETE SET NULL,
    deal_value DOUBLE PRECISION,
    conversion_date DATE,
    journey_steps JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS engagement_events (
    id SERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    event_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS insights (
    id SERIAL PRIMARY KEY,
    insight_type TEXT,
    title TEXT NOT NULL,
    description TEXT,
    data JSONB,
    action_recommended TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    dismissed_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_calendar_week ON content_calendar(week);
CREATE INDEX IF NOT EXISTS idx_generated_calendar ON generated_content(calendar_id);
CREATE INDEX IF NOT EXISTS idx_metrics_platform ON performance_metrics(platform, week_start);
CREATE INDEX IF NOT EXISTS idx_subs_status ON newsletter_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_subs_engagement ON newsletter_subscribers(engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_issues_status ON newsletter_issues(status, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_issue ON newsletter_engagement(issue_id);
CREATE INDEX IF NOT EXISTS idx_engagement_subscriber ON newsletter_engagement(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_stage ON prospects(stage);
CREATE INDEX IF NOT EXISTS idx_outreach_prospect ON email_outreach(prospect_id);
CREATE INDEX IF NOT EXISTS idx_outreach_sent ON email_outreach(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_events_entity ON engagement_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_attribution_prospect ON attribution_chain(prospect_id);
CREATE INDEX IF NOT EXISTS idx_insights_status ON insights(status, priority);
