import { useEffect, useState } from 'react';
import api from '../../services/api';

const BASE = 'http://127.0.0.1:8000/admin';

const RISK_CLASS = { LOW: 'p4', MEDIUM: 'p2', HIGH: 'p1' };

const PARAM_SOURCES = [
  { value: 'ticket_creator_email', label: 'Ticket creator email' },
  { value: 'ticket_creator_name',  label: 'Ticket creator name' },
  { value: 'ticket_id',            label: 'Ticket ID (UUID)' },
  { value: 'organization_id',      label: 'Organization ID' },
  { value: 'llm_extract',          label: 'LLM-extracted from ticket text' },
];

// ── Blank templates ────────────────────────────────────────────────────────────

const blankParam = () => ({ name: '', in: 'body', required: false, source: 'llm_extract', description: '' });
const blankOp    = () => ({
  operation_id: '', http_method: 'POST', path: '', summary: '', description: '',
  risk_level: 'LOW', side_effects: '', parameters: [blankParam()],
});
const blankTool  = () => ({
  name: '', description: '', base_url: '', auth_type: 'none',
  auth_config: { token: '', key: '', header: 'X-API-Key', username: '', password: '' },
  operations: [blankOp()],
});

// ── Sub-components ─────────────────────────────────────────────────────────────

function RiskBadge({ level }) {
  const cls = RISK_CLASS[level] || 'p3';
  return <span className={`b ${cls}`}>{level}</span>;
}

function ToolCard({ tool, onSelect, selected }) {
  return (
    <div
      className="card"
      onClick={() => onSelect(tool)}
      style={{
        cursor: 'pointer',
        borderColor: selected ? 'rgba(168,85,247,.4)' : undefined,
        background: selected ? 'linear-gradient(135deg,rgba(168,85,247,.06),rgba(12,18,32,.8))' : undefined,
        transition: 'border-color .15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>{tool.name}</div>
          <div style={{ fontSize: '11px', color: '#3d5378', marginTop: '2px' }}>{tool.base_url}</div>
        </div>
        <span className={`b ${tool.is_active ? 's-res' : 's-pend'}`}>{tool.is_active ? 'Active' : 'Inactive'}</span>
      </div>
      {tool.description && (
        <div style={{ fontSize: '12px', color: '#8499b5', marginBottom: '8px' }}>{tool.description}</div>
      )}
      <div style={{ display: 'flex', gap: '10px', fontSize: '11px', color: '#3d5378' }}>
        <span>{tool.operation_count} operation{tool.operation_count !== 1 ? 's' : ''}</span>
        <span>auth: {tool.auth_type}</span>
      </div>
    </div>
  );
}

function OperationRow({ op, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ border: '1px solid #101828', borderRadius: '8px', overflow: 'hidden', marginBottom: '8px' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', background: '#090d1a' }}
        onClick={() => setExpanded(e => !e)}
      >
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#3d5378', background: '#0c1220', padding: '2px 6px', borderRadius: '4px', border: '1px solid #101828' }}>{op.http_method}</span>
        <span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#8499b5', flex: 1 }}>{op.path}</span>
        <RiskBadge level={op.risk_level} />
        <span style={{ fontSize: '11px', color: '#3d5378' }}>{op.operation_id}</span>
        <button
          className="btn-s"
          style={{ height: '26px', padding: '0 8px', fontSize: '11px', color: '#f87171', borderColor: 'rgba(239,68,68,.2)' }}
          onClick={e => { e.stopPropagation(); onDelete(op.id); }}
        >Remove</button>
        <span style={{ color: '#3d5378', fontSize: '13px' }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid #101828' }}>
          {op.summary && <div style={{ fontSize: '12.5px', color: '#c9d8ee', marginBottom: '6px' }}>{op.summary}</div>}
          {op.description && <div style={{ fontSize: '12px', color: '#8499b5', marginBottom: '8px' }}>{op.description}</div>}
          {op.side_effects?.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#3d5378', textTransform: 'uppercase', marginBottom: '4px' }}>Side Effects</div>
              {op.side_effects.map((s, i) => <div key={i} style={{ fontSize: '11.5px', color: '#6d52cc' }}>• {s}</div>)}
            </div>
          )}
          {op.parameters?.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: 700, color: '#3d5378', textTransform: 'uppercase', marginBottom: '4px' }}>Parameters</div>
              <table className="tbl" style={{ fontSize: '11.5px' }}>
                <thead><tr><th>Name</th><th>In</th><th>Required</th><th>Source</th><th>Description</th></tr></thead>
                <tbody>
                  {op.parameters.map((p, i) => (
                    <tr key={i}>
                      <td className="bright">{p.name}</td>
                      <td>{p.in}</td>
                      <td>{p.required ? 'Yes' : 'No'}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '11px', color: '#a78bfa' }}>{p.source || 'llm_extract'}</td>
                      <td>{p.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ParameterBuilder({ params, onChange }) {
  const add    = () => onChange([...params, blankParam()]);
  const remove = (i) => onChange(params.filter((_, j) => j !== i));
  const update = (i, field, val) => {
    const next = [...params];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  return (
    <div>
      {params.map((p, i) => (
        <div key={i} style={{ background: '#090d1a', border: '1px solid #101828', borderRadius: '6px', padding: '10px', marginBottom: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 80px', gap: '6px', marginBottom: '6px' }}>
            <input className="inp" placeholder="name" style={{ height: '30px', fontSize: '12px' }} value={p.name} onChange={e => update(i, 'name', e.target.value)} />
            <select className="sel" style={{ height: '30px', fontSize: '12px' }} value={p.in} onChange={e => update(i, 'in', e.target.value)}>
              <option value="path">path</option>
              <option value="query">query</option>
              <option value="body">body</option>
            </select>
            <select className="sel" style={{ height: '30px', fontSize: '12px' }} value={p.required ? 'true' : 'false'} onChange={e => update(i, 'required', e.target.value === 'true')}>
              <option value="false">optional</option>
              <option value="true">required</option>
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '6px' }}>
            <select className="sel" style={{ height: '30px', fontSize: '12px' }} value={p.source || 'llm_extract'} onChange={e => update(i, 'source', e.target.value)}>
              {PARAM_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              <option value="static:">static value…</option>
            </select>
            <input className="inp" placeholder="description (optional)" style={{ height: '30px', fontSize: '12px' }} value={p.description || ''} onChange={e => update(i, 'description', e.target.value)} />
            <button className="btn-s" onClick={() => remove(i)} style={{ height: '30px', padding: '0 8px', fontSize: '11px', color: '#f87171', borderColor: 'rgba(239,68,68,.2)' }}>×</button>
          </div>
          {(p.source || '').startsWith('static:') && (
            <input className="inp" placeholder="static value" style={{ height: '30px', fontSize: '12px', marginTop: '6px', width: '100%' }}
              value={(p.source || '').slice(7)}
              onChange={e => update(i, 'source', `static:${e.target.value}`)}
            />
          )}
        </div>
      ))}
      <button className="btn-s" onClick={add} style={{ fontSize: '12px', height: '30px', padding: '0 12px' }}>+ Add Parameter</button>
    </div>
  );
}

function OperationBuilder({ ops, onChange }) {
  const add    = () => onChange([...ops, blankOp()]);
  const remove = (i) => onChange(ops.filter((_, j) => j !== i));
  const update = (i, field, val) => {
    const next = [...ops];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  return (
    <div>
      {ops.map((op, i) => (
        <div key={i} style={{ border: '1px solid rgba(168,85,247,.2)', borderRadius: '8px', padding: '14px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#a78bfa' }}>Operation {i + 1}</span>
            {ops.length > 1 && <button className="btn-s" onClick={() => remove(i)} style={{ height: '26px', padding: '0 8px', fontSize: '11px', color: '#f87171', borderColor: 'rgba(239,68,68,.2)' }}>Remove</button>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px', gap: '8px', marginBottom: '8px' }}>
            <input className="inp" placeholder="operationId (e.g. resetUserPassword)" style={{ height: '32px' }} value={op.operation_id} onChange={e => update(i, 'operation_id', e.target.value)} />
            <select className="sel" style={{ height: '32px' }} value={op.http_method} onChange={e => update(i, 'http_method', e.target.value)}>
              {['GET','POST','PUT','PATCH','DELETE'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <input className="inp" placeholder="Path (e.g. /api/users/{user_email}/reset-password)" style={{ width: '100%', height: '32px', marginBottom: '8px', fontFamily: 'monospace', fontSize: '12px' }} value={op.path} onChange={e => update(i, 'path', e.target.value)} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '8px', marginBottom: '8px' }}>
            <input className="inp" placeholder="Summary" style={{ height: '32px' }} value={op.summary} onChange={e => update(i, 'summary', e.target.value)} />
            <select className="sel" style={{ height: '32px' }} value={op.risk_level} onChange={e => update(i, 'risk_level', e.target.value)}>
              <option value="LOW">LOW</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="HIGH">HIGH</option>
            </select>
          </div>
          <textarea className="inp" placeholder="Description" rows={2} style={{ width: '100%', resize: 'none', marginBottom: '8px', fontSize: '12px' }} value={op.description} onChange={e => update(i, 'description', e.target.value)} />
          <input className="inp" placeholder="Side effects (comma-separated, e.g. Sends email to user, Logs out sessions)" style={{ width: '100%', height: '32px', marginBottom: '10px', fontSize: '12px' }} value={op.side_effects} onChange={e => update(i, 'side_effects', e.target.value)} />
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#3d5378', textTransform: 'uppercase', marginBottom: '6px' }}>Parameters</div>
          <ParameterBuilder params={op.parameters || []} onChange={v => update(i, 'parameters', v)} />
        </div>
      ))}
      <button className="btn-s" onClick={add} style={{ fontSize: '12px', height: '32px', padding: '0 14px' }}>+ Add Operation</button>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

function AdminTools() {
  const [tools, setTools]       = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(blankTool());
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [catalog, setCatalog]   = useState([]);

  const loadTools = () =>
    api.get(`${BASE}/tools`).then(r => setTools(r.data)).catch(() => {});

  const loadSelected = (t) =>
    api.get(`${BASE}/tools/${t.id}`).then(r => setSelected(r.data)).catch(() => {});

  const loadCatalog = () =>
    api.get(`${BASE}/tools/catalog/active`).then(r => setCatalog(r.data)).catch(() => {});

  useEffect(() => { loadTools(); loadCatalog(); }, []);

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        operations: (form.operations || []).map(op => ({
          ...op,
          side_effects: typeof op.side_effects === 'string'
            ? op.side_effects.split(',').map(s => s.trim()).filter(Boolean)
            : op.side_effects,
          parameters: op.parameters || [],
        })),
      };
      await api.post(`${BASE}/tools`, payload);
      setShowForm(false);
      setForm(blankTool());
      loadTools();
      loadCatalog();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to save tool');
    }
    setSaving(false);
  };

  const handleDeactivate = async (id) => {
    if (!window.confirm('Deactivate this tool? Its operations will no longer be available to the AI engine.')) return;
    await api.delete(`${BASE}/tools/${id}`).catch(() => {});
    setSelected(null);
    loadTools();
    loadCatalog();
  };

  const handleDeleteOp = async (opId) => {
    if (!selected) return;
    await api.delete(`${BASE}/tools/${selected.id}/operations/${opId}`).catch(() => {});
    loadSelected(selected);
    loadCatalog();
  };

  return (
    <div className="page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
        <div>
          <h1 className="ff" style={{ fontSize: '18px', fontWeight: 700, color: '#e2e8f0', margin: 0 }}>AI Tool Registry</h1>
          <div style={{ fontSize: '12px', color: '#3d5378', marginTop: '3px' }}>
            Register external API tools. The LLM discovers and selects actions automatically — no code changes required.
          </div>
        </div>
        <button className="btn-p" onClick={() => setShowForm(true)} style={{ height: '34px', padding: '0 16px' }}>+ Register Tool</button>
      </div>

      {/* Active catalog summary */}
      {catalog.length > 0 && (
        <div className="card" style={{ marginBottom: '16px', borderColor: 'rgba(168,85,247,.2)', background: 'rgba(168,85,247,.04)' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: '10px' }}>
            Active Catalog — {catalog.length} operation{catalog.length !== 1 ? 's' : ''} available to AI
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {catalog.map(op => (
              <div key={op.operationId} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#0c1220', border: '1px solid #101828', borderRadius: '6px', padding: '5px 10px' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#c9d8ee' }}>{op.operationId}</span>
                <RiskBadge level={op.risk_level} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '280px 1fr' : '1fr', gap: '14px' }}>

        {/* Tool list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {tools.length === 0 && !showForm && (
            <div className="card" style={{ textAlign: 'center', padding: '32px' }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🔌</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>No tools registered</div>
              <div style={{ fontSize: '12px', color: '#3d5378' }}>Register your first external API tool to enable AI-driven automated actions.</div>
            </div>
          )}
          {tools.map(t => (
            <ToolCard key={t.id} tool={t} selected={selected?.id === t.id} onSelect={loadSelected} />
          ))}
        </div>

        {/* Tool detail */}
        {selected && (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700, color: '#e2e8f0' }}>{selected.name}</div>
                <div style={{ fontSize: '11px', color: '#3d5378', marginTop: '2px', fontFamily: 'monospace' }}>{selected.base_url}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span className={`b ${selected.is_active ? 's-res' : 's-pend'}`}>{selected.is_active ? 'Active' : 'Inactive'}</span>
                {selected.is_active && (
                  <button className="btn-s" onClick={() => handleDeactivate(selected.id)} style={{ height: '28px', padding: '0 10px', fontSize: '11px', color: '#f87171', borderColor: 'rgba(239,68,68,.2)' }}>
                    Deactivate
                  </button>
                )}
                <button className="btn-s" onClick={() => setSelected(null)} style={{ height: '28px', padding: '0 10px', fontSize: '11px' }}>✕</button>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', marginBottom: '14px', fontSize: '12px', color: '#8499b5' }}>
              <span>Auth: <strong style={{ color: '#c9d8ee' }}>{selected.auth_type}</strong></span>
            </div>

            <div style={{ fontSize: '11px', fontWeight: 700, color: '#3d5378', textTransform: 'uppercase', marginBottom: '10px' }}>
              Operations ({selected.operations?.length || 0})
            </div>
            {(selected.operations || []).map(op => (
              <OperationRow key={op.id} op={op} onDelete={handleDeleteOp} />
            ))}
            {(!selected.operations || selected.operations.length === 0) && (
              <div style={{ fontSize: '12px', color: '#3d5378', padding: '12px 0' }}>No operations defined.</div>
            )}
          </div>
        )}
      </div>

      {/* Registration form */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(7,9,15,.8)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 9999, overflowY: 'auto', padding: '32px 0' }}>
          <div style={{ background: '#0c1220', border: '1px solid #101828', borderRadius: '14px', width: '760px', padding: '28px', maxWidth: '96vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#e2e8f0' }}>Register API Tool</div>
              <button className="btn-s" onClick={() => setShowForm(false)} style={{ height: '28px', padding: '0 10px' }}>✕</button>
            </div>

            {/* Tool basics */}
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', marginBottom: '10px' }}>Tool Details</div>
            <input className="inp" placeholder="Tool name (e.g. Identity Management API)" style={{ width: '100%', height: '36px', marginBottom: '8px' }} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            <input className="inp" placeholder="Base URL (e.g. https://idm.company.com)" style={{ width: '100%', height: '36px', marginBottom: '8px', fontFamily: 'monospace', fontSize: '12px' }} value={form.base_url} onChange={e => setForm(f => ({ ...f, base_url: e.target.value }))} />
            <textarea className="inp" placeholder="Description" rows={2} style={{ width: '100%', resize: 'none', marginBottom: '10px' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />

            <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '8px', marginBottom: '14px' }}>
              <select className="sel" style={{ height: '36px' }} value={form.auth_type} onChange={e => setForm(f => ({ ...f, auth_type: e.target.value }))}>
                <option value="none">No Auth</option>
                <option value="bearer">Bearer Token</option>
                <option value="api_key">API Key</option>
                <option value="basic">Basic Auth</option>
              </select>
              {form.auth_type === 'bearer' && (
                <input className="inp" placeholder="Bearer token" style={{ height: '36px' }} value={form.auth_config?.token || ''} onChange={e => setForm(f => ({ ...f, auth_config: { ...f.auth_config, token: e.target.value } }))} />
              )}
              {form.auth_type === 'api_key' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input className="inp" placeholder="Header name (default: X-API-Key)" style={{ height: '36px', flex: 1 }} value={form.auth_config?.header || ''} onChange={e => setForm(f => ({ ...f, auth_config: { ...f.auth_config, header: e.target.value } }))} />
                  <input className="inp" placeholder="API key value" style={{ height: '36px', flex: 1 }} value={form.auth_config?.key || ''} onChange={e => setForm(f => ({ ...f, auth_config: { ...f.auth_config, key: e.target.value } }))} />
                </div>
              )}
              {form.auth_type === 'basic' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input className="inp" placeholder="Username" style={{ height: '36px', flex: 1 }} value={form.auth_config?.username || ''} onChange={e => setForm(f => ({ ...f, auth_config: { ...f.auth_config, username: e.target.value } }))} />
                  <input className="inp" type="password" placeholder="Password" style={{ height: '36px', flex: 1 }} value={form.auth_config?.password || ''} onChange={e => setForm(f => ({ ...f, auth_config: { ...f.auth_config, password: e.target.value } }))} />
                </div>
              )}
            </div>

            {/* Operations */}
            <div style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', marginBottom: '10px' }}>Operations</div>
            <OperationBuilder ops={form.operations || []} onChange={ops => setForm(f => ({ ...f, operations: ops }))} />

            {error && <div style={{ marginTop: '12px', fontSize: '12px', color: '#f87171' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button className="btn-p" onClick={handleSave} disabled={saving} style={{ flex: 1, justifyContent: 'center' }}>
                {saving ? 'Saving…' : 'Register Tool'}
              </button>
              <button className="btn-s" onClick={() => setShowForm(false)} style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminTools;
