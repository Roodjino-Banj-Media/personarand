import { useState } from 'react';
import NewsletterList from './NewsletterList.jsx';
import NewsletterCompose from './NewsletterCompose.jsx';
import NewsletterSubscribers from './NewsletterSubscribers.jsx';
import NewsletterAnalytics from './NewsletterAnalytics.jsx';
import NewsletterForms from './NewsletterForms.jsx';

const TABS = [
  { key: 'issues', label: 'Issues' },
  { key: 'subscribers', label: 'Subscribers' },
  { key: 'forms', label: 'Signup forms' },
  { key: 'analytics', label: 'Analytics' },
];

export default function NewsletterView() {
  const [tab, setTab] = useState('issues');
  const [composingId, setComposingId] = useState(null); // null = list; 'new' = compose new; id = edit existing

  if (composingId !== null) {
    return (
      <NewsletterCompose
        issueId={composingId === 'new' ? null : composingId}
        onBack={() => setComposingId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Newsletter</h1>
          <p className="text-text-secondary text-sm mt-1">
            Owned-audience layer. Deep essays weekly, repurposed across social, attributed to revenue.
          </p>
        </div>
        {tab === 'issues' && (
          <button className="btn-primary" onClick={() => setComposingId('new')}>
            + New issue
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? 'border-primary text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'issues' && <NewsletterList onOpen={(id) => setComposingId(id)} />}
      {tab === 'subscribers' && <NewsletterSubscribers />}
      {tab === 'forms' && <NewsletterForms />}
      {tab === 'analytics' && <NewsletterAnalytics />}
    </div>
  );
}
