import tickets from '../../data/sampleTickets';

function TicketWorkspace() {
  const active = tickets[0];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-panel">
        <h2 className="text-xl font-semibold text-slate-900">Ticket workspace</h2>
        <p className="mt-2 text-slate-500">Workflow tools to manage an active support ticket.</p>
        <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-3xl bg-slate-50 p-6">
            <div className="text-sm uppercase tracking-[0.3em] text-slate-500">Focused ticket</div>
            <h3 className="mt-4 text-2xl font-semibold text-slate-900">{active.title}</h3>
            <p className="mt-4 text-slate-600">{active.details}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-3xl bg-white p-4 text-sm text-slate-700">Priority: {active.priority}</div>
              <div className="rounded-3xl bg-white p-4 text-sm text-slate-700">Status: {active.status}</div>
            </div>
          </div>
          <div className="rounded-3xl bg-white p-6">
            <div className="text-sm uppercase tracking-[0.3em] text-slate-500">Action items</div>
            <ul className="mt-4 space-y-3 text-slate-600">
              <li className="rounded-3xl border border-slate-200 bg-slate-50 p-4">Review ticket notes and confirm resolution path.</li>
              <li className="rounded-3xl border border-slate-200 bg-slate-50 p-4">Share incident update with stakeholders.</li>
              <li className="rounded-3xl border border-slate-200 bg-slate-50 p-4">Mark ticket as validated after QA review.</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

export default TicketWorkspace;
