CREATE TABLE IF NOT EXISTS content_calendar (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week INTEGER NOT NULL,
    day TEXT,
    title TEXT NOT NULL,
    description TEXT,
    content_type TEXT,
    platforms TEXT,
    funnel_layer TEXT,
    status TEXT DEFAULT 'planned',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS generated_content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    calendar_id INTEGER,
    content_type TEXT,
    platform TEXT,
    title TEXT,
    body TEXT,
    metadata TEXT,
    performance_notes TEXT,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (calendar_id) REFERENCES content_calendar(id)
);

CREATE TABLE IF NOT EXISTS performance_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start DATE,
    platform TEXT,
    followers INTEGER,
    posts_count INTEGER,
    reach INTEGER,
    engagement_total INTEGER,
    top_post_link TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS commercial_outcomes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    outcome_type TEXT,
    description TEXT,
    value REAL,
    source TEXT,
    date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS visual_inspiration (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filename TEXT,
    filepath TEXT,
    tags TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS carousel_designs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    slides TEXT,
    template_style TEXT,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS weekly_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start DATE NOT NULL UNIQUE,
    what_worked TEXT,
    what_didnt TEXT,
    next_focus TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    company TEXT,
    title TEXT,
    source TEXT,
    tags TEXT,
    status TEXT DEFAULT 'active',
    engagement_score INTEGER DEFAULT 0,
    subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_engagement_at TIMESTAMP,
    total_opens INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    welcome_email_1_sent_at TIMESTAMP,
    welcome_email_2_sent_at TIMESTAMP,
    welcome_email_3_sent_at TIMESTAMP,
    unsubscribe_token TEXT
);

CREATE TABLE IF NOT EXISTS newsletter_issues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subject_line TEXT NOT NULL,
    content_md TEXT,
    content_html TEXT,
    template_type TEXT,
    scheduled_send TIMESTAMP,
    sent_at TIMESTAMP,
    total_sent INTEGER DEFAULT 0,
    total_opens INTEGER DEFAULT 0,
    total_clicks INTEGER DEFAULT 0,
    total_unsubscribes INTEGER DEFAULT 0,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS newsletter_engagement (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscriber_id INTEGER NOT NULL,
    issue_id INTEGER NOT NULL,
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    links_clicked TEXT,
    bounced_at TIMESTAMP,
    unsubscribed_at TIMESTAMP,
    resend_message_id TEXT,
    UNIQUE (subscriber_id, issue_id),
    FOREIGN KEY (subscriber_id) REFERENCES newsletter_subscribers(id) ON DELETE CASCADE,
    FOREIGN KEY (issue_id) REFERENCES newsletter_issues(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS newsletter_content_links (
    newsletter_id INTEGER,
    content_id INTEGER,
    PRIMARY KEY (newsletter_id, content_id),
    FOREIGN KEY (newsletter_id) REFERENCES newsletter_issues(id) ON DELETE CASCADE,
    FOREIGN KEY (content_id) REFERENCES generated_content(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS signup_forms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    headline TEXT,
    subheadline TEXT,
    cta TEXT,
    placeholder TEXT,
    success_message TEXT,
    default_tags TEXT,
    style TEXT DEFAULT 'dark',
    signups_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subs_status ON newsletter_subscribers(status);
CREATE INDEX IF NOT EXISTS idx_subs_engagement ON newsletter_subscribers(engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_issues_status ON newsletter_issues(status, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_engagement_issue ON newsletter_engagement(issue_id);
CREATE INDEX IF NOT EXISTS idx_engagement_subscriber ON newsletter_engagement(subscriber_id);

CREATE TABLE IF NOT EXISTS prospects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    deal_value REAL,
    notes TEXT,
    tags TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_contact TIMESTAMP,
    next_action TEXT,
    next_action_date DATE
);

CREATE TABLE IF NOT EXISTS email_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT,
    subject_line TEXT NOT NULL,
    body TEXT NOT NULL,
    variables TEXT,
    best_for TEXT,
    times_used INTEGER DEFAULT 0,
    times_replied INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS email_outreach (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prospect_id INTEGER NOT NULL,
    template_id INTEGER,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    personalization_notes TEXT,
    content_shared_id INTEGER,
    resend_message_id TEXT,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    opened_at TIMESTAMP,
    clicked_at TIMESTAMP,
    replied_at TIMESTAMP,
    reply_text TEXT,
    sequence_id INTEGER,
    sequence_position INTEGER,
    FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
    FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE SET NULL,
    FOREIGN KEY (content_shared_id) REFERENCES generated_content(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prospect_id INTEGER NOT NULL,
    scheduled_date TIMESTAMP NOT NULL,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sequences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    steps TEXT,
    active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS prospect_sequences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    prospect_id INTEGER NOT NULL,
    sequence_id INTEGER NOT NULL,
    current_position INTEGER DEFAULT 1,
    status TEXT DEFAULT 'active',
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_sent_at TIMESTAMP,
    stopped_at TIMESTAMP,
    stop_reason TEXT,
    FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
    FOREIGN KEY (sequence_id) REFERENCES sequences(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_stage ON prospects(stage);
CREATE INDEX IF NOT EXISTS idx_outreach_prospect ON email_outreach(prospect_id);
CREATE INDEX IF NOT EXISTS idx_outreach_sent ON email_outreach(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings(scheduled_date);

CREATE TABLE IF NOT EXISTS prospect_subscriber_link (
    prospect_id INTEGER NOT NULL,
    subscriber_id INTEGER NOT NULL,
    linked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (prospect_id, subscriber_id),
    FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
    FOREIGN KEY (subscriber_id) REFERENCES newsletter_subscribers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS attribution_chain (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_id INTEGER,
    newsletter_id INTEGER,
    prospect_id INTEGER,
    email_id INTEGER,
    meeting_id INTEGER,
    deal_value REAL,
    conversion_date DATE,
    journey_steps TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (content_id) REFERENCES generated_content(id) ON DELETE SET NULL,
    FOREIGN KEY (newsletter_id) REFERENCES newsletter_issues(id) ON DELETE SET NULL,
    FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE,
    FOREIGN KEY (email_id) REFERENCES email_outreach(id) ON DELETE SET NULL,
    FOREIGN KEY (meeting_id) REFERENCES meetings(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS engagement_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL,
    entity_id INTEGER NOT NULL,
    event_type TEXT NOT NULL,
    event_data TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS insights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    insight_type TEXT,
    title TEXT NOT NULL,
    description TEXT,
    data TEXT,
    action_recommended TEXT,
    priority TEXT DEFAULT 'medium',
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    dismissed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_events_entity ON engagement_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_attribution_prospect ON attribution_chain(prospect_id);
CREATE INDEX IF NOT EXISTS idx_insights_status ON insights(status, priority);

CREATE INDEX IF NOT EXISTS idx_calendar_week ON content_calendar(week);
CREATE INDEX IF NOT EXISTS idx_generated_calendar ON generated_content(calendar_id);
CREATE INDEX IF NOT EXISTS idx_metrics_platform ON performance_metrics(platform, week_start);
