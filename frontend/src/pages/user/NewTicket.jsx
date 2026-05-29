import { useState } from 'react';

function NewTicket() {
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Infrastructure');
  const [priority, setPriority] = useState('P3 - Medium');

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '22px' }}>
        <div>
          <h1 className="ff" style={{ fontSize: '19px', fontWeight: 700, color: '#e2e8f0' }}>Create New Ticket</h1>
          <p style={{ fontSize: '12.5px', color: '#3d5378', marginTop: '3px' }}>Our AI will auto-detect category, priority and check for duplicates</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn-s" type="button">Preview</button>
          <button className="btn-p" type="button">Submit Ticket</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 284px', gap: '14px' }}>
        <div className="card">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '17px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#3d5378', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Subject *</label>
              <input className="inp" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Brief description of the issue…" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#3d5378', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Description *</label>
              <textarea
                className="inp"
                rows="5"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detailed description. Include steps to reproduce, expected vs actual behavior, environment details…"
                style={{ resize: 'vertical', lineHeight: 1.6 }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#3d5378', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Category</label>
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
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#3d5378', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Priority</label>
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
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#3d5378', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '.06em' }}>Attachments</label>
              <div style={{ border: '2px dashed #101828', borderRadius: '8px', padding: '22px', textAlign: 'center', cursor: 'pointer', transition: 'border-color .15s' }}>
                <svg className="i" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1e3047" strokeWidth="1.5" style={{ display: 'block', margin: '0 auto 8px' }}>
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                <div style={{ fontSize: '12.5px', color: '#3d5378' }}>Drop files here or <span style={{ color: '#4f8ef7' }}>browse</span></div>
                <div style={{ fontSize: '11px', color: '#1e3047', marginTop: '3px' }}>Max 25MB · PNG, JPG, PDF, TXT, ZIP</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
              <button type="button" className="btn-p" style={{ flex: 1, justifyContent: 'center', height: '38px', fontSize: '13px' }}>Submit Ticket →</button>
              <button type="button" className="btn-s" style={{ height: '38px', padding: '0 14px' }}>Preview</button>
              <button type="button" className="btn-s" style={{ height: '38px', padding: '0 14px' }}>Save Draft</button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div className="ai-panel">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
              <div style={{ width: '17px', height: '17px', background: 'linear-gradient(135deg,#7c4dff,#3b6fff)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg className="i" width="9" height="9" viewBox="0 0 24 24" fill="white"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10" /></svg>
              </div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa' }}>AI INTELLIGENCE</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              <div style={{ padding: '9px', background: 'rgba(0,0,0,.25)', borderRadius: '7px' }}>
                <div style={{ fontSize: '10px', color: '#6d52cc', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Detected Category</div>
                <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 600 }}>Infrastructure <span style={{ fontSize: '11px', color: '#6d52cc' }}>87%</span></div>
              </div>
              <div style={{ padding: '9px', background: 'rgba(0,0,0,.25)', borderRadius: '7px' }}>
                <div style={{ fontSize: '10px', color: '#6d52cc', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '5px' }}>Urgency Score</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <div className="pbar" style={{ flex: 1 }}><div className="pfill" style={{ width: '82%', background: 'linear-gradient(90deg,#7c4dff,#ef4444)' }} /></div>
                  <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#f87171' }}>HIGH</span>
                </div>
              </div>
              <div style={{ padding: '9px', background: 'rgba(0,0,0,.25)', borderRadius: '7px' }}>
                <div style={{ fontSize: '10px', color: '#6d52cc', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '4px' }}>Suggested Team</div>
                <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: 600 }}>Infra Team</div>
              </div>
            </div>
          </div>

          <div style={{ background: 'rgba(234,179,8,.06)', border: '1px solid rgba(234,179,8,.18)', borderRadius: '9px', padding: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '7px' }}>
              <svg className="i" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#fbbf24' }}>POSSIBLE DUPLICATE</span>
            </div>
            <p style={{ fontSize: '12px', color: '#92651a', lineHeight: 1.5, margin: 0 }}>2 similar open tickets found. Possible duplicate of <strong style={{ color: '#fbbf24' }}>TKT-0001</strong>.</p>
            <button type="button" style={{ marginTop: '7px', fontSize: '11px', color: '#fbbf24', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>View similar →</button>
          </div>

          <div className="card">
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e3047', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '9px' }}>Try These First</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <div style={{ padding: '8px', background: '#0e1629', borderRadius: '7px', cursor: 'pointer', fontSize: '12.5px', color: '#8499b5', lineHeight: 1.45 }}>Check the server status dashboard for known outages</div>
              <div style={{ padding: '8px', background: '#0e1629', borderRadius: '7px', cursor: 'pointer', fontSize: '12.5px', color: '#8499b5', lineHeight: 1.45 }}>Verify if a recent deployment was pushed to production</div>
              <div style={{ padding: '8px', background: '#0e1629', borderRadius: '7px', cursor: 'pointer', fontSize: '12.5px', color: '#8499b5', lineHeight: 1.45 }}>Review health check endpoints in monitoring console</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default NewTicket;
