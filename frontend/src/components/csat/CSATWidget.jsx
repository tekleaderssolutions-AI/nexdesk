function CSATWidget({ title, value, trend }) {
  return (
    <div className="rounded-3xl bg-slate-50 p-6 shadow-sm">
      <div className="text-sm uppercase tracking-[0.32em] text-slate-500">{title}</div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="text-3xl font-semibold text-slate-900">{value}</div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600">{trend}</div>
      </div>
    </div>
  );
}

export default CSATWidget;
