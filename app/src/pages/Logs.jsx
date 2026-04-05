import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/* ── Level config ───────────────────────────────────────────── */
const LEVELS = {
  info:    { label: 'INFO',  color: 'var(--accent-blue)',   bg: 'rgba(56,139,253,0.10)'  },
  success: { label: 'OK',    color: 'var(--accent-green)',  bg: 'rgba(63,185,80,0.10)'   },
  warn:    { label: 'WARN',  color: 'var(--accent-yellow)', bg: 'rgba(210,153,34,0.10)'  },
  error:   { label: 'ERROR', color: 'var(--accent-red)',    bg: 'rgba(248,81,73,0.10)'   },
  debug:   { label: 'DEBUG', color: 'var(--text-muted)',    bg: 'transparent'            },
};
const LEVEL_KEYS = ['info', 'success', 'warn', 'error', 'debug'];
const MAX_LINES  = 5000;
let   _id        = 0;

/* ── Helpers ─────────────────────────────────────────────────── */
function nid() { return ++_id; }

function detectLevel(msg) {
  const m = (msg || '').toLowerCase();
  if (m.includes('error') || m.includes('fail') || m.includes('\u2717')) return 'error';
  if (m.includes('warn'))                                                   return 'warn';
  if (m.includes('\u2713') || m.includes('success') || m.includes('done')) return 'success';
  if (m.includes('debug'))                                                   return 'debug';
  return 'info';
}

function normalise(raw) {
  if (typeof raw === 'string') {
    return { id: nid(), time: new Date().toISOString(), level: detectLevel(raw), message: raw, source: '' };
  }
  return {
    id:      nid(),
    time:    raw.time    || new Date().toISOString(),
    level:   raw.level   || detectLevel(raw.message || ''),
    message: raw.message || JSON.stringify(raw),
    source:  raw.source  || raw.channel || '',
  };
}

function fmtTime(iso) {
  try {
    const d = new Date(iso);
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map((n) => String(n).padStart(2, '0')).join(':') +
      '.' + String(d.getMilliseconds()).padStart(3, '0');
  } catch (e) { return iso; }
}

function fmtDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) { return iso; }
}

/* ── LevelBadge ─────────────────────────────────────────────── */
function LevelBadge({ level }) {
  const cfg = LEVELS[level] || LEVELS.info;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '1px 6px',
      borderRadius: 4,
      fontFamily: 'var(--font-mono)',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.04em',
      color: cfg.color,
      background: cfg.bg,
      border: '1px solid ' + cfg.color + '33',
      minWidth: 40,
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      {cfg.label}
    </span>
  );
}

/* ── LogRow ─────────────────────────────────────────────────── */
function LogRow({ entry, showSource }) {
  const cfg = LEVELS[entry.level] || LEVELS.info;
  const msgColor = cfg.color === 'var(--text-muted)' ? 'var(--text-secondary)' : cfg.color;
  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      padding: '3px 0',
      borderBottom: '1px solid rgba(255,255,255,0.025)',
      fontFamily: 'var(--font-mono)',
      fontSize: 11.5,
      lineHeight: 1.55,
    }}>
      <span style={{ color: 'var(--text-muted)', flexShrink: 0, minWidth: 90, userSelect: 'none' }}>
        {fmtTime(entry.time)}
      </span>
      <LevelBadge level={entry.level} />
      {showSource && entry.source && (
        <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontSize: 10 }}>
          [{entry.source}]
        </span>
      )}
      <span style={{ flex: 1, color: msgColor, wordBreak: 'break-all' }}>
        {entry.message}
      </span>
    </div>
  );
}

/* ── LevelToggle ────────────────────────────────────────────── */
function LevelToggle({ level, active, count, onToggle }) {
  const cfg = LEVELS[level] || LEVELS.info;
  return (
    <button
      onClick={() => onToggle(level)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        border: '1px solid ' + (active ? cfg.color : 'var(--border)'),
        borderRadius: 6,
        background: active ? cfg.bg : 'transparent',
        color: active ? cfg.color : 'var(--text-muted)',
        fontFamily: 'var(--font-mono)',
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
        transition: 'all 120ms ease',
        userSelect: 'none',
      }}
    >
      {cfg.label}
      {count > 0 && (
        <span style={{
          background: active ? cfg.color + '33' : 'var(--bg-hover)',
          color: active ? cfg.color : 'var(--text-muted)',
          borderRadius: 8,
          padding: '0 5px',
          fontSize: 10,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {count >= 1000 ? (count / 1000).toFixed(1) + 'k' : count}
        </span>
      )}
    </button>
  );
}

/* ── Main component ─────────────────────────────────────────── */
export default function Logs() {
  const [entries, setEntries]           = useState([]);
  const [activeLevels, setActiveLevels] = useState(new Set(LEVEL_KEYS));
  const [search, setSearch]             = useState('');
  const [autoScroll, setAutoScroll]     = useState(true);
  const [showSource, setShowSource]     = useState(false);
  const [paused, setPaused]             = useState(false);
  const pauseBufferRef                  = useRef([]);
  const logRef                          = useRef(null);

  /* ── Subscribe to IPC log events ── */
  useEffect(() => {
    if (!window.electronAPI) return;
    const handler = (data) => {
      const entry = normalise(data);
      if (paused) {
        pauseBufferRef.current.push(entry);
        if (pauseBufferRef.current.length > 500) {
          pauseBufferRef.current = pauseBufferRef.current.slice(-500);
        }
      } else {
        setEntries((prev) => {
          const next = [...prev, entry];
          return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
        });
      }
    };
    window.electronAPI.onLogLine(handler);
    return () => window.electronAPI.removeAllListeners('log-line');
  }, [paused]);

  /* ── Flush pause buffer on resume ── */
  useEffect(() => {
    if (!paused && pauseBufferRef.current.length > 0) {
      const buffered = pauseBufferRef.current.slice();
      pauseBufferRef.current = [];
      setEntries((prev) => {
        const next = [...prev, ...buffered];
        return next.length > MAX_LINES ? next.slice(-MAX_LINES) : next;
      });
    }
  }, [paused]);

  /* ── Auto-scroll ── */
  useEffect(() => {
    if (autoScroll && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [entries, autoScroll]);

  /* ── Level counts ── */
  const levelCounts = useMemo(() => {
    const counts = {};
    LEVEL_KEYS.forEach((k) => { counts[k] = 0; });
    entries.forEach((e) => { if (counts[e.level] !== undefined) counts[e.level]++; });
    return counts;
  }, [entries]);

  /* ── Filtered entries ── */
  const visible = useMemo(() => {
    return entries.filter((e) => {
      if (!activeLevels.has(e.level)) return false;
      if (search) {
        const q = search.toLowerCase();
        return e.message.toLowerCase().includes(q) || e.source.toLowerCase().includes(q);
      }
      return true;
    });
  }, [entries, activeLevels, search]);

  /* ── Group by date ── */
  const grouped = useMemo(() => {
    const groups = [];
    let lastDate = '';
    visible.forEach((e) => {
      const d = fmtDate(e.time);
      if (d !== lastDate) {
        groups.push({ type: 'date', label: d, key: 'date-' + d + '-' + e.id });
        lastDate = d;
      }
      groups.push({ type: 'entry', entry: e, key: 'e-' + e.id });
    });
    return groups;
  }, [visible]);

  /* ── Handlers ── */
  const toggleLevel = useCallback((level) => {
    setActiveLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level); else next.add(level);
      return next;
    });
  }, []);

  const clearLogs = useCallback(() => {
    setEntries([]);
    pauseBufferRef.current = [];
  }, []);

  const exportLogs = useCallback(() => {
    const text = entries
      .map((e) => fmtTime(e.time) + ' [' + (LEVELS[e.level] || LEVELS.info).label + ']' +
        (e.source ? ' [' + e.source + ']' : '') + ' ' + e.message)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'genome-downloader-' + fmtDate(new Date().toISOString()).replace(/\s/g, '-') + '.log';
    a.click();
    URL.revokeObjectURL(url);
  }, [entries]);

  const handleScroll = useCallback(() => {
    if (!logRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 40;
    if (!atBottom && autoScroll)  setAutoScroll(false);
    if (atBottom  && !autoScroll) setAutoScroll(true);
  }, [autoScroll]);

  /* ── Demo entries when running outside Electron ── */
  useEffect(() => {
    if (window.electronAPI) return;
    setEntries([
      normalise({ level: 'info',    message: 'Genome downloader started. Electron environment ready.' }),
      normalise({ level: 'info',    message: 'Loaded 2,999 genome records from bacteria_3000.tsv' }),
      normalise({ level: 'success', message: '\u2713 Python 3.11.4 detected at /usr/bin/python3' }),
      normalise({ level: 'success', message: '\u2713 datasets CLI v14.28.0 detected' }),
      normalise({ level: 'warn',    message: 'NCBI API key not set -- rate limited to 3 req/s' }),
      normalise({ level: 'info',    message: 'Settings loaded from user data directory.' }),
      normalise({ level: 'debug',   message: 'IPC bridge initialised; all channels registered.' }),
    ]);
  }, []);

  return (
    <div style={S.root}>

      {/* ── Page header ── */}
      <div style={S.pageHeader}>
        <div>
          <h2 style={S.pageTitle}>Logs</h2>
          <p style={S.pageSubtitle}>
            Live output from the downloader process.{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{entries.length.toLocaleString()}</strong>
            {' '}total &nbsp;·&nbsp; showing{' '}
            <strong style={{ color: 'var(--accent-blue)' }}>{visible.length.toLocaleString()}</strong>
          </p>
        </div>
        <div style={S.headerActions}>
          <button
            className={'btn btn-sm ' + (paused ? 'btn-danger' : 'btn-ghost')}
            onClick={() => setPaused((p) => !p)}
          >
            {paused ? '\u25BA Resume' : '\u23F8 Pause'}
            {paused && pauseBufferRef.current.length > 0 && (
              <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '0 5px', fontSize: 10, marginLeft: 2 }}>
                +{pauseBufferRef.current.length}
              </span>
            )}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowSource((s) => !s)}
          >
            {showSource ? 'Hide Source' : 'Show Source'}
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={exportLogs}
            disabled={entries.length === 0}
          >
            \u2193 Export
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={clearLogs}
            disabled={entries.length === 0}
          >
            Clear
          </button>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div style={S.toolbar}>
        <div style={S.levelToggles}>
          {LEVEL_KEYS.map((lvl) => (
            <LevelToggle
              key={lvl}
              level={lvl}
              active={activeLevels.has(lvl)}
              count={levelCounts[lvl] || 0}
              onToggle={toggleLevel}
            />
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
          <div style={S.searchWrap}>
            <span style={S.searchIcon}>&#128269;</span>
            <input
              className="input"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter log messages..."
              style={{ paddingLeft: 28, fontSize: 12, width: 240 }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={S.clearSearch}>X</button>
            )}
          </div>
          <button
            className={'btn btn-sm ' + (autoScroll ? 'btn-primary' : 'btn-ghost')}
            onClick={() => {
              setAutoScroll((a) => {
                if (!a && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
                return !a;
              });
            }}
          >
            {autoScroll ? '\u2193 Auto-scroll ON' : '\u2193 Auto-scroll OFF'}
          </button>
        </div>
      </div>

      {/* ── Log pane ── */}
      <div ref={logRef} style={S.logPane} onScroll={handleScroll}>
        {grouped.length === 0 ? (
          <div style={S.emptyState}>
            <span style={{ fontSize: 36, opacity: 0.4 }}>&#128203;</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14, fontWeight: 600 }}>
              {entries.length === 0 ? 'No log entries yet' : 'No entries match your filters'}
            </span>
            <span style={{ color: 'var(--text-muted)', fontSize: 12, maxWidth: 320, textAlign: 'center', lineHeight: 1.5 }}>
              {entries.length === 0
                ? 'Log output from the download process will stream here in real-time.'
                : 'Try changing the level filters or clearing the search.'}
            </span>
            {entries.length > 0 && (
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => { setActiveLevels(new Set(LEVEL_KEYS)); setSearch(''); }}
                style={{ marginTop: 8 }}
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          grouped.map((item) =>
            item.type === 'date' ? (
              <div key={item.key} style={S.dateSep}>
                <div style={S.dateSepLine} />
                <span style={S.dateSepLabel}>{item.label}</span>
                <div style={S.dateSepLine} />
              </div>
            ) : (
              <LogRow key={item.key} entry={item.entry} showSource={showSource} />
            )
          )
        )}
      </div>

      {/* ── Footer ── */}
      <div style={S.footer}>
        <div style={S.footerLeft}>
          {LEVEL_KEYS.map((lvl) => {
            const cfg = LEVELS[lvl];
            const n   = levelCounts[lvl] || 0;
            if (n === 0) return null;
            return (
              <span key={lvl} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
                <span style={{ color: cfg.color, fontWeight: 700 }}>{n.toLocaleString()}</span>
                <span style={{ color: 'var(--text-muted)' }}>{cfg.label.toLowerCase()}</span>
              </span>
            );
          })}
        </div>
        <div style={S.footerRight}>
          {paused && (
            <span style={{ color: 'var(--accent-red)', fontSize: 11, fontWeight: 600 }}>
              Paused -- {pauseBufferRef.current.length} lines buffered
            </span>
          )}
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            Max {MAX_LINES.toLocaleString()} lines
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────────────── */
const S = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
    background: 'var(--bg-primary)',
  },
  pageHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '13px 20px 11px',
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)',
    flexShrink: 0,
    gap: 16,
    flexWrap: 'wrap',
  },
  pageTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 2,
  },
  pageSubtitle: {
    fontSize: 12,
    color: 'var(--text-muted)',
    lineHeight: 1.4,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 16px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  levelToggles: {
    display: 'flex',
    gap: 5,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  searchWrap: {
    position: 'relative',
  },
  searchIcon: {
    position: 'absolute',
    left: 8,
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: 12,
    pointerEvents: 'none',
    zIndex: 1,
  },
  clearSearch: {
    position: 'absolute',
    right: 8,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    fontSize: 10,
    padding: 2,
    lineHeight: 1,
  },
  logPane: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: '8px 16px',
    position: 'relative',
    minHeight: 0,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    height: '100%',
    minHeight: 260,
    textAlign: 'center',
    padding: 24,
  },
  dateSep: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    margin: '12px 0 8px',
    userSelect: 'none',
  },
  dateSepLine: {
    flex: 1,
    height: 1,
    background: 'var(--border)',
  },
  dateSepLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.07em',
    whiteSpace: 'nowrap',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '7px 16px',
    background: 'var(--bg-secondary)',
    borderTop: '1px solid var(--border)',
    flexShrink: 0,
    gap: 12,
    flexWrap: 'wrap',
  },
  footerLeft: {
    display: 'flex',
    gap: 14,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  footerRight: {
    display: 'flex',
    gap: 16,
    alignItems: 'center',
  },
};
