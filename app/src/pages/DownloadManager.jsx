import { useState, useEffect, useRef, useCallback, useMemo } from "react";

/* ─────────────────────────────────────────────────────────────
   Constants & pure helpers
───────────────────────────────────────────────────────────── */
const BLOCKLIST = new Set(["GCF_963665895.2"]);

const DOT_COLOR = {
  pending: "#30363d",
  running: "#388bfd",
  done: "#3fb950",
  failed: "#f85149",
  skip: "#e6edf3",
};

const LOG_COLOR = {
  INFO: "#8b949e",
  SUCCESS: "#3fb950",
  WARN: "#d29922",
  ERROR: "#f85149",
  SKIP: "#484f58",
  DEBUG: "#a371f7",
};

const DOTS_PER_ROW = 50;
const MAX_LOG_LINES = 100;

const DOWNLOAD_MODES = [
  { key: "all", label: "All genomes" },
  { key: "reference", label: "Reference only" },
  { key: "representative", label: "Representative only" },
  { key: "taxonomy", label: "By taxonomy" },
  { key: "manual", label: "Manual entry" },
];

/** Extract GCF accession strings from column 2 of raw TSV text */
function parseTsv(text) {
  if (!text) return [];
  return text
    .split("\n")
    .slice(1) // skip header row
    .map((l) => l.split("\t")[2]?.trim())
    .filter((gcf) => gcf && gcf.startsWith("GCF_") && !BLOCKLIST.has(gcf));
}

/** Parse raw TSV text into full row objects keyed by header name */
function parseFullTsv(text) {
  if (!text) return [];
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].split("\t").map((h) => h.trim());
  return lines
    .slice(1)
    .map((line) => {
      const cols = line.split("\t");
      const obj = {};
      header.forEach((h, i) => {
        obj[h] = (cols[i] || "").trim();
      });
      return obj;
    })
    .filter((r) => r.gcf_accession && r.gcf_accession.startsWith("GCF_"));
}

function fmtTime(iso) {
  if (!iso) return "--:--:--";
  try {
    return new Date(iso).toLocaleTimeString("en-GB", { hour12: false });
  } catch {
    return "--:--:--";
  }
}

/* ─────────────────────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────────────────────── */

function StatCard({ label, value, color, dimLabel }) {
  return (
    <div style={S.statCard}>
      <span style={{ ...S.statValue, color: color || "var(--text-primary)" }}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </span>
      <span
        style={{
          ...S.statLabel,
          color: dimLabel ? "var(--text-muted)" : "var(--text-secondary)",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function Dot({ gcf, status }) {
  return (
    <div
      title={`${gcf} — ${status}`}
      style={{
        width: 12,
        height: 12,
        borderRadius: 2,
        background: DOT_COLOR[status] ?? DOT_COLOR.pending,
        flexShrink: 0,
        cursor: "default",
      }}
    />
  );
}

function StatusPill({ running, finished, stopped }) {
  let label = "Idle";
  let color = "var(--text-muted)";
  let showDot = false;

  if (running) {
    label = "Downloading…";
    color = "var(--accent-blue)";
    showDot = true;
  } else if (finished) {
    label = "Complete";
    color = "var(--accent-green)";
  } else if (stopped) {
    label = "Stopped";
    color = "var(--accent-yellow)";
  }

  return (
    <div style={{ ...S.statusPill, color }}>
      {showDot && <span style={S.pulseDot} />}
      {label}
    </div>
  );
}

function LogLine({ entry }) {
  const color = LOG_COLOR[entry.level] ?? LOG_COLOR.INFO;
  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        lineHeight: 1.55,
        fontStyle: entry.level === "SKIP" ? "italic" : "normal",
      }}
    >
      <span style={S.logTime}>{entry.ts}</span>
      <span style={{ color, fontWeight: 600, flexShrink: 0, minWidth: 56 }}>
        [{entry.level}]
      </span>
      <span style={{ color, flex: 1, wordBreak: "break-all" }}>
        {entry.message}
      </span>
    </div>
  );
}

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
        {count}
      </span>
      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
        {label}
      </span>
    </div>
  );
}

function ScanDetailsTable({ results }) {
  const [showDetails, setShowDetails] = useState(false);
  const displayed = results.slice(0, 20);
  return (
    <div>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => setShowDetails((v) => !v)}
        style={{ marginBottom: 8 }}
      >
        {showDetails ? "▾ Hide details" : "▸ Show details"} (
        {Math.min(results.length, 20)} of {results.length})
      </button>
      {showDetails && (
        <div style={{ overflowX: "auto" }}>
          <table style={S.detailTable}>
            <thead>
              <tr>
                {["Scientific Name", "GCF", "Phylum", "FNA", "FAA", "GFF"].map(
                  (h) => (
                    <th key={h} style={S.detailTh}>
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {displayed.map((r) => (
                <tr key={r.gcf}>
                  <td style={S.detailTd}>{r.scientific_name || "—"}</td>
                  <td
                    style={{
                      ...S.detailTd,
                      fontFamily: "monospace",
                      fontSize: 11,
                    }}
                  >
                    {r.gcf}
                  </td>
                  <td style={S.detailTd}>{r.phylum || "—"}</td>
                  <td
                    style={{
                      ...S.detailTd,
                      textAlign: "center",
                      color: r.has_fna
                        ? "var(--accent-blue)"
                        : "var(--text-muted)",
                    }}
                  >
                    {r.has_fna ? "✓" : "—"}
                  </td>
                  <td
                    style={{
                      ...S.detailTd,
                      textAlign: "center",
                      color: r.has_faa
                        ? "var(--accent-green)"
                        : "var(--text-muted)",
                    }}
                  >
                    {r.has_faa ? "✓" : "—"}
                  </td>
                  <td
                    style={{
                      ...S.detailTd,
                      textAlign: "center",
                      color: r.has_gff ? "#a371f7" : "var(--text-muted)",
                    }}
                  >
                    {r.has_gff ? "✓" : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {results.length > 20 && (
            <p
              style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}
            >
              Showing first 20 of {results.length.toLocaleString()} results.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   Main page component
───────────────────────────────────────────────────────────── */
export default function DownloadManager({
  downloadStats = {},
  setDownloadStats,
}) {
  /* ── existing state ── */
  const [settings, setSettings] = useState(null);
  const [accessions, setAccessions] = useState([]);
  const [statuses, setStatuses] = useState({});
  const [localStats, setLocalStats] = useState({
    success: 0,
    failed: 0,
    total: 0,
    remaining: 0,
  });
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const [stopped, setStopped] = useState(false);
  const [logs, setLogs] = useState([]);
  const logEndRef = useRef(null);

  /* ── new state ── */
  const [tsvPath, setTsvPath] = useState("");
  const [allRows, setAllRows] = useState([]);
  const [scanResult, setScanResult] = useState(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [dupList, setDupList] = useState([]);
  const [dupScanned, setDupScanned] = useState(false);
  const [deleteResult, setDeleteResult] = useState(null);
  const [downloadMode, setDownloadMode] = useState("all");
  const [taxFilters, setTaxFilters] = useState({
    phylum: "",
    class: "",
    order: "",
    family: "",
    genus: "",
    species: "",
    strain: "",
  });
  const [taxRows, setTaxRows] = useState([]);
  const [manualInput, setManualInput] = useState("");
  const [existingOpen, setExistingOpen] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [advOpen, setAdvOpen] = useState(true);

  /* ── on mount: load settings + TSV, wire IPC listeners ── */
  useEffect(() => {
    if (!window.electronAPI) return;

    /* 1. settings */
    window.electronAPI
      .getSettings()
      .then((s) => setSettings(s))
      .catch(console.error);

    /* 2. TSV → accessions + store tsvPath */
    (async () => {
      try {
        const path = await window.electronAPI.getTsvPath();
        if (!path) return;
        setTsvPath(path);
        const text = await window.electronAPI.readTsv(path);
        const gcfs = parseTsv(text);
        setAccessions(gcfs);
        setLocalStats((prev) => ({
          ...prev,
          total: gcfs.length,
          remaining: gcfs.length,
        }));
      } catch (err) {
        console.error("TSV load failed:", err);
      }
    })();

    /* 3. IPC listeners */
    window.electronAPI.onGenomeStatus(({ gcf, status }) => {
      setStatuses((prev) => ({ ...prev, [gcf]: status }));
    });

    window.electronAPI.onDownloadProgress(
      ({ success, failed, remaining, total }) => {
        setLocalStats({ success, failed, remaining, total });
        if (setDownloadStats) {
          setDownloadStats((prev) => ({
            ...prev,
            downloaded: success,
            failed,
          }));
        }
      },
    );

    window.electronAPI.onDownloadsDone(({ success, failed }) => {
      setRunning(false);
      setFinished(true);
      setLocalStats((prev) => ({ ...prev, success, failed, remaining: 0 }));
      if (setDownloadStats) {
        setDownloadStats((prev) => ({
          ...prev,
          downloaded: success,
          failed,
          running: false,
        }));
      }
    });

    window.electronAPI.onLogLine((data) => {
      const entry = {
        id: Math.random(),
        ts: fmtTime(data.timestamp),
        level: (data.level || "INFO").toUpperCase(),
        message: data.message || "",
      };
      setLogs((prev) => {
        const next = [...prev, entry];
        return next.length > MAX_LOG_LINES ? next.slice(-MAX_LOG_LINES) : next;
      });
    });

    return () => {
      window.electronAPI.removeAllListeners("genome-status");
      window.electronAPI.removeAllListeners("download-progress");
      window.electronAPI.removeAllListeners("downloads-done");
      window.electronAPI.removeAllListeners("log-line");
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── load full TSV rows when tsvPath is set ── */
  useEffect(() => {
    if (!window.electronAPI || !tsvPath) return;
    window.electronAPI
      .readTsv(tsvPath)
      .then((text) => setAllRows(parseFullTsv(text)))
      .catch(console.error);
  }, [tsvPath]);

  /* ── auto-scroll log to bottom ── */
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  /* ── taxonomy dropdown options derived from allRows ── */
  const phylumOptions = useMemo(
    () => [...new Set(allRows.map((r) => r.phylum).filter(Boolean))].sort(),
    [allRows],
  );
  const classOptions = useMemo(() => {
    const rows = taxFilters.phylum
      ? allRows.filter((r) => r.phylum === taxFilters.phylum)
      : allRows;
    return [...new Set(rows.map((r) => r.class).filter(Boolean))].sort();
  }, [allRows, taxFilters.phylum]);
  const orderOptions = useMemo(() => {
    let rows = taxFilters.phylum
      ? allRows.filter((r) => r.phylum === taxFilters.phylum)
      : allRows;
    if (taxFilters.class)
      rows = rows.filter((r) => r.class === taxFilters.class);
    return [...new Set(rows.map((r) => r.order).filter(Boolean))].sort();
  }, [allRows, taxFilters.phylum, taxFilters.class]);
  const familyOptions = useMemo(() => {
    let rows = taxFilters.phylum
      ? allRows.filter((r) => r.phylum === taxFilters.phylum)
      : allRows;
    if (taxFilters.class)
      rows = rows.filter((r) => r.class === taxFilters.class);
    if (taxFilters.order)
      rows = rows.filter((r) => r.order === taxFilters.order);
    return [...new Set(rows.map((r) => r.family).filter(Boolean))].sort();
  }, [allRows, taxFilters.phylum, taxFilters.class, taxFilters.order]);

  const genusOptions = useMemo(() => {
    let rows = taxFilters.phylum
      ? allRows.filter((r) => r.phylum === taxFilters.phylum)
      : allRows;
    if (taxFilters.class)
      rows = rows.filter((r) => r.class === taxFilters.class);
    if (taxFilters.order)
      rows = rows.filter((r) => r.order === taxFilters.order);
    if (taxFilters.family)
      rows = rows.filter((r) => r.family === taxFilters.family);
    return [...new Set(rows.map((r) => r.genus).filter(Boolean))].sort();
  }, [
    allRows,
    taxFilters.phylum,
    taxFilters.class,
    taxFilters.order,
    taxFilters.family,
  ]);

  const speciesOptions = useMemo(() => {
    let rows = taxFilters.phylum
      ? allRows.filter((r) => r.phylum === taxFilters.phylum)
      : allRows;
    if (taxFilters.class)
      rows = rows.filter((r) => r.class === taxFilters.class);
    if (taxFilters.order)
      rows = rows.filter((r) => r.order === taxFilters.order);
    if (taxFilters.family)
      rows = rows.filter((r) => r.family === taxFilters.family);
    if (taxFilters.genus)
      rows = rows.filter((r) => r.genus === taxFilters.genus);
    return [...new Set(rows.map((r) => r.species).filter(Boolean))].sort();
  }, [
    allRows,
    taxFilters.phylum,
    taxFilters.class,
    taxFilters.order,
    taxFilters.family,
    taxFilters.genus,
  ]);

  const strainOptions = useMemo(() => {
    let rows = taxFilters.phylum
      ? allRows.filter((r) => r.phylum === taxFilters.phylum)
      : allRows;
    if (taxFilters.class)
      rows = rows.filter((r) => r.class === taxFilters.class);
    if (taxFilters.order)
      rows = rows.filter((r) => r.order === taxFilters.order);
    if (taxFilters.family)
      rows = rows.filter((r) => r.family === taxFilters.family);
    if (taxFilters.genus)
      rows = rows.filter((r) => r.genus === taxFilters.genus);
    if (taxFilters.species)
      rows = rows.filter((r) => r.species === taxFilters.species);
    return [...new Set(rows.map((r) => r.strain).filter(Boolean))].sort();
  }, [
    allRows,
    taxFilters.phylum,
    taxFilters.class,
    taxFilters.order,
    taxFilters.family,
    taxFilters.genus,
    taxFilters.species,
  ]);

  /* ── manual accessions parsed from text area ── */
  const manualAccessions = useMemo(
    () =>
      manualInput
        .split(/[;\n]+/)
        .map((s) => s.trim())
        .filter((s) => /^GCF_/.test(s)),
    [manualInput],
  );

  /* ── count of accessions that will be sent for the current mode ── */
  const filteredCount = useMemo(() => {
    if (downloadMode === "all") return accessions.length;
    if (downloadMode === "reference") {
      const s = new Set(
        allRows
          .filter((r) => r.refseq_category === "reference genome")
          .map((r) => r.gcf_accession),
      );
      return accessions.filter((gcf) => s.has(gcf)).length;
    }
    if (downloadMode === "representative") {
      const s = new Set(
        allRows
          .filter((r) => r.refseq_category === "representative genome")
          .map((r) => r.gcf_accession),
      );
      return accessions.filter((gcf) => s.has(gcf)).length;
    }
    if (downloadMode === "manual") return manualAccessions.length;
    if (downloadMode === "taxonomy") return taxRows.length;
    return accessions.length;
  }, [downloadMode, accessions, allRows, manualAccessions, taxRows]);

  /* ── redundant count: already-downloaded GCFs that overlap with queue ── */
  const redundantCount = useMemo(() => {
    if (!scanResult?.results) return 0;
    const scanSet = new Set(scanResult.results.map((r) => r.gcf));
    return accessions.filter((gcf) => scanSet.has(gcf)).length;
  }, [scanResult, accessions]);

  /* ── handlers ── */

  const handleScan = useCallback(async () => {
    if (!settings?.outputDir || !tsvPath) return;
    setScanLoading(true);
    try {
      const result = await window.electronAPI.scanOutputDir({
        outputDir: settings.outputDir,
        tsvPath,
      });
      setScanResult(result);
      if (setDownloadStats) {
        setDownloadStats((prev) => ({
          ...prev,
          downloaded: result.total ?? result.results?.length ?? 0,
        }));
      }
    } catch (err) {
      console.error("scan error:", err);
    }
    setScanLoading(false);
  }, [settings, tsvPath]);

  const handleFindDuplicates = useCallback(async () => {
    if (!settings?.outputDir || !tsvPath) return;
    setScanLoading(true);
    setDupScanned(false);
    try {
      const result = await window.electronAPI.scanOutputDir({
        outputDir: settings.outputDir,
        tsvPath,
      });
      setScanResult(result);
      if (setDownloadStats) {
        setDownloadStats((prev) => ({
          ...prev,
          downloaded: result.total ?? result.results?.length ?? 0,
        }));
      }
      const accSet = new Set(accessions);
      const dups = (result.results || [])
        .filter((r) => accSet.has(r.gcf))
        .map((r) => ({ ...r, selected: false }));
      setDupList(dups);
      setDeleteResult(null);
      setDupScanned(true);
    } catch (err) {
      console.error("scan error:", err);
    }
    setScanLoading(false);
  }, [settings, tsvPath, accessions]);

  const handleDeleteSelected = useCallback(async () => {
    const gcfList = dupList.filter((r) => r.selected).map((r) => r.gcf);
    if (gcfList.length === 0) return;
    if (
      !window.confirm(
        `Delete ${gcfList.length} genome folder(s)? This cannot be undone.`,
      )
    )
      return;
    try {
      const result = await window.electronAPI.deleteGenomes({
        outputDir: settings.outputDir,
        gcfList,
      });
      setDeleteResult(result);
      /* re-scan to refresh the list */
      const refreshed = await window.electronAPI.scanOutputDir({
        outputDir: settings.outputDir,
        tsvPath,
      });
      setScanResult(refreshed);
      const accSet = new Set(accessions);
      setDupList(
        (refreshed.results || [])
          .filter((r) => accSet.has(r.gcf))
          .map((r) => ({ ...r, selected: false })),
      );
    } catch (err) {
      console.error("delete error:", err);
    }
  }, [dupList, settings, tsvPath, accessions]);

  const handleLoadTaxonomy = useCallback(async () => {
    if (!tsvPath) return;
    const filters = {};
    if (taxFilters.phylum) filters.phylum = taxFilters.phylum;
    if (taxFilters.class) filters.class = taxFilters.class;
    if (taxFilters.order) filters.order = taxFilters.order;
    if (taxFilters.family) filters.family = taxFilters.family;
    if (taxFilters.genus) filters.genus = taxFilters.genus;
    if (taxFilters.species) filters.species = taxFilters.species;
    if (taxFilters.strain) filters.strain = taxFilters.strain;
    try {
      const result = await window.electronAPI.getGenomeList({
        tsvPath,
        filters,
      });
      setTaxRows(result.rows || []);
    } catch (err) {
      console.error("getGenomeList error:", err);
    }
  }, [tsvPath, taxFilters]);

  const handleStart = useCallback(async () => {
    if (!settings || accessions.length === 0) return;
    setRunning(true);
    setFinished(false);
    setStopped(false);
    if (setDownloadStats) setDownloadStats((p) => ({ ...p, running: true }));

    let filteredAccessions = accessions;
    if (downloadMode === "reference") {
      const refSet = new Set(
        allRows
          .filter((r) => r.refseq_category === "reference genome")
          .map((r) => r.gcf_accession),
      );
      filteredAccessions = accessions.filter((gcf) => refSet.has(gcf));
    } else if (downloadMode === "representative") {
      const repSet = new Set(
        allRows
          .filter((r) => r.refseq_category === "representative genome")
          .map((r) => r.gcf_accession),
      );
      filteredAccessions = accessions.filter((gcf) => repSet.has(gcf));
    } else if (downloadMode === "manual") {
      filteredAccessions = manualInput
        .split(/[;\n]+/)
        .map((s) => s.trim())
        .filter((s) => /^GCF_/.test(s));
    } else if (downloadMode === "taxonomy") {
      const taxSet = new Set(taxRows.map((r) => r.gcf_accession));
      filteredAccessions = accessions.filter((gcf) => taxSet.has(gcf));
    }

    if (filteredAccessions.length === 0) {
      setRunning(false);
      if (setDownloadStats) setDownloadStats((p) => ({ ...p, running: false }));
      return;
    }

    try {
      await window.electronAPI.startDownloads({
        accessions: filteredAccessions,
        outDir: settings.outputDir,
        apiKey: settings.apiKey || "",
        parallelism: settings.parallelism || 4,
      });
    } catch (err) {
      console.error("startDownloads error:", err);
      setRunning(false);
      if (setDownloadStats) setDownloadStats((p) => ({ ...p, running: false }));
    }
  }, [
    settings,
    accessions,
    allRows,
    downloadMode,
    manualInput,
    taxRows,
    setDownloadStats,
  ]);

  const handleStop = useCallback(() => {
    window.electronAPI.stopDownloads();
    setRunning(false);
    setStopped(true);
    if (setDownloadStats) setDownloadStats((p) => ({ ...p, running: false }));
  }, [setDownloadStats]);

  const handleOpenFolder = useCallback(() => {
    if (settings?.outputDir) window.electronAPI.openPath(settings.outputDir);
  }, [settings]);

  /* ── derived values ── */
  const total = localStats.total || accessions.length || 2999;
  const success = localStats.success || 0;
  const failedCnt = localStats.failed || 0;
  const remaining = localStats.remaining ?? total - success - failedCnt;
  const pct = total > 0 ? (success / total) * 100 : 0;
  const canScan = !!settings?.outputDir && !!tsvPath;

  /* ── render ── */
  return (
    <div style={S.root}>
      {/* ── 1. top stats bar ── */}
      <div style={S.statsBar}>
        <StatCard label="Total" value={total} color="var(--text-primary)" />
        <StatCard
          label="Downloaded"
          value={success}
          color="var(--accent-green)"
        />
        <StatCard
          label="Failed ✗"
          value={failedCnt}
          color={failedCnt > 0 ? "var(--accent-red)" : "var(--text-muted)"}
          dimLabel={failedCnt === 0}
        />
        <StatCard
          label="Remaining"
          value={remaining}
          color="var(--accent-blue)"
        />
      </div>

      {/* ── 2. progress bar ── */}
      <div style={S.progressSection}>
        <div style={S.progressTrack}>
          <div style={{ ...S.progressFill, width: `${pct}%` }} />
        </div>
        <p style={S.progressLabel}>
          {success.toLocaleString()} of {total.toLocaleString()} genomes
          downloaded ({pct.toFixed(1)}%)
        </p>
      </div>

      {/* ── 3. control row ── */}
      <div style={S.controlRow}>
        <button
          className="btn btn-primary"
          onClick={handleStart}
          disabled={running || accessions.length === 0}
        >
          ▶ Start Downloads
          {downloadMode !== "all" && filteredCount !== accessions.length && (
            <span style={{ opacity: 0.75, marginLeft: 6, fontSize: 11 }}>
              ({filteredCount.toLocaleString()} filtered)
            </span>
          )}
        </button>
        <button
          className="btn btn-danger"
          onClick={handleStop}
          disabled={!running}
        >
          ⏹ Stop
        </button>
        <button
          className="btn btn-ghost"
          onClick={handleOpenFolder}
          disabled={!settings?.outputDir}
        >
          📁 Open Output Folder
        </button>
        <div style={S.controlSpacer} />
        <StatusPill running={running} finished={finished} stopped={stopped} />
      </div>

      {/* ── 4. Advanced Download Options card ── */}
      <div style={S.featureCard}>
        <button
          style={S.featureCardHeader}
          onClick={() => setAdvOpen((o) => !o)}
        >
          <span style={S.sectionHeading}>Advanced Download Options</span>
          <span style={S.chevron}>{advOpen ? "▾" : "▸"}</span>
        </button>

        {advOpen && (
          <div style={{ padding: "0 16px 14px" }}>
            {/* Mode selector */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ ...S.sectionLabel, marginBottom: 8 }}>
                Download Mode
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {DOWNLOAD_MODES.map((m) => (
                  <button
                    key={m.key}
                    onClick={() => setDownloadMode(m.key)}
                    style={{
                      ...S.modePill,
                      ...(downloadMode === m.key
                        ? S.modePillActive
                        : S.modePillInactive),
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {/* By Taxonomy mode */}
            {downloadMode === "taxonomy" && (
              <div style={S.modePanel}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 10,
                  }}
                >
                  <div style={S.sectionLabel}>Taxonomy Filters</div>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 11 }}
                    onClick={() =>
                      setTaxFilters({
                        phylum: "",
                        class: "",
                        order: "",
                        family: "",
                        genus: "",
                        species: "",
                        strain: "",
                      })
                    }
                  >
                    ✕ Clear all
                  </button>
                </div>

                {/* Row 1: Higher-level ranks */}
                <div style={{ marginBottom: 4 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 6,
                    }}
                  >
                    Higher classification
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: 8,
                      marginBottom: 12,
                    }}
                  >
                    <div>
                      <label style={S.dropdownLabel}>Phylum</label>
                      <select
                        style={S.dropdown}
                        value={taxFilters.phylum}
                        onChange={(e) =>
                          setTaxFilters((f) => ({
                            ...f,
                            phylum: e.target.value,
                            class: "",
                            order: "",
                            family: "",
                            genus: "",
                            species: "",
                            strain: "",
                          }))
                        }
                      >
                        <option value="">
                          All (
                          {
                            [
                              ...new Set(
                                allRows.map((r) => r.phylum).filter(Boolean),
                              ),
                            ].length
                          }
                          )
                        </option>
                        {phylumOptions.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={S.dropdownLabel}>Class</label>
                      <select
                        style={S.dropdown}
                        value={taxFilters.class}
                        onChange={(e) =>
                          setTaxFilters((f) => ({
                            ...f,
                            class: e.target.value,
                            order: "",
                            family: "",
                            genus: "",
                            species: "",
                            strain: "",
                          }))
                        }
                      >
                        <option value="">All ({classOptions.length})</option>
                        {classOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={S.dropdownLabel}>Order</label>
                      <select
                        style={S.dropdown}
                        value={taxFilters.order}
                        onChange={(e) =>
                          setTaxFilters((f) => ({
                            ...f,
                            order: e.target.value,
                            family: "",
                            genus: "",
                            species: "",
                            strain: "",
                          }))
                        }
                      >
                        <option value="">All ({orderOptions.length})</option>
                        {orderOptions.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={S.dropdownLabel}>Family</label>
                      <select
                        style={S.dropdown}
                        value={taxFilters.family}
                        onChange={(e) =>
                          setTaxFilters((f) => ({
                            ...f,
                            family: e.target.value,
                            genus: "",
                            species: "",
                            strain: "",
                          }))
                        }
                      >
                        <option value="">All ({familyOptions.length})</option>
                        {familyOptions.map((fam) => (
                          <option key={fam} value={fam}>
                            {fam}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Row 2: Lower-level ranks */}
                <div style={{ marginBottom: 10 }}>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                      marginBottom: 6,
                    }}
                  >
                    Lower classification
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 8,
                    }}
                  >
                    <div>
                      <label style={S.dropdownLabel}>Genus</label>
                      <select
                        style={S.dropdown}
                        value={taxFilters.genus}
                        onChange={(e) =>
                          setTaxFilters((f) => ({
                            ...f,
                            genus: e.target.value,
                            species: "",
                            strain: "",
                          }))
                        }
                      >
                        <option value="">All ({genusOptions.length})</option>
                        {genusOptions.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={S.dropdownLabel}>Species</label>
                      <select
                        style={S.dropdown}
                        value={taxFilters.species}
                        onChange={(e) =>
                          setTaxFilters((f) => ({
                            ...f,
                            species: e.target.value,
                            strain: "",
                          }))
                        }
                      >
                        <option value="">All ({speciesOptions.length})</option>
                        {speciesOptions.map((sp) => (
                          <option key={sp} value={sp}>
                            {sp}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={S.dropdownLabel}>Strain</label>
                      <select
                        style={S.dropdown}
                        value={taxFilters.strain}
                        onChange={(e) =>
                          setTaxFilters((f) => ({
                            ...f,
                            strain: e.target.value,
                          }))
                        }
                      >
                        <option value="">All ({strainOptions.length})</option>
                        {strainOptions.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Active filter summary */}
                {Object.values(taxFilters).some(Boolean) && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 5,
                      marginBottom: 10,
                    }}
                  >
                    {Object.entries(taxFilters)
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <span
                          key={k}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 8px",
                            borderRadius: 10,
                            background: "var(--accent-blue-10)",
                            border: "1px solid var(--accent-blue-20)",
                            fontSize: 11,
                            color: "var(--accent-blue)",
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 600,
                              textTransform: "capitalize",
                            }}
                          >
                            {k}:
                          </span>
                          <span>{v}</span>
                          <button
                            onClick={() =>
                              setTaxFilters((f) => ({ ...f, [k]: "" }))
                            }
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "0 1px",
                              color: "var(--accent-blue)",
                              fontSize: 12,
                              lineHeight: 1,
                            }}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                  </div>
                )}

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={handleLoadTaxonomy}
                  >
                    Load matching genomes
                  </button>
                  {taxRows.length > 0 && (
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--accent-blue)",
                        fontWeight: 600,
                      }}
                    >
                      {taxRows.length.toLocaleString()} genome
                      {taxRows.length !== 1 ? "s" : ""} matched
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Manual entry mode */}
            {downloadMode === "manual" && (
              <div style={S.modePanel}>
                <div style={{ ...S.sectionLabel, marginBottom: 8 }}>
                  GCF Accessions
                </div>
                <textarea
                  style={S.manualTextarea}
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder={
                    "Enter GCF accessions separated by semicolons or newlines\nExample: GCF_013267415.1; GCF_022807975.1"
                  }
                  rows={5}
                />
                <div
                  style={{
                    fontSize: 12,
                    color:
                      manualAccessions.length > 0
                        ? "var(--accent-blue)"
                        : "var(--text-muted)",
                    marginTop: 6,
                  }}
                >
                  {manualAccessions.length > 0
                    ? `${manualAccessions.length.toLocaleString()} accessions entered`
                    : "No valid GCF_ accessions detected yet"}
                </div>
              </div>
            )}

            {/* Summary pill for reference / representative modes */}
            {(downloadMode === "reference" ||
              downloadMode === "representative") && (
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  marginTop: 4,
                }}
              >
                {allRows.length > 0
                  ? `${filteredCount.toLocaleString()} genomes match this filter`
                  : "TSV not yet loaded — count will appear once loaded"}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 5. Existing Downloads card ── */}
      <div style={S.featureCard}>
        <button
          style={S.featureCardHeader}
          onClick={() => setExistingOpen((o) => !o)}
        >
          <span style={S.sectionHeading}>Existing Downloads</span>
          <span style={S.chevron}>{existingOpen ? "▾" : "▸"}</span>
        </button>

        {existingOpen && (
          <div style={{ padding: "0 16px 14px" }}>
            {!canScan ? (
              <p
                style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}
              >
                Set an output directory in Settings and ensure a TSV is loaded
                to enable scanning.
              </p>
            ) : (
              <>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleScan}
                  disabled={scanLoading}
                  style={{ marginBottom: 12 }}
                >
                  {scanLoading ? "⏳ Scanning…" : "Scan output folder"}
                </button>

                {scanResult && (
                  <>
                    {/* stat pills */}
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 12,
                      }}
                    >
                      <ScanPill
                        label="genomes downloaded"
                        count={
                          scanResult.total ?? scanResult.results?.length ?? 0
                        }
                        color="var(--text-primary)"
                      />
                      <ScanPill
                        label="w/ FNA"
                        count={
                          (scanResult.results || []).filter((r) => r.has_fna)
                            .length
                        }
                        color="var(--accent-blue)"
                      />
                      <ScanPill
                        label="w/ FAA"
                        count={
                          (scanResult.results || []).filter((r) => r.has_faa)
                            .length
                        }
                        color="var(--accent-green)"
                      />
                      <ScanPill
                        label="w/ GFF"
                        count={
                          (scanResult.results || []).filter((r) => r.has_gff)
                            .length
                        }
                        color="#a371f7"
                      />
                    </div>

                    {/* warning banner */}
                    {(scanResult.total ?? 0) > 0 && (
                      <div style={S.warningBanner}>
                        ⚠️ These genomes are already in your output folder.
                        Starting a download run will skip them automatically.
                      </div>
                    )}

                    {/* redundant count */}
                    {redundantCount > 0 && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--accent-yellow)",
                          marginBottom: 10,
                        }}
                      >
                        {redundantCount.toLocaleString()} accession
                        {redundantCount !== 1 ? "s" : ""} in the current TSV
                        would be skipped as already downloaded.
                      </div>
                    )}

                    {/* details table toggle */}
                    {(scanResult.results?.length ?? 0) > 0 && (
                      <ScanDetailsTable results={scanResult.results} />
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── 6. Manage Duplicates card ── */}
      <div style={S.featureCard}>
        <button
          style={S.featureCardHeader}
          onClick={() => setDupOpen((o) => !o)}
        >
          <span style={S.sectionHeading}>Manage Duplicates</span>
          <span style={S.chevron}>{dupOpen ? "▾" : "▸"}</span>
        </button>

        {dupOpen && (
          <div style={{ padding: "0 16px 14px" }}>
            {!canScan ? (
              <p
                style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}
              >
                Set an output directory in Settings and ensure a TSV is loaded
                to enable duplicate detection.
              </p>
            ) : (
              <>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={handleFindDuplicates}
                  disabled={scanLoading}
                  style={{ marginBottom: 12 }}
                >
                  {scanLoading
                    ? "⏳ Scanning…"
                    : "Find duplicates in output folder"}
                </button>

                {/* deletion result summary */}
                {deleteResult && (
                  <div
                    style={{
                      fontSize: 12,
                      marginBottom: 10,
                      color: "var(--text-secondary)",
                    }}
                  >
                    ✓ {deleteResult.deleted?.length ?? 0} genome folder
                    {(deleteResult.deleted?.length ?? 0) !== 1 ? "s" : ""}{" "}
                    deleted
                    {deleteResult.errors?.length > 0 && (
                      <span
                        style={{
                          color: "var(--accent-red)",
                          marginLeft: 8,
                        }}
                      >
                        · {deleteResult.errors.length} error
                        {deleteResult.errors.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                )}

                {/* no duplicates message */}
                {dupScanned && dupList.length === 0 && !scanLoading && (
                  <p
                    style={{
                      fontSize: 12,
                      color: "var(--accent-green)",
                      margin: 0,
                    }}
                  >
                    ✓ No duplicates found between the output folder and the
                    current TSV.
                  </p>
                )}

                {/* duplicate list */}
                {dupList.length > 0 && (
                  <>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        marginBottom: 8,
                      }}
                    >
                      {dupList.length} genome
                      {dupList.length !== 1 ? "s" : ""} found in both the output
                      folder and the current TSV.
                    </div>

                    {/* bulk action buttons */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setDupList((d) =>
                            d.map((r) => ({ ...r, selected: true })),
                          )
                        }
                      >
                        Select All
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setDupList((d) =>
                            d.map((r) => ({ ...r, selected: false })),
                          )
                        }
                      >
                        Deselect All
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={handleDeleteSelected}
                        disabled={!dupList.some((r) => r.selected)}
                      >
                        🗑 Delete Selected (
                        {dupList.filter((r) => r.selected).length})
                      </button>
                    </div>

                    {/* scrollable duplicate list */}
                    <div style={S.dupListContainer}>
                      {dupList.map((r) => (
                        <label key={r.gcf} style={S.dupRow}>
                          <input
                            type="checkbox"
                            checked={r.selected}
                            onChange={(e) =>
                              setDupList((d) =>
                                d.map((x) =>
                                  x.gcf === r.gcf
                                    ? { ...x, selected: e.target.checked }
                                    : x,
                                ),
                              )
                            }
                            style={{ marginRight: 8, flexShrink: 0 }}
                          />
                          <span
                            style={{
                              flex: 1,
                              fontSize: 12,
                              fontFamily: "monospace",
                              color: "var(--text-primary)",
                            }}
                          >
                            {r.gcf}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--text-muted)",
                              marginLeft: 8,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: 180,
                            }}
                          >
                            {r.scientific_name || "—"}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              marginLeft: 8,
                              color: r.has_fna
                                ? "var(--accent-blue)"
                                : "var(--text-muted)",
                            }}
                          >
                            FNA
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              marginLeft: 4,
                              color: r.has_faa
                                ? "var(--accent-green)"
                                : "var(--text-muted)",
                            }}
                          >
                            FAA
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              marginLeft: 4,
                              color: r.has_gff
                                ? "#a371f7"
                                : "var(--text-muted)",
                            }}
                          >
                            GFF
                          </span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── 7. genome dot grid ── */}
      <div style={S.gridCard} className="card">
        <div style={S.gridHeader}>
          <span style={S.gridTitle}>Genome Status Grid</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {accessions.length} genomes · {DOTS_PER_ROW} per row
          </span>
        </div>
        <div style={S.gridScroll}>
          <div style={S.dotGrid}>
            {accessions.map((gcf) => (
              <Dot key={gcf} gcf={gcf} status={statuses[gcf] || "pending"} />
            ))}
          </div>
        </div>
        <div style={S.legend}>
          {Object.entries(DOT_COLOR).map(([status, color]) => (
            <div key={status} style={S.legendItem}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  background: color,
                  flexShrink: 0,
                }}
              />
              <span style={S.legendLabel}>
                {status === "skip"
                  ? "Skipped"
                  : status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── 8. recent activity log ── */}
      <div style={S.logCard} className="card">
        <div style={S.logHeader}>
          <span style={S.gridTitle}>Recent Activity</span>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            last {MAX_LOG_LINES} lines
          </span>
        </div>
        <div style={S.logScroll}>
          {logs.length === 0 ? (
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
              Log output will appear here once downloads start…
            </span>
          ) : (
            logs.map((entry) => <LogLine key={entry.id} entry={entry} />)
          )}
          <div ref={logEndRef} />
        </div>
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
    overflowY: "auto",
    gap: 12,
    padding: "16px 20px",
    boxSizing: "border-box",
  },

  /* ── stats bar ── */
  statsBar: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 10,
    flexShrink: 0,
  },
  statCard: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    textAlign: "center",
  },
  statValue: {
    fontSize: 26,
    fontWeight: 700,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  statLabel: {
    fontSize: 12,
    fontWeight: 500,
  },

  /* ── progress ── */
  progressSection: {
    flexShrink: 0,
  },
  progressTrack: {
    height: 10,
    background: "var(--bg-hover)",
    borderRadius: 5,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "var(--accent-blue)",
    borderRadius: 5,
    transition: "width 400ms ease",
    backgroundImage: "linear-gradient(90deg, #388bfd 0%, #4d9ffe 100%)",
  },
  progressLabel: {
    margin: "6px 0 0",
    fontSize: 12,
    color: "var(--text-secondary)",
    textAlign: "center",
  },

  /* ── controls ── */
  controlRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
    flexWrap: "wrap",
  },
  controlSpacer: {
    flex: 1,
  },
  statusPill: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    padding: "5px 14px",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 500,
  },
  pulseDot: {
    display: "inline-block",
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "var(--accent-blue)",
    animation: "pulse 1.4s ease-in-out infinite",
  },

  /* ── collapsible feature cards (Advanced Options, Existing Downloads, Duplicates) ── */
  featureCard: {
    flexShrink: 0,
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    overflow: "hidden",
  },
  featureCardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "10px 16px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
    color: "inherit",
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  chevron: {
    fontSize: 12,
    color: "var(--text-muted)",
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },

  /* ── download mode pill selector ── */
  modePill: {
    padding: "4px 12px",
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    transition: "background 150ms, color 150ms",
  },
  modePillActive: {
    background: "rgba(56,139,253,0.12)",
    border: "1px solid var(--accent-blue)",
    color: "var(--accent-blue)",
  },
  modePillInactive: {
    background: "var(--bg-hover)",
    border: "1px solid var(--border)",
    color: "var(--text-secondary)",
  },

  /* ── mode sub-panel (taxonomy / manual) ── */
  modePanel: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: 12,
    marginTop: 4,
  },
  dropdownLabel: {
    display: "block",
    fontSize: 11,
    color: "var(--text-muted)",
    marginBottom: 4,
    fontWeight: 500,
  },
  dropdown: {
    width: "100%",
    padding: "5px 8px",
    borderRadius: 5,
    border: "1px solid var(--border)",
    background: "var(--bg-hover)",
    color: "var(--text-primary)",
    fontSize: 12,
  },
  manualTextarea: {
    width: "100%",
    padding: "8px 10px",
    borderRadius: 5,
    border: "1px solid var(--border)",
    background: "var(--bg-hover)",
    color: "var(--text-primary)",
    fontSize: 12,
    fontFamily: "'SF Mono', Monaco, Consolas, monospace",
    resize: "vertical",
    boxSizing: "border-box",
    lineHeight: 1.5,
  },

  /* ── warning banner ── */
  warningBanner: {
    background: "rgba(210,153,34,0.12)",
    border: "1px solid rgba(210,153,34,0.35)",
    borderRadius: 5,
    padding: "8px 12px",
    fontSize: 12,
    color: "#d29922",
    marginBottom: 10,
  },

  /* ── duplicate list ── */
  dupListContainer: {
    maxHeight: 220,
    overflowY: "auto",
    border: "1px solid var(--border)",
    borderRadius: 5,
    background: "var(--bg-card)",
  },
  dupRow: {
    display: "flex",
    alignItems: "center",
    padding: "5px 10px",
    borderBottom: "1px solid var(--border)",
    cursor: "pointer",
    gap: 4,
  },

  /* ── scan details table ── */
  detailTable: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 11,
  },
  detailTh: {
    textAlign: "left",
    padding: "4px 8px",
    borderBottom: "1px solid var(--border)",
    fontWeight: 600,
    color: "var(--text-secondary)",
    whiteSpace: "nowrap",
  },
  detailTd: {
    padding: "3px 8px",
    borderBottom: "1px solid var(--border)",
    color: "var(--text-primary)",
    maxWidth: 180,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  /* ── dot grid card ── */
  gridCard: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    minHeight: 80,
    padding: 0,
  },
  gridHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 14px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  gridTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-secondary)",
  },
  gridScroll: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    padding: "12px 14px",
    minHeight: 0,
  },
  dotGrid: {
    display: "grid",
    gridTemplateColumns: `repeat(${DOTS_PER_ROW}, 12px)`,
    gap: 2,
  },
  legend: {
    display: "flex",
    gap: 16,
    padding: "8px 14px",
    borderTop: "1px solid var(--border)",
    flexShrink: 0,
    flexWrap: "wrap",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 5,
  },
  legendLabel: {
    fontSize: 11,
    color: "var(--text-secondary)",
  },

  /* ── log panel ── */
  logCard: {
    height: 200,
    minHeight: 200,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    padding: 0,
  },
  logHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "8px 14px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  logScroll: {
    flex: 1,
    overflowY: "auto",
    padding: "8px 14px",
    fontFamily: "'SF Mono', Monaco, Consolas, monospace",
    fontSize: 11,
    lineHeight: 1.6,
    minHeight: 0,
  },
  logTime: {
    color: "var(--text-muted)",
    flexShrink: 0,
    minWidth: 64,
    userSelect: "none",
  },
};
