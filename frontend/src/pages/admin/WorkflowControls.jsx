function WorkflowControls() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-panel">
        <h2 className="text-xl font-semibold text-slate-900">Workflow controls</h2>
        <p className="mt-2 text-slate-500">Manage incident lifecycle states, approvals and automation controls.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: 'Approval queue', value: '8 pending' },
            { title: 'Automation rules', value: '12 active' },
            { title: 'SLA health', value: '96%' },
          ].map((card) => (
            <div key={card.title} className="rounded-3xl bg-slate-50 p-5">
              <div className="text-sm uppercase tracking-[0.3em] text-slate-500">{card.title}</div>
              <div className="mt-4 text-3xl font-semibold text-slate-900">{card.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-panel">
        <div className="grid gap-4 sm:grid-cols-2">
          {['Route incident flows', 'Approve escalations', 'Activate fallback paths'].map((title) => (
            <div key={title} className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <h3 className="font-semibold text-slate-900">{title}</h3>
              <p className="mt-3 text-slate-600">Configure the next step in the incident lifecycle and enable the relevant team actions.</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default WorkflowControls;
