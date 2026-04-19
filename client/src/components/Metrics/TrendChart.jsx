import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const PLATFORM_COLORS = {
  Instagram: '#e1306c',
  Facebook: '#1877f2',
  LinkedIn: '#0077b5',
  TikTok: '#ff0050',
  X: '#ffffff',
  YouTube: '#ff0000',
};

const METRIC_LABEL = {
  followers: 'Followers',
  reach: 'Reach',
  engagement: 'Engagement',
};

export default function TrendChart({ trends, platforms, metric = 'followers', height = 240 }) {
  const key = `_${metric}`;
  const dataPointCount = trends.filter((w) => platforms.some((p) => w[`${p}${key}`] != null)).length;

  if (dataPointCount === 0) {
    return (
      <div className="card-pad text-text-secondary text-sm h-60 flex items-center justify-center">
        No data yet for {METRIC_LABEL[metric]}. Enter a week in Metrics to start the trendline.
      </div>
    );
  }
  if (dataPointCount === 1) {
    return (
      <div className="card-pad text-text-secondary text-sm h-60 flex items-center justify-center">
        {METRIC_LABEL[metric]} has one data point. Enter one more week to see a trend.
      </div>
    );
  }

  return (
    <div className="card-pad">
      <div className="flex items-baseline justify-between mb-3">
        <div className="text-sm font-semibold">{METRIC_LABEL[metric]} — trend</div>
        <div className="text-[11px] text-text-secondary">{dataPointCount} weeks</div>
      </div>
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer>
          <LineChart data={trends} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
            <CartesianGrid stroke="#2a2a2a" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="week_start"
              stroke="#666"
              tick={{ fontSize: 11, fill: '#999' }}
              tickFormatter={(v) => v?.slice(5)}
            />
            <YAxis
              stroke="#666"
              tick={{ fontSize: 11, fill: '#999' }}
              width={50}
            />
            <Tooltip
              contentStyle={{
                background: '#0a0a0a',
                border: '1px solid #333',
                borderRadius: 6,
                fontSize: 12,
              }}
              labelStyle={{ color: '#999' }}
              itemStyle={{ color: '#e0e0e0' }}
            />
            {platforms.map((p) => (
              <Line
                key={p}
                type="monotone"
                dataKey={`${p}${key}`}
                name={p}
                stroke={PLATFORM_COLORS[p] || '#0066ff'}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-3 mt-3">
        {platforms.map((p) => (
          <div key={p} className="flex items-center gap-1.5 text-[11px] text-text-secondary">
            <span className="w-3 h-0.5" style={{ background: PLATFORM_COLORS[p] || '#0066ff' }} />
            {p}
          </div>
        ))}
      </div>
    </div>
  );
}
