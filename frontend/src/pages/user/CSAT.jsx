import { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import tickets from '../../data/sampleTickets';

function CSAT() {
  const { user, csatRecords, submitCsat } = useAuth();
  const [form, setForm] = useState({ ticketId: tickets[0]?.id || '', rating: 5, resolved: 'resolved', feedback: '' });
  const [message, setMessage] = useState('');

  const history = useMemo(() => csatRecords.filter((record) => record.userEmail === user?.email), [csatRecords, user]);
  const averageRating = useMemo(() => {
    if (!history.length) return 0;
    return (history.reduce((sum, item) => sum + item.rating, 0) / history.length).toFixed(1);
  }, [history]);

  const handleSubmit = (event) => {
    event.preventDefault();
    submitCsat({
      userEmail: user.email,
      ticketId: form.ticketId,
      rating: Number(form.rating),
      resolved: form.resolved,
      feedback: form.feedback,
    });
    setMessage('Your CSAT response has been recorded.');
    setForm((prev) => ({ ...prev, feedback: '' }));
  };

  return (
    <div className="space-y-6">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-3xl bg-white p-8 shadow-panel">
          <h2 className="text-xl font-semibold text-slate-900">CSAT feedback</h2>
          <p className="mt-2 text-slate-500">Capture satisfaction for a resolved ticket and share a short feedback summary.</p>
          {message ? <div className="mt-5 rounded-3xl bg-emerald-500/10 p-4 text-sm text-emerald-800">{message}</div> : null}
          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <label className="block text-sm font-semibold text-slate-700">
              Ticket
              <select
                value={form.ticketId}
                onChange={(e) => setForm((prev) => ({ ...prev, ticketId: e.target.value }))}
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                {tickets.map((ticket) => (
                  <option key={ticket.id} value={ticket.id}>{`${ticket.id} — ${ticket.title}`}</option>
                ))}
              </select>
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-semibold text-slate-700">
                Satisfaction
                <select
                  value={form.rating}
                  onChange={(e) => setForm((prev) => ({ ...prev, rating: e.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  {[5, 4, 3, 2, 1].map((value) => (
                    <option key={value} value={value}>{value} Stars</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-700">
                Resolution status
                <select
                  value={form.resolved}
                  onChange={(e) => setForm((prev) => ({ ...prev, resolved: e.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <option value="resolved">Resolved</option>
                  <option value="not_resolved">Not resolved</option>
                </select>
              </label>
            </div>
            <label className="block text-sm font-semibold text-slate-700">
              Feedback
              <textarea
                value={form.feedback}
                onChange={(e) => setForm((prev) => ({ ...prev, feedback: e.target.value }))}
                rows="4"
                placeholder="Add your comments here"
                className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900"
              />
            </label>
            <button className="rounded-3xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400">
              Submit CSAT
            </button>
          </form>
        </div>
        <div className="rounded-3xl bg-white p-8 shadow-panel">
          <h2 className="text-xl font-semibold text-slate-900">CSAT summary</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-3xl bg-slate-50 p-5">
              <div className="text-sm text-slate-500">Average rating</div>
              <div className="mt-2 text-4xl font-semibold text-slate-900">{averageRating}</div>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5">
              <div className="text-sm text-slate-500">Submitted responses</div>
              <div className="mt-2 text-3xl font-semibold text-slate-900">{history.length}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-8 shadow-panel">
        <h2 className="text-xl font-semibold text-slate-900">CSAT history</h2>
        <div className="mt-6 space-y-4">
          {history.length ? (
            history.map((entry) => (
              <div key={entry.id} className="rounded-3xl border border-slate-200 p-5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold text-slate-900">{entry.ticketId} — {entry.rating} stars</div>
                    <div className="text-sm text-slate-500">Status: {entry.resolved === 'resolved' ? 'Resolved' : 'Not resolved'}</div>
                  </div>
                  <div className="text-sm text-slate-500">{new Date(entry.createdAt).toLocaleDateString()}</div>
                </div>
                <p className="mt-4 text-slate-600">{entry.feedback || 'No comment provided.'}</p>
              </div>
            ))
          ) : (
            <div className="rounded-3xl bg-slate-50 p-6 text-slate-600">No CSAT submissions yet. Use the form to share your feedback.</div>
          )}
        </div>
      </section>
    </div>
  );
}

export default CSAT;
