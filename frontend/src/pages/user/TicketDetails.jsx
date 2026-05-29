import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import tickets from '../../data/sampleTickets';

function TicketDetails() {
  const { id } = useParams();

  const ticket = useMemo(() => tickets.find((item) => item.id === id), [id]);

  if (!ticket) {
    return (
      <div className="rounded-3xl bg-white p-8 shadow-panel">
        <h2 className="text-xl font-semibold text-slate-900">Ticket not found</h2>
        <p className="mt-3 text-slate-500">Please return to your ticket list and select a valid ticket.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-white p-8 shadow-panel">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm uppercase tracking-[0.3em] text-slate-500">{ticket.id}</div>
            <h2 className="mt-2 text-3xl font-semibold text-slate-900">{ticket.title}</h2>
          </div>
          <div className="rounded-full bg-slate-100 px-4 py-2 text-sm text-slate-700">{ticket.status}</div>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl bg-slate-50 p-5">Priority: {ticket.priority}</div>
          <div className="rounded-3xl bg-slate-50 p-5">Category: {ticket.category}</div>
          <div className="rounded-3xl bg-slate-50 p-5">Created: {ticket.createdAt}</div>
          <div className="rounded-3xl bg-slate-50 p-5">CSAT status: {ticket.csat}</div>
        </div>
        <div className="mt-6 rounded-3xl bg-slate-50 p-6 text-slate-700">{ticket.details}</div>
      </section>
    </div>
  );
}

export default TicketDetails;
