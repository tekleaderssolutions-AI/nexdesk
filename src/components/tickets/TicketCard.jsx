import StatusBadge from './StatusBadge';
import PriorityBadge from './PriorityBadge';

function TicketCard({ ticket }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-panel">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm text-slate-500">{ticket.id}</div>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{ticket.title}</h3>
          <p className="mt-2 text-sm text-slate-500">{ticket.details}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PriorityBadge priority={ticket.priority} />
          <StatusBadge status={ticket.status} />
        </div>
      </div>
    </div>
  );
}

export default TicketCard;
