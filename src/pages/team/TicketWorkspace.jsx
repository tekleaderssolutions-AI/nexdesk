import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  fetchTickets, getMe, getTicket,
  getConversations, sendConversationMessage,
  getTicketMessages, sendTicketMessage,
  getAISuggestion, getResolutionConfidence, getTicketTimeline,
  getTicketRelationships, assignTicketToMember, getTeamMembersWorkload,
  updateTicketStatus,
} from '../../services/ticketService';

const PRIORITY_CLASS = { P1: 'p1', P2: 'p2', P3: 'p3', P4: 'p4', P5: 'p5' };
const PRIORITY_LABEL = { P1: 'P1 Critical', P2: 'P2 High', P3: 'P3 Medium', P4: 'P4 Low', P5: 'P5 Minimal' };

function statusBadge(s) {
  const u = (s || '').toUpperCase();
  const cls = { OPEN:'s-open', IN_PROGRESS:'s-prog', RESOLVED:'s-res', CLOSED:'s-res', ESCALATED:'s-esc', AI_RESOLVED:'s-ai', AI_RESOLVED_PENDING_USER_CONFIRMATION:'s-ai', AI_TEAM_REVIEW:'s-ai', TEAM_APPROVED_AI_RESPONSE:'s-ai', REOPENED:'s-reo' };
  const lbl = { OPEN:'Open', IN_PROGRESS:'In Progress', RESOLVED:'Resolved', CLOSED:'Closed', ESCALATED:'Escalated', AI_RESOLVED:'AI Resolved', AI_RESOLVED_PENDING_USER_CONFIRMATION:'AI Pending', AI_TEAM_REVIEW:'AI Review', TEAM_APPROVED_AI_RESPONSE:'Team Approved', REOPENED:'Reopened' };
  return <span className={`b ${cls[u]||'s-open'}`}>{lbl[u]||s}</span>;
}

function fmtTime(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function fmtSLAShort(t) {
  if (t.sla_breached) return { text: 'SLA Breached', color: '#f87171' };
  if (t.sla_at_risk)  return { text: 'SLA At Risk',  color: '#fb923c' };
  if (t.sla_minutes_remaining != null) {
    const h = Math.floor(t.sla_minutes_remaining / 60), m = t.sla_minutes_remaining % 60;
    return { text: `SLA: ${h > 0 ? `${h}h ${m}m` : `${m}m`} remaining`, color: '#34d399' };
  }
  return null;
}

// ── Assign modal ──────────────────────────────────────────────────────────────
function AssignModal({ ticket, members, onClose, onDone }) {
  const [sel, setSel] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async () => {
    if (!sel) { setErr('Select a member'); return; }
    setBusy(true);
    const r = await assignTicketToMember(ticket.ticket_id || ticket.id, sel);
    setBusy(false);
    if (r.success) { onDone(); onClose(); } else setErr(r.message || 'Failed');
  };
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 }}>
      <div className="card ff" style={{ width:'360px', padding:'24px' }}>
        <div style={{ fontSize:'14px', fontWeight:700, color:'#e2e8f0', marginBottom:'16px' }}>Reassign Ticket</div>
        <select className="sel" value={sel} onChange={e=>setSel(e.target.value)} style={{ width:'100%', marginBottom:'12px' }}>
          <option value="">Select member…</option>
          {members.map(m=><option key={m.user_id} value={m.user_id}>{m.full_name} ({m.member_role})</option>)}
        </select>
        {err && <div style={{ color:'#f87171', fontSize:'12px', marginBottom:'10px' }}>{err}</div>}
        <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
          <button className="btn-s" onClick={onClose} style={{ height:'30px', padding:'0 14px', fontSize:'12px' }}>Cancel</button>
          <button className="btn-p" onClick={go} disabled={busy} style={{ height:'30px', padding:'0 14px', fontSize:'12px' }}>{busy?'Assigning…':'Assign'}</button>
        </div>
      </div>
    </div>
  );
}

// ── Ticket list sidebar ───────────────────────────────────────────────────────
function TicketSidebar({ tickets, selectedId, onSelect, loading }) {
  const [q, setQ] = useState('');
  const filtered = q
    ? tickets.filter(t => t.ticket_no?.toLowerCase().includes(q.toLowerCase()) || t.subject?.toLowerCase().includes(q.toLowerCase()))
    : tickets;

  return (
    <div style={{ width:'220px', flexShrink:0, borderRight:'1px solid #101828', display:'flex', flexDirection:'column', height:'100%' }}>
      <div style={{ padding:'12px', borderBottom:'1px solid #101828' }}>
        <input className="inp" placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)}
          style={{ width:'100%', height:'30px', fontSize:'11.5px', boxSizing:'border-box' }} />
      </div>
      <div style={{ flex:1, overflowY:'auto' }}>
        {loading && <div style={{ padding:'16px', fontSize:'12px', color:'#3d5378' }}>Loading…</div>}
        {!loading && filtered.length === 0 && <div style={{ padding:'16px', fontSize:'12px', color:'#3d5378' }}>No tickets</div>}
        {filtered.map(t => {
          const active = t.ticket_id === selectedId;
          return (
            <button key={t.ticket_id} onClick={() => onSelect(t.ticket_id)} style={{
              width:'100%', textAlign:'left', padding:'10px 12px', border:'none', cursor:'pointer',
              background: active ? 'rgba(52,211,153,.08)' : 'transparent',
              borderLeft: active ? '3px solid #34d399' : '3px solid transparent',
              borderBottom:'1px solid #0a1020',
            }}>
              <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px' }}>
                <span style={{ fontSize:'10.5px', fontWeight:700, color: active ? '#34d399' : '#4f8ef7', fontFamily:'monospace' }}>{t.ticket_no}</span>
                <span className={`b ${PRIORITY_CLASS[t.priority]||'p3'}`} style={{ fontSize:'9px', padding:'1px 5px' }}>
                  {t.priority}
                </span>
              </div>
              <div style={{ fontSize:'11.5px', color:'#c9d8ee', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight: active ? 600 : 400 }}>{t.subject}</div>
              <div style={{ marginTop:'4px' }}>{statusBadge(t.status)}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Conversation panel ────────────────────────────────────────────────────────
function ConversationPanel({ ticket, me, workload, onReload }) {
  const [tab, setTab] = useState('conversation'); // conversation | internal | history
  const [messages, setMessages] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [replyType, setReplyType] = useState('reply'); // reply | internal
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [aiDraft, setAiDraft] = useState('');
  const bottomRef = useRef(null);
  const pollRef = useRef(null);
  const isP1P2 = ['P1','P2'].includes(ticket.priority);

  const loadMessages = useCallback(() => {
    if (isP1P2) {
      getConversations(ticket.ticket_id).then(r => {
        if (r.success) setMessages(r.conversations || []);
      });
    } else {
      getTicketMessages(ticket.ticket_id).then(r => {
        if (r.success) setMessages(r.messages || []);
      });
    }
  }, [ticket.ticket_id, isP1P2]);

  useEffect(() => {
    setMessages([]); setTimeline([]); setInput(''); setTab('conversation');
    loadMessages();
    getTicketTimeline(ticket.ticket_id).then(r => { if (r.success) setTimeline(r.events || r.timeline || []); });
    // Load AI draft from suggestion
    getAISuggestion(ticket.ticket_id).then(r => {
      if (r.success && r.suggestion) {
        const s = r.suggestion;
        const steps = (s.suggested_steps || []).slice(0, 2).map((st, i) => `${i+1}. ${st}`).join('\n');
        setAiDraft(`Hi ${ticket.creator_name || 'there'},\n\nWe've reviewed your request. ${s.problem_summary || ''}\n\n${steps ? `Steps being taken:\n${steps}` : ''}\n\nWe'll keep you updated.\n\n— ${workload?.team_name || 'Support Team'}`);
      }
    });
    pollRef.current = setInterval(loadMessages, 5000);
    return () => clearInterval(pollRef.current);
  }, [ticket.ticket_id]); // eslint-disable-line

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages]);

  const send = async () => {
    const body = input.trim();
    if (!body || sending) return;
    setSending(true);
    let r;
    if (isP1P2) {
      r = await sendConversationMessage(ticket.ticket_id, body);
    } else {
      r = await sendTicketMessage(ticket.ticket_id, body);
    }
    setSending(false);
    if (r.success) { setInput(''); loadMessages(); }
  };

  const handleKey = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };

  const slaInfo = fmtSLAShort(ticket);
  const deptMembers = workload?.department_members || [];

  // Normalize messages across both conversation types
  const displayMessages = tab === 'internal'
    ? messages.filter(m => m.is_internal)
    : tab === 'conversation'
    ? messages.filter(m => !m.is_internal)
    : [];

  return (
    <div style={{ flex:'2.2', minWidth:'360px', borderRight:'1px solid #101828', display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Header */}
      <div style={{ padding:'14px 16px', borderBottom:'1px solid #101828', flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'6px' }}>
          <span style={{ fontSize:'13px', fontWeight:800, color:'#e2e8f0', fontFamily:'monospace' }}>{ticket.ticket_no}</span>
          {statusBadge(ticket.status)}
          <span className={`b ${PRIORITY_CLASS[ticket.priority]||'p3'}`}>● {PRIORITY_LABEL[ticket.priority]||ticket.priority}</span>
        </div>
        <div style={{ fontSize:'14px', fontWeight:700, color:'#e2e8f0', marginBottom:'6px', lineHeight:1.3 }}>{ticket.subject}</div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:'12px', alignItems:'center', fontSize:'11.5px' }}>
          {slaInfo && <span style={{ color: slaInfo.color, fontWeight:700 }}>⏱ {slaInfo.text}</span>}
          {ticket.incident_id && <span style={{ color:'#a855f7', fontWeight:600 }}>· Linked: INC</span>}
          {ticket.creator_name && <span style={{ color:'#3d5378' }}>· {ticket.creator_name}</span>}
          {ticket.assigned_team_name && <span style={{ color:'#4f8ef7' }}>· {ticket.assigned_team_name}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid #101828', flexShrink:0 }}>
        {[['conversation','Conversation'],['internal','Internal Notes'],['history','History']].map(([key,lbl]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding:'10px 16px', border:'none', cursor:'pointer', background:'transparent',
            fontSize:'12px', fontWeight: tab===key ? 700 : 400,
            color: tab===key ? '#34d399' : '#3d5378',
            borderBottom: tab===key ? '2px solid #34d399' : '2px solid transparent',
            fontFamily:'inherit',
          }}>{lbl}</button>
        ))}
      </div>

      {/* Messages */}
      <div style={{ flex:1, overflowY:'auto', padding:'14px' }}>
        {/* Incident alert */}
        {ticket.incident_id && tab === 'conversation' && (
          <div style={{ background:'rgba(248,113,113,.08)', border:'1px solid rgba(248,113,113,.2)', borderRadius:'8px', padding:'12px', marginBottom:'12px' }}>
            <div style={{ fontSize:'11.5px', fontWeight:700, color:'#f87171', marginBottom:'4px' }}>⚠ INCIDENT LINKED</div>
            <div style={{ fontSize:'11.5px', color:'#c9d8ee' }}>{ticket.description?.slice(0, 120)}</div>
          </div>
        )}

        {tab === 'history' ? (
          timeline.length === 0
            ? <div style={{ color:'#3d5378', fontSize:'12px', textAlign:'center', marginTop:'24px' }}>No history yet.</div>
            : timeline.map((ev, i) => (
              <div key={i} style={{ display:'flex', gap:'10px', marginBottom:'10px', fontSize:'12px' }}>
                <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#4f8ef7', flexShrink:0, marginTop:'5px' }} />
                <div>
                  <span style={{ color:'#c9d8ee' }}>{ev.event || ev.field_changed}</span>
                  {ev.new_value && <span style={{ color:'#3d5378', marginLeft:'6px' }}>→ {ev.new_value}</span>}
                  <div style={{ fontSize:'10px', color:'#1e3047', marginTop:'2px' }}>{fmtTime(ev.created_at || ev.timestamp)}</div>
                </div>
              </div>
            ))
        ) : (
          displayMessages.length === 0
            ? <div style={{ color:'#3d5378', fontSize:'12px', textAlign:'center', marginTop:'24px' }}>No messages yet.</div>
            : displayMessages.map((m, i) => {
              const body = m.message_body || m.message || '';
              const senderName = m.sender_name || (m.sender_role === 'AI' ? 'NexDesk AI' : m.sender_type === 'AI' ? 'NexDesk AI' : m.sender_role || m.sender_type || '?');
              const isAI = (m.sender_role||m.sender_type||'').toUpperCase() === 'AI';
              const isMe = me && (String(m.sender_id) === String(me.id));
              const initial = senderName[0]?.toUpperCase() || '?';
              const avatarColor = isAI ? '#a855f7' : isMe ? '#34d399' : '#4f8ef7';

              return (
                <div key={m.id||i} style={{ display:'flex', gap:'10px', marginBottom:'14px', alignItems:'flex-start' }}>
                  <div style={{
                    width:'28px', height:'28px', borderRadius:'50%', flexShrink:0,
                    background: `linear-gradient(135deg,${avatarColor},${avatarColor}88)`,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    fontSize:'10px', fontWeight:800, color:'#fff',
                  }}>
                    {isAI ? 'AI' : initial}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                      <span style={{ fontSize:'12px', fontWeight:700, color:'#c9d8ee' }}>{senderName}</span>
                      {isAI && <span style={{ fontSize:'10px', color:'#3d5378' }}>(auto)</span>}
                      <span style={{ fontSize:'10px', color:'#1e3047' }}>{fmtTime(m.created_at)}</span>
                      {m.is_internal && <span style={{ fontSize:'9px', background:'rgba(168,85,247,.15)', color:'#a855f7', padding:'1px 6px', borderRadius:'6px', fontWeight:700 }}>INTERNAL</span>}
                    </div>
                    <div style={{
                      background: isMe ? 'rgba(79,142,247,.12)' : 'rgba(255,255,255,.04)',
                      border: `1px solid ${isMe ? 'rgba(79,142,247,.2)' : '#101828'}`,
                      borderRadius:'10px', padding:'10px 14px',
                      fontSize:'12.5px', color:'#c9d8ee', lineHeight:1.6,
                    }}>
                      {body}
                    </div>
                  </div>
                </div>
              );
            })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Reply box */}
      {tab !== 'history' && (
        <div style={{ borderTop:'1px solid #101828', padding:'12px', flexShrink:0 }}>
          <div style={{ display:'flex', gap:'4px', marginBottom:'8px' }}>
            {[['reply','Reply to User'],['internal','Internal Note']].map(([type,lbl]) => (
              <button key={type} onClick={() => setReplyType(type)} style={{
                height:'26px', padding:'0 12px', fontSize:'11px', borderRadius:'6px', border:'1px solid',
                cursor:'pointer', fontFamily:'inherit', fontWeight: replyType===type ? 700 : 400,
                background: replyType===type ? (type==='internal' ? 'rgba(168,85,247,.15)' : 'rgba(52,211,153,.1)') : 'transparent',
                color: replyType===type ? (type==='internal' ? '#a855f7' : '#34d399') : '#3d5378',
                borderColor: replyType===type ? (type==='internal' ? '#a855f7' : '#34d399') : '#101828',
              }}>{lbl}</button>
            ))}
          </div>
          <textarea
            className="inp"
            placeholder="Write a response…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={3}
            style={{ width:'100%', resize:'none', fontSize:'12.5px', lineHeight:1.5, boxSizing:'border-box' }}
          />
          <div style={{ display:'flex', gap:'8px', marginTop:'8px', alignItems:'center' }}>
            <button className="btn-s" style={{ height:'28px', padding:'0 10px', fontSize:'11px' }}>📎 Attach</button>
            <button className="btn-s" onClick={() => setInput(aiDraft)} style={{ height:'28px', padding:'0 10px', fontSize:'11px', color:'#a855f7', borderColor:'#a855f7' }}>✦ AI Draft</button>
            <div style={{ flex:1 }} />
            <button
              className="btn-s"
              onClick={async () => {
                const r = await updateTicketStatus(ticket.ticket_id, 'ESCALATED');
                if (r.success) onReload();
              }}
              style={{ height:'28px', padding:'0 10px', fontSize:'11px', color:'#f87171', borderColor:'#f87171' }}
            >↑ Escalate</button>
            <button
              className="btn-p"
              onClick={send}
              disabled={sending || !input.trim()}
              style={{ height:'28px', padding:'0 16px', fontSize:'12px' }}
            >
              {sending ? 'Sending…' : 'Send →'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Actions panel ─────────────────────────────────────────────────────────────
function ActionsPanel({ ticket, workload, onReload, onAssignOpen }) {
  const [busy, setBusy] = useState('');
  const related = []; // placeholder for linked tickets

  const doStatus = async (status) => {
    setBusy(status);
    await updateTicketStatus(ticket.ticket_id, status);
    setBusy('');
    onReload();
  };

  const isResolved = ['RESOLVED','CLOSED','AI_RESOLVED'].includes((ticket.status||'').toUpperCase());

  return (
    <div style={{ flex:'1.4', minWidth:'260px', borderRight:'1px solid #101828', overflowY:'auto', height:'100%' }}>
      <div style={{ padding:'14px 16px' }}>

        {/* Incident */}
        {ticket.incident_id && (
          <div style={{ marginBottom:'16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:'10px', color:'#3d5378', textTransform:'uppercase', letterSpacing:'.07em' }}>Incident</span>
            <span style={{ fontSize:'12px', fontWeight:700, color:'#a855f7' }}>INC ↗</span>
          </div>
        )}

        {/* Resolution Actions */}
        <div style={{ marginBottom:'20px' }}>
          <div style={{ fontSize:'10px', color:'#3d5378', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:'10px' }}>Resolution Actions</div>

          <button
            onClick={() => doStatus('RESOLVED')}
            disabled={!!busy || isResolved}
            style={{
              width:'100%', height:'40px', borderRadius:'8px', border:'none', cursor: isResolved ? 'default' : 'pointer',
              background: isResolved ? 'rgba(52,211,153,.1)' : 'linear-gradient(135deg,#059669,#34d399)',
              color: isResolved ? '#34d399' : '#fff', fontWeight:700, fontSize:'13px', marginBottom:'8px',
              opacity: !!busy && busy !== 'RESOLVED' ? .5 : 1, fontFamily:'inherit',
            }}
          >
            {busy==='RESOLVED' ? 'Resolving…' : isResolved ? '✓ Resolved' : '✓ Mark Resolved'}
          </button>

          <button
            onClick={() => doStatus('ESCALATED')}
            disabled={!!busy}
            style={{
              width:'100%', height:'38px', borderRadius:'8px', border:'1px solid rgba(248,113,113,.3)', cursor:'pointer',
              background:'rgba(248,113,113,.08)', color:'#f87171', fontWeight:600, fontSize:'12.5px', marginBottom:'8px',
              opacity: !!busy && busy !== 'ESCALATED' ? .5 : 1, fontFamily:'inherit',
            }}
          >
            {busy==='ESCALATED' ? '…' : '↑ Escalate Further'}
          </button>

          <button
            disabled={!!busy}
            style={{
              width:'100%', height:'38px', borderRadius:'8px', border:'1px solid rgba(251,146,60,.3)', cursor:'pointer',
              background:'rgba(251,146,60,.08)', color:'#fb923c', fontWeight:600, fontSize:'12.5px', marginBottom:'12px',
              opacity: !!busy ? .5 : 1, fontFamily:'inherit',
            }}
          >
            ⊕ Merge Duplicate
          </button>

          <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
            <button style={{
              background:'none', border:'none', cursor:'pointer', textAlign:'left',
              fontSize:'12px', color:'#3d5378', padding:'4px 0', fontFamily:'inherit',
              display:'flex', alignItems:'center', gap:'6px',
            }}>
              ⚡ Convert to Incident
            </button>
            <button onClick={onAssignOpen} style={{
              background:'none', border:'none', cursor:'pointer', textAlign:'left',
              fontSize:'12px', color:'#3d5378', padding:'4px 0', fontFamily:'inherit',
              display:'flex', alignItems:'center', gap:'6px',
            }}>
              ↻ Reassign
            </button>
          </div>
        </div>

        {/* Duplicate Analysis */}
        <div style={{ marginBottom:'20px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
            <span style={{ fontSize:'10px', color:'#3d5378', textTransform:'uppercase', letterSpacing:'.07em' }}>Duplicate Analysis</span>
            <span style={{
              background: (ticket.duplicate_count||0) > 0 ? 'rgba(251,146,60,.15)' : 'rgba(52,211,153,.1)',
              color: (ticket.duplicate_count||0) > 0 ? '#fb923c' : '#34d399',
              borderRadius:'10px', fontSize:'10px', fontWeight:700, padding:'2px 8px',
            }}>
              {ticket.duplicate_count||0} match{ticket.duplicate_count !== 1 ? 'es' : ''}
            </span>
          </div>
          {(ticket.duplicate_count||0) === 0 ? (
            <div style={{ background:'rgba(255,255,255,.03)', borderRadius:'8px', padding:'12px', fontSize:'12px', color:'#3d5378', textAlign:'center' }}>
              No duplicate tickets detected.
            </div>
          ) : (
            <div style={{ background:'rgba(251,146,60,.06)', border:'1px solid rgba(251,146,60,.2)', borderRadius:'8px', padding:'12px', fontSize:'12px', color:'#fb923c' }}>
              {ticket.duplicate_count} duplicate ticket{ticket.duplicate_count !== 1 ? 's' : ''} found for this ticket.
            </div>
          )}
        </div>

        {/* Linked info */}
        {ticket.incident_id && (
          <div>
            <div style={{ fontSize:'10px', color:'#3d5378', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:'10px' }}>Linked</div>
            <div style={{ background:'rgba(168,85,247,.06)', border:'1px solid rgba(168,85,247,.15)', borderRadius:'8px', padding:'12px', fontSize:'12px', color:'#a855f7' }}>
              Incident linked to this ticket.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── AI panel ──────────────────────────────────────────────────────────────────
function AIPanel({ ticket, onUseDraft }) {
  const [kbMatches, setKbMatches] = useState([]);
  const [suggestion, setSuggestion] = useState(null);
  const [loadingKB, setLoadingKB] = useState(true);
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    setKbMatches([]); setSuggestion(null); setDraft(''); setLoadingKB(true);

    getResolutionConfidence(ticket.ticket_id).then(r => {
      if (r.success && r.data?.top_matches) setKbMatches(r.data.top_matches.slice(0, 3));
      setLoadingKB(false);
    });

    getAISuggestion(ticket.ticket_id).then(r => {
      if (r.success && r.suggestion) {
        const s = r.suggestion;
        setSuggestion(s);
        const steps = (s.suggested_steps || []).slice(0, 3).map((st, i) => `${i+1}. ${st}`).join('\n');
        setDraft(`Hi ${ticket.creator_name || 'there'},\n\nWe've reviewed your request:\n${s.problem_summary || ''}\n\nRoot cause: ${s.probable_root_cause || 'Under investigation'}\n\n${steps}\n\nWe'll keep you updated.\n— Support Team`);
      }
    });
  }, [ticket.ticket_id]); // eslint-disable-line

  const matchColor = (score) => {
    const pct = score > 1 ? score : score * 100;
    if (pct >= 80) return '#34d399';
    if (pct >= 60) return '#facc15';
    return '#f87171';
  };
  const matchPct = (score) => `${Math.round(score > 1 ? score : score * 100)}%`;

  return (
    <div style={{ flex:'1.2', minWidth:'220px', overflowY:'auto', height:'100%' }}>
      <div style={{ padding:'14px' }}>

        {/* KB Suggestions */}
        <div style={{ marginBottom:'18px' }}>
          <div style={{ fontSize:'10px', color:'#3d5378', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:'10px' }}>KB Suggestions</div>
          {loadingKB ? (
            <div style={{ fontSize:'12px', color:'#3d5378' }}>Searching KB…</div>
          ) : kbMatches.length === 0 ? (
            <div style={{ fontSize:'12px', color:'#3d5378' }}>No KB matches found.</div>
          ) : kbMatches.map((m, i) => (
            <div key={i} style={{ background:'rgba(255,255,255,.03)', border:'1px solid #101828', borderRadius:'8px', padding:'10px', marginBottom:'8px' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px' }}>
                <button
                  onClick={() => onUseDraft && onUseDraft(m.resolution || '')}
                  style={{
                    height:'22px', padding:'0 10px', fontSize:'10.5px', borderRadius:'6px',
                    background:'rgba(52,211,153,.15)', border:'1px solid rgba(52,211,153,.3)',
                    color:'#34d399', fontWeight:700, cursor:'pointer', fontFamily:'inherit',
                  }}
                >Use this</button>
                <span style={{ fontSize:'11px', fontWeight:700, color: matchColor(m.similarity_score) }}>
                  {matchPct(m.similarity_score)} match
                </span>
              </div>
              <div style={{ fontSize:'12px', fontWeight:600, color:'#c9d8ee', marginBottom:'4px' }}>{m.title}</div>
              {m.resolution && (
                <div style={{ fontSize:'11px', color:'#3d5378', lineHeight:1.5, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
                  {m.resolution}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Similar past tickets from AI suggestion */}
        {suggestion && (
          <div style={{ marginBottom:'18px' }}>
            <div style={{ fontSize:'10px', color:'#3d5378', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:'10px' }}>AI Analysis</div>
            <div style={{ background:'rgba(168,85,247,.06)', border:'1px solid rgba(168,85,247,.15)', borderRadius:'8px', padding:'10px', marginBottom:'8px' }}>
              <div style={{ fontSize:'10px', color:'#a855f7', fontWeight:700, textTransform:'uppercase', marginBottom:'4px' }}>Problem</div>
              <div style={{ fontSize:'11.5px', color:'#c9d8ee', lineHeight:1.5 }}>{suggestion.problem_summary}</div>
            </div>
            {suggestion.probable_root_cause && (
              <div style={{ background:'rgba(255,255,255,.03)', border:'1px solid #101828', borderRadius:'8px', padding:'10px' }}>
                <div style={{ fontSize:'10px', color:'#3d5378', fontWeight:700, textTransform:'uppercase', marginBottom:'4px' }}>Root Cause</div>
                <div style={{ fontSize:'11.5px', color:'#c9d8ee', lineHeight:1.5 }}>{suggestion.probable_root_cause}</div>
              </div>
            )}
          </div>
        )}

        {/* Auto-generated reply draft */}
        {draft && (
          <div>
            <div style={{ fontSize:'10px', color:'#3d5378', textTransform:'uppercase', letterSpacing:'.07em', marginBottom:'10px' }}>Auto-generated Reply Draft</div>
            <div style={{ background:'rgba(79,142,247,.05)', border:'1px solid rgba(79,142,247,.15)', borderRadius:'8px', padding:'10px', marginBottom:'8px' }}>
              <div style={{ fontSize:'11.5px', color:'#c9d8ee', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{draft}</div>
            </div>
            <button
              onClick={() => { onUseDraft && onUseDraft(draft); setCopied(true); setTimeout(()=>setCopied(false), 2000); }}
              style={{
                width:'100%', height:'30px', borderRadius:'6px', fontSize:'11.5px', fontWeight:700,
                background:'rgba(79,142,247,.12)', border:'1px solid rgba(79,142,247,.25)',
                color: copied ? '#34d399' : '#4f8ef7', cursor:'pointer', fontFamily:'inherit',
              }}
            >
              {copied ? '✓ Copied to Reply' : 'Copy Draft to Reply'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
function TicketWorkspace() {
  const [tickets,    setTickets]    = useState([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selectedId, setSelectedId]  = useState(null);
  const [ticket,     setTicket]      = useState(null);
  const [me,         setMe]          = useState(null);
  const [workload,   setWorkload]    = useState(null);
  const [assignOpen, setAssignOpen]  = useState(false);
  const [replyInput, setReplyInput]  = useState(''); // shared state for "Use this" / draft copy

  useEffect(() => {
    getMe().then(r => { if (r.success) setMe(r.user); });
    getTeamMembersWorkload().then(r => { if (r.success) setWorkload(r.data); });

    getMe().then(r => {
      const params = {};
      if (r.user?.department_id) params.department_id = r.user.department_id;
      fetchTickets(params).then(res => {
        if (res.success && res.tickets?.length) {
          setTickets(res.tickets);
          setSelectedId(res.tickets[0].ticket_id);
          setTicket(res.tickets[0]);
        }
        setLoadingList(false);
      });
    });
  }, []);

  const loadTicket = useCallback((id) => {
    const fromList = tickets.find(t => t.ticket_id === id);
    if (fromList) setTicket(fromList);
    getTicket(id).then(r => { if (r.success) setTicket(r.ticket); });
  }, [tickets]);

  const handleSelect = (id) => {
    setSelectedId(id);
    loadTicket(id);
  };

  const handleReload = () => {
    if (selectedId) loadTicket(selectedId);
  };

  const deptMembers = workload?.department_members || [];

  if (loadingList) {
    return (
      <div className="page ff" style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
        <div style={{ color:'#3d5378', fontSize:'14px' }}>Loading workspace…</div>
      </div>
    );
  }

  if (tickets.length === 0) {
    return (
      <div className="page ff" style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
        <div style={{ color:'#3d5378', fontSize:'14px' }}>No tickets assigned to your team.</div>
      </div>
    );
  }

  return (
    <div className="ff" style={{ display:'flex', height:'calc(100vh - 108px)', overflow:'hidden', background:'var(--bg)', margin:'-24px' }}>
      {/* Ticket list sidebar */}
      <TicketSidebar
        tickets={tickets}
        selectedId={selectedId}
        onSelect={handleSelect}
        loading={loadingList}
      />

      {/* 3-panel workspace */}
      {ticket ? (
        <>
          <ConversationPanel
            ticket={ticket}
            me={me}
            workload={workload}
            onReload={handleReload}
          />
          <ActionsPanel
            ticket={ticket}
            workload={workload}
            onReload={handleReload}
            onAssignOpen={() => setAssignOpen(true)}
          />
          <AIPanel
            ticket={ticket}
            onUseDraft={(text) => { /* ConversationPanel handles its own input */ }}
          />
        </>
      ) : (
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#3d5378', fontSize:'14px' }}>
          Select a ticket to start working
        </div>
      )}

      {/* Assign modal */}
      {assignOpen && ticket && (
        <AssignModal
          ticket={ticket}
          members={deptMembers}
          onClose={() => setAssignOpen(false)}
          onDone={handleReload}
        />
      )}
    </div>
  );
}

export default TicketWorkspace;
