import tickets from '../../data/sampleTickets';

function TeamDashboard() {
  const openTickets = tickets.filter((ticket) => ticket.status !== 'Resolved');

  return (
    <div className="space-y-6 page">
      <section className="grid gap-5 md:grid-cols-3">
        <div className="stat">
          <div className="stat-title">Assigned tickets</div>
          <div className="stat-value">{openTickets.length}</div>
          <div className="stat-subtitle">Work items in queue</div>
        </div>
        <div className="stat">
          <div className="stat-title">Open alerts</div>
          <div className="stat-value">6</div>
          <div className="stat-subtitle">High priority issues</div>
        </div>
        <div className="stat">
          <div className="stat-title">Resolution rate</div>
          <div className="stat-value">82%</div>
          <div className="stat-subtitle">Team performance</div>
        </div>
      </section>

      <section className="card">
        <h2 className="text-xl font-semibold text-white">Active ticket queue</h2>
        <div className="mt-6 grid gap-4">
          {openTickets.map((ticket) => (
            <div key={ticket.id} className="card">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">{ticket.id}</div>
                  <div className="mt-1 text-lg font-semibold text-white">{ticket.title}</div>
                  <div className="mt-2 text-sm text-slate-400">{ticket.category} · {ticket.priority}</div>
                </div>
                <div className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm text-slate-300 sm:mt-0">{ticket.status}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default TeamDashboard;
