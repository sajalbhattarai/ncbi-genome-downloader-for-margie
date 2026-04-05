import { useState, useEffect, useRef, useCallback } from "react";

/* ─────────────────────────────────────────────────────────────
   Constants
───────────────────────────────────────────────────────────── */
const MAX_LOG_LINES = 200;

const INITIAL_STEPS = [
  {
    id: "scan",
    label: "Scan & enumerate genomes",
    status: "pending",
    message: "",
  },
  {
    id: "normalize",
    label: "Copy & normalize filenames",
    status: "pending",
    message: "",
  },
  {
    id: "taxonomy",
    label: "Build taxonomic table",
    status: "pending",
    message: "",
  },
  {
    id: "verify",
    label: "Verify GCF accessions",
    status: "pending",
    message: "",
  },
  {
    id: "manifest",
    label: "Write genome manifest",
    status: "pending",
    message: "",
  },
  {
    id: "segregate",
    label: "Segregate by taxonomy",
    status: "pending",
    message: "",
  },
  { id: "html", label: "Generate HTML report", status: "pending", message: "" },
];

const LOG_COLOR = {
  INFO: "#8892b0",
  SUCCESS: "#4caf50",
  WARN: "#f39c12",
  ERROR: "#e74c3c",
};

/* ─────────────────────────────────────────────────────────────
   Pure helpers
───────────────────────────────────────────────────────────── */
function fmtTs(ts) {
  if (!ts) return "--:--:--";
  const s = String(ts);
  if (/^\d{2}:\d{2}:\d{2}/.test(s)) return s.slice(0, 8);
  try {
    return new Date(ts).toLocaleTimeString("en-GB", { hour12: false });
  } catch {
    return "--:--:--";
  }
}

function stepLabelColor(status) {
  const map = {
    running: "var(--accent-blue)",
    done: "var(--accent-green)",
    warn: "#f39c12",
    error: "var(--accent-red)",
    skip: "var(--text-muted)",
    pending: "var(--text-secondary)",
  };
  return map[status] ?? "var(--text-secondary)";
}

/* ─────────────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────────────── */
function StepIcon({ status }) {
  const config = {
    pending: { char: "○", color: "var(--text-muted)" },
    running: { char: "●", color: "var(--accent-blue)", pulse: true },
    done: { char: "✓", color: "var(--accent-green)" },
    warn: { char: "!", color: "var(--accent-yellow)" },
    skip: { char: "—", color: "var(--text-muted)" },
    error: { char: "×", color: "var(--accent-red)" },
  };
  const { char, color, pulse } = config[status] ?? config.pending;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 20,
        height: 20,
        borderRadius: "50%",
        border: `1px solid ${color}`,
        color,
        fontSize:
          status === "done" || status === "warn" || status === "error"
            ? 11
            : 12,
        fontWeight: 700,
        fontFamily: "var(--font-mono)",
        flexShrink: 0,
        animation: pulse ? "pulse 1.4s ease-in-out infinite" : "none",
        lineHeight: 1,
      }}
    >
      {char}
    </span>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div style={S.statPill}>
      <span style={{ ...S.pillValue, color: color || "var(--text-primary)" }}>
        {typeof value === "number" ? value.toLocaleString() : (value ?? "—")}
      </span>
      <span style={S.pillLabel}>{label}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────── */
export default function Processing() {
  const [downloadDir, setDownloadDir] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [tsvPath, setTsvPath] = useState("");
  const [segregateByTaxonomy, setSegregateByTaxonomy] = useState(true);
  const [generateHtml, setGenerateHtml] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [steps, setSteps] = useState(INITIAL_STEPS);
  const [logs, setLogs] = useState([]);
  const [doneData, setDoneData] = useState(null);
  const logEndRef = useRef(null);

  /* ── On mount: load TSV path + wire IPC events ── */
  useEffect(() => {
    if (!window.electronAPI) return;

    window.electronAPI.getTsvPath().then(setTsvPath).catch(console.error);

    window.electronAPI.onProcessingStep(({ id, status, message }) => {
      setSteps((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, status, message: message || "" } : s,
        ),
      );
    });

    window.electronAPI.onProcessingLog(({ ts, level, message }) => {
      setLogs((prev) => {
        const entry = {
          id: Math.random(),
          ts: fmtTs(ts),
          level: (level || "INFO").toUpperCase(),
          message: message || "",
        };
        const next = [...prev, entry];
        return next.length > MAX_LOG_LINES ? next.slice(-MAX_LOG_LINES) : next;
      });
    });

    window.electronAPI.onProcessingFile(({ current, total, name }) => {
      setSteps((prev) =>
        prev.map((s) =>
          s.id === "normalize"
            ? {
                ...s,
                status: "running",
                message: `${current}/${total} — ${name || ""}`,
              }
            : s,
        ),
      );
    });

    window.electronAPI.onProcessingDone((data) => {
      setRunning(false);
      setFinished(true);
      setDoneData(data);
    });

    return () => {
      window.electronAPI.removeAllListeners("processing-step");
      window.electronAPI.removeAllListeners("processing-log");
      window.electronAPI.removeAllListeners("processing-file");
      window.electronAPI.removeAllListeners("processing-done");
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Auto-scroll log to bottom ── */
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  /* ── Handlers ── */
  const browseDownloadDir = useCallback(async () => {
    if (!window.electronAPI) return;
    const dir = await window.electronAPI.selectDirectory();
    if (dir) setDownloadDir(dir);
  }, []);

  const browseOutputDir = useCallback(async () => {
    if (!window.electronAPI) return;
    const dir = await window.electronAPI.selectDirectory();
    if (dir) setOutputDir(dir);
  }, []);

  const handleScan = useCallback(async () => {
    if (!downloadDir || !window.electronAPI) return;
    setScanning(true);
    setScanResult(null);
    try {
      const result = await window.electronAPI.scanDownloads({
        downloadDir,
        tsvPath,
      });
      setScanResult(result);
    } catch (err) {
      console.error("scanDownloads error:", err);
    } finally {
      setScanning(false);
    }
  }, [downloadDir, tsvPath]);

  const handleStartProcessing = useCallback(async () => {
    if (!downloadDir || !outputDir || !window.electronAPI) return;
    setRunning(true);
    setFinished(false);
    setSteps(INITIAL_STEPS);
    setLogs([]);
    setDoneData(null);
    try {
      await window.electronAPI.startProcessing({
        downloadDir,
        outputDir,
        tsvPath,
        segregateByTaxonomy,
        generateHtml,
      });
    } catch (err) {
      console.error("startProcessing error:", err);
      setRunning(false);
    }
  }, [downloadDir, outputDir, tsvPath, segregateByTaxonomy, generateHtml]);

  const showProgress = running || finished;

  /* ── Render ── */
  return (
    <div style={S.root}>
      {/* ── Page header ── */}
      <div style={S.pageHeader}>
        <h2 style={S.pageTitle}>Processing</h2>
        <p style={S.pageSubtitle}>
          Copy, rename, and organize downloaded genomes into a clean output
          structure.
        </p>
      </div>

      {/* ── Scrollable body ── */}
      <div style={S.body}>
        {/* ──────────── A. Configuration card ──────────── */}
        <div style={S.card}>
          <div style={S.sectionTitle}>Configuration</div>

          {/* Source folder */}
          <div style={S.fieldGroup}>
            <label style={S.label}>Source folder (downloads)</label>
            <div style={S.inputRow}>
              <input
                style={S.input}
                type="text"
                value={downloadDir}
                onChange={(e) => setDownloadDir(e.target.value)}
                placeholder="/path/to/downloads"
                spellCheck={false}
              />
              <button
                className="btn btn-ghost btn-sm"
                onClick={browseDownloadDir}
              >
                Browse
              </button>
            </div>
          </div>

          {/* Output folder */}
          <div style={S.fieldGroup}>
            <label style={S.label}>
              Output folder (processing destination)
            </label>
            <div style={S.inputRow}>
              <input
                style={S.input}
                type="text"
                value={outputDir}
                onChange={(e) => setOutputDir(e.target.value)}
                placeholder="/path/to/output"
                spellCheck={false}
              />
              <button
                className="btn btn-ghost btn-sm"
                onClick={browseOutputDir}
              >
                Browse
              </button>
            </div>
          </div>

          {/* TSV path (read-only info) */}
          <div style={S.fieldGroup}>
            <label style={S.label}>TSV metadata path</label>
            <div style={S.tsvDisplay}>
              {tsvPath ? (
                tsvPath
              ) : (
                <span style={{ color: "var(--text-muted)" }}>Loading...</span>
              )}
            </div>
          </div>

          {/* Divider */}
          <div style={S.divider} />

          {/* Checkboxes */}
          <div style={S.checkboxGroup}>
            <label style={S.checkboxLabel}>
              <input
                type="checkbox"
                checked={segregateByTaxonomy}
                onChange={(e) => setSegregateByTaxonomy(e.target.checked)}
                style={S.checkbox}
              />
              <span style={S.checkboxText}>
                <strong>Segregate by taxonomy</strong>
                {" - organizes files into "}
                <code style={S.code}>
                  by-taxonomy/Phylum/Class/Order/Family/
                </code>
                {" subdirectories"}
              </span>
            </label>
            <label style={S.checkboxLabel}>
              <input
                type="checkbox"
                checked={generateHtml}
                onChange={(e) => setGenerateHtml(e.target.checked)}
                style={S.checkbox}
              />
              <span style={S.checkboxText}>
                <strong>Generate HTML report</strong>
                {" - creates "}
                <code style={S.code}>genome_browser.html</code>
                {" in the output folder"}
              </span>
            </label>
          </div>

          {/* Action row */}
          <div style={S.actionRow}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleScan}
              disabled={!downloadDir || scanning}
            >
              {scanning ? "Scanning..." : "Scan Downloads"}
            </button>
            <button
              className="btn btn-primary"
              onClick={handleStartProcessing}
              disabled={!downloadDir || !outputDir || running}
            >
              {running ? "Processing..." : "Start Processing"}
            </button>
          </div>
        </div>

        {/* ──────────── B. Scan preview card ──────────── */}
        {scanResult && (
          <div style={S.card}>
            <div style={S.sectionTitle}>Scan Preview</div>
            <div style={S.statPills}>
              <StatPill
                label="Total Found"
                value={scanResult.total}
                color="var(--text-primary)"
              />
              <StatPill
                label="With FNA"
                value={scanResult.withFna}
                color="var(--accent-blue)"
              />
              <StatPill
                label="With FAA"
                value={scanResult.withFaa}
                color="var(--accent-green)"
              />
              <StatPill
                label="With GFF"
                value={scanResult.withGff}
                color="#f39c12"
              />
            </div>

            {scanResult.results && scanResult.results.length > 0 && (
              <div style={S.previewTable}>
                <div style={S.previewHeader}>
                  <span style={S.previewCell}>Accession</span>
                  <span style={{ ...S.previewCell, textAlign: "center" }}>
                    FNA
                  </span>
                  <span style={{ ...S.previewCell, textAlign: "center" }}>
                    FAA
                  </span>
                  <span style={{ ...S.previewCell, textAlign: "center" }}>
                    GFF
                  </span>
                </div>
                {scanResult.results.slice(0, 10).map((r, i) => (
                  <div
                    key={i}
                    style={{
                      ...S.previewRow,
                      borderBottom:
                        i < Math.min(scanResult.results.length, 10) - 1
                          ? "1px solid var(--border)"
                          : "none",
                    }}
                  >
                    <span
                      style={{
                        ...S.previewCell,
                        fontFamily: "monospace",
                        fontSize: 11,
                      }}
                    >
                      {r.accession || r.gcf || r.name || "-"}
                    </span>
                    <span
                      style={{
                        ...S.previewCell,
                        textAlign: "center",
                        color: r.hasFna
                          ? "var(--accent-green)"
                          : "var(--text-muted)",
                      }}
                    >
                      {r.hasFna ? "v" : "-"}
                    </span>
                    <span
                      style={{
                        ...S.previewCell,
                        textAlign: "center",
                        color: r.hasFaa
                          ? "var(--accent-green)"
                          : "var(--text-muted)",
                      }}
                    >
                      {r.hasFaa ? "v" : "-"}
                    </span>
                    <span
                      style={{
                        ...S.previewCell,
                        textAlign: "center",
                        color: r.hasGff
                          ? "var(--accent-green)"
                          : "var(--text-muted)",
                      }}
                    >
                      {r.hasGff ? "v" : "-"}
                    </span>
                  </div>
                ))}
                {scanResult.results.length > 10 && (
                  <div
                    style={{
                      padding: "6px 12px",
                      fontSize: 11,
                      color: "var(--text-muted)",
                      fontStyle: "italic",
                    }}
                  >
                    ... and {(scanResult.results.length - 10).toLocaleString()}{" "}
                    more
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ──────────── C. Progress steps ──────────── */}
        {showProgress && (
          <div style={S.card}>
            <div style={S.sectionTitle}>Progress</div>

            {/* ── Step progress summary ── */}
            {(running || finished) &&
              (() => {
                const doneCount = steps.filter(
                  (s) =>
                    s.status === "done" ||
                    s.status === "warn" ||
                    s.status === "skip",
                ).length;
                const remaining = steps.filter(
                  (s) => s.status === "pending",
                ).length;
                const activeStep = steps.find((s) => s.status === "running");
                return (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "8px 14px",
                      background: "var(--bg-hover)",
                      borderRadius: "var(--radius)",
                      marginBottom: 10,
                      fontSize: 12,
                    }}
                  >
                    <span
                      style={{
                        color: "var(--text-secondary)",
                        fontFamily: "var(--font-mono)",
                      }}
                    >
                      {doneCount}/{steps.length}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 3,
                        background: "var(--border)",
                        borderRadius: 2,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${(doneCount / steps.length) * 100}%`,
                          background:
                            finished && !doneData?.success
                              ? "var(--accent-red)"
                              : "var(--accent-blue)",
                          borderRadius: 2,
                          transition: "width 300ms ease",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        color: "var(--text-muted)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {activeStep
                        ? activeStep.label
                        : remaining > 0
                          ? `${remaining} step${remaining !== 1 ? "s" : ""} remaining`
                          : finished
                            ? "Complete"
                            : "Ready"}
                    </span>
                  </div>
                );
              })()}

            <div style={S.stepList}>
              {steps.map((step, i) => (
                <div
                  key={step.id}
                  style={{
                    ...S.stepRow,
                    borderBottom:
                      i < steps.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <span style={S.stepIcon}>
                    <StepIcon status={step.status} />
                  </span>
                  <div style={S.stepInfo}>
                    <span
                      style={{
                        ...S.stepName,
                        color: stepLabelColor(step.status),
                      }}
                    >
                      {step.label}
                    </span>
                    {step.message ? (
                      <span style={S.stepMsg}>{step.message}</span>
                    ) : step.status === "pending" ? (
                      <span
                        style={{
                          ...S.stepMsg,
                          color: "var(--text-muted)",
                          opacity: 0.5,
                        }}
                      >
                        —
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ──────────── D. Live log panel ──────────── */}
        {showProgress && (
          <div style={S.logCard}>
            <div style={S.logHeader}>
              <span style={S.logTitle}>Live Log</span>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                last {MAX_LOG_LINES} lines
              </span>
            </div>
            <div style={S.logScroll}>
              {logs.length === 0 ? (
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  Log output will appear here once processing starts...
                </span>
              ) : (
                logs.map((entry) => (
                  <div key={entry.id} style={S.logLine}>
                    <span style={S.logTs}>[{entry.ts}]</span>
                    <span
                      style={{
                        ...S.logLevel,
                        color: LOG_COLOR[entry.level] ?? LOG_COLOR.INFO,
                      }}
                    >
                      {entry.level}
                    </span>
                    <span
                      style={{
                        ...S.logMsg,
                        color: LOG_COLOR[entry.level] ?? LOG_COLOR.INFO,
                      }}
                    >
                      {entry.message}
                    </span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        )}

        {/* ──────────── E. Final summary card ──────────── */}
        {doneData && doneData.success && (
          <div style={S.summaryCard}>
            <div style={{ ...S.sectionTitle, color: "var(--accent-green)" }}>
              Processing Complete
            </div>
            <div style={S.statPills}>
              <StatPill
                label="Total Genomes"
                value={doneData.total}
                color="var(--text-primary)"
              />
              <StatPill
                label="Files Copied"
                value={doneData.copied}
                color="var(--accent-green)"
              />
              <StatPill
                label="Warnings"
                value={doneData.warnings != null ? doneData.warnings : 0}
                color={
                  (doneData.warnings != null ? doneData.warnings : 0) > 0
                    ? "#f39c12"
                    : "var(--text-muted)"
                }
              />
            </div>
            <div style={S.summaryButtons}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => window.electronAPI.openPath(outputDir)}
              >
                Open Output Folder
              </button>
              {doneData.htmlPath && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => window.electronAPI.openPath(doneData.htmlPath)}
                >
                  Open HTML Report
                </button>
              )}
              {segregateByTaxonomy && (
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() =>
                    window.electronAPI.openPath(outputDir + "/by-taxonomy")
                  }
                >
                  Open by-taxonomy Folder
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Styles
───────────────────────────────────────────────────────────── */
const S = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
    background: "var(--bg-primary)",
  },
  pageHeader: {
    padding: "16px 20px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-secondary)",
    flexShrink: 0,
  },
  pageTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "-0.02em",
  },
  pageSubtitle: {
    margin: "4px 0 0",
    fontSize: 12,
    color: "var(--text-secondary)",
    lineHeight: 1.5,
  },
  body: {
    flex: 1,
    overflowY: "auto",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: 12,
    boxSizing: "border-box",
  },
  card: {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: 16,
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 10,
  },
  fieldGroup: {
    marginBottom: 12,
  },
  label: {
    display: "block",
    fontSize: 12,
    fontWeight: 500,
    color: "var(--text-secondary)",
    marginBottom: 5,
  },
  inputRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  input: {
    flex: 1,
    background: "var(--bg-hover)",
    border: "1px solid var(--border)",
    color: "var(--text-primary)",
    borderRadius: 5,
    padding: "6px 10px",
    fontSize: 13,
    outline: "none",
    fontFamily: "inherit",
    minWidth: 0,
  },
  tsvDisplay: {
    background: "var(--bg-hover)",
    border: "1px solid var(--border)",
    borderRadius: 5,
    padding: "6px 10px",
    fontSize: 12,
    color: "var(--text-muted)",
    fontFamily: "monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  divider: {
    height: 1,
    background: "var(--border)",
    margin: "14px 0",
  },
  checkboxGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    marginBottom: 14,
  },
  checkboxLabel: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    cursor: "pointer",
  },
  checkbox: {
    marginTop: 3,
    flexShrink: 0,
    accentColor: "var(--accent-blue)",
    cursor: "pointer",
  },
  checkboxText: {
    fontSize: 13,
    color: "var(--text-primary)",
    lineHeight: 1.5,
  },
  code: {
    fontFamily: "monospace",
    fontSize: 11,
    background: "rgba(255,255,255,0.06)",
    padding: "1px 5px",
    borderRadius: 3,
    color: "var(--accent-blue)",
  },
  actionRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
  },
  statPills: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  statPill: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "8px 16px",
    background: "var(--bg-hover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    minWidth: 80,
  },
  pillValue: {
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  pillLabel: {
    fontSize: 10,
    fontWeight: 600,
    color: "var(--text-muted)",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  previewTable: {
    border: "1px solid var(--border)",
    borderRadius: 6,
    overflow: "hidden",
  },
  previewHeader: {
    display: "grid",
    gridTemplateColumns: "1fr 64px 64px 64px",
    background: "var(--bg-hover)",
    padding: "6px 12px",
    fontSize: 11,
    fontWeight: 700,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    borderBottom: "1px solid var(--border)",
  },
  previewRow: {
    display: "grid",
    gridTemplateColumns: "1fr 64px 64px 64px",
    padding: "6px 12px",
    fontSize: 12,
    color: "var(--text-secondary)",
  },
  previewCell: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  stepList: {
    display: "flex",
    flexDirection: "column",
  },
  stepRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: "8px 0",
  },
  stepIcon: {
    fontSize: 15,
    lineHeight: 1.3,
    flexShrink: 0,
    width: 22,
    textAlign: "center",
  },
  stepInfo: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  stepName: {
    fontSize: 13,
    fontWeight: 500,
    lineHeight: 1.3,
  },
  stepMsg: {
    fontSize: 11,
    color: "var(--text-muted)",
    fontFamily: "monospace",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  logCard: {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    minHeight: 200,
    maxHeight: 320,
    flexShrink: 0,
  },
  logHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 14px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  logTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  logScroll: {
    flex: 1,
    overflowY: "auto",
    padding: "8px 14px",
    fontFamily: "monospace",
    fontSize: 12,
    lineHeight: 1.6,
    minHeight: 0,
    background: "var(--bg-primary)",
  },
  logLine: {
    display: "flex",
    gap: 8,
    lineHeight: 1.5,
  },
  logTs: {
    color: "var(--text-muted)",
    flexShrink: 0,
    userSelect: "none",
  },
  logLevel: {
    flexShrink: 0,
    fontWeight: 700,
    minWidth: 56,
  },
  logMsg: {
    flex: 1,
    wordBreak: "break-all",
  },
  summaryCard: {
    background: "rgba(76, 175, 80, 0.05)",
    border: "1px solid rgba(76, 175, 80, 0.3)",
    borderRadius: 8,
    padding: 16,
    flexShrink: 0,
  },
  summaryButtons: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginTop: 4,
  },
};
