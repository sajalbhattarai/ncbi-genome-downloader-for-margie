import { useState, useEffect, useRef } from "react";

/* ── Pipeline step definitions ─────────────────────────────── */
const STEPS = [
  { id: "scan", label: "Scan downloaded genomes", icon: "🔍" },
  { id: "normalize", label: "Copy & rename files", icon: "📋" },
  { id: "taxonomy", label: "Create taxonomic table", icon: "🧬" },
  { id: "verify", label: "Verify GCF ↔ name matches", icon: "✅" },
  { id: "manifest", label: "Write genome manifest", icon: "📄" },
];

const PAGE_SIZE = 50;

/* ── ScanPill ───────────────────────────────────────────────── */
function ScanPill({ label, count, color }) {
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 11px",
        background: "var(--bg-hover)",
        border: "1px solid var(--border)",
        borderRadius: 12,
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 700,
          color,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {(count ?? 0).toLocaleString()}
      </span>
      <span
        style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 500 }}
      >
        {label}
      </span>
    </div>
  );
}

/* ── StatCard ───────────────────────────────────────────────── */
function StatCard({ icon, label, value, color }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 8,
        }}
      >
        <span style={{ fontSize: 22 }}>{icon}</span>
        <span
          style={{
            fontSize: 26,
            fontWeight: 700,
            color,
            fontVariantNumeric: "tabular-nums",
            lineHeight: 1,
          }}
        >
          {value}
        </span>
      </div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "var(--text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </div>
    </div>
  );
}

/* ── FileCheck ──────────────────────────────────────────────── */
function FileCheck({ val }) {
  return val ? (
    <span
      style={{ color: "var(--accent-green)", fontWeight: 700, fontSize: 14 }}
    >
      ✓
    </span>
  ) : (
    <span style={{ color: "var(--text-muted)", fontSize: 14 }}>—</span>
  );
}

/* ── StepRow ────────────────────────────────────────────────── */
function StepRow({ index, step, state, progress, isLast }) {
  const { status = "pending", message = "" } = state;

  const getStatusIcon = () => {
    switch (status) {
      case "running":
        return (
          <span
            style={{
              color: "var(--accent-blue)",
              fontSize: 18,
              display: "inline-block",
              animation: "processorSpin 1s linear infinite",
              lineHeight: 1,
            }}
          >
            ↻
          </span>
        );
      case "done":
        return (
          <span
            style={{
              color: "var(--accent-green)",
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            ✓
          </span>
        );
      case "warn":
        return (
          <span style={{ color: "var(--accent-yellow)", fontSize: 16 }}>⚠</span>
        );
      case "error":
        return (
          <span
            style={{
              color: "var(--accent-red)",
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            ✗
          </span>
        );
      default:
        return (
          <span style={{ color: "var(--text-muted)", fontSize: 16 }}>○</span>
        );
    }
  };

  const labelColor =
    {
      pending: "var(--text-muted)",
      running: "var(--accent-blue)",
      done: "var(--text-primary)",
      warn: "var(--accent-yellow)",
      error: "var(--accent-red)",
    }[status] || "var(--text-muted)";

  const numBg =
    {
      pending: "var(--bg-hover)",
      running: "rgba(56,139,253,0.15)",
      done: "rgba(63,185,80,0.15)",
      warn: "rgba(210,153,34,0.15)",
      error: "rgba(248,81,73,0.15)",
    }[status] || "var(--bg-hover)";

  const showProgress = progress && status === "running" && progress.total > 0;

  return (
    <div
      style={{
        padding: "12px 0",
        borderBottom: isLast ? "none" : "1px solid var(--border)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Circled step number */}
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: "50%",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: numBg,
            border: "1px solid var(--border)",
            fontSize: 11,
            fontWeight: 700,
            color: labelColor,
          }}
        >
          {index}
        </div>

        {/* Step icon */}
        <span style={{ fontSize: 16, flexShrink: 0 }}>{step.icon}</span>

        {/* Step label */}
        <span
          style={{ flex: 1, fontSize: 14, fontWeight: 500, color: labelColor }}
        >
          {step.label}
        </span>

        {/* Message */}
        {message && (
          <span
            style={{
              fontSize: 12,
              color: labelColor,
              maxWidth: 320,
              textAlign: "right",
              flexShrink: 0,
              opacity: 0.9,
            }}
          >
            {message}
          </span>
        )}

        {/* Status icon */}
        <div
          style={{
            flexShrink: 0,
            width: 24,
            textAlign: "center",
            lineHeight: 1,
          }}
        >
          {getStatusIcon()}
        </div>
      </div>

      {/* Inline progress bar for normalize step */}
      {showProgress && (
        <div style={{ marginTop: 10, paddingLeft: 60 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 5,
            }}
          >
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                color: "var(--text-secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "65%",
              }}
            >
              {progress.current}
            </span>
            <span
              style={{
                fontSize: 11,
                color: "var(--text-secondary)",
                fontVariantNumeric: "tabular-nums",
                flexShrink: 0,
              }}
            >
              {progress.idx.toLocaleString()} /{" "}
              {progress.total.toLocaleString()}
            </span>
          </div>
          <div
            style={{
              height: 4,
              background: "var(--bg-hover)",
              borderRadius: 2,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${Math.min(100, Math.round((progress.idx / progress.total) * 100))}%`,
                background: "var(--accent-blue)",
                borderRadius: 2,
                transition: "width 150ms ease",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── ManifestTab ────────────────────────────────────────────── */
function ManifestTab({ rows, page, totalPages, setPage, total }) {
  const headers = [
    "GCF Accession",
    "Normalized Name",
    "Scientific Name",
    "Strain",
    "FNA",
    "FAA",
    "GFF",
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ overflowX: "auto", maxHeight: 380, overflowY: "auto" }}>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: 12,
            tableLayout: "auto",
          }}
        >
          <thead>
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                    padding: "8px 12px",
                    textAlign: "left",
                    background: "var(--bg-card)",
                    color: "var(--text-muted)",
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    borderBottom: "1px solid var(--border)",
                    whiteSpace: "nowrap",
                    userSelect: "none",
                    boxShadow: "0 1px 0 var(--border)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  style={{
                    padding: 32,
                    textAlign: "center",
                    color: "var(--text-muted)",
                    fontSize: 13,
                  }}
                >
                  No manifest entries
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td
                    style={{
                      padding: "6px 12px",
                      fontFamily: "monospace",
                      fontSize: 11,
                      color: "var(--accent-blue)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.gcf || "—"}
                  </td>
                  <td
                    style={{
                      padding: "6px 12px",
                      fontSize: 12,
                      maxWidth: 180,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.normalized_base || row.normalized_name || "—"}
                  </td>
                  <td
                    style={{
                      padding: "6px 12px",
                      fontSize: 12,
                      fontStyle: "italic",
                      color: "var(--text-secondary)",
                      maxWidth: 180,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.scientific_name || "—"}
                  </td>
                  <td
                    style={{
                      padding: "6px 12px",
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      maxWidth: 120,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {row.strain || "—"}
                  </td>
                  <td style={{ padding: "6px 12px", textAlign: "center" }}>
                    <FileCheck val={row.has_fna} />
                  </td>
                  <td style={{ padding: "6px 12px", textAlign: "center" }}>
                    <FileCheck val={row.has_faa} />
                  </td>
                  <td style={{ padding: "6px 12px", textAlign: "center" }}>
                    <FileCheck val={row.has_gff} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 16px",
          borderTop: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {total.toLocaleString()} entries · Page {page + 1} of {totalPages}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            className="btn btn-ghost btn-sm"
            disabled={page === 0}
            onClick={() => setPage(0)}
          >
            «
          </button>
          <button
            className="btn btn-ghost btn-sm"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            ‹
          </button>
          <button
            className="btn btn-ghost btn-sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            ›
          </button>
          <button
            className="btn btn-ghost btn-sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage(totalPages - 1)}
          >
            »
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── ListTab ────────────────────────────────────────────────── */
function ListTab({ items, emptyMsg, color }) {
  if (!items || items.length === 0) {
    return (
      <div
        style={{
          padding: "36px 24px",
          textAlign: "center",
          color: "var(--text-muted)",
          fontSize: 13,
        }}
      >
        ✓ {emptyMsg}
      </div>
    );
  }
  return (
    <div style={{ maxHeight: 400, overflowY: "auto", padding: "8px 16px" }}>
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            padding: "7px 0",
            borderBottom: "1px solid var(--border)",
            fontSize: 12,
            color,
            fontFamily: "monospace",
            lineHeight: 1.5,
            wordBreak: "break-all",
          }}
        >
          {typeof item === "string" ? item : JSON.stringify(item)}
        </div>
      ))}
    </div>
  );
}

/* ── LogEntry ───────────────────────────────────────────────── */
function LogEntry({ entry }) {
  const lvl = (entry.level || "INFO").toUpperCase();
  const levelColor =
    {
      INFO: "var(--text-muted)",
      SUCCESS: "var(--accent-green)",
      WARN: "var(--accent-yellow)",
      WARNING: "var(--accent-yellow)",
      ERROR: "var(--accent-red)",
    }[lvl] || "var(--text-muted)";

  const msgColor = lvl === "INFO" ? "var(--text-secondary)" : levelColor;

  let timeStr = "";
  if (entry.timestamp) {
    try {
      timeStr = new Date(entry.timestamp).toLocaleTimeString();
    } catch {
      timeStr = String(entry.timestamp);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        padding: "1px 0",
        fontSize: 11,
        fontFamily: "monospace",
        lineHeight: 1.6,
      }}
    >
      <span
        style={{
          color: "var(--text-muted)",
          flexShrink: 0,
          minWidth: 72,
          whiteSpace: "nowrap",
        }}
      >
        {timeStr}
      </span>
      <span
        style={{
          color: levelColor,
          flexShrink: 0,
          minWidth: 72,
          fontWeight: lvl !== "INFO" ? 700 : 400,
        }}
      >
        [{lvl}]
      </span>
      <span style={{ color: msgColor, flex: 1, wordBreak: "break-all" }}>
        {entry.message}
      </span>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────── */
export default function Processor() {
  const [config, setConfig] = useState({
    downloadDir: "",
    outputDir: "",
    tsvPath: "",
  });
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [steps, setSteps] = useState({});
  const [progress, setProgress] = useState({ idx: 0, total: 0, current: "" });
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(null);
  const [logs, setLogs] = useState([]);
  const [logOpen, setLogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("manifest");
  const [manifestPage, setManifestPage] = useState(0);

  const logEndRef = useRef(null);

  /* ── Load settings on mount ── */
  useEffect(() => {
    if (!window.electronAPI) return;
    Promise.all([
      window.electronAPI.getSettings(),
      window.electronAPI.getTsvPath(),
    ])
      .then(([settings, tsvPath]) => {
        setConfig((prev) => ({
          ...prev,
          downloadDir: settings?.outputDir || "",
          tsvPath: tsvPath || "",
        }));
      })
      .catch(console.error);
  }, []);

  /* ── Auto-scroll log ── */
  useEffect(() => {
    if (logOpen && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, logOpen]);

  /* ── Cleanup listeners on unmount ── */
  useEffect(() => {
    return () => {
      if (!window.electronAPI) return;
      [
        "processing-step",
        "processing-file",
        "processing-log",
        "processing-done",
      ].forEach((ch) => window.electronAPI.removeAllListeners(ch));
    };
  }, []);

  /* ── Browse directory ── */
  const handleBrowse = async (field) => {
    if (!window.electronAPI) return;
    const dir = await window.electronAPI.selectDirectory();
    if (dir) setConfig((prev) => ({ ...prev, [field]: dir }));
  };

  /* ── Scan downloads ── */
  const handleScan = async () => {
    if (!config.downloadDir || scanning) return;
    setScanning(true);
    setScanResult(null);
    try {
      const result = await window.electronAPI.scanDownloads({
        downloadDir: config.downloadDir,
        tsvPath: config.tsvPath,
      });
      if (result.ok) {
        const withFiles = result.results.filter(
          (r) => r.has_fna || r.has_faa || r.has_gff,
        ).length;
        setScanResult({ ...result, withFiles });
      }
    } catch (e) {
      console.error("Scan error:", e);
    }
    setScanning(false);
  };

  /* ── Start processing ── */
  const handleStartProcessing = async () => {
    if (!config.outputDir || running) return;

    // Remove any stale listeners before re-registering
    if (window.electronAPI) {
      [
        "processing-step",
        "processing-file",
        "processing-log",
        "processing-done",
      ].forEach((ch) => window.electronAPI.removeAllListeners(ch));
    }

    setSteps({});
    setProgress({ idx: 0, total: 0, current: "" });
    setDone(null);
    setLogs([]);
    setManifestPage(0);
    setActiveTab("manifest");
    setRunning(true);
    setLogOpen(true);

    window.electronAPI.onProcessingStep((d) => {
      setSteps((prev) => ({
        ...prev,
        [d.stepId]: {
          status: d.status,
          message: d.message,
          total: d.total,
          withFiles: d.withFiles,
          filesCopied: d.filesCopied,
          warnings: d.warnings,
          copyErrors: d.copyErrors,
        },
      }));
    });

    window.electronAPI.onProcessingFile((d) => {
      setProgress({
        idx: d.idx,
        total: d.total,
        current: d.normalized_base || d.gcf || "",
      });
    });

    window.electronAPI.onProcessingLog((d) => {
      setLogs((prev) => {
        const next = [...prev, d];
        return next.length > 500 ? next.slice(next.length - 500) : next;
      });
    });

    window.electronAPI.onProcessingDone((d) => {
      setDone(d);
      setRunning(false);
      [
        "processing-step",
        "processing-file",
        "processing-log",
        "processing-done",
      ].forEach((ch) => window.electronAPI.removeAllListeners(ch));
    });

    try {
      await window.electronAPI.startProcessing({
        downloadDir: config.downloadDir,
        outputDir: config.outputDir,
        tsvPath: config.tsvPath,
      });
    } catch (e) {
      console.error("Processing error:", e);
      setRunning(false);
    }
  };

  /* ── Export log ── */
  const handleExportLog = () => {
    const text = logs
      .map((l) => `[${l.timestamp || ""}] [${l.level || "INFO"}] ${l.message}`)
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `processor-log-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  /* ── Derived values ── */
  const canStart = !!config.outputDir && !running;
  const showSteps = running || !!done || Object.keys(steps).length > 0;
  const manifest = done?.manifest || [];
  const totalPages = Math.max(1, Math.ceil(manifest.length / PAGE_SIZE));
  const manifestRows = manifest.slice(
    manifestPage * PAGE_SIZE,
    (manifestPage + 1) * PAGE_SIZE,
  );

  /* ── Render ── */
  return (
    <div style={styles.root}>
      {/* Keyframe for spinning icon */}
      <style>{`
        @keyframes processorSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      {/* ── Page header ── */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>🔧 File Processor</h1>
          <p style={styles.pageSubtitle}>
            Copy, rename, and organize downloaded genomes into a clean structure
            ready for bioinformatics pipelines.
          </p>
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={styles.body}>
        {/* Config card */}
        <div className="card" style={styles.configCard}>
          <h2 style={styles.cardTitle}>Configuration</h2>

          {/* Source directory */}
          <div style={styles.fieldRow}>
            <label style={styles.fieldLabel}>Source (downloads folder)</label>
            <div style={styles.fieldControls}>
              <input
                className="input"
                style={styles.fieldInput}
                value={config.downloadDir}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, downloadDir: e.target.value }))
                }
                placeholder="Path to downloaded genomes folder…"
              />
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleBrowse("downloadDir")}
              >
                Browse
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleScan}
                disabled={scanning || !config.downloadDir}
              >
                {scanning ? "↻ Scanning…" : "🔍 Scan"}
              </button>
            </div>
          </div>

          {/* Output directory */}
          <div style={styles.fieldRow}>
            <label style={styles.fieldLabel}>Processing output folder</label>
            <div style={styles.fieldControls}>
              <input
                className="input"
                style={styles.fieldInput}
                value={config.outputDir}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, outputDir: e.target.value }))
                }
                placeholder="Path for processed output (genomes-scaffolds/, etc.)…"
              />
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleBrowse("outputDir")}
              >
                Browse
              </button>
            </div>
          </div>

          {/* Metadata TSV */}
          <div style={styles.fieldRow}>
            <label style={styles.fieldLabel}>Metadata TSV</label>
            <div style={styles.fieldControls}>
              <input
                className="input"
                style={styles.fieldInput}
                value={config.tsvPath}
                onChange={(e) =>
                  setConfig((p) => ({ ...p, tsvPath: e.target.value }))
                }
                placeholder="Path to metadata TSV file…"
              />
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleBrowse("tsvPath")}
              >
                Browse
              </button>
            </div>
          </div>

          {/* Start button */}
          <div style={styles.startRow}>
            <button
              className="btn btn-primary"
              onClick={handleStartProcessing}
              disabled={!canStart}
              style={{
                opacity: canStart ? 1 : 0.5,
                cursor: canStart ? "pointer" : "not-allowed",
              }}
            >
              {running ? "↻ Processing…" : "▶ Start Processing"}
            </button>
          </div>
        </div>

        {/* Output folder structure info */}
        <div className="card" style={styles.infoCard}>
          <div style={styles.infoHeader}>
            <span style={{ fontSize: 15 }}>📁</span>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: "var(--text-secondary)",
              }}
            >
              Output folder will be organized as:
            </span>
          </div>
          <pre style={styles.infoTree}>
            {[
              "  genomes-scaffolds/    ← genome FASTA (.fna)",
              "  protein-sequences/    ← protein FASTA (.faa)",
              "  gff-files/            ← annotation (.gff)",
              "  input/                ← all files + taxonomic_table.tsv",
              "  taxonomic_table.tsv",
              "  genome_manifest.tsv",
            ].join("\n")}
          </pre>
        </div>

        {/* Scan preview */}
        {scanResult && (
          <div className="card" style={styles.scanCard}>
            <div
              style={{
                marginBottom: 10,
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text-primary)",
              }}
            >
              Found {(scanResult.total ?? 0).toLocaleString()} genome
              directories
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <ScanPill
                label="FNA"
                count={scanResult.results.filter((r) => r.has_fna).length}
                color="var(--accent-blue)"
              />
              <ScanPill
                label="FAA"
                count={scanResult.results.filter((r) => r.has_faa).length}
                color="var(--accent-green)"
              />
              <ScanPill
                label="GFF"
                count={scanResult.results.filter((r) => r.has_gff).length}
                color="var(--accent-purple)"
              />
              <ScanPill
                label="No files"
                count={(scanResult.total ?? 0) - (scanResult.withFiles ?? 0)}
                color="var(--accent-yellow)"
              />
            </div>
          </div>
        )}

        {/* Pipeline steps */}
        {showSteps && (
          <div className="card" style={styles.stepsCard}>
            <h2 style={styles.cardTitle}>Pipeline Progress</h2>
            <div>
              {STEPS.map((step, i) => (
                <StepRow
                  key={step.id}
                  index={i + 1}
                  step={step}
                  state={steps[step.id] || { status: "pending" }}
                  progress={step.id === "normalize" ? progress : null}
                  isLast={i === STEPS.length - 1}
                />
              ))}
            </div>
          </div>
        )}

        {/* Results section */}
        {done && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Stat cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: 12,
              }}
            >
              <StatCard
                icon="🧬"
                label="Genomes processed"
                value={(done.total ?? 0).toLocaleString()}
                color="var(--accent-blue)"
              />
              <StatCard
                icon="📁"
                label="Files copied"
                value={(done.filesCopied ?? 0).toLocaleString()}
                color="var(--accent-green)"
              />
              <StatCard
                icon="⚠️"
                label="Warnings"
                value={(done.verifyWarnings?.length ?? 0).toLocaleString()}
                color="var(--accent-yellow)"
              />
              <StatCard
                icon="❌"
                label="Copy errors"
                value={(done.copyErrors?.length ?? 0).toLocaleString()}
                color={
                  (done.copyErrors?.length ?? 0) > 0
                    ? "var(--accent-red)"
                    : "var(--text-secondary)"
                }
              />
            </div>

            {/* Tab container */}
            <div className="card" style={{ overflow: "hidden", padding: 0 }}>
              {/* Tab header */}
              <div
                style={{
                  display: "flex",
                  borderBottom: "1px solid var(--border)",
                  padding: "0 4px",
                }}
              >
                {[
                  {
                    id: "manifest",
                    label: `Manifest (${manifest.length.toLocaleString()})`,
                  },
                  {
                    id: "warnings",
                    label: `Warnings (${(done.verifyWarnings?.length ?? 0).toLocaleString()})`,
                  },
                  {
                    id: "errors",
                    label: `Errors (${(done.copyErrors?.length ?? 0).toLocaleString()})`,
                  },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    style={{
                      padding: "10px 16px",
                      background: "transparent",
                      border: "none",
                      borderBottom: `2px solid ${activeTab === tab.id ? "var(--accent-blue)" : "transparent"}`,
                      color:
                        activeTab === tab.id
                          ? "var(--accent-blue)"
                          : "var(--text-secondary)",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 500,
                      marginBottom: -1,
                      transition: "color 120ms ease",
                    }}
                    onClick={() => {
                      setActiveTab(tab.id);
                      if (tab.id === "manifest") setManifestPage(0);
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab body */}
              {activeTab === "manifest" && (
                <ManifestTab
                  rows={manifestRows}
                  page={manifestPage}
                  totalPages={totalPages}
                  setPage={setManifestPage}
                  total={manifest.length}
                />
              )}
              {activeTab === "warnings" && (
                <ListTab
                  items={done.verifyWarnings}
                  emptyMsg="No warnings"
                  color="var(--accent-yellow)"
                />
              )}
              {activeTab === "errors" && (
                <ListTab
                  items={done.copyErrors}
                  emptyMsg="No copy errors"
                  color="var(--accent-red)"
                />
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {done.outputDir && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => window.electronAPI.openPath(done.outputDir)}
                >
                  📂 Open Output Folder
                </button>
              )}
              {done.outputDir && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    window.electronAPI.openPath(
                      `${done.outputDir}/taxonomic_table.tsv`,
                    )
                  }
                >
                  📊 Open Taxonomic Table (in Finder)
                </button>
              )}
              {done.outputDir && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    window.electronAPI.openPath(
                      `${done.outputDir}/genome_manifest.tsv`,
                    )
                  }
                >
                  📋 Open Manifest (in Finder)
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Live log (collapsible, pinned to bottom) ── */}
      <div style={styles.logSection}>
        <button style={styles.logToggle} onClick={() => setLogOpen((p) => !p)}>
          <span style={{ fontSize: 9, color: "var(--text-muted)" }}>
            {logOpen ? "▼" : "▶"}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--text-secondary)",
            }}
          >
            Live Log
          </span>
          {logs.length > 0 && (
            <span
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                marginLeft: 4,
              }}
            >
              ({logs.length.toLocaleString()} lines)
            </span>
          )}
          {logs.length > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginLeft: "auto", fontSize: 11 }}
              onClick={(e) => {
                e.stopPropagation();
                handleExportLog();
              }}
            >
              ⬇ Export .txt
            </button>
          )}
        </button>

        {logOpen && (
          <div style={styles.logBody}>
            {logs.length === 0 ? (
              <span
                style={{
                  color: "var(--text-muted)",
                  fontSize: 11,
                  fontFamily: "monospace",
                }}
              >
                No log entries yet…
              </span>
            ) : (
              logs.map((entry, i) => <LogEntry key={i} entry={entry} />)
            )}
            <div ref={logEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Styles ─────────────────────────────────────────────────── */
const styles = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
    background: "var(--bg-primary)",
    color: "var(--text-primary)",
  },

  pageHeader: {
    padding: "20px 24px 16px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-secondary)",
    flexShrink: 0,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: 700,
    color: "var(--text-primary)",
    margin: 0,
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 13,
    color: "var(--text-secondary)",
    margin: 0,
    lineHeight: 1.5,
  },

  body: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    padding: 24,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    minHeight: 0,
  },

  configCard: {
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--text-primary)",
    margin: "0 0 4px 0",
  },
  fieldRow: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-secondary)",
    letterSpacing: "0.02em",
  },
  fieldControls: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  fieldInput: {
    flex: 1,
    minWidth: 0,
    fontFamily: "monospace",
    fontSize: 12,
  },
  startRow: {
    display: "flex",
    justifyContent: "flex-end",
    paddingTop: 8,
    borderTop: "1px solid var(--border)",
  },

  infoCard: {
    padding: "14px 16px",
  },
  infoHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  infoTree: {
    margin: 0,
    padding: "12px 16px",
    background: "var(--bg-primary)",
    borderRadius: 6,
    border: "1px solid var(--border)",
    fontSize: 12,
    fontFamily: "monospace",
    color: "var(--text-secondary)",
    lineHeight: 1.8,
    whiteSpace: "pre",
    overflowX: "auto",
  },

  scanCard: {
    padding: "14px 16px",
  },

  stepsCard: {
    padding: "16px 20px",
  },

  logSection: {
    borderTop: "1px solid var(--border)",
    background: "var(--bg-secondary)",
    flexShrink: 0,
  },
  logToggle: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    width: "100%",
    padding: "9px 16px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
  },
  logBody: {
    maxHeight: 220,
    overflowY: "auto",
    padding: "4px 16px 12px",
    display: "flex",
    flexDirection: "column",
  },
};
