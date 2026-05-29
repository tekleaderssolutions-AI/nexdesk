import tickets from '../../data/sampleTickets';

function AssignedQueue() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-panel">
        <h2 className="text-xl font-semibold text-slate-900">Assigned queue</h2>
        <p className="mt-2 text-slate-500">Tickets assigned to your team for incident handling.</p>
        <div className="mt-6 space-y-4">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="rounded-3xl border border-slate-200 p-5 sm:flex sm:items-center sm:justify-between">
              <div>
                <div className="text-sm text-slate-500">{ticket.id}</div>
                <div className="mt-1 text-lg font-semibold text-slate-900">{ticket.title}</div>
              </div>
              <div className="flex flex-col gap-2 sm:items-end">
                <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">{ticket.priority}</span>
                <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">{ticket.status}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default AssignedQueue;
