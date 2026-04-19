const STATUS_STYLE = {
  planned: 'border-border text-text-secondary bg-[#1f1f1f]',
  scripted: 'border-blue-500/40 text-blue-300 bg-blue-500/10',
  shot: 'border-purple-500/40 text-purple-300 bg-purple-500/10',
  edited: 'border-amber-500/40 text-amber-300 bg-amber-500/10',
  posted: 'border-success/40 text-success bg-success/5',
};

export default function CalendarItem({ item, onClick, onStatusChange }) {
  const statusCls = STATUS_STYLE[item.status] || STATUS_STYLE.planned;
  return (
    <div
      className="card-pad cursor-pointer hover:border-[#555] transition-colors"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] uppercase tracking-widest text-text-secondary">{item.day}</div>
        <span className={`pill ${statusCls}`}>{item.status}</span>
      </div>
      <div className="text-base font-semibold mt-2 leading-snug">{item.title}</div>
      {item.funnel_layer && (
        <div className="text-[11px] text-text-secondary mt-2">
          {item.funnel_layer}
        </div>
      )}
      {item.platforms && item.platforms.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3">
          {item.platforms.map((p) => (
            <span key={p} className="pill border-border text-text-secondary">{p}</span>
          ))}
        </div>
      )}
      <div className="flex justify-between items-center mt-4">
        <div className="text-[11px] text-text-secondary truncate pr-2">{item.content_type}</div>
        <select
          className="text-[11px] bg-[#0f0f0f] border border-border rounded px-2 py-1 text-text-secondary"
          value={item.status}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onStatusChange(e.target.value)}
        >
          {Object.keys(STATUS_STYLE).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
