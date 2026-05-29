function StatsCard({ title, value, detail }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-panel">
      <div className="text-sm uppercase tracking-[0.32em] text-slate-500">{title}</div>
      <div className="mt-4 text-4xl font-semibold text-slate-900">{value}</div>
      {detail ? <p className="mt-3 text-sm text-slate-600">{detail}</p> : null}
    </div>
  );
}

export default StatsCard;
