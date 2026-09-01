'use client';

import { useEffect, useMemo, useState } from 'react';
import { uploadPresigned } from '@vercel/blob/client';

const PHOTO_MAX_DIMENSION = 480;
const PHOTO_QUALITY = 0.72;

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, PHOTO_MAX_DIMENSION / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('resize failed'))), 'image/jpeg', PHOTO_QUALITY);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('could not read image'));
    };
    img.src = objectUrl;
  });
}

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
  const ids = new Set((file.relations || []).map((r) => r.id));
  files.forEach((f) => {
    if ((f.relations || []).some((r) => r.id === file.id)) ids.add(f.id);
  });
  ids.delete(file.id);
  return [...ids].map((id) => files.find((f) => f.id === id)).filter(Boolean);
}

function isDirectlyRelated(a, b) {
  return (a.relations || []).some((r) => r.id === b.id) || (b.relations || []).some((r) => r.id === a.id);
}

function relationNote(a, b) {
  const forward = (a.relations || []).find((r) => r.id === b.id);
  const backward = (b.relations || []).find((r) => r.id === a.id);
  return (forward && forward.note) || (backward && backward.note) || '';
}

function allRelationPairs(files) {
  const map = new Map();
  files.forEach((f) => {
    (f.relations || []).forEach((r) => {
      const other = files.find((o) => o.id === r.id);
      if (!other) return;
      const key = [f.id, other.id].sort((x, y) => x - y).join('-');
      if (!map.has(key) || (!map.get(key).note && r.note)) {
        const [a, b] = f.id < other.id ? [f, other] : [other, f];
        map.set(key, { a, b, note: r.note || relationNote(f, other) });
      }
    });
  });
  return [...map.values()];
}

function RelationMap({ file, files, onNavigate }) {
  const related = relatedFiles(file, files);
  if (related.length === 0) {
    return <div className="detail-section-body empty">no relations mapped</div>;
  }

  // every node — the active file included — sits as a peer on the same circle,
  // nobody forced through a center, so a relation is always a plain straight line
  const group = [file, ...related];
  const size = 280;
  const c = size / 2;
  const orbit = group.length <= 3 ? 85 : 105;

  const nodes = group.map((f, i) => {
    const angle = (i / group.length) * Math.PI * 2 - Math.PI / 2;
    return { ...f, x: c + orbit * Math.cos(angle), y: c + orbit * Math.sin(angle) };
  });

  const links = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (isDirectlyRelated(nodes[i], nodes[j])) {
        links.push([nodes[i], nodes[j]]);
      }
    }
  }

  return (
    <>
      <div className="relnet">
        <svg viewBox={`0 0 ${size} ${size}`} preserveAspectRatio="none">
          {links.map(([a, b]) => (
            <line
              key={`link-${a.id}-${b.id}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="var(--cyan-dim)"
              strokeWidth="1"
            />
          ))}
        </svg>
        {nodes.map((n) => (
          <div
            key={n.id}
            className={`relnode ${n.id === file.id ? 'active' : ''}`}
            style={{ left: `${(n.x / size) * 100}%`, top: `${(n.y / size) * 100}%` }}
            onClick={() => n.id !== file.id && onNavigate(n.id)}
          >
            {n.name}
          </div>
        ))}
      </div>
      <div className="relation-list">
        {links.map(([a, b]) => {
          const note = relationNote(a, b);
          return (
            <div key={`${a.id}-${b.id}`} className="relation-list-row">
              {a.id === file.id ? <b>{a.name}</b> : a.name} — {b.id === file.id ? <b>{b.name}</b> : b.name}
              {note && <span className="relation-list-note"> — {note}</span>}
            </div>
          );
        })}
      </div>
    </>
  );
}

function GlobalRelationMap({ files, onNavigate }) {
  if (files.length === 0) return null;
  const size = 320;
  const c = size / 2;
  const orbit = files.length <= 6 ? 110 : 135;

  const nodes = files.map((f, i) => {
    const angle = (i / files.length) * Math.PI * 2 - Math.PI / 2;
    return { ...f, x: c + orbit * Math.cos(angle), y: c + orbit * Math.sin(angle) };
  });

  const links = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      if (isDirectlyRelated(nodes[i], nodes[j])) {
        links.push([nodes[i], nodes[j]]);
      }
    }
  }

  return (
    <div className="relnet relnet-global">
      <svg viewBox={`0 0 ${size} ${size}`} preserveAspectRatio="none">
        {links.map(([a, b]) => (
          <line key={`link-${a.id}-${b.id}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--cyan-dim)" strokeWidth="1" strokeOpacity="0.6" />
        ))}
      </svg>
      {nodes.map((n) => (
        <div
          key={n.id}
          className="relnode relnode-sm"
          style={{ left: `${(n.x / size) * 100}%`, top: `${(n.y / size) * 100}%` }}
          onClick={() => onNavigate(n.id)}
        >
          {n.name}
        </div>
      ))}
    </div>
  );
}

function AllRelationsScreen({ files, onBack, onNavigate }) {
  const pairs = allRelationPairs(files);
  return (
    <div className="detail">
      <button className="back-btn" onClick={onBack}>
        ‹ back to files
      </button>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>All Relations</h1>
      <div className="subhead" style={{ marginBottom: 16 }}>
        <b>{pairs.length}</b> relations logged
      </div>
      <GlobalRelationMap files={files} onNavigate={onNavigate} />
      {pairs.length === 0 ? (
        <div className="detail-section-body empty">no relations logged yet</div>
      ) : (
        <div className="all-relations-list">
          {pairs.map((p, i) => (
            <div key={`${p.a.id}-${p.b.id}`} className="all-relations-row">
              <span className="all-relations-index">{i + 1}.</span>
              <span>
                <span className="rel-link" onClick={() => onNavigate(p.a.id)}>{p.a.name}</span>
                {' — '}
                <span className="rel-link" onClick={() => onNavigate(p.b.id)}>{p.b.name}</span>
                {p.note && <span className="relation-list-note"> — {p.note}</span>}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Page() {
  const [name, setName] = useState(undefined); // undefined = not loaded yet
  const [nameInput, setNameInput] = useState('');
  const [files, setFiles] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [threatFilter, setThreatFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [screen, setScreen] = useState('list'); // list | detail | form | allRelations
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
    return files.filter((f) => {
      if (threatFilter !== 'all' && f.threat !== threatFilter) return false;
      if (typeFilter !== 'all' && (f.type || 'guest') !== typeFilter) return false;
      if (!q) return true;
      const relNames = relatedFiles(f, files).map((r) => r.name).join(' ');
      return [f.name, f.basicInfo, f.secrets, relNames].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [files, query, threatFilter, typeFilter]);

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

              <div className="filter-row">
                {['all', 'high', 'watch', 'low'].map((lvl) => (
                  <div
                    key={lvl}
                    className={`filter-chip ${threatFilter === lvl ? 'selected' : ''}`}
                    onClick={() => setThreatFilter(lvl)}
                  >
                    {lvl}
                  </div>
                ))}
              </div>
              <div className="filter-row">
                {['all', 'guest', 'staff'].map((t) => (
                  <div
                    key={t}
                    className={`filter-chip ${typeFilter === t ? 'selected' : ''}`}
                    onClick={() => setTypeFilter(t)}
                  >
                    {t}
                  </div>
                ))}
              </div>

              <button className="all-relations-btn" onClick={() => setScreen('allRelations')}>
                view all relations
              </button>
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
                      <div className="panel-head-info">
                        {f.photoUrl && <img src={f.photoUrl} alt="" className="panel-photo" />}
                        <div>
                          <div className="panel-name">{f.name}</div>
                          <div className="panel-id">FILE {String(f.id).padStart(2, '0')} · {(f.type || 'guest').toUpperCase()}</div>
                        </div>
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
                      <div className="field-label">Basic info</div>
                      <div className={`field-value ${f.basicInfo ? '' : 'empty'}`}>{f.basicInfo || 'none logged'}</div>
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

        {screen === 'allRelations' && (
          <AllRelationsScreen
            files={files}
            onBack={() => setScreen('list')}
            onNavigate={(id) => {
              setActiveId(id);
              setScreen('detail');
            }}
          />
        )}

        {screen === 'detail' && active && (
          <div className="detail">
            <button className="back-btn" onClick={() => setScreen('list')}>
              ‹ back to files
            </button>
            {active.photoUrl && <img src={active.photoUrl} alt="" className="detail-photo" />}
            <div className="detail-head">
              <div>
                <div className="detail-name">{active.name}</div>
                <div className="detail-id">FILE {String(active.id).padStart(2, '0')} · {(active.type || 'guest').toUpperCase()}</div>
              </div>
              <div className="gauge">
                <div className="gauge-label">
                  <span className={`lvl lvl-${active.threat}`}>{LEVELS[active.threat].label}</span>threat
                </div>
                <GaugeSvg threat={active.threat} size={44} />
              </div>
            </div>
            <div className="detail-section">
              <div className="detail-section-label">basic info</div>
              <div className={`detail-section-body ${active.basicInfo ? '' : 'empty'}`}>{active.basicInfo || 'none logged'}</div>
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
  const [type, setType] = useState(file?.type || 'guest');
  const [threat, setThreat] = useState(file?.threat || 'low');
  const [photoUrl, setPhotoUrl] = useState(file?.photoUrl || '');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [basicInfo, setBasicInfo] = useState(file?.basicInfo || '');
  const [secrets, setSecrets] = useState(file?.secrets || '');
  const [relations, setRelations] = useState(file?.relations || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const otherFiles = allFiles.filter((f) => f.id !== file?.id);

  async function onPhotoChange(e) {
    const picked = e.target.files[0];
    e.target.value = '';
    if (!picked) return;
    setUploadingPhoto(true);
    setError('');
    try {
      const resized = await resizeImage(picked);
      const blob = await uploadPresigned(`photos/${Date.now()}.jpg`, resized, {
        access: 'public',
        handleUploadUrl: '/api/blob-upload',
      });
      setPhotoUrl(blob.url);
    } catch (e) {
      setError('could not upload photo — try again');
    } finally {
      setUploadingPhoto(false);
    }
  }

  function toggleRelation(id) {
    setRelations((prev) =>
      prev.some((r) => r.id === id) ? prev.filter((r) => r.id !== id) : [...prev, { id, note: '' }]
    );
  }

  function setRelationNote(id, note) {
    setRelations((prev) => prev.map((r) => (r.id === id ? { ...r, note } : r)));
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
        body: JSON.stringify({ name, type, threat, photoUrl, basicInfo, secrets, relations, loggedBy }),
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

      <label>Photo</label>
      <div className="photo-field">
        {photoUrl && <img src={photoUrl} alt="" className="photo-preview" />}
        <label className="photo-upload-btn">
          {uploadingPhoto ? 'uploading…' : photoUrl ? 'replace photo' : 'add photo'}
          <input type="file" accept="image/*" capture="environment" onChange={onPhotoChange} disabled={uploadingPhoto} hidden />
        </label>
      </div>

      <label>Type</label>
      <div className="threat-select">
        {['guest', 'staff'].map((t) => (
          <div key={t} className={`threat-option ${type === t ? 'selected lvl-watch' : ''}`} onClick={() => setType(t)}>
            {t}
          </div>
        ))}
      </div>

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

      <label>Basic info</label>
      <textarea value={basicInfo} onChange={(e) => setBasicInfo(e.target.value)} placeholder="who are they, where do they work?" />

      <label>Secrets</label>
      <textarea value={secrets} onChange={(e) => setSecrets(e.target.value)} placeholder="what do we know?" />

      <label>Relations</label>
      {otherFiles.length === 0 ? (
        <div className="detail-section-body empty">no other files yet to connect to</div>
      ) : (
        <div className="relation-picker">
          {otherFiles.map((f) => {
            const rel = relations.find((r) => r.id === f.id);
            return (
              <div key={f.id} className="relation-pick-row">
                <div
                  className={`relation-option ${rel ? 'selected' : ''}`}
                  onClick={() => toggleRelation(f.id)}
                >
                  {f.name}
                </div>
                {rel && (
                  <input
                    type="text"
                    className="relation-note-input"
                    placeholder="how are they related?"
                    value={rel.note}
                    onChange={(e) => setRelationNote(f.id, e.target.value)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {error && <div className="error-text">{error}</div>}

      <button className="primary-btn" disabled={saving} onClick={save}>
        {saving ? 'saving…' : 'save file'}
      </button>
    </div>
  );
}
