import { useEffect, useMemo, useState } from 'react';
import { fetchTickets, getMyCsatRecords, submitCsatFeedback } from '../../services/ticketService';

const ELIGIBLE = new Set(['RESOLVED', 'CLOSED', 'AI_RESOLVED', 'AI_RESOLVED_PENDING_USER_CONFIRMATION', 'REOPENED', 'AI_TEAM_REVIEW', 'TEAM_APPROVED_AI_RESPONSE']);

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function resolutionTime(ticket) {
  if (!ticket?.created_at || !ticket?.updated_at) return '—';
  const ms = new Date(ticket.updated_at) - new Date(ticket.created_at);
  if (ms < 0) return '—';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

function Stars({ rating, onRate, size = 18 }) {
  const [hovered, setHovered] = useState(0);
  const active = hovered || rating;
  return (
    <div style={{ display: 'flex', gap: '2px' }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <svg
          key={n}
          width={size} height={size} viewBox="0 0 24 24"
          fill={n <= active ? '#facc15' : 'none'}
          stroke={n <= active ? '#facc15' : '#1e3047'}
          strokeWidth="1.5"
          style={{ cursor: onRate ? 'pointer' : 'default', transition: 'fill .1s' }}
          onMouseEnter={() => onRate && setHovered(n)}
          onMouseLeave={() => onRate && setHovered(0)}
          onClick={() => onRate && onRate(n)}
        >
          <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" />
        </svg>
      ))}
    </div>
  );
}

function StatCard({ label, children, accent }) {
  return (
    <div className="card" style={{ padding: '18px 20px', borderTop: `3px solid ${accent}` }}>
      <div style={{ fontSize: '10px', fontWeight: 700, color: '#1e3047', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '10px' }}>{label}</div>
      {children}
    </div>
  );
}

function PendingCard({ ticket, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [isResolved, setIsResolved] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);

  const canSubmit = rating > 0 && isResolved !== null;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    const r = await submitCsatFeedback(ticket.ticket_id, rating, isResolved, feedback);
    setSaving(false);
    if (r.success) onSubmitted(r.record);
  };

  const handleSkip = () => onSubmitted(null);

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <TicketHeader ticket={ticket} extraBadge={
        <span style={{ background: 'rgba(251,191,36,.15)', border: '1px solid rgba(251,191,36,.3)', color: '#fbbf24', borderRadius: '20px', fontSize: '10px', fontWeight: 700, padding: '2px 8px' }}>
          Pending Rating
        </span>
      } />
      <TicketMeta ticket={ticket} />
      {/* Rating row */}
      <div style={{ borderTop: '1px solid #101828', padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '16px', alignItems: 'start' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#3d5378', marginBottom: '8px', fontWeight: 600 }}>How satisfied were you?</div>
          <Stars rating={rating} onRate={setRating} />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#3d5378', marginBottom: '8px', fontWeight: 600 }}>Was your issue resolved?</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setIsResolved(true)}
              style={{
                height: '28px', padding: '0 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
                background: isResolved === true ? 'rgba(52,211,153,.15)' : 'transparent',
                border: `1px solid ${isResolved === true ? '#34d399' : '#101828'}`,
                color: isResolved === true ? '#34d399' : '#3d5378',
              }}
            >✓ Yes, Resolved</button>
            <button
              onClick={() => setIsResolved(false)}
              style={{
                height: '28px', padding: '0 10px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
                background: isResolved === false ? 'rgba(248,113,113,.12)' : 'transparent',
                border: `1px solid ${isResolved === false ? '#f87171' : '#101828'}`,
                color: isResolved === false ? '#f87171' : '#3d5378',
              }}
            >✗ Not Resolved</button>
          </div>
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#3d5378', marginBottom: '6px', fontWeight: 600 }}>Additional feedback</div>
          <textarea
            className="inp"
            rows={2}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Tell us about your experience…"
            style={{ width: '100%', boxSizing: 'border-box', resize: 'none', fontSize: '12px', lineHeight: 1.4 }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '18px' }}>
          <button
            className="btn-p"
            onClick={handleSubmit}
            disabled={!canSubmit || saving}
            style={{ height: '32px', fontSize: '12px', opacity: canSubmit ? 1 : 0.45 }}
          >
            {saving ? '…' : 'Submit'}
          </button>
          <button
            onClick={handleSkip}
            style={{ background: 'none', border: 'none', color: '#3d5378', fontSize: '12px', cursor: 'pointer', textAlign: 'center' }}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

function RatedCard({ ticket, csat }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <TicketHeader ticket={ticket} extraBadge={
        <span style={{ background: 'rgba(79,142,247,.15)', border: '1px solid rgba(79,142,247,.3)', color: '#4f8ef7', borderRadius: '20px', fontSize: '10px', fontWeight: 700, padding: '2px 8px' }}>
          Rated
        </span>
      } />
      <TicketMeta ticket={ticket} />
      <div style={{ borderTop: '1px solid #101828', padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '20px', alignItems: 'start' }}>
        <div>
          <div style={{ fontSize: '11px', color: '#3d5378', marginBottom: '6px', fontWeight: 600 }}>Your rating</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Stars rating={csat.rating} size={15} />
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#facc15' }}>{csat.rating}.0</span>
          </div>
        </div>
        <div>
          {csat.feedback_text && (
            <>
              <div style={{ fontSize: '11px', color: '#3d5378', marginBottom: '4px', fontWeight: 600 }}>Feedback</div>
              <div style={{ fontSize: '12.5px', color: '#8499b5', lineHeight: 1.5, fontStyle: 'italic' }}>"{csat.feedback_text}"</div>
            </>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '11px', color: '#1e3047', marginBottom: '8px' }}>
            Submitted {fmtDate(csat.created_at)}
          </div>
          {csat.is_resolved
            ? <span style={{ background: 'rgba(52,211,153,.12)', border: '1px solid rgba(52,211,153,.25)', color: '#34d399', borderRadius: '6px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 600 }}>✓ Resolved</span>
            : <span style={{ background: 'rgba(248,113,113,.12)', border: '1px solid rgba(248,113,113,.25)', color: '#f87171', borderRadius: '6px', padding: '3px 10px', fontSize: '11.5px', fontWeight: 600 }}>✗ Not Resolved</span>
          }
        </div>
      </div>
    </div>
  );
}

function ReopenedCard({ ticket, csat }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <TicketHeader ticket={ticket} extraBadge={
        <span style={{ background: 'rgba(248,113,113,.12)', border: '1px solid rgba(248,113,113,.25)', color: '#f87171', borderRadius: '20px', fontSize: '10px', fontWeight: 700, padding: '2px 8px' }}>
          Not Resolved
        </span>
      } />
      <TicketMeta ticket={ticket} showRating={csat?.rating} originalResolvedDate />
      <div style={{ borderTop: '1px solid #101828', margin: '0 20px', padding: '14px 0 0' }} />
      <div style={{ background: 'rgba(234,88,12,.08)', border: '1px solid rgba(234,88,12,.22)', borderRadius: '8px', margin: '0 20px 20px', padding: '14px 16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#fb923c', marginBottom: '4px' }}>Ticket Reopened — Under Escalation Review</div>
          <div style={{ fontSize: '12px', color: '#92400e', lineHeight: 1.5 }}>
            This ticket has been escalated to the {ticket.assigned_team_name || 'support'} team manager. Expected response within 4 hours.
          </div>
        </div>
        <span style={{ flexShrink: 0, background: 'rgba(234,88,12,.18)', border: '1px solid rgba(234,88,12,.35)', color: '#fb923c', borderRadius: '6px', padding: '4px 12px', fontSize: '11.5px', fontWeight: 700 }}>
          Escalated
        </span>
      </div>
    </div>
  );
}

function TicketHeader({ ticket, extraBadge }) {
  const statusMap = {
    RESOLVED: { cls: 's-res', label: 'Resolved' },
    CLOSED: { cls: 's-res', label: 'Closed' },
    AI_RESOLVED: { cls: 's-ai', label: 'AI Resolved' },
    AI_RESOLVED_PENDING_USER_CONFIRMATION: { cls: 's-ai', label: 'AI Resolved' },
    REOPENED: { cls: 's-reo', label: 'Reopened' },
    AI_TEAM_REVIEW: { cls: 's-pend', label: 'AI Review' },
    TEAM_APPROVED_AI_RESPONSE: { cls: 's-pend', label: 'Team Approved' },
  };
  const s = statusMap[(ticket.status || '').toUpperCase()] || { cls: 's-open', label: ticket.status };
  const isReopened = (ticket.status || '').toUpperCase() === 'REOPENED';
  return (
    <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: '#4f8ef7', background: 'rgba(79,142,247,.1)', padding: '2px 8px', borderRadius: '5px' }}>
          {ticket.ticket_no}
        </span>
        <span className={`b ${s.cls}`}>{s.label}</span>
        {extraBadge}
      </div>
      <span style={{ fontSize: '11px', color: '#1e3047', whiteSpace: 'nowrap' }}>
        {isReopened ? 'Originally resolved: ' : 'Resolved: '}
        {fmtDate(ticket.updated_at || ticket.created_at)}
      </span>
    </div>
  );
}

function TicketMeta({ ticket, showRating }) {
  const prioMap = { P1: 'p1', P2: 'p2', P3: 'p3', P4: 'p4', P5: 'p5' };
  const prioLabel = { P1: 'P1 Critical', P2: 'P2 High', P3: 'P3 Medium', P4: 'P4 Low', P5: 'P5 Info' };
  const prio = (ticket.priority || '').toUpperCase();
  return (
    <div style={{ padding: '0 20px 14px' }}>
      <div style={{ fontSize: '14px', fontWeight: 600, color: '#c9d8ee', marginBottom: '12px' }}>{ticket.subject}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
        <MetaCell label="TEAM HANDLED" value={ticket.assigned_team_name || 'AI Engine'} />
        <MetaCell label="RESOLUTION TIME" value={resolutionTime(ticket)} />
        {showRating !== undefined
          ? <MetaCell label="RATING">
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Stars rating={showRating} size={12} />
                <span style={{ fontSize: '12px', color: '#facc15', fontWeight: 700 }}>{showRating}.0</span>
              </div>
            </MetaCell>
          : prio
            ? <MetaCell label="PRIORITY">
                <span className={`b ${prioMap[prio]}`}>● {prioLabel[prio] || prio}</span>
              </MetaCell>
            : <MetaCell label="PRIORITY" value="—" />
        }
      </div>
    </div>
  );
}

function MetaCell({ label, value, children }) {
  return (
    <div>
      <div style={{ fontSize: '10px', fontWeight: 700, color: '#1e3047', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>{label}</div>
      {children ?? <div style={{ fontSize: '13px', color: '#8499b5' }}>{value}</div>}
    </div>
  );
}

function CSAT() {
  const [tickets, setTickets] = useState([]);
  const [csatMap, setCsatMap] = useState({});   // ticket_id → csat record
  const [skipped, setSkipped] = useState({});   // ticket_id → true
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Promise.all([fetchTickets(), getMyCsatRecords()]).then(([tr, cr]) => {
      if (!mounted) return;
      if (tr.success) setTickets(tr.tickets || []);
      if (cr.success) {
        const m = {};
        (cr.records || []).forEach(r => { m[String(r.ticket_id)] = r; });
        setCsatMap(m);
      }
      setLoading(false);
    });
    return () => { mounted = false; };
  }, []);

  const eligible = useMemo(
    () => tickets.filter(t => ELIGIBLE.has((t.status || '').toUpperCase())),
    [tickets]
  );

  const pending = useMemo(
    () => eligible.filter(t => !csatMap[t.ticket_id] && !skipped[t.ticket_id] && (t.status || '').toUpperCase() !== 'REOPENED'),
    [eligible, csatMap, skipped]
  );

  // Stats
  const csatList = Object.values(csatMap);
  const totalRated = csatList.length;
  const avgRating = totalRated ? (csatList.reduce((s, r) => s + r.rating, 0) / totalRated) : 0;
  const satisfiedCount = csatList.filter(r => r.rating >= 4).length;
  const overallSat = totalRated ? Math.round(satisfiedCount / totalRated * 100) : 0;
  const reopenedCount = eligible.filter(t => (t.status || '').toUpperCase() === 'REOPENED').length;
  const unresolvedPct = eligible.length ? Math.round(reopenedCount / eligible.length * 100) : 0;

  // Most helpful team
  const teamRatings = {};
  csatList.forEach(r => {
    const t = tickets.find(tk => tk.ticket_id === String(r.ticket_id));
    const team = t?.assigned_team_name || 'AI Engine';
    if (!teamRatings[team]) teamRatings[team] = { sum: 0, count: 0 };
    teamRatings[team].sum += r.rating;
    teamRatings[team].count++;
  });
  const bestTeam = Object.entries(teamRatings)
    .map(([name, d]) => ({ name, avg: (d.sum / d.count).toFixed(1), count: d.count }))
    .sort((a, b) => parseFloat(b.avg) - parseFloat(a.avg))[0];

  const handleSubmitted = (ticketId, record) => {
    if (record) {
      setCsatMap(prev => ({ ...prev, [ticketId]: record }));
    } else {
      setSkipped(prev => ({ ...prev, [ticketId]: true }));
    }
  };

  if (loading) {
    return <div className="page ff" style={{ color: '#3d5378', fontSize: '13px', padding: '40px' }}>Loading…</div>;
  }

  return (
    <div className="page ff">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '22px' }}>
        <div>
          <h1 className="ff" style={{ fontSize: '19px', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>CSAT & Feedback</h1>
          <p style={{ fontSize: '12.5px', color: '#3d5378', marginTop: '4px' }}>Rate your experience & manage resolved ticket feedback</p>
        </div>
        <button className="btn-s" style={{ height: '32px', fontSize: '12px', padding: '0 14px' }}>All Time</button>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '18px' }}>
        {/* Overall Satisfaction */}
        <StatCard label="Overall Satisfaction" accent="#facc15">
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#e2e8f0', lineHeight: 1 }}>{overallSat}%</div>
          {totalRated > 0 && (
            <div style={{ fontSize: '11px', color: '#34d399', marginTop: '4px', marginBottom: '8px' }}>Based on {totalRated} rating{totalRated !== 1 ? 's' : ''}</div>
          )}
          <div style={{ height: '3px', background: '#101828', borderRadius: '2px', marginTop: '10px', overflow: 'hidden' }}>
            <div style={{ width: `${overallSat}%`, height: '100%', background: '#facc15', borderRadius: '2px', transition: 'width .5s' }} />
          </div>
        </StatCard>

        {/* Average Rating */}
        <StatCard label="Average Rating" accent="#4f8ef7">
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#e2e8f0', lineHeight: 1 }}>
            {totalRated ? avgRating.toFixed(1) : '—'}
            <span style={{ fontSize: '14px', color: '#3d5378', fontWeight: 400 }}>/5</span>
          </div>
          <div style={{ fontSize: '11px', color: '#1e3047', marginTop: '4px', marginBottom: '8px' }}>Based on {totalRated} rating{totalRated !== 1 ? 's' : ''}</div>
          <Stars rating={Math.round(avgRating)} size={14} />
        </StatCard>

        {/* Unresolved % */}
        <StatCard label="Unresolved %" accent="#f87171">
          <div style={{ fontSize: '32px', fontWeight: 800, color: unresolvedPct > 20 ? '#f87171' : '#e2e8f0', lineHeight: 1 }}>{unresolvedPct}%</div>
          <div style={{ fontSize: '11px', color: '#1e3047', marginTop: '4px', marginBottom: '8px' }}>
            {reopenedCount} of {eligible.length} tickets reopened
          </div>
          <div style={{ height: '3px', background: '#101828', borderRadius: '2px', marginTop: '10px', overflow: 'hidden' }}>
            <div style={{ width: `${unresolvedPct}%`, height: '100%', background: '#f87171', borderRadius: '2px', transition: 'width .5s' }} />
          </div>
        </StatCard>

        {/* Most Helpful Team */}
        <StatCard label="Most Helpful Team" accent="#34d399">
          {bestTeam ? (
            <>
              <div style={{ fontSize: '17px', fontWeight: 700, color: '#facc15', marginBottom: '3px' }}>{bestTeam.name}</div>
              <div style={{ fontSize: '11px', color: '#1e3047', marginBottom: '10px' }}>Avg {bestTeam.avg} · {bestTeam.count} rating{bestTeam.count !== 1 ? 's' : ''}</div>
              <span style={{ background: 'rgba(52,211,153,.12)', border: '1px solid rgba(52,211,153,.25)', color: '#34d399', borderRadius: '5px', padding: '2px 8px', fontSize: '10px', fontWeight: 700 }}>Top Performer</span>
            </>
          ) : (
            <div style={{ fontSize: '12px', color: '#2a3f5a' }}>No ratings yet</div>
          )}
        </StatCard>
      </div>

      {/* Pending warning banner */}
      {pending.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(251,191,36,.06)', border: '1px solid rgba(251,191,36,.2)',
          borderRadius: '10px', padding: '12px 18px', marginBottom: '18px', gap: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" style={{ flexShrink: 0, marginTop: '1px' }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#fbbf24', marginBottom: '2px' }}>
                {pending.length} ticket{pending.length !== 1 ? 's are' : ' is'} waiting for your feedback
              </div>
              <div style={{ fontSize: '12px', color: '#92651a' }}>
                Rate your satisfaction to help us improve: {pending.map(t => t.ticket_no).join(', ')} {pending.length > 3 ? `and ${pending.length - 3} more` : ''} are pending.
              </div>
            </div>
          </div>
          <button className="btn-s" style={{ height: '30px', fontSize: '11.5px', padding: '0 12px', flexShrink: 0, borderColor: 'rgba(251,191,36,.3)', color: '#fbbf24' }}>
            Rate Now
          </button>
        </div>
      )}

      {/* Ticket cards list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {eligible.length === 0 && (
          <div style={{ textAlign: 'center', padding: '52px', color: '#3d5378', fontSize: '13px' }}>
            No resolved tickets yet. CSAT cards will appear here once tickets are resolved.
          </div>
        )}

        {eligible.map((ticket) => {
          const tid = ticket.ticket_id;
          const csat = csatMap[tid];
          const status = (ticket.status || '').toUpperCase();
          const isReopened = status === 'REOPENED';

          if (isReopened) {
            return <ReopenedCard key={tid} ticket={ticket} csat={csat} />;
          }
          if (csat || skipped[tid]) {
            return csat ? <RatedCard key={tid} ticket={ticket} csat={csat} /> : null;
          }
          return <PendingCard key={tid} ticket={ticket} onSubmitted={(rec) => handleSubmitted(tid, rec)} />;
        })}
      </div>
    </div>
  );
}

export default CSAT;
