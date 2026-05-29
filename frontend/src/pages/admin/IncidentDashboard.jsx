function IncidentDashboard() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-panel">
        <h2 className="text-xl font-semibold text-slate-900">Incident dashboard</h2>
        <p className="mt-2 text-slate-500">Monitor incident states, escalations and SLA performance in one view.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: 'Critical incidents', value: '8' },
            { label: 'Escalations', value: '5' },
            { label: 'SLA breaches', value: '2' },
          ].map((item) => (
            <div key={item.label} className="rounded-3xl bg-slate-50 p-5">
              <div className="text-sm uppercase tracking-[0.3em] text-slate-500">{item.label}</div>
              <div className="mt-4 text-3xl font-semibold text-slate-900">{item.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-panel">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <div className="text-sm uppercase tracking-[0.3em] text-slate-500">Next incident review</div>
            <div className="mt-4 text-lg font-semibold text-slate-900">Review pending incident assignments and approvals.</div>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
            <div className="text-sm uppercase tracking-[0.3em] text-slate-500">SLA recovery</div>
            <div className="mt-4 text-lg font-semibold text-slate-900">Focus on the tickets closest to breach.</div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default IncidentDashboard;
