function PriorityBadge({ priority }) {
  const classes = {
    High: 'bg-rose-100 text-rose-700',
    Medium: 'bg-amber-100 text-amber-700',
    Low: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${classes[priority] || 'bg-slate-100 text-slate-700'}`}>
      {priority}
    </span>
  );
}

export default PriorityBadge;
