function AnalyticsCard({ title, value, description }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-6 shadow-sm">
      <div className="text-sm uppercase tracking-[0.32em] text-slate-500">{title}</div>
      <div className="mt-4 text-3xl font-semibold text-slate-900">{value}</div>
      <p className="mt-3 text-sm text-slate-600">{description}</p>
    </div>
  );
}

export default AnalyticsCard;
