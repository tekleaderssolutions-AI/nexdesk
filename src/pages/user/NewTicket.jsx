import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { analyzeTicket, createTicket } from '../../services/ticketService';

const MIN_CHARS = 20;
const DEBOUNCE_MS = 1800;

const PRIORITY_COLOR = { P1: '#f87171', P2: '#fb923c', P3: '#facc15', P4: '#4f8ef7', P5: '#94a3b8' };
const URGENCY_COLOR  = { HIGH: '#f87171', MEDIUM: '#facc15', LOW: '#34d399' };

function statusLabel(s) {
  const m = { OPEN: 'Open', IN_PROGRESS: 'In Progress', RESOLVED: 'Resolved', CLOSED: 'Closed', ESCALATED: 'Escalated' };
  return m[(s || '').toUpperCase()] || s;
}

function RightPanel({ subject, description }) {
  const [analysis, setAnalysis]   = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const timerRef = useRef(null);

  const ready = subject.trim().length >= MIN_CHARS && description.trim().length >= MIN_CHARS;

  useEffect(() => {
    if (!ready) {
      setAnalysis(null);
      setAnalyzing(false);
      clearTimeout(timerRef.current);
      return;
    }
    setAnalyzing(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const r = await analyzeTicket(subject.trim(), description.trim());
      if (r.success) setAnalysis(r);
      setAnalyzing(false);
    }, DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [subject, description]);

  if (!ready) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="ai-panel" style={{ opacity: 0.45 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
            <div style={{ width: '17px', height: '17px', background: 'linear-gradient(135deg,#7c4dff,#3b6fff)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10" /></svg>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa' }}>AI INTELLIGENCE</span>
          </div>
          <p style={{ fontSize: '12px', color: '#4a3a70', lineHeight: 1.6, margin: 0 }}>
            Type at least {MIN_CHARS} characters in both subject and description to get live AI analysis.
          </p>
        </div>
        <div style={{ background: 'rgba(30,48,71,.35)', border: '1px solid #101828', borderRadius: '9px', padding: '12px', opacity: 0.45 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e3047', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '7px' }}>Similar Tickets</div>
          <p style={{ fontSize: '12px', color: '#2a3f5a', margin: 0 }}>Will appear after analysis runs.</p>
        </div>
        <div style={{ background: 'rgba(30,48,71,.35)', border: '1px solid #101828', borderRadius: '9px', padding: '12px', opacity: 0.45 }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e3047', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '7px' }}>Try These First</div>
          <p style={{ fontSize: '12px', color: '#2a3f5a', margin: 0 }}>KB suggestions will appear here.</p>
        </div>
      </div>
    );
  }

  if (analyzing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="ai-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <div style={{ width: '17px', height: '17px', background: 'linear-gradient(135deg,#7c4dff,#3b6fff)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10" /></svg>
            </div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa' }}>AI INTELLIGENCE</span>
            <span style={{ fontSize: '10px', color: '#6d52cc', marginLeft: 'auto' }}>Analyzing…</span>
          </div>
          {[80, 55, 70].map((w, i) => (
            <div key={i} style={{ height: '36px', borderRadius: '7px', background: 'rgba(0,0,0,.25)', marginBottom: '8px', overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(124,77,255,.15), transparent)', animation: 'shimmer 1.4s infinite' }} />
            </div>
          ))}
        </div>
        <Skeleton />
        <Skeleton />
      </div>
    );
  }

  if (!analysis) return null;

  const urgency = (analysis.urgency || 'LOW').toUpperCase();
  const urgencyPct = urgency === 'HIGH' ? 85 : urgency === 'MEDIUM' ? 50 : 22;
  const urgencyColor = URGENCY_COLOR[urgency] || '#94a3b8';
  const prio = analysis.priority || 'P3';
  const prioColor = PRIORITY_COLOR[prio] || '#94a3b8';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* AI Intelligence */}
      <div className="ai-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
          <div style={{ width: '17px', height: '17px', background: 'linear-gradient(135deg,#7c4dff,#3b6fff)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10" /></svg>
          </div>
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa' }}>AI INTELLIGENCE</span>
          <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#34d399', fontWeight: 600 }}>● Live</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          {/* Detected Category */}
          <div style={{ padding: '9px', background: 'rgba(0,0,0,.25)', borderRadius: '7px' }}>
            <div style={{ fontSize: '10px', color: '#6d52cc', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Detected Category</div>
            <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 600 }}>
              {analysis.category || '—'}
              {analysis.category_confidence > 0 && (
                <span style={{ fontSize: '11px', color: '#6d52cc', marginLeft: '6px' }}>{analysis.category_confidence}%</span>
              )}
            </div>
          </div>

          {/* Urgency */}
          <div style={{ padding: '9px', background: 'rgba(0,0,0,.25)', borderRadius: '7px' }}>
            <div style={{ fontSize: '10px', color: '#6d52cc', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '5px' }}>Urgency Score</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <div className="pbar" style={{ flex: 1 }}>
                <div className="pfill" style={{ width: `${urgencyPct}%`, background: `linear-gradient(90deg,#7c4dff,${urgencyColor})` }} />
              </div>
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: urgencyColor }}>{urgency}</span>
            </div>
          </div>

          {/* Suggested Priority */}
          <div style={{ padding: '9px', background: 'rgba(0,0,0,.25)', borderRadius: '7px' }}>
            <div style={{ fontSize: '10px', color: '#6d52cc', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Suggested Priority</div>
            <div style={{ fontSize: '13px', color: prioColor, fontWeight: 700 }}>{prio}</div>
          </div>

          {/* Suggested Team */}
          {analysis.suggested_team && (
            <div style={{ padding: '9px', background: 'rgba(0,0,0,.25)', borderRadius: '7px' }}>
              <div style={{ fontSize: '10px', color: '#6d52cc', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Suggested Team</div>
              <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 600 }}>{analysis.suggested_team}</div>
            </div>
          )}
        </div>
      </div>

      {/* Possible Duplicates */}
      {analysis.similar_tickets && analysis.similar_tickets.length > 0 && (
        <div style={{ background: 'rgba(234,179,8,.06)', border: '1px solid rgba(234,179,8,.18)', borderRadius: '9px', padding: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '9px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#fbbf24' }}>POSSIBLE DUPLICATE</span>
            <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#92651a' }}>{analysis.similar_tickets.length} similar</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {analysis.similar_tickets.map((t, i) => (
              <div key={i} style={{ padding: '8px', background: 'rgba(0,0,0,.2)', borderRadius: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#fbbf24' }}>{t.ticket_no}</span>
                  <span style={{ fontSize: '10px', color: '#92651a' }}>{t.similarity}% match</span>
                </div>
                <div style={{ fontSize: '11.5px', color: '#92651a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.subject}</div>
                <div style={{ fontSize: '10px', color: '#6b4d12', marginTop: '2px' }}>{statusLabel(t.status)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KB Suggestions */}
      {analysis.kb_suggestions && analysis.kb_suggestions.length > 0 && (
        <div className="card" style={{ padding: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#3d5378', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '9px' }}>Try These First</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
            {analysis.kb_suggestions.map((kb, i) => (
              <div key={i} style={{ padding: '8px', background: '#0e1629', borderRadius: '7px' }}>
                <div style={{ fontSize: '12px', color: '#4f8ef7', fontWeight: 600, marginBottom: '3px' }}>{kb.title}</div>
                <div style={{ fontSize: '11.5px', color: '#8499b5', lineHeight: 1.45 }}>{kb.resolution_preview}{kb.resolution_preview?.length >= 140 ? '…' : ''}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No duplicates, no KB — show a clean "looks good" */}
      {(!analysis.similar_tickets || analysis.similar_tickets.length === 0) &&
       (!analysis.kb_suggestions || analysis.kb_suggestions.length === 0) && (
        <div style={{ background: 'rgba(52,211,153,.06)', border: '1px solid rgba(52,211,153,.2)', borderRadius: '9px', padding: '12px', fontSize: '12px', color: '#34d399' }}>
          ✓ No similar open tickets found. Looks like a new issue.
        </div>
      )}
    </div>
  );
}

function Skeleton() {
  return (
    <div style={{ background: '#0c1220', border: '1px solid #101828', borderRadius: '9px', padding: '12px', overflow: 'hidden', position: 'relative', height: '60px' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.03), transparent)', animation: 'shimmer 1.4s infinite' }} />
    </div>
  );
}

function NewTicket() {
  const navigate = useNavigate();
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Infrastructure');
  const [priority, setPriority] = useState('P3 - Medium');
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFiles = (files) => {
    setAttachments((cur) => [...cur, ...Array.from(files)].slice(0, 5));
  };

  const handleSubmit = async () => {
    setError('');
    if (!subject.trim() || !description.trim()) {
      setError('Subject and description are required.');
      return;
    }
    setLoading(true);
    const result = await createTicket({ subject, description, category, priority, attachments });
    setLoading(false);
    if (!result.success) { setError(result.message); return; }
    navigate('/user/tickets');
  };

  return (
    <div className="page ff">
      {/* shimmer keyframe */}
      <style>{`@keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }`}</style>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '22px' }}>
        <div>
          <h1 className="ff" style={{ fontSize: '19px', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>Create New Ticket</h1>
          <p style={{ fontSize: '12.5px', color: '#3d5378', marginTop: '3px' }}>Our AI will auto-detect category, priority and check for duplicates</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-s" type="button" onClick={() => navigate(-1)}>Cancel</button>
          <button className="btn-p" type="button" onClick={handleSubmit} disabled={loading}>{loading ? 'Submitting…' : 'Submit Ticket'}</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 284px', gap: '14px' }}>
        {/* Left: form */}
        <div className="card">
          {error && (
            <div style={{ marginBottom: '16px', padding: '12px', borderRadius: '10px', background: 'rgba(248,113,113,.1)', color: '#f87171', fontSize: '13px' }}>{error}</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '17px' }}>
            <div>
              <label style={labelStyle}>Subject *</label>
              <input className="inp" value={subject} onChange={(e) => setSubject(e.target.value)}
                placeholder="Brief description of the issue…" style={{ width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={labelStyle}>Description *</label>
              <textarea className="inp" rows="5" value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed description. Include steps to reproduce, expected vs actual behavior, environment details…"
                style={{ resize: 'vertical', lineHeight: 1.6, width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Category</label>
                <select className="sel" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option>Infrastructure</option>
                  <option>Authentication</option>
                  <option>Payments</option>
                  <option>Data & Reports</option>
                  <option>Frontend</option>
                  <option>Notifications</option>
                  <option>Database</option>
                  <option>Product</option>
                  <option>Other</option>
                </select>
              </div>
              <div>
                <label style={labelStyle}>Priority</label>
                <select className="sel" value={priority} onChange={(e) => setPriority(e.target.value)}>
                  <option>P3 - Medium</option>
                  <option>P1 - Critical</option>
                  <option>P2 - High</option>
                  <option>P4 - Low</option>
                  <option>P5 - Informational</option>
                </select>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Attachments</label>
              <div style={{ position: 'relative', border: '2px dashed #101828', borderRadius: '8px', padding: '22px', textAlign: 'center', cursor: 'pointer' }}>
                <input type="file" multiple accept="image/png,image/jpeg,application/pdf,text/plain,application/zip"
                  style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                  onChange={(e) => handleFiles(e.target.files)} />
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1e3047" strokeWidth="1.5" style={{ display: 'block', margin: '0 auto 8px' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <div style={{ fontSize: '12.5px', color: '#3d5378' }}>Drop files here or <span style={{ color: '#4f8ef7' }}>browse</span></div>
                <div style={{ fontSize: '11px', color: '#1e3047', marginTop: '3px' }}>Max 25MB · PNG, JPG, PDF, TXT, ZIP</div>
              </div>
              {attachments.length > 0 && (
                <ul style={{ listStyle: 'none', padding: 0, margin: '10px 0 0', color: '#94a3b8', fontSize: '12.5px' }}>
                  {attachments.map((f, i) => <li key={i} style={{ marginBottom: '4px' }}>📎 {f.name}</li>)}
                </ul>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
              <button type="button" className="btn-p" style={{ flex: 1, justifyContent: 'center', height: '38px', fontSize: '13px' }}
                onClick={handleSubmit} disabled={loading}>
                {loading ? 'Submitting…' : 'Submit Ticket →'}
              </button>
              <button type="button" className="btn-s" style={{ height: '38px', padding: '0 14px' }} onClick={() => navigate(-1)}>Cancel</button>
            </div>
          </div>
        </div>

        {/* Right: live AI analysis */}
        <RightPanel subject={subject} description={description} />
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block', fontSize: '11px', fontWeight: 700, color: '#3d5378',
  marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.06em',
};

export default NewTicket;
