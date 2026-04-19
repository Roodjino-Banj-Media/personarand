import { useState } from 'react';
import ProspectDatabase from './ProspectDatabase.jsx';
import DailyOutreach from './DailyOutreach.jsx';
import PipelineBoard from './PipelineBoard.jsx';
import MeetingsView from './MeetingsView.jsx';
import TemplatesView from './TemplatesView.jsx';

const TABS = [
  { key: 'database', label: 'Database' },
  { key: 'outreach', label: 'Daily outreach' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'meetings', label: 'Meetings' },
  { key: 'templates', label: 'Templates' },
];

export default function ProspectsView() {
  const [tab, setTab] = useState('database');
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Prospects</h1>
        <p className="text-text-secondary text-sm mt-1">
          Active pipeline. Database → Daily outreach → Meetings → Close. Integrated with newsletter (warm leads) and content (attribution).
        </p>
      </div>
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${
              tab === t.key
                ? 'border-primary text-text-primary'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'database' && <ProspectDatabase />}
      {tab === 'outreach' && <DailyOutreach />}
      {tab === 'pipeline' && <PipelineBoard />}
      {tab === 'meetings' && <MeetingsView />}
      {tab === 'templates' && <TemplatesView />}
    </div>
  );
}
