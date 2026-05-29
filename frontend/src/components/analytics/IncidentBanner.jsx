function IncidentBanner({ title, message }) {
  return (
    <div className="rounded-3xl bg-rose-50 p-5 text-slate-800 shadow-sm border border-rose-100">
      <div className="text-sm font-semibold text-rose-700">{title}</div>
      <div className="mt-2 text-sm text-slate-700">{message}</div>
    </div>
  );
}

export default IncidentBanner;
