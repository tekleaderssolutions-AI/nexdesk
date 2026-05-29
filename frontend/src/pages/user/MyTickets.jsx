import { Link } from 'react-router-dom';
import tickets from '../../data/sampleTickets';

function MyTickets() {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-6 shadow-panel">
        <h2 className="text-xl font-semibold text-slate-900">My tickets</h2>
        <p className="mt-2 text-slate-500">Track ticket status and view details for your active incidents.</p>
        <div className="mt-6 space-y-4">
          {tickets.map((ticket) => (
            <div key={ticket.id} className="rounded-3xl border border-slate-200 p-5 sm:flex sm:items-center sm:justify-between">
              <div>
                <div className="text-sm uppercase tracking-[0.35em] text-slate-500">{ticket.id}</div>
                <h3 className="mt-2 text-lg font-semibold text-slate-900">{ticket.title}</h3>
                <div className="mt-2 text-sm text-slate-500">{ticket.details}</div>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:mt-0 sm:items-end">
                <span className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">{ticket.status}</span>
                <Link
                  to={`/user/ticket/${ticket.id}`}
                  className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400"
                >
                  View details
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default MyTickets;
