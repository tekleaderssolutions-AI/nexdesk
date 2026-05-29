import { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';

function CSATAnalytics() {
  const { csatRecords } = useAuth();

  const stats = useMemo(() => {
    const resolved = csatRecords.filter((item) => item.resolved === 'resolved');
    const average = resolved.length ? (resolved.reduce((sum, entry) => sum + entry.rating, 0) / resolved.length).toFixed(1) : '0.0';
    const lowRatings = csatRecords.filter((item) => item.rating <= 2).length;
    return { total: csatRecords.length, average, lowRatings };
  }, [csatRecords]);

  return (
    <div className="space-y-6">
      <section className="grid gap-5 md:grid-cols-3">
        <div className="rounded-3xl bg-white p-6 shadow-panel">
          <div className="text-sm uppercase tracking-[0.3em] text-slate-500">Total CSAT</div>
          <div className="mt-3 text-4xl font-semibold text-slate-950">{stats.total}</div>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-panel">
          <div className="text-sm uppercase tracking-[0.3em] text-slate-500">Average rating</div>
          <div className="mt-3 text-4xl font-semibold text-slate-950">{stats.average}</div>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-panel">
          <div className="text-sm uppercase tracking-[0.3em] text-slate-500">Low satisfaction</div>
          <div className="mt-3 text-4xl font-semibold text-slate-950">{stats.lowRatings}</div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-6 shadow-panel">
        <h2 className="text-xl font-semibold text-slate-900">Satisfaction trends</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {['Peak satisfaction', 'Response quality', 'Follow-up actions'].map((label) => (
            <div key={label} className="rounded-3xl bg-slate-50 p-5">
              <div className="text-sm uppercase tracking-[0.3em] text-slate-500">{label}</div>
              <div className="mt-4 text-3xl font-semibold text-slate-900">{Math.floor(Math.random() * 24) + 75}%</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export default CSATAnalytics;
