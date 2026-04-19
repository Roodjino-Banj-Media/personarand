const TEMPLATES = [
  {
    name: 'Value-First (Content Share)',
    category: 'value_first',
    best_for: 'cold',
    subject_line: '{hook}',
    body: `Hi {name},

Saw {observation about their company or role}.

Just published this on {platform}: {content_title}
{content_link}

{one line explaining why it's relevant to them}

If it resonates, would love to discuss how we've solved {pain_point} for similar companies.

Worth 20 minutes this week?

Roodjino`,
    variables: ['name', 'hook', 'observation', 'platform', 'content_title', 'content_link', 'pain_point'],
  },
  {
    name: 'Direct Problem Call-Out',
    category: 'direct',
    best_for: 'cold',
    subject_line: '{company}\u2019s {challenge}',
    body: `{name},

Working with {similar_company} on {challenge}.

Noticed {company} is likely facing something similar based on {observation}.

We've developed a framework that cuts {time_or_cost} by {metric}.

Want to see if it applies to your situation. 15 minutes?

Roodjino`,
    variables: ['name', 'company', 'challenge', 'similar_company', 'observation', 'time_or_cost', 'metric'],
  },
  {
    name: 'Referral / Warm Intro',
    category: 'referral',
    best_for: 'warm',
    subject_line: '{mutual_contact} suggested we connect',
    body: `{name},

{mutual_contact} mentioned you're dealing with {challenge}.

We've worked with {similar_company} on exactly this.

{one_line_framework_or_result}

Worth exploring if there's a fit? Coffee this week?

Roodjino`,
    variables: ['name', 'mutual_contact', 'challenge', 'similar_company', 'one_line_framework_or_result'],
  },
  {
    name: 'Newsletter Subscriber Follow-Up',
    category: 'newsletter_followup',
    best_for: 'warm',
    subject_line: 'Noticed you\u2019ve been reading about {topic}',
    body: `{name},

Saw you've opened the last {n} newsletters about {topic}.

This tells me {pain_point} might be on your radar.

We're applying exactly this at Banj and with clients like {example_client}.

Would love to show you the actual framework. 20 minutes this week?

Roodjino`,
    variables: ['name', 'topic', 'n', 'pain_point', 'example_client'],
  },
  {
    name: 'Post-Meeting Follow-Up',
    category: 'post_meeting',
    best_for: 'hot',
    subject_line: 'Next steps for {company}',
    body: `{name},

Great talking yesterday about {key_topic_discussed}.

As promised, here's {resource_or_framework}: {resource_link}

{specific_next_step_from_conversation}

{timeline_or_cta}

Roodjino`,
    variables: ['name', 'company', 'key_topic_discussed', 'resource_or_framework', 'resource_link', 'specific_next_step_from_conversation', 'timeline_or_cta'],
  },
  {
    name: 'Re-engagement (No Response)',
    category: 'reengagement',
    best_for: 'cold',
    subject_line: 'Going to assume no, but before I do\u2026',
    body: `{name},

Sent a note last week about {topic}. Didn't hear back \u2014 usually that means it's not a priority right now, which is fine.

Before I go dark: if any of these are true, it might be worth 15 minutes:

- {trigger_1}
- {trigger_2}
- {trigger_3}

If none of that resonates, no worries \u2014 I'll leave you alone.

Roodjino`,
    variables: ['name', 'topic', 'trigger_1', 'trigger_2', 'trigger_3'],
  },
  {
    name: 'Proposal Follow-Up',
    category: 'proposal_followup',
    best_for: 'hot',
    subject_line: 'Proposal for {company} \u2014 questions?',
    body: `{name},

Sent the proposal on {sent_date}. Quick check: anything that needs clarification before {decision_date}?

Happy to jump on a 15-minute call if easier.

Roodjino`,
    variables: ['name', 'company', 'sent_date', 'decision_date'],
  },
  {
    name: 'Meeting Confirmation',
    category: 'meeting_confirmation',
    best_for: 'hot',
    subject_line: 'Confirming \u2014 {meeting_type} on {date}',
    body: `{name},

Confirming our {meeting_type} for {date} at {time} ({timezone}).

{location_or_link}

Happy to bring anything specific \u2014 topics to cover, cases you\u2019d want to hear about? Just reply.

Roodjino`,
    variables: ['name', 'meeting_type', 'date', 'time', 'timezone', 'location_or_link'],
  },
  {
    name: 'No-Show Recovery',
    category: 'no_show',
    best_for: 'warm',
    subject_line: 'Missed you today \u2014 reschedule?',
    body: `{name},

Looks like something came up. No problem.

If it still makes sense to talk, here are three slots this week: {slot_1}, {slot_2}, {slot_3}.

If timing got complicated and you'd rather circle back in a few weeks, just say so \u2014 I\u2019ll put it on the radar.

Roodjino`,
    variables: ['name', 'slot_1', 'slot_2', 'slot_3'],
  },
  {
    name: 'Banj Media Intro',
    category: 'intro',
    best_for: 'cold',
    subject_line: 'Communication infrastructure, not another agency',
    body: `{name},

Running into most Haitian (and regional) brands with the same pattern: strong product, weak communication systems. The gap isn\u2019t more content \u2014 it\u2019s the infrastructure behind it.

At Banj Media we build that layer \u2014 editorial, production, distribution, measurement, commercial \u2014 as a retainer. Not a project shop.

If that's relevant to {company}, worth a 20-minute intro?

Roodjino`,
    variables: ['name', 'company'],
  },
];

function seedTemplates(db) {
  const existing = db.prepare(`SELECT COUNT(*) AS n FROM email_templates`).get().n;
  if (existing > 0) return 0;
  const insert = db.prepare(`
    INSERT INTO email_templates (name, category, subject_line, body, variables, best_for)
    VALUES (@name, @category, @subject_line, @body, @variables, @best_for)
  `);
  const tx = db.transaction((rows) => {
    for (const r of rows) insert.run({ ...r, variables: JSON.stringify(r.variables) });
  });
  tx(TEMPLATES);
  return TEMPLATES.length;
}

module.exports = { seedTemplates, TEMPLATES };
