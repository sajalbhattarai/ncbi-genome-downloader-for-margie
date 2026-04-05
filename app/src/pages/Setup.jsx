import { useState, useEffect, useRef } from "react";

/* ── Default settings shape ───────────────────────────────── */
const DEFAULT_SETTINGS = {
  outputDir: "",
  batchesDir: "",
  apiKey: "",
  parallelism: 4,
  batchSize: 50,
};

/* ── Section wrapper ──────────────────────────────────────── */
function Section({ title, children }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <span style={styles.sectionTitle}>{title}</span>
      </div>
      <div style={styles.sectionBody}>{children}</div>
    </div>
  );
}

/* ── Status row for environment checks ───────────────────── */
function EnvRow({ label, status, detail, action }) {
  const icon =
    status === "ok" ? (
      <span style={styles.iconOk}>✓</span>
    ) : status === "error" ? (
      <span style={styles.iconErr}>✗</span>
    ) : status === "loading" ? (
      <span style={styles.iconSpin}>↻</span>
    ) : (
      <span style={styles.iconIdle}>○</span>
    );

  return (
    <div style={styles.envRow}>
      <div style={styles.envRowLeft}>
        {icon}
        <div style={styles.envRowInfo}>
          <span style={styles.envRowLabel}>{label}</span>
          {detail && (
            <span
              style={{
                ...styles.envRowDetail,
                color:
                  status === "ok"
                    ? "var(--accent-green)"
                    : status === "error"
                      ? "var(--accent-red)"
                      : "var(--text-muted)",
              }}
            >
              {detail}
            </span>
          )}
        </div>
      </div>
      {action && <div style={styles.envRowAction}>{action}</div>}
    </div>
  );
}

/* ── Directory field with browse ─────────────────────────── */
function DirField({ label, value, onChange, placeholder, helper }) {
  const handleBrowse = async () => {
    if (!window.electronAPI) return;
    const dir = await window.electronAPI.selectDirectory();
    if (dir) onChange(dir);
  };

  return (
    <div className="form-group" style={{ gap: 6 }}>
      <label className="label">{label}</label>
      <div style={styles.dirRow}>
        <input
          className="input input-mono"
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder || "Select a directory…"}
          style={{ flex: 1 }}
          spellCheck={false}
        />
        <button
          className="btn btn-ghost btn-sm"
          onClick={handleBrowse}
          style={styles.browseBtn}
        >
          Browse
        </button>
      </div>
      {helper && <span className="helper-text">{helper}</span>}
    </div>
  );
}

/* ── Main component ───────────────────────────────────────── */
export default function Setup() {
  /* ── Settings state ── */
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  /* ── Environment check state ── */
  const [pythonStatus, setPythonStatus] = useState("idle"); // idle | loading | ok | error
  const [pythonDetail, setPythonDetail] = useState("");
  const [datasetsStatus, setDatasetsStatus] = useState("idle");
  const [datasetsDetail, setDatasetsDetail] = useState("");
  const [datasetsArch, setDatasetsArch] = useState("");

  /* ── datasets CLI download state ── */
  const [cliDownloading, setCliDownloading] = useState(false);
  const [cliProgress, setCliProgress] = useState(0); // 0-100
  const [cliProgressLabel, setCliProgressLabel] = useState("");

  /* ── Toast state ── */
  const [toast, setToast] = useState(null); // null | { type, message }
  const toastTimer = useRef(null);

  /* ── Saving state ── */
  const [saving, setSaving] = useState(false);

  /* ── Load settings on mount, then run env checks ── */
  useEffect(() => {
    loadSettings();
    runPythonCheck();
    runDatasetsCheck();
    detectArch();
  }, []);

  /* ── Listen for datasets CLI download progress ── */
  useEffect(() => {
    if (!window.electronAPI) return;
    window.electronAPI.onDatasetsProgress((data) => {
      if (typeof data.percent === "number") {
        setCliProgress(data.percent);
        setCliProgressLabel(data.label || `${data.percent}%`);
      }
      if (data.done) {
        setCliDownloading(false);
        setCliProgress(100);
        runDatasetsCheck();
      }
      if (data.error) {
        setCliDownloading(false);
        showToast("error", `CLI download failed: ${data.error}`);
      }
    });
    return () =>
      window.electronAPI.removeAllListeners("datasets-download-progress");
  }, []);

  function showToast(type, message) {
    setToast({ type, message });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2800);
  }

  async function loadSettings() {
    if (!window.electronAPI) return;
    try {
      const saved = await window.electronAPI.getSettings();
      if (saved) {
        setSettings((prev) => ({ ...prev, ...saved }));
      }
    } catch (err) {
      console.warn("Could not load settings:", err);
    }
  }

  async function runPythonCheck() {
    setPythonStatus("loading");
    setPythonDetail("Checking…");
    if (!window.electronAPI) {
      setPythonStatus("error");
      setPythonDetail("electronAPI not available");
      return;
    }
    try {
      const result = await window.electronAPI.checkPython();
      if (result && result.ok) {
        setPythonStatus("ok");
        setPythonDetail(result.version || "Python 3 found");
      } else {
        setPythonStatus("error");
        setPythonDetail(result?.error || "Python 3 not found");
      }
    } catch (err) {
      setPythonStatus("error");
      setPythonDetail(String(err.message || err));
    }
  }

  async function runDatasetsCheck() {
    setDatasetsStatus("loading");
    setDatasetsDetail("Checking…");
    if (!window.electronAPI) {
      setDatasetsStatus("error");
      setDatasetsDetail("electronAPI not available");
      return;
    }
    try {
      const result = await window.electronAPI.getDatasetsStatus();
      if (result && result.ok) {
        setDatasetsStatus("ok");
        setDatasetsDetail(result.version || "datasets CLI found");
      } else {
        setDatasetsStatus("error");
        setDatasetsDetail(result?.detail || "Not installed");
      }
    } catch (err) {
      setDatasetsStatus("error");
      setDatasetsDetail(String(err.message || err));
    }
  }

  async function detectArch() {
    // navigator.userAgent on macOS Electron includes arm64 or x86_64
    const ua = (navigator.userAgent || "").toLowerCase();
    if (ua.includes("arm64") || ua.includes("apple m")) {
      setDatasetsArch("ARM64 (Apple Silicon)");
    } else {
      setDatasetsArch("x86_64 (Intel)");
    }
  }

  async function handleDownloadCli() {
    if (!window.electronAPI) return;
    setCliDownloading(true);
    setCliProgress(0);
    setCliProgressLabel("Starting download…");
    try {
      await window.electronAPI.downloadDatasetsCli();
    } catch (err) {
      setCliDownloading(false);
      showToast("error", `Failed to start CLI download: ${err.message || err}`);
    }
  }

  async function handleSave() {
    if (!window.electronAPI) {
      showToast("error", "electronAPI not available");
      return;
    }
    setSaving(true);
    try {
      await window.electronAPI.saveSettings(settings);
      showToast("success", "Settings saved.");
    } catch (err) {
      showToast("error", `Save failed: ${err.message || err}`);
    } finally {
      setSaving(false);
    }
  }

  function setSetting(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  /* ── Datasets CLI action element ── */
  const datasetsAction =
    datasetsStatus === "error" ? (
      <div style={styles.cliInstallBlock}>
        <div style={styles.cliArchNote}>
          Architecture:{" "}
          <strong style={{ color: "var(--text-primary)" }}>
            {datasetsArch}
          </strong>
        </div>
        {cliDownloading ? (
          <div style={styles.cliProgressBlock}>
            <div style={styles.cliProgressRow}>
              <span style={styles.cliProgressLabel}>{cliProgressLabel}</span>
              <span style={styles.cliProgressPct}>{cliProgress}%</span>
            </div>
            <div className="progress-bar-track" style={{ width: 200 }}>
              <div
                className="progress-bar-fill"
                style={{ width: `${cliProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <button
            className="btn btn-primary btn-sm"
            onClick={handleDownloadCli}
            disabled={cliDownloading}
          >
            Download datasets CLI
          </button>
        )}
      </div>
    ) : null;

  return (
    <div style={styles.root}>
      {/* ── Page header ── */}
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>Setup</h2>
          <p style={styles.pageSubtitle}>
            Configure your environment and download preferences before starting.
          </p>
        </div>
        {/* Save button + toast area */}
        <div style={styles.headerRight}>
          {toast && (
            <div
              className={`toast ${
                toast.type === "success"
                  ? "toast-success"
                  : toast.type === "error"
                    ? "toast-error"
                    : "toast-info"
              }`}
            >
              {toast.type === "success"
                ? "✓"
                : toast.type === "error"
                  ? "✗"
                  : "ℹ"}{" "}
              {toast.message}
            </div>
          )}
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
            style={{ minWidth: 120 }}
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div style={styles.scrollBody}>
        <div style={styles.inner}>
          {/* ── Section 1: Environment Check ── */}
          <Section title="Environment Check">
            <EnvRow
              label="Python 3"
              status={pythonStatus}
              detail={pythonDetail}
              action={
                pythonStatus === "error" ? (
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span style={styles.envHint}>
                      Install Python 3 from{" "}
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          window.electronAPI?.openExternal(
                            "https://www.python.org/downloads/",
                          );
                        }}
                      >
                        python.org
                      </a>
                    </span>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={runPythonCheck}
                    >
                      Recheck
                    </button>
                  </div>
                ) : pythonStatus !== "loading" ? (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={runPythonCheck}
                  >
                    Recheck
                  </button>
                ) : null
              }
            />
            <EnvRow
              label="NCBI datasets CLI"
              status={datasetsStatus}
              detail={datasetsDetail}
              action={
                datasetsStatus !== "loading" ? (
                  datasetsStatus === "error" ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: 8,
                      }}
                    >
                      {datasetsAction}
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={runDatasetsCheck}
                      >
                        Recheck
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={runDatasetsCheck}
                    >
                      Recheck
                    </button>
                  )
                ) : null
              }
            />
            {datasetsStatus === "error" && !cliDownloading && (
              <div style={styles.archBanner}>
                <span style={styles.archBannerIcon}>ℹ</span>
                <span style={styles.archBannerText}>
                  Will download the <strong>{datasetsArch}</strong> build of{" "}
                  <code
                    style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}
                  >
                    datasets
                  </code>{" "}
                  from NCBI.
                </span>
              </div>
            )}
          </Section>

          {/* ── Section 2: Paths ── */}
          <Section title="Output Paths">
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <DirField
                label="Output Directory"
                value={settings.outputDir}
                onChange={(v) => setSetting("outputDir", v)}
                placeholder="/path/to/genomes/output"
                helper="Downloaded genome files will be stored in this directory."
              />
              <DirField
                label="Batches Directory"
                value={settings.batchesDir}
                onChange={(v) => setSetting("batchesDir", v)}
                placeholder="/path/to/genomes/batches"
                helper="Batch manifest files (JSON) will be written here during download preparation."
              />
            </div>
          </Section>

          {/* ── Section 3: NCBI API Key ── */}
          <Section title="NCBI API Key">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div className="form-group">
                <label className="label">API Key</label>
                <input
                  className="input input-mono"
                  type="password"
                  value={settings.apiKey}
                  onChange={(e) => setSetting("apiKey", e.target.value)}
                  placeholder="Paste your NCBI API key here…"
                  autoComplete="off"
                  spellCheck={false}
                />
                <span className="helper-text" style={{ marginTop: 5 }}>
                  Without a key:{" "}
                  <strong style={{ color: "var(--text-secondary)" }}>
                    3 req/s
                  </strong>
                  . With a key:{" "}
                  <strong style={{ color: "var(--accent-green)" }}>
                    10 req/s
                  </strong>
                  . A key is strongly recommended for bulk downloads.
                </span>
              </div>

              <div style={styles.apiKeyLinks}>
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  Get a free API key from your NCBI account →
                </span>
                <a
                  href="#"
                  style={styles.apiKeyLink}
                  onClick={(e) => {
                    e.preventDefault();
                    window.electronAPI?.openExternal(
                      "https://www.ncbi.nlm.nih.gov/account/",
                    );
                  }}
                >
                  ncbi.nlm.nih.gov/account
                </a>
              </div>
            </div>
          </Section>

          {/* ── Section 4: Download Settings ── */}
          <Section title="Download Settings">
            <div style={styles.settingsGrid}>
              {/* Parallel Downloads */}
              <div className="form-group">
                <label className="label">Parallel Downloads</label>
                <div style={styles.numberRow}>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    max={16}
                    value={settings.parallelism}
                    onChange={(e) =>
                      setSetting(
                        "parallelism",
                        Math.min(
                          16,
                          Math.max(1, parseInt(e.target.value) || 1),
                        ),
                      )
                    }
                    style={{ width: 80 }}
                  />
                  <div style={styles.parallelDots}>
                    {Array.from({ length: 16 }).map((_, i) => (
                      <span
                        key={i}
                        style={{
                          ...styles.parallelDot,
                          background:
                            i < settings.parallelism
                              ? "var(--accent-blue)"
                              : "var(--bg-hover)",
                          border:
                            i < settings.parallelism
                              ? "1px solid var(--accent-blue)"
                              : "1px solid var(--border)",
                        }}
                        onClick={() => setSetting("parallelism", i + 1)}
                        title={`${i + 1} parallel download${i === 0 ? "" : "s"}`}
                      />
                    ))}
                  </div>
                </div>
                <span className="helper-text">
                  Number of simultaneous genome downloads. Higher values use
                  more bandwidth and CPU. Recommended: 4–8.
                </span>
              </div>

              {/* Batch Size */}
              <div className="form-group">
                <label className="label">Batch Size</label>
                <div style={styles.numberRow}>
                  <input
                    className="input"
                    type="number"
                    min={10}
                    max={200}
                    value={settings.batchSize}
                    onChange={(e) =>
                      setSetting(
                        "batchSize",
                        Math.min(
                          200,
                          Math.max(10, parseInt(e.target.value) || 50),
                        ),
                      )
                    }
                    style={{ width: 80 }}
                  />
                  <span style={styles.batchPreview}>
                    ≈{" "}
                    <strong style={{ color: "var(--text-primary)" }}>
                      {Math.ceil(2999 / settings.batchSize)}
                    </strong>{" "}
                    batches for 2,999 genomes
                  </span>
                </div>
                <span className="helper-text">
                  Number of genomes per batch manifest. Smaller batches allow
                  finer-grained resume-on-failure. Default: 50.
                </span>
              </div>
            </div>
          </Section>

          {/* ── Bottom save strip ── */}
          <div style={styles.saveStrip}>
            {toast && (
              <div
                className={`toast ${
                  toast.type === "success"
                    ? "toast-success"
                    : toast.type === "error"
                      ? "toast-error"
                      : "toast-info"
                }`}
              >
                {toast.type === "success"
                  ? "✓"
                  : toast.type === "error"
                    ? "✗"
                    : "ℹ"}{" "}
                {toast.message}
              </div>
            )}
            <button
              className="btn btn-primary btn-lg"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving…" : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Styles ───────────────────────────────────────────────── */
const styles = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
    background: "var(--bg-primary)",
  },

  /* Header */
  pageHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "18px 28px 14px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-secondary)",
    flexShrink: 0,
    gap: 16,
    flexWrap: "wrap",
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: 2,
  },
  pageSubtitle: {
    fontSize: 13,
    color: "var(--text-muted)",
    lineHeight: 1.4,
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexShrink: 0,
  },

  /* Scroll body */
  scrollBody: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
  },
  inner: {
    maxWidth: 760,
    margin: "0 auto",
    padding: "24px 28px 40px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },

  /* Section */
  section: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    overflow: "hidden",
  },
  sectionHeader: {
    padding: "11px 18px",
    borderBottom: "1px solid var(--border)",
    background: "rgba(255,255,255,0.02)",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
  },
  sectionBody: {
    padding: "16px 18px",
  },

  /* Env rows */
  envRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 0",
    borderBottom: "1px solid var(--border)",
  },
  envRowLeft: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  envRowInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  envRowLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  envRowDetail: {
    fontSize: 12,
    fontFamily: "var(--font-mono)",
  },
  envRowAction: {
    flexShrink: 0,
  },
  envHint: {
    fontSize: 12,
    color: "var(--text-muted)",
  },

  /* Status icons */
  iconOk: {
    color: "var(--accent-green)",
    fontSize: 16,
    fontWeight: 700,
    lineHeight: "1.5",
    flexShrink: 0,
  },
  iconErr: {
    color: "var(--accent-red)",
    fontSize: 16,
    fontWeight: 700,
    lineHeight: "1.5",
    flexShrink: 0,
  },
  iconSpin: {
    color: "var(--accent-yellow)",
    fontSize: 16,
    lineHeight: "1.5",
    flexShrink: 0,
    display: "inline-block",
    animation: "spin 1s linear infinite",
  },
  iconIdle: {
    color: "var(--text-muted)",
    fontSize: 16,
    lineHeight: "1.5",
    flexShrink: 0,
  },

  /* CLI install */
  cliInstallBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 6,
  },
  cliArchNote: {
    fontSize: 11,
    color: "var(--text-muted)",
    textAlign: "right",
  },
  cliProgressBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    alignItems: "flex-end",
  },
  cliProgressRow: {
    display: "flex",
    justifyContent: "space-between",
    width: 200,
    gap: 8,
  },
  cliProgressLabel: {
    fontSize: 11,
    color: "var(--text-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  cliProgressPct: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--accent-blue)",
    flexShrink: 0,
  },

  /* Arch banner */
  archBanner: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 10,
    padding: "9px 12px",
    background: "var(--accent-blue-10)",
    border: "1px solid rgba(56,139,253,0.2)",
    borderRadius: 6,
  },
  archBannerIcon: {
    color: "var(--accent-blue)",
    fontWeight: 700,
    flexShrink: 0,
    marginTop: 1,
  },
  archBannerText: {
    fontSize: 12,
    color: "var(--text-secondary)",
    lineHeight: 1.5,
  },

  /* Dir field */
  dirRow: {
    display: "flex",
    gap: 8,
    alignItems: "stretch",
  },
  browseBtn: {
    flexShrink: 0,
  },

  /* API key */
  apiKeyLinks: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 12px",
    background: "var(--bg-hover)",
    borderRadius: 6,
    border: "1px solid var(--border)",
  },
  apiKeyLink: {
    fontSize: 12,
    color: "var(--accent-blue)",
    fontFamily: "var(--font-mono)",
    textDecoration: "none",
  },

  /* Settings grid */
  settingsGrid: {
    display: "flex",
    flexDirection: "column",
    gap: 24,
  },
  numberRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  parallelDots: {
    display: "flex",
    gap: 4,
    alignItems: "center",
    flexWrap: "wrap",
  },
  parallelDot: {
    width: 14,
    height: 14,
    borderRadius: 3,
    cursor: "pointer",
    transition: "background 120ms ease, border-color 120ms ease",
    flexShrink: 0,
  },
  batchPreview: {
    fontSize: 12,
    color: "var(--text-muted)",
  },

  /* Save strip */
  saveStrip: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 14,
    padding: "16px 0 0",
    borderTop: "1px solid var(--border)",
    marginTop: 4,
  },
};
