function StatusBadge({ status }) {
  const classes = {
    Open: 'bg-sky-100 text-sky-700',
    'In Progress': 'bg-amber-100 text-amber-700',
    Resolved: 'bg-emerald-100 text-emerald-700',
  };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${classes[status] || 'bg-slate-100 text-slate-700'}`}>
      {status}
    </span>
  );
}

export default StatusBadge;
