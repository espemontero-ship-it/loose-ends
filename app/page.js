'use client';

import { useEffect, useMemo, useState } from 'react';

const LEVELS = {
  high: { label: 'high', color: 'var(--warn)', ratio: 0.9 },
  watch: { label: 'watch', color: 'var(--cyan)', ratio: 0.55 },
  low: { label: 'low', color: 'var(--text-dim)', ratio: 0.2 },
};

const NAME_KEY = 'loose-ends-name';
const POLL_MS = 15000;

function GaugeSvg({ threat, size = 30 }) {
  const lvl = LEVELS[threat] || LEVELS.low;
  const r = (size - 6) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle className="gauge-track" cx={c} cy={c} r={r} strokeWidth="3" />
      <circle
        className="gauge-fill"
        cx={c}
        cy={c}
        r={r}
        strokeWidth="3"
        stroke={lvl.color}
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - lvl.ratio)}
      />
    </svg>
  );
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'yesterday';
  return `${days}d ago`;
}

function relatedFiles(file, files) {
  if (!file) return [];
  const outgoing = file.relationIds || [];
  const ids = new Set(outgoing);
  files.forEach((f) => {
    if ((f.relationIds || []).includes(file.id)) ids.add(f.id);
  });
  ids.delete(file.id);
  return [...ids].map((id) => files.find((f) => f.id === id)).filter(Boolean);
}

function isDirectlyRelated(a, b) {
  return (a.relationIds || []).includes(b.id) || (b.relationIds || []).includes(a.id);
}

function RelationMap({ file, files, onNavigate }) {
  const related = relatedFiles(file, files);
  if (related.length === 0) {
    return <div className="detail-section-body empty">no relations mapped</div>;
  }

  const size = 280;
  const c = size / 2;
  const orbit = related.length <= 3 ? 90 : 110;

  const nodes = related.map((r, i) => {
    const angle = (i / related.length) * Math.PI * 2 - Math.PI / 2;
    return { ...r, x: c + orbit * Math.cos(angle), y: c + orbit * Math.sin(angle) };
  });

  const satelliteLinks = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (isDirectlyRelated(nodes[i], nodes[j])) {
        satelliteLinks.push([nodes[i], nodes[j]]);
      }
    }
  }

  // list every line shown, in plain words, so it can be read, not just seen
  const readableLines = [
    ...nodes.map((n) => `${file.name} — ${n.name}`),
    ...satelliteLinks.map(([a, b]) => `${a.name} — ${b.name}`),
  ];

  return (
    <>
      <svg width="100%" viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
        {nodes.map((n) => (
          <line key={`spoke-${n.id}`} x1={c} y1={c} x2={n.x} y2={n.y} stroke="var(--cyan-dim)" strokeWidth="1" />
        ))}
        {satelliteLinks.map(([a, b]) => {
          // bow the line outward a little so it never collapses onto a spoke
          const mx = (a.x + b.x) / 2;
          const my = (a.y + b.y) / 2;
          const dx = mx - c;
          const dy = my - c;
          const dist = Math.hypot(dx, dy) || 1;
          const bowX = mx + (dx / dist) * 14;
          const bowY = my + (dy / dist) * 14;
          return (
            <path
              key={`link-${a.id}-${b.id}`}
              d={`M ${a.x} ${a.y} Q ${bowX} ${bowY} ${b.x} ${b.y}`}
              fill="none"
              stroke="var(--cyan-dim)"
              strokeWidth="1"
            />
          );
        })}
        <circle cx={c} cy={c} r="9" fill="var(--bg-panel)" stroke="var(--cyan)" strokeWidth="2" />
        <text x={c} y={c + 24} textAnchor="middle" fill="var(--cyan)" fontFamily="IBM Plex Mono, monospace" fontSize="10">
          {file.name}
        </text>
        {nodes.map((n) => {
          const lvl = LEVELS[n.threat] || LEVELS.low;
          return (
            <g key={n.id} style={{ cursor: 'pointer' }} onClick={() => onNavigate(n.id)}>
              <circle cx={n.x} cy={n.y} r="7" fill="var(--bg-panel)" stroke={lvl.color} strokeWidth="2" />
              <text
                x={n.x}
                y={n.y + (n.y > c ? 20 : -14)}
                textAnchor="middle"
                fill="var(--text-dim)"
                fontFamily="IBM Plex Mono, monospace"
                fontSize="9.5"
              >
                {n.name}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="relation-list">
        {readableLines.map((line) => (
          <div key={line} className="relation-list-row">
            {line}
          </div>
        ))}
      </div>
    </>
  );
}

export default function Page() {
  const [name, setName] = useState(undefined); // undefined = not loaded yet
  const [nameInput, setNameInput] = useState('');
  const [files, setFiles] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [screen, setScreen] = useState('list'); // list | detail | form
  const [activeId, setActiveId] = useState(null);
  const [editing, setEditing] = useState(null); // file being edited, or null for new

  useEffect(() => {
    setName(localStorage.getItem(NAME_KEY) || '');
  }, []);

  async function loadFiles() {
    try {
      const res = await fetch('/api/files');
      if (!res.ok) throw new Error('failed to load');
      const data = await res.json();
      setFiles(data);
    } catch (e) {
      // stay on stale data, no crash
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    loadFiles();
    const interval = setInterval(loadFiles, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  function confirmName() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    localStorage.setItem(NAME_KEY, trimmed);
    setName(trimmed);
  }

  function changeName() {
    localStorage.removeItem(NAME_KEY);
    setName('');
    setNameInput('');
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files;
    return files.filter((f) => {
      const relNames = relatedFiles(f, files).map((r) => r.name).join(' ');
      return [f.name, f.secrets, relNames].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [files, query]);

  const active = files.find((f) => f.id === activeId);

  if (name === undefined) return null;

  if (!name) {
    return (
      <>
        <div className="gridbg" />
        <div className="app">
          <div className="centered-screen">
            <div className="eyebrow">
              <span className="dot" />security // off book
            </div>
            <h1>Loose Ends</h1>
            <label>Who are you?</label>
            <input
              type="text"
              placeholder="your name"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmName()}
              autoFocus
            />
            <button className="primary-btn" disabled={!nameInput.trim()} onClick={confirmName}>
              enter
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="gridbg" />
      <div className="app">
        {screen === 'list' && (
          <>
            <header>
              <div className="chrome-row">
                <span>
                  <span className="dot" />uplink stable
                </span>
                <button className="tag" onClick={changeName}>
                  {name}
                </button>
              </div>
              <div className="title-row">
                <h1>Loose Ends</h1>
              </div>
              <div className="subhead">
                <b>{files.length}</b> files logged
              </div>
            </header>

            <div className="controls">
              <div className="search">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="7" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  placeholder="search a guest, secret, relationship…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="list">
              {!loaded && <div className="list-empty">loading files…</div>}
              {loaded && filtered.length === 0 && <div className="list-empty">no files match</div>}
              {filtered.map((f) => {
                const lvl = LEVELS[f.threat] || LEVELS.low;
                const relNames = relatedFiles(f, files).map((r) => r.name).join(' · ');
                return (
                  <div
                    key={f.id}
                    className="panel clickable"
                    onClick={() => {
                      setActiveId(f.id);
                      setScreen('detail');
                    }}
                  >
                    <div className="panel-head">
                      <div>
                        <div className="panel-name">{f.name}</div>
                        <div className="panel-id">FILE {String(f.id).padStart(2, '0')}</div>
                      </div>
                      <div className="gauge">
                        <div className="gauge-label">
                          <span className={`lvl lvl-${f.threat}`}>{lvl.label}</span>threat
                        </div>
                        <GaugeSvg threat={f.threat} />
                      </div>
                    </div>
                    <div className="field">
                      <div className="field-mark">›</div>
                      <div className="field-label">Secrets</div>
                      <div className={`field-value ${f.secrets ? '' : 'empty'}`}>{f.secrets || 'none logged'}</div>
                    </div>
                    <div className="field">
                      <div className="field-mark">›</div>
                      <div className="field-label">Relations</div>
                      <div className={`field-value ${relNames ? '' : 'empty'}`}>{relNames || 'none logged'}</div>
                    </div>
                    <div className="panel-meta">
                      <div>
                        logged by <b>{f.logged_by}</b>
                      </div>
                      <div>{timeAgo(f.updated_at)}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div
              className="fab"
              onClick={() => {
                setEditing(null);
                setScreen('form');
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
          </>
        )}

        {screen === 'detail' && active && (
          <div className="detail">
            <button className="back-btn" onClick={() => setScreen('list')}>
              ‹ back to files
            </button>
            <div className="detail-head">
              <div>
                <div className="detail-name">{active.name}</div>
                <div className="detail-id">FILE {String(active.id).padStart(2, '0')}</div>
              </div>
              <div className="gauge">
                <div className="gauge-label">
                  <span className={`lvl lvl-${active.threat}`}>{LEVELS[active.threat].label}</span>threat
                </div>
                <GaugeSvg threat={active.threat} size={44} />
              </div>
            </div>
            <div className="detail-section">
              <div className="detail-section-label">secrets</div>
              <div className={`detail-section-body ${active.secrets ? '' : 'empty'}`}>{active.secrets || 'none logged'}</div>
            </div>
            <div className="detail-section">
              <div className="detail-section-label">relations</div>
              <RelationMap
                file={active}
                files={files}
                onNavigate={(id) => setActiveId(id)}
              />
            </div>
            <div className="panel-meta">
              <div>
                logged by <b>{active.logged_by}</b>
              </div>
              <div>{timeAgo(active.updated_at)}</div>
            </div>
            <button
              className="edit-btn"
              onClick={() => {
                setEditing(active);
                setScreen('form');
              }}
            >
              edit this file
            </button>
          </div>
        )}

        {screen === 'form' && (
          <FileForm
            file={editing}
            allFiles={files}
            loggedBy={name}
            onCancel={() => setScreen(editing ? 'detail' : 'list')}
            onSaved={(saved) => {
              loadFiles();
              setActiveId(saved.id);
              setScreen('detail');
            }}
          />
        )}
      </div>
    </>
  );
}

function FileForm({ file, allFiles, loggedBy, onCancel, onSaved }) {
  const [name, setName] = useState(file?.name || '');
  const [threat, setThreat] = useState(file?.threat || 'low');
  const [secrets, setSecrets] = useState(file?.secrets || '');
  const [relationIds, setRelationIds] = useState(file?.relationIds || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const otherFiles = allFiles.filter((f) => f.id !== file?.id);

  function toggleRelation(id) {
    setRelationIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function save() {
    if (!name.trim()) {
      setError('name is required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const url = file ? `/api/files/${file.id}` : '/api/files';
      const method = file ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, threat, secrets, relationIds, loggedBy }),
      });
      if (!res.ok) throw new Error('save failed');
      const saved = await res.json();
      onSaved(saved);
    } catch (e) {
      setError('could not save — try again');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="detail">
      <button className="back-btn" onClick={onCancel}>
        ‹ cancel
      </button>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>{file ? 'Edit File' : 'New File'}</h1>

      <label>Name</label>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="guest or staff name" />

      <label>Threat</label>
      <div className="threat-select">
        {['high', 'watch', 'low'].map((lvl) => (
          <div
            key={lvl}
            className={`threat-option ${threat === lvl ? `selected lvl-${lvl}` : ''}`}
            onClick={() => setThreat(lvl)}
          >
            {lvl}
          </div>
        ))}
      </div>

      <label>Secrets</label>
      <textarea value={secrets} onChange={(e) => setSecrets(e.target.value)} placeholder="what do we know?" />

      <label>Relations</label>
      {otherFiles.length === 0 ? (
        <div className="detail-section-body empty">no other files yet to connect to</div>
      ) : (
        <div className="relation-picker">
          {otherFiles.map((f) => (
            <div
              key={f.id}
              className={`relation-option ${relationIds.includes(f.id) ? 'selected' : ''}`}
              onClick={() => toggleRelation(f.id)}
            >
              {f.name}
            </div>
          ))}
        </div>
      )}

      {error && <div className="error-text">{error}</div>}

      <button className="primary-btn" disabled={saving} onClick={save}>
        {saving ? 'saving…' : 'save file'}
      </button>
    </div>
  );
}
