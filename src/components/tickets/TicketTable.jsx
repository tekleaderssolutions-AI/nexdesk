function TicketTable({ tickets }) {
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-panel">
      <table className="min-w-full border-separate border-spacing-0">
        <thead className="bg-slate-950 text-left text-sm uppercase tracking-[0.24em] text-slate-300">
          <tr>
            <th className="px-6 py-4">Ticket</th>
            <th className="px-6 py-4">Category</th>
            <th className="px-6 py-4">Priority</th>
            <th className="px-6 py-4">Status</th>
            <th className="px-6 py-4">Date</th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id} className="border-t border-slate-200 last:border-b">
              <td className="px-6 py-5 text-sm font-semibold text-slate-900">{ticket.id}</td>
              <td className="px-6 py-5 text-sm text-slate-600">{ticket.category}</td>
              <td className="px-6 py-5 text-sm text-slate-600">{ticket.priority}</td>
              <td className="px-6 py-5 text-sm text-slate-600">{ticket.status}</td>
              <td className="px-6 py-5 text-sm text-slate-600">{ticket.createdAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default TicketTable;
