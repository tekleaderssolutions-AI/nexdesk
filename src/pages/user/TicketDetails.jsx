import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getTicket, getTicketTimeline, getAISuggestion,
  getResolutionConfidence,
  getTicketMessages, sendTicketMessage,
  acceptAIResolution, rejectAIResolution,
  getActionExecution, confirmAction,
  getAIResolutionData, submitTeamAIAction,
  getConversations, sendConversationMessage,
} from '../../services/ticketService';
import { useAuth } from '../../context/AuthContext';

// ── Constants ─────────────────────────────────────────────────────────────────

const PRIORITY_LABEL = { P1: 'P1 Critical', P2: 'P2 High', P3: 'P3 Medium', P4: 'P4 Low', P5: 'P5 Info' };
const PRIORITY_CLASS = { P1: 'p1', P2: 'p2', P3: 'p3', P4: 'p4', P5: 'p5' };

function statusClass(s) {
  const u = (s || '').toUpperCase();
  if (u === 'OPEN') return 's-open';
  if (u === 'IN_PROGRESS') return 's-prog';
  if (u === 'RESOLVED' || u === 'CLOSED') return 's-res';
  if (u === 'ESCALATED') return 's-esc';
  if (u === 'AI_RESOLVED') return 's-ai';
  if (u === 'AI_RESOLVED_PENDING_USER_CONFIRMATION' || u === 'AI_TEAM_REVIEW' || u === 'TEAM_APPROVED_AI_RESPONSE' || u === 'AI_ACTION_COMPLETED') return 's-ai-pend';
  if (u.includes('REOPEN')) return 's-reo';
  if (u.includes('PENDING') || u.includes('ON_HOLD')) return 's-pend';
  return 's-open';
}

function statusLabel(s) {
  const map = {
    IN_PROGRESS: 'In Progress',
    AI_RESOLVED: 'AI Resolved',
    AI_RESOLVED_PENDING_USER_CONFIRMATION: 'AI Solution Sent',
    AI_TEAM_REVIEW: 'AI Team Review',
    TEAM_APPROVED_AI_RESPONSE: 'Team Approved AI',
    AI_ACTION_COMPLETED: 'AI Action Taken',
    PENDING_ADMIN_REVIEW: 'Pending Review',
    OPEN: 'Open',
    RESOLVED: 'Resolved',
    ESCALATED: 'Escalated',
    CLOSED: 'Closed',
    REOPENED: 'Reopened',
    ON_HOLD: 'On Hold',
    ASSIGNED: 'Assigned',
  };
  return map[(s || '').toUpperCase()] || s;
}

function resolutionBadge(ticket) {
  const rt = (ticket.resolution_type || '').toUpperCase();
  if (rt === 'AI_AUTO_RESOLVE' || ticket.status === 'AI_RESOLVED_PENDING_USER_CONFIRMATION')
    return <span className="badge-ai-solved">⚡ Solved By AI</span>;
  if (rt === 'AI_TEAM_REVIEW' && ticket.status === 'TEAM_APPROVED_AI_RESPONSE')
    return <span className="badge-team-approved">✦ Team Approved AI Solution</span>;
  if (ticket.status === 'CLOSED' && ticket.closed_by_user && rt !== 'AI_AUTO_RESOLVE')
    return <span className="badge-human">👤 Human Resolution</span>;
  if (ticket.status === 'AI_TEAM_REVIEW')
    return <span className="badge-ai-review">⟳ AI Team Review</span>;
  return null;
}

function computeSLA(ticket) {
  if (!ticket?.created_at) return null;
  // Use backend-supplied SLA fields when available (from sla_rules DB table)
  if (ticket.sla_pct_elapsed != null) {
    const breached = !!ticket.sla_breached;
    const atRisk   = !!ticket.sla_at_risk;
    const pct      = ticket.sla_pct_elapsed ?? 0;
    const minLeft  = ticket.sla_minutes_remaining ?? 0;
    let text;
    if (breached) {
      text = 'SLA Breached';
    } else {
      const h = Math.floor(minLeft / 60);
      const m = minLeft % 60;
      text = h > 0 ? `${h}h ${m}m left` : `${m}m left`;
    }
    return { text, pct, breached, atRisk };
  }
  // Fallback (no SLA data yet)
  return null;
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return (
    dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' +
    dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) +
    ' UTC'
  );
}

// ── SidebarRow ────────────────────────────────────────────────────────────────

function SidebarRow({ label, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr', gap: '6px', alignItems: 'start' }}>
      <span style={{ fontSize: '11px', color: '#1e3047', paddingTop: '2px', lineHeight: 1.3 }}>{label}</span>
      <span style={{ fontSize: '12.5px', color: '#8499b5', lineHeight: 1.4 }}>{children}</span>
    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────

function TicketTimeline({ events }) {
  if (!events.length) return null;
  const dotColor = (src) => (src === 'lifecycle' ? '#34d399' : '#3b6fff');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {events.map((ev) => (
        <div key={ev.id} className="tl-item">
          <div className="tl-dot" style={{ background: dotColor(ev.source) }} />
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#1e3047', textTransform: 'uppercase', letterSpacing: '.04em' }}>{ev.event}</div>
          <div style={{ fontSize: '12px', color: '#c9d8ee', marginTop: '1px' }}>{ev.value}</div>
          <div style={{ fontSize: '10.5px', color: '#1e3047', marginTop: '1px' }}>
            by {ev.changed_by}{ev.created_at ? ` · ${new Date(ev.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── ConversationChat ──────────────────────────────────────────────────────────

function ConversationChat({ ticketId, currentUser, useConversations, subtitle }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [sending, setSending]   = useState(false);
  const bottomRef = useRef(null);
  const pollRef   = useRef(null);

  const loadMessages = () => {
    if (useConversations) {
      getConversations(ticketId).then((r) => { if (r.success) setMessages(r.messages); });
    } else {
      getTicketMessages(ticketId).then((r) => { if (r.success) setMessages(r.messages); });
    }
  };

  useEffect(() => {
    loadMessages();
    pollRef.current = setInterval(loadMessages, 5000);
    return () => clearInterval(pollRef.current);
  }, [ticketId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = async () => {
    const body = input.trim();
    if (!body || sending) return;
    setSending(true);
    const r = useConversations
      ? await sendConversationMessage(ticketId, body)
      : await sendTicketMessage(ticketId, body);
    if (r.success) {
      setInput('');
      const nm = r.message;
      const normalized = useConversations
        ? { id: nm.id, sender_id: nm.sender_id, sender_type: nm.sender_role, sender_name: nm.sender_name, message_body: nm.message, created_at: nm.created_at }
        : nm;
      setMessages((prev) => [...prev, normalized]);
    }
    setSending(false);
  };

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const getBody       = (m) => m.message_body || m.message || '';
  const getSenderType = (m) => m.sender_type  || m.sender_role || '';

  return (
    <div className="card">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>Live Conversation</span>
          {subtitle && (
            <span style={{ fontSize: '11px', color: '#3d5378', marginLeft: '8px' }}>{subtitle}</span>
          )}
        </div>
        <span style={{ width: '7px', height: '7px', background: '#34d399', borderRadius: '50%', display: 'inline-block', boxShadow: '0 0 6px #34d399' }} />
      </div>

      {/* Messages */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '120px', maxHeight: '300px', overflowY: 'auto', marginBottom: '14px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#1e3047', fontSize: '12.5px', padding: '24px 0' }}>No messages yet. Start the conversation!</div>
        )}
        {messages.map((m) => {
          const isMe  = m.sender_id === String(currentUser?.user_id);
          const stype = getSenderType(m);
          const isAI  = stype === 'AI';
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: '3px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '10.5px', color: '#1e3047' }}>
                {isAI && (
                  <span style={{ background: 'linear-gradient(135deg,#7c4dff,#3b6fff)', borderRadius: '3px', padding: '1px 4px', fontSize: '9px', color: '#fff', fontWeight: 700 }}>AI</span>
                )}
                <span>{isMe ? 'You' : (m.sender_name || (isAI ? 'AI Agent' : 'Support'))}</span>
                {m.created_at && <span>· {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
              </div>
              <div className={isMe ? 'msg-me' : 'msg-them'}>{getBody(m)}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: '7px', paddingTop: '12px', borderTop: '1px solid #101828' }}>
        <input
          className="inp"
          type="text"
          placeholder="Type a message…"
          style={{ flex: 1, height: '36px', fontSize: '12.5px' }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={sending}
        />
        <button className="btn-p" onClick={handleSend} disabled={sending || !input.trim()} style={{ height: '36px', padding: '0 16px' }}>
          Send
        </button>
      </div>
    </div>
  );
}

// ── AISummaryPanel ────────────────────────────────────────────────────────────

function AISummaryPanel({ ticketId, isInternal }) {
  const [suggestion, setSuggestion] = useState(null);
  useEffect(() => {
    getAISuggestion(ticketId).then((r) => { if (r.success) setSuggestion(r.suggestion); });
  }, [ticketId]);
  if (!suggestion) return null;

  const pct = suggestion.confidence ? Math.round(suggestion.confidence * 100) : null;

  return (
    <div className="card" style={{ background: 'linear-gradient(135deg,rgba(79,142,247,.05),rgba(12,18,32,.9))', borderColor: 'rgba(79,142,247,.18)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <div style={{ width: '20px', height: '20px', background: 'linear-gradient(135deg,#7c4dff,#3b6fff)', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="white"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10" /></svg>
        </div>
        <span style={{ fontSize: '11px', fontWeight: 700, color: '#4f8ef7', letterSpacing: '.06em', textTransform: 'uppercase' }}>
          AI SUMMARY{isInternal ? ' (INTERNAL)' : ''}
        </span>
        {pct && (
          <span style={{ marginLeft: 'auto', fontSize: '10.5px', fontWeight: 700, color: '#34d399', background: 'rgba(52,211,153,.1)', border: '1px solid rgba(52,211,153,.25)', padding: '1px 8px', borderRadius: '10px' }}>
            {pct}% confidence
          </span>
        )}
      </div>
      <p style={{ fontSize: '12.5px', color: '#8499b5', lineHeight: 1.7, margin: 0 }}>
        {suggestion.problem_summary}
        {suggestion.probable_root_cause && (
          <> Root cause: <em>{suggestion.probable_root_cause}</em>.</>
        )}
        {suggestion.recommended_escalation_team && (
          <> <strong style={{ color: '#c9d8ee' }}>Recommended action: Route to {suggestion.recommended_escalation_team}.</strong></>
        )}
      </p>
    </div>
  );
}

// ── SimilarCasesPanel ─────────────────────────────────────────────────────────

function SimilarCasesPanel({ ticketId }) {
  const [matches, setMatches] = useState([]);
  useEffect(() => {
    getResolutionConfidence(ticketId).then((r) => {
      if (r.success && r.data?.top_matches?.length) setMatches(r.data.top_matches.slice(0, 3));
    });
  }, [ticketId]);
  if (!matches.length) return null;

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <div style={{ width: '18px', height: '18px', background: 'linear-gradient(135deg,#7c4dff,#3b6fff)', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="white"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10" /></svg>
        </div>
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#e2e8f0' }}>AI — Similar Tickets</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {matches.map((m, i) => {
          const pct = Math.round(m.similarity_score || 0);
          const color = pct >= 85 ? '#34d399' : pct >= 65 ? '#fbbf24' : '#3d5378';
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: '#090d1a', borderRadius: '8px', border: '1px solid #101828' }}>
              <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                <div style={{ fontSize: '12.5px', color: '#4f8ef7', fontWeight: 600, marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.title}</div>
                <div style={{ fontSize: '11.5px', color: '#3d5378', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(m.resolution || '').slice(0, 90)}{(m.resolution || '').length > 90 ? '…' : ''}
                </div>
              </div>
              <span style={{ fontSize: '10.5px', fontWeight: 700, color, background: `${color}18`, border: `1px solid ${color}44`, padding: '2px 8px', borderRadius: '10px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                {pct}% match
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── L1: AIAutoResolvePanel ────────────────────────────────────────────────────

function AIAutoResolvePanel({ ticket, onAccept, onReject, busy }) {
  const [messages, setMessages] = useState([]);
  useEffect(() => {
    getTicketMessages(String(ticket.ticket_id)).then((r) => { if (r.success) setMessages(r.messages); });
  }, [ticket.ticket_id]);
  const aiMsg = messages.find((m) => m.sender_type === 'AI');
  const pct   = ticket.final_resolution_confidence ? Math.round(ticket.final_resolution_confidence) : null;

  return (
    <div className="card" style={{ borderColor: 'rgba(52,211,153,.3)', background: 'linear-gradient(135deg,rgba(52,211,153,.04),rgba(15,23,42,.6))' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
        <div style={{ width: '36px', height: '36px', background: 'rgba(52,211,153,.15)', border: '1px solid rgba(52,211,153,.3)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>✦</div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#34d399' }}>Solved By AI</div>
            {pct && <span style={{ fontSize: '11px', color: '#059669', background: 'rgba(5,150,105,.1)', border: '1px solid rgba(5,150,105,.2)', padding: '1px 7px', borderRadius: '10px' }}>{pct}% confidence</span>}
          </div>
          <div style={{ fontSize: '11.5px', color: '#3d5378' }}>Our AI found a matching solution in the knowledge base.</div>
        </div>
        <span className="badge-ai-solved">⚡ Solved By AI</span>
      </div>
      {aiMsg && (
        <div className="ai-panel" style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
            <div style={{ width: '15px', height: '15px', background: 'linear-gradient(135deg,#7c4dff,#3b6fff)', borderRadius: '3px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><polygon points="13,2 3,14 12,14 11,22 21,10 12,10" /></svg>
            </div>
            <span style={{ fontSize: '10px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '.06em' }}>AI Resolution</span>
          </div>
          <p style={{ fontSize: '12.5px', color: '#c9d8ee', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{aiMsg.message_body}</p>
        </div>
      )}
      <div style={{ height: '1px', background: '#101828', margin: '14px 0' }} />
      <p style={{ fontSize: '11.5px', color: '#3d5378', margin: '0 0 14px', lineHeight: 1.6 }}>
        Did this solution resolve your issue? Accept to close the ticket or request human assistance.
      </p>
      <div style={{ display: 'flex', gap: '10px' }}>
        <button className="btn-p" onClick={onAccept} disabled={busy} style={{ flex: 1, justifyContent: 'center', background: '#059669' }}>
          {busy ? '…' : '✓ Accept Resolution'}
        </button>
        <button className="btn-s" onClick={onReject} disabled={busy} style={{ flex: 1, justifyContent: 'center', color: '#fb923c', borderColor: 'rgba(249,115,22,.25)' }}>
          {busy ? '…' : '✕ Need Human Assistance'}
        </button>
      </div>
    </div>
  );
}

// ── L2: TeamApprovedPanel ─────────────────────────────────────────────────────

function TeamApprovedPanel({ ticket, onAccept, onNeedHelp, busy }) {
  const [messages, setMessages] = useState([]);
  useEffect(() => {
    getTicketMessages(String(ticket.ticket_id)).then((r) => { if (r.success) setMessages(r.messages); });
  }, [ticket.ticket_id]);
  const teamMsg = messages.filter((m) => m.sender_type === 'TEAM').slice(-1)[0];

  return (
    <div className="card" style={{ borderColor: 'rgba(79,142,247,.3)', background: 'linear-gradient(135deg,rgba(79,142,247,.04),rgba(15,23,42,.6))' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
        <div style={{ width: '36px', height: '36px', background: 'rgba(79,142,247,.15)', border: '1px solid rgba(79,142,247,.3)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>✦</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#4f8ef7', marginBottom: '3px' }}>Team Approved AI Solution</div>
          <div style={{ fontSize: '11.5px', color: '#3d5378' }}>Your support team reviewed and approved the AI-suggested resolution.</div>
        </div>
        <span className="badge-team-approved">✦ Team Approved</span>
      </div>
      {teamMsg && (
        <div className="ai-panel" style={{ marginBottom: '14px', borderColor: 'rgba(79,142,247,.2)' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#4f8ef7', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '8px' }}>Approved Resolution</div>
          <p style={{ fontSize: '12.5px', color: '#c9d8ee', lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{teamMsg.message_body}</p>
        </div>
      )}
      <div style={{ height: '1px', background: '#101828', margin: '14px 0' }} />
      <div style={{ display: 'flex', gap: '10px' }}>
        <button className="btn-p" onClick={onAccept} disabled={busy} style={{ flex: 1, justifyContent: 'center', background: '#059669' }}>
          {busy ? '…' : '✓ Accept Resolution'}
        </button>
        <button className="btn-s" onClick={onNeedHelp} disabled={busy} style={{ flex: 1, justifyContent: 'center', color: '#fb923c', borderColor: 'rgba(249,115,22,.25)' }}>
          {busy ? '…' : '✕ Need Further Help'}
        </button>
      </div>
    </div>
  );
}

// ── Closed Panel ──────────────────────────────────────────────────────────────

function ClosedPanel({ ticket }) {
  const rt    = (ticket.resolution_type || '').toUpperCase();
  const byAI  = rt === 'AI_AUTO_RESOLVE';
  const byTeamAI = rt === 'AI_TEAM_REVIEW';
  return (
    <div className="card" style={{ borderColor: 'rgba(52,211,153,.2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{ fontSize: '20px' }}>✓</span>
        <div style={{ fontSize: '14px', fontWeight: 700, color: '#34d399' }}>Ticket Closed</div>
        {byAI     && <span className="badge-ai-solved" style={{ marginLeft: 'auto' }}>⚡ Solved By AI</span>}
        {byTeamAI && <span className="badge-team-approved" style={{ marginLeft: 'auto' }}>✦ Team Approved AI Solution</span>}
        {!byAI && !byTeamAI && <span className="badge-human" style={{ marginLeft: 'auto' }}>👤 Human Resolution</span>}
      </div>
      <p style={{ fontSize: '12.5px', color: '#3d5378', margin: 0, lineHeight: 1.65 }}>
        {byAI ? 'You accepted the AI-generated resolution. This ticket is now closed.'
          : byTeamAI ? 'You accepted the team-approved AI solution. This ticket is now closed.'
          : 'This ticket has been closed. If you need further assistance, please open a new ticket.'}
      </p>
    </div>
  );
}

// ── Team AI Review Panel ──────────────────────────────────────────────────────

function TeamAIReviewPanel({ ticket, onActionDone }) {
  const [aiData, setAiData] = useState(null);
  const [mode, setMode]     = useState('view');
  const [editText, setEditText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg]   = useState('');

  useEffect(() => {
    getAIResolutionData(String(ticket.ticket_id)).then((r) => { if (r.success) setAiData(r.data); });
  }, [ticket.ticket_id]);

  const handleAction = async (action) => {
    setBusy(true);
    const solution = action === 'EDIT' ? editText.trim() : null;
    if (action === 'EDIT' && !solution) { setBusy(false); return; }
    const r = await submitTeamAIAction(String(ticket.ticket_id), action, solution);
    if (r.success) {
      const labels = { APPROVE: 'Solution approved and sent to user.', EDIT: 'Edited solution sent to user.', REJECT: 'AI suggestion rejected — ticket moved to In Progress.' };
      setMsg(labels[action] || 'Done.');
      onActionDone();
    } else { setMsg(r.message || 'Action failed.'); setBusy(false); }
  };

  if (msg) return <div className="card" style={{ borderColor: 'rgba(168,85,247,.2)' }}><div style={{ fontSize: '13px', fontWeight: 600, color: '#a855f7' }}>{msg}</div></div>;

  return (
    <div className="ai-review-panel" style={{ marginBottom: '0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <div style={{ width: '30px', height: '30px', background: 'rgba(168,85,247,.15)', border: '1px solid rgba(168,85,247,.3)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>⟳</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#a855f7' }}>AI Suggested Resolution — Team Review Required</div>
          <div style={{ fontSize: '11px', color: '#3d5378' }}>Review this AI-generated suggestion before sending it to the user</div>
        </div>
        {ticket.final_resolution_confidence && (
          <span style={{ fontSize: '11px', color: '#a855f7', background: 'rgba(168,85,247,.1)', border: '1px solid rgba(168,85,247,.2)', padding: '2px 8px', borderRadius: '10px' }}>
            {Math.round(ticket.final_resolution_confidence)}% confidence
          </span>
        )}
      </div>

      {aiData?.original_ai_solution && mode === 'view' && (
        <div style={{ background: 'rgba(0,0,0,.25)', border: '1px solid rgba(168,85,247,.15)', borderRadius: '8px', padding: '12px', marginBottom: '12px', fontSize: '12.5px', color: '#c9d8ee', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
          {aiData.original_ai_solution}
        </div>
      )}

      {mode === 'edit' && (
        <div style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', color: '#a855f7', fontWeight: 600, marginBottom: '6px' }}>Edit AI Solution before sending:</div>
          <textarea className="inp" rows={8} style={{ width: '100%', fontSize: '12.5px', lineHeight: 1.65, resize: 'vertical' }}
            value={editText} onChange={(e) => setEditText(e.target.value)} />
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {mode === 'view' ? (
          <>
            <button className="btn-p" onClick={() => handleAction('APPROVE')} disabled={busy} style={{ background: '#059669' }}>
              {busy ? '…' : '✓ Approve — Send to User'}
            </button>
            <button className="btn-s" onClick={() => { setEditText(aiData?.original_ai_solution || ''); setMode('edit'); }} disabled={busy} style={{ color: '#4f8ef7', borderColor: 'rgba(79,142,247,.25)' }}>
              ✎ Edit Solution
            </button>
            <button className="btn-s" onClick={() => handleAction('REJECT')} disabled={busy} style={{ color: '#f87171', borderColor: 'rgba(239,68,68,.2)' }}>
              ✕ Reject
            </button>
          </>
        ) : (
          <>
            <button className="btn-p" onClick={() => handleAction('EDIT')} disabled={busy || !editText.trim()} style={{ background: '#059669' }}>
              {busy ? '…' : '✓ Send Edited Solution'}
            </button>
            <button className="btn-s" onClick={() => setMode('view')} disabled={busy}>← Back</button>
          </>
        )}
      </div>
    </div>
  );
}

// ── AI Action Panel ───────────────────────────────────────────────────────────

function AIActionPanel({ ticket, execution, onConfirm, busy }) {
  return (
    <div className="card" style={{ borderColor: 'rgba(59,130,246,.3)', background: 'linear-gradient(135deg,rgba(59,130,246,.04),rgba(12,18,32,.8))' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '16px' }}>
        <div style={{ width: '36px', height: '36px', background: 'rgba(59,130,246,.15)', border: '1px solid rgba(59,130,246,.3)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>⚡</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '14px', fontWeight: 700, color: '#60a5fa', marginBottom: '3px' }}>Automated Action Performed</div>
          <div style={{ fontSize: '11.5px', color: '#3d5378' }}>Our AI automatically performed an action to resolve your issue.</div>
        </div>
      </div>
      {execution && (
        <div style={{ padding: '12px 14px', background: 'rgba(59,130,246,.06)', border: '1px solid rgba(59,130,246,.12)', borderRadius: '10px', marginBottom: '12px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '6px' }}>Action Details</div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '4px' }}>{execution.action_summary || execution.operation_id}</div>
          {execution.confidence && <div style={{ fontSize: '11px', color: '#3d5378' }}>Confidence: {Math.round(execution.confidence)}%</div>}
        </div>
      )}
      <div style={{ display: 'flex', gap: '10px' }}>
        <button className="btn-p" onClick={() => onConfirm(true)} disabled={busy} style={{ flex: 1, justifyContent: 'center', background: '#059669' }}>
          {busy ? '…' : '✓ Yes, Issue Resolved'}
        </button>
        <button className="btn-s" onClick={() => onConfirm(false)} disabled={busy} style={{ flex: 1, justifyContent: 'center', color: '#fb923c', borderColor: 'rgba(249,115,22,.25)' }}>
          {busy ? '…' : '✕ Still Having Issues'}
        </button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

function TicketDetails() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const [ticket, setTicket]   = useState(null);
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMsg, setActionMsg]   = useState('');
  const [execution, setExecution]   = useState(null);

  const role    = (user?.role || '').toUpperCase();
  const isUser  = role === 'USER' || role === '';
  const isTeam  = role === 'TEAM';
  const isAdmin = role === 'ADMIN';

  const loadTicket = () => {
    getTicket(id).then((r) => {
      if (r.success) setTicket(r.ticket);
      else setError(r.message || 'Ticket not found');
      setLoading(false);
    });
    getTicketTimeline(id).then((r) => { if (r.success) setEvents(r.events || []); });
  };

  useEffect(() => {
    let mounted = true;
    getTicket(id).then((r) => {
      if (!mounted) return;
      if (r.success) setTicket(r.ticket);
      else setError(r.message || 'Ticket not found');
      setLoading(false);
    });
    getTicketTimeline(id).then((r) => { if (r.success) setEvents(r.events || []); });
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    if (ticket?.status === 'AI_ACTION_COMPLETED') {
      getActionExecution(ticket.ticket_id).then((r) => { if (r.success) setExecution(r.data); });
    }
  }, [ticket?.ticket_id, ticket?.status]);

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px', color: '#3d5378', fontSize: '13px' }}>
      Loading ticket…
    </div>
  );
  if (error || !ticket) return (
    <div className="page"><div className="card" style={{ padding: '40px' }}>
      <div style={{ fontSize: '15px', fontWeight: 600, color: '#e2e8f0', marginBottom: '8px' }}>Ticket not found</div>
      <div style={{ fontSize: '12.5px', color: '#3d5378' }}>{error}</div>
    </div></div>
  );

  const prio            = (ticket.priority || '').toUpperCase();
  const st              = (ticket.status   || '').toUpperCase();
  const isHighPriority  = prio === 'P1' || prio === 'P2';
  const isClosed        = st === 'CLOSED';
  const isAITeamReview  = st === 'AI_TEAM_REVIEW';
  const isPendingAI     = st === 'AI_RESOLVED_PENDING_USER_CONFIRMATION';
  const isTeamApproved  = st === 'TEAM_APPROVED_AI_RESPONSE';
  const isAIAction      = st === 'AI_ACTION_COMPLETED';

  const sla = computeSLA(ticket);

  const handleAcceptAI = async () => {
    setActionBusy(true);
    const r = await acceptAIResolution(ticket.ticket_id);
    if (r.success) { setActionMsg('Ticket closed successfully. Thank you!'); loadTicket(); }
    else setActionBusy(false);
  };
  const handleRejectAI = async () => {
    setActionBusy(true);
    const r = await rejectAIResolution(ticket.ticket_id);
    if (r.success) { setActionMsg('Got it — a support agent will follow up.'); loadTicket(); }
    else setActionBusy(false);
  };
  const handleConfirmAction = async (resolved) => {
    setActionBusy(true);
    const r = await confirmAction(ticket.ticket_id, resolved);
    if (r.success) { setActionMsg(resolved ? 'Great! Ticket closed.' : 'Understood — a support agent will be assigned shortly.'); loadTicket(); }
    else setActionBusy(false);
  };

  return (
    <div className="page ff">

      {/* ── Header breadcrumb ── */}
      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', color: '#3d5378', fontSize: '12.5px', cursor: 'pointer', padding: 0, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}
        >
          ← Back
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#4f8ef7' }}>{ticket.ticket_no}</span>
          <span className={`b ${PRIORITY_CLASS[prio] || 'p4'}`}>● {PRIORITY_LABEL[prio] || prio}</span>
          <span className={`b ${statusClass(ticket.status)}`}>{statusLabel(ticket.status)}</span>
          {ticket.major_incident_flag && (
            <span style={{ background: 'rgba(239,68,68,.1)', color: '#f87171', border: '1px solid rgba(239,68,68,.25)', padding: '2px 9px', borderRadius: '5px', fontSize: '10.5px', fontWeight: 700, letterSpacing: '.03em' }}>
              🔴 LIVE INCIDENT
            </span>
          )}
          {ticket.parent_ticket_no && (
            <span style={{ background: '#090d1a', color: '#4f8ef7', border: '1px solid #101828', padding: '2px 8px', borderRadius: '5px', fontSize: '10.5px', fontWeight: 600 }}>
              {ticket.parent_ticket_no} →
            </span>
          )}
          {isPendingAI && (
            <span style={{ fontSize: '11px', color: '#34d399', background: 'rgba(52,211,153,.08)', padding: '2px 8px', borderRadius: '5px', border: '1px solid rgba(52,211,153,.2)' }}>
              Action required
            </span>
          )}
        </div>

        <h1 className="ff" style={{ fontSize: '17px', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>
          {ticket.subject}
        </h1>
      </div>

      {/* ── Two-column layout ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 270px', gap: '16px', alignItems: 'start' }}>

        {/* ── Left main column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* AI Summary — all roles see this when suggestion exists */}
          <AISummaryPanel ticketId={id} isInternal={isTeam || isAdmin} />

          {/* Team/Admin: review panel when in AI_TEAM_REVIEW */}
          {(isTeam || isAdmin) && isAITeamReview && (
            <TeamAIReviewPanel ticket={ticket} onActionDone={loadTicket} />
          )}

          {/* User: status-specific panels */}
          {isUser && actionMsg && (
            <div className="card" style={{ borderColor: 'rgba(52,211,153,.2)' }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#34d399' }}>{actionMsg}</div>
            </div>
          )}

          {isUser && !actionMsg && isPendingAI && (
            <AIAutoResolvePanel ticket={ticket} onAccept={handleAcceptAI} onReject={handleRejectAI} busy={actionBusy} />
          )}

          {isUser && !actionMsg && isTeamApproved && (
            <TeamApprovedPanel ticket={ticket} onAccept={handleAcceptAI} onNeedHelp={handleRejectAI} busy={actionBusy} />
          )}

          {isUser && isAIAction && (
            <AIActionPanel ticket={ticket} execution={execution} onConfirm={handleConfirmAction} busy={actionBusy} />
          )}

          {isUser && isAITeamReview && (
            <div className="card" style={{ borderColor: 'rgba(168,85,247,.2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '18px' }}>⟳</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#a855f7' }}>Team is Reviewing Your Case</span>
                <span className="badge-ai-review" style={{ marginLeft: 'auto' }}>⟳ AI Team Review</span>
              </div>
              <p style={{ fontSize: '12.5px', color: '#3d5378', lineHeight: 1.65, margin: 0 }}>
                Our AI found a potential solution. Your support team is currently reviewing it before sending it to you.
              </p>
            </div>
          )}

          {isUser && isClosed && <ClosedPanel ticket={ticket} />}

          {isUser && !ticket.assigned_team_id && !isPendingAI && !isTeamApproved && !isClosed && !isAIAction && !isAITeamReview && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span style={{ fontSize: '18px' }}>⏳</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>We're working on your request</span>
              </div>
              <p style={{ fontSize: '12.5px', color: '#3d5378', lineHeight: 1.65, margin: 0 }}>
                Your ticket has been received and is under review. Once a team is assigned, you'll be able to chat with them here.
              </p>
            </div>
          )}

          {/* Live Conversation — shown when team is assigned */}
          {(ticket.assigned_team_id || isTeam || isAdmin) && !isClosed && (
            <ConversationChat
              ticketId={String(ticket.ticket_id)}
              currentUser={user}
              useConversations={isHighPriority}
              subtitle={isHighPriority ? `P${prio.slice(1)} — real-time chat enabled` : 'chat with your support team'}
            />
          )}

          {/* Similar KB cases */}
          <SimilarCasesPanel ticketId={id} />

          {/* Description */}
          <div className="card">
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#1e3047', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '10px' }}>Description</div>
            <p style={{ fontSize: '13px', color: '#8499b5', lineHeight: 1.75, margin: 0 }}>{ticket.description || '—'}</p>
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Ticket Detail card */}
          <div className="card">
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#1e3047', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '14px' }}>Ticket Detail</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
              <SidebarRow label="Status">
                <span className={`b ${statusClass(ticket.status)}`}>{statusLabel(ticket.status)}</span>
              </SidebarRow>

              <SidebarRow label="Priority">
                <span className={`b ${PRIORITY_CLASS[prio] || 'p4'}`}>● {PRIORITY_LABEL[prio] || prio}</span>
              </SidebarRow>

              {ticket.category_name && (
                <SidebarRow label="Category">{ticket.category_name}</SidebarRow>
              )}

              {ticket.assigned_team_name && (
                <SidebarRow label="Team">{ticket.assigned_team_name}</SidebarRow>
              )}

              {ticket.department_name && (
                <SidebarRow label="Dept">{ticket.department_name}</SidebarRow>
              )}

              {ticket.parent_ticket_no && (
                <SidebarRow label="Incident">
                  <span style={{ color: '#4f8ef7' }}>{ticket.parent_ticket_no}</span>
                </SidebarRow>
              )}

              <SidebarRow label="Created">{fmtDate(ticket.created_at)}</SidebarRow>

              {isClosed && ticket.closed_at && (
                <SidebarRow label="Closed">
                  <span style={{ color: '#34d399' }}>{fmtDate(ticket.closed_at)}</span>
                </SidebarRow>
              )}
            </div>

            {/* SLA bar */}
            {sla && !isClosed && (
              <>
                <div style={{ height: '1px', background: '#101828', margin: '14px 0' }} />
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#1e3047', textTransform: 'uppercase', letterSpacing: '.07em' }}>SLA</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: sla.breached ? '#f87171' : sla.atRisk ? '#fb923c' : '#e2e8f0' }}>{sla.text}</span>
                  </div>
                  <div style={{ height: '4px', background: '#101828', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${sla.pct}%`,
                      background: sla.breached ? '#f87171' : sla.atRisk ? '#fb923c' : '#34d399',
                      borderRadius: '2px',
                      transition: 'width .3s',
                    }} />
                  </div>
                  {ticket.sla_deadline && (
                    <div style={{ fontSize: '10.5px', color: '#1e3047', marginTop: '5px' }}>
                      Due {new Date(ticket.sla_deadline).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* AI confidence */}
            {ticket.final_resolution_confidence && (
              <>
                <div style={{ height: '1px', background: '#101828', margin: '14px 0' }} />
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#1e3047', textTransform: 'uppercase', letterSpacing: '.07em' }}>AI Confidence</span>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#a78bfa' }}>{Math.round(ticket.final_resolution_confidence)}%</span>
                  </div>
                  <div style={{ height: '4px', background: '#101828', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, Math.round(ticket.final_resolution_confidence))}%`, background: '#7c4dff', borderRadius: '2px' }} />
                  </div>
                </div>
              </>
            )}

            {/* Resolution type badge */}
            {(ticket.resolution_type || isClosed) && resolutionBadge(ticket) && (
              <>
                <div style={{ height: '1px', background: '#101828', margin: '14px 0' }} />
                {resolutionBadge(ticket)}
              </>
            )}
          </div>

          {/* Activity timeline */}
          {events.length > 0 && (
            <div className="card">
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#1e3047', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '12px' }}>Activity</div>
              <TicketTimeline events={events.slice(0, 6)} />
            </div>
          )}

          {/* Attachments placeholder */}
          <div className="card">
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#1e3047', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '12px' }}>Attachments</div>
            <div style={{ fontSize: '12px', color: '#1e3047' }}>No attachments</div>
          </div>

          {/* User actions */}
          {isUser && !isClosed && !isPendingAI && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
              <button className="btn-s" style={{ width: '100%', justifyContent: 'center', fontSize: '12.5px' }}>
                ↺ Reopen Ticket
              </button>
              <button className="btn-s" style={{ width: '100%', justifyContent: 'center', fontSize: '12.5px', color: '#f87171', borderColor: 'rgba(239,68,68,.22)' }}>
                ⚠ Flag as Urgent
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default TicketDetails;
