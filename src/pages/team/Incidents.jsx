function Incidents() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-panel">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Incident backlog</h2>
            <p className="mt-2 text-slate-500">Track open, critical and escalated incidents for your team.</p>
          </div>
          <div className="rounded-3xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white">42 open incidents</div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {['Critical', 'High Priority', 'Monitoring', 'Audit Review'].map((label) => (
            <div key={label} className="rounded-3xl bg-slate-50 p-5">
              <div className="text-sm uppercase tracking-[0.3em] text-slate-500">{label}</div>
              <div className="mt-4 text-3xl font-semibold text-slate-900">{Math.floor(Math.random() * 24) + 6}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default Incidents;
