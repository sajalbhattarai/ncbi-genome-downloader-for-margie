import { useState, useEffect, useRef, useCallback } from "react";

/* ── Constants ─────────────────────────────────────────────── */
const TOTAL_GENOMES = 2999;

/* ── Verification result badge ─────────────────────────────── */
function VerifyBadge({ status }) {
  switch (status) {
    case "ok":
      return <span className="badge badge-green">✓ valid</span>;
    case "missing":
      return <span className="badge badge-yellow">missing</span>;
    case "corrupt":
      return <span className="badge badge-red">✗ corrupt</span>;
    case "checking":
      return <span className="badge badge-blue">checking…</span>;
    default:
      return <span className="badge badge-muted">{status || "pending"}</span>;
  }
}

/* ── Stat card ─────────────────────────────────────────────── */
function StatCard({ label, value, color, sub }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statCardRow}>
        <span
          style={{
            ...styles.statCardValue,
            color: color || "var(--text-primary)",
          }}
        >
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
      </div>
      <span style={styles.statCardLabel}>{label}</span>
      {sub && <span style={styles.statCardSub}>{sub}</span>}
    </div>
  );
}

/* ── Progress bar with label ───────────────────────────────── */
function LabeledProgress({ pct, color, label, sub }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-primary)",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 12,
            color: "var(--text-muted)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {sub}
        </span>
      </div>
      <div className="progress-bar-track" style={{ height: 8 }}>
        <div
          className="progress-bar-fill"
          style={{
            width: `${pct}%`,
            background: color || "var(--accent-blue)",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>0</span>
        <span
          style={{
            fontSize: 11,
            color: color || "var(--accent-blue)",
            fontWeight: 600,
          }}
        >
          {pct}%
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {TOTAL_GENOMES.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

/* ── Result row in the table ───────────────────────────────── */
function ResultRow({ item, idx, onRecheck }) {
  return (
    <tr>
      <td
        style={{
          ...styles.td,
          color: "var(--text-muted)",
          fontSize: 11,
          textAlign: "right",
          width: 44,
        }}
      >
        {idx}
      </td>
      <td style={{ ...styles.td, width: 148 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--accent-blue)",
          }}
        >
          {item.gcf}
        </span>
      </td>
      <td style={{ ...styles.td, width: 200 }}>
        <span
          style={{
            fontStyle: "italic",
            fontSize: 13,
            color: "var(--text-primary)",
          }}
        >
          {item.name || "—"}
        </span>
      </td>
      <td style={{ ...styles.td, width: 100 }}>
        <VerifyBadge status={item.status} />
      </td>
      <td
        style={{
          ...styles.td,
          color: "var(--text-secondary)",
          fontSize: 12,
          maxWidth: 180,
        }}
      >
        <span
          title={item.detail || ""}
          style={{
            display: "block",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {item.detail || "—"}
        </span>
      </td>
      <td
        style={{
          ...styles.td,
          width: 110,
          color: "var(--text-muted)",
          fontSize: 11,
          fontFamily: "var(--font-mono)",
        }}
      >
        {item.size || "—"}
      </td>
      <td style={{ ...styles.td, width: 80 }}>
        {(item.status === "missing" || item.status === "corrupt") && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onRecheck && onRecheck(item.gcf)}
            title="Re-verify this genome"
          >
            ↺
          </button>
        )}
      </td>
    </tr>
  );
}

/* ── Summary donut (SVG) ───────────────────────────────────── */
function SummaryDonut({ ok, missing, corrupt, total }) {
  const SIZE = 100;
  const STROKE = 10;
  const r = (SIZE - STROKE) / 2;
  const circ = 2 * Math.PI * r;

  const pOk = total > 0 ? ok / total : 0;
  const pMissing = total > 0 ? missing / total : 0;
  const pCorrupt = total > 0 ? corrupt / total : 0;

  const segOk = circ * pOk;
  const segMissing = circ * pMissing;
  const segCorrupt = circ * pCorrupt;

  const offsetOk = 0;
  const offsetMissing = offsetOk + segOk;
  const offsetCorrupt = offsetMissing + segMissing;

  const cx = SIZE / 2;
  const cy = SIZE / 2;

  const makeArc = (dashLen, dashOffset) => ({
    cx,
    cy,
    r,
    fill: "none",
    strokeWidth: STROKE,
    strokeDasharray: `${dashLen} ${circ - dashLen}`,
    strokeDashoffset: -dashOffset,
    strokeLinecap: "butt",
    style: { transition: "stroke-dasharray 600ms ease" },
  });

  return (
    <div
      style={{ position: "relative", width: SIZE, height: SIZE, flexShrink: 0 }}
    >
      <svg width={SIZE} height={SIZE} style={{ transform: "rotate(-90deg)" }}>
        {/* Track */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke="var(--bg-hover)"
          strokeWidth={STROKE}
        />
        {/* OK */}
        {pOk > 0 && (
          <circle stroke="var(--accent-green)" {...makeArc(segOk, offsetOk)} />
        )}
        {/* Missing */}
        {pMissing > 0 && (
          <circle
            stroke="var(--accent-yellow)"
            {...makeArc(segMissing, offsetMissing)}
          />
        )}
        {/* Corrupt */}
        {pCorrupt > 0 && (
          <circle
            stroke="var(--accent-red)"
            {...makeArc(segCorrupt, offsetCorrupt)}
          />
        )}
      </svg>
      {/* Centre label */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 1,
        }}
      >
        <span
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "var(--text-primary)",
            lineHeight: 1,
          }}
        >
          {total > 0 ? Math.round((ok / total) * 100) : 0}%
        </span>
        <span
          style={{
            fontSize: 9,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          valid
        </span>
      </div>
    </div>
  );
}

/* ── Filter tabs ───────────────────────────────────────────── */
function FilterTabs({ active, onChange, counts }) {
  const tabs = [
    { id: "all", label: "All", count: counts.all },
    { id: "ok", label: "Valid", count: counts.ok },
    { id: "missing", label: "Missing", count: counts.missing },
    { id: "corrupt", label: "Corrupt", count: counts.corrupt },
  ];

  return (
    <div style={styles.tabs}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`btn btn-sm ${active === tab.id ? "btn-primary" : "btn-ghost"}`}
          onClick={() => onChange(tab.id)}
          style={{ gap: 6 }}
        >
          {tab.label}
          {tab.count > 0 && (
            <span
              style={{
                background:
                  active === tab.id
                    ? "rgba(255,255,255,0.25)"
                    : "var(--bg-hover)",
                color: active === tab.id ? "#fff" : "var(--text-secondary)",
                borderRadius: 10,
                padding: "0 5px",
                fontSize: 10,
                fontWeight: 700,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {tab.count.toLocaleString()}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ── Main component ────────────────────────────────────────── */
export default function Verification({ downloadStats = {} }) {
  const { downloaded = 0 } = downloadStats;

  /* ── State ── */
  const [results, setResults] = useState([]); // { gcf, name, status, detail, size }
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0); // 0-100
  const [checkedCount, setChecked] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [confirmRecheck, setConfirmRecheck] = useState(null);
  const [error, setError] = useState(null);
  const PAGE_SIZE = 100;

  /* ── Derived counts ── */
  const counts = {
    all: results.length,
    ok: results.filter((r) => r.status === "ok").length,
    missing: results.filter((r) => r.status === "missing").length,
    corrupt: results.filter((r) => r.status === "corrupt").length,
  };

  /* ── Filtered results ── */
  const filtered = results.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        r.gcf.toLowerCase().includes(q) ||
        (r.name || "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  /* ── Reset page on filter change ── */
  useEffect(() => {
    setPage(0);
  }, [statusFilter, search]);

  /* ── Subscribe to IPC events ── */
  useEffect(() => {
    if (!window.electronAPI) return;

    const statusHandler = (data) => {
      if (!data) return;
      if (data.verifyResult) {
        const { gcf, name, status, detail, size } = data.verifyResult;
        setResults((prev) => {
          const others = prev.filter((x) => x.gcf !== gcf);
          return [...others, { gcf, name: name || gcf, status, detail, size }];
        });
        setChecked((n) => n + 1);
      }
    };

    const progressHandler = (data) => {
      if (data && typeof data.verifyPct === "number") {
        setProgress(data.verifyPct);
      }
    };

    const doneHandler = (data) => {
      setRunning(false);
      setDone(true);
      if (data && typeof data.verifyPct === "number") {
        setProgress(data.verifyPct);
      }
    };

    window.electronAPI.onGenomeStatus(statusHandler);
    window.electronAPI.onDownloadProgress(progressHandler);
    window.electronAPI.onDownloadsDone(doneHandler);

    return () => {
      window.electronAPI.removeAllListeners("genome-status");
      window.electronAPI.removeAllListeners("download-progress");
      window.electronAPI.removeAllListeners("downloads-done");
    };
  }, []);

  /* ── Handlers ── */
  const handleStartVerify = useCallback(async () => {
    setError(null);
    setResults([]);
    setChecked(0);
    setProgress(0);
    setDone(false);
    setRunning(true);

    if (!window.electronAPI) {
      setError("electronAPI not available — run inside Electron.");
      setRunning(false);
      return;
    }
    try {
      await window.electronAPI.verifyDownloads({});
    } catch (err) {
      setError(err.message || String(err));
      setRunning(false);
    }
  }, []);

  const handleRecheck = useCallback(async (gcf) => {
    setConfirmRecheck(null);
    if (!window.electronAPI) return;
    // Mark item as checking
    setResults((prev) =>
      prev.map((r) => (r.gcf === gcf ? { ...r, status: "checking" } : r)),
    );
    try {
      await window.electronAPI.verifyDownloads({ gcf });
    } catch (err) {
      setResults((prev) =>
        prev.map((r) =>
          r.gcf === gcf ? { ...r, status: "corrupt", detail: err.message } : r,
        ),
      );
    }
  }, []);

  const exportCsv = useCallback(() => {
    const header = "gcf_accession,name,status,detail,size\n";
    const rows = results
      .map(
        (r) =>
          `${r.gcf},"${(r.name || "").replace(/"/g, '""')}",${r.status},"${(r.detail || "").replace(/"/g, '""')}",${r.size || ""}`,
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "verification_results.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, [results]);

  /* ── Render: not started yet ── */
  const neverRun = results.length === 0 && !running && !done;

  return (
    <div style={styles.root}>
      {/* ── Page header ── */}
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>Verification</h2>
          <p style={styles.pageSubtitle}>
            Integrity-check all downloaded genome assemblies — detect missing
            files, size mismatches, and checksum failures.
          </p>
        </div>
        <div style={styles.headerActions}>
          {error && (
            <span
              style={{
                color: "var(--accent-red)",
                fontSize: 12,
                maxWidth: 260,
              }}
            >
              {error}
            </span>
          )}
          {results.length > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={exportCsv}
              title="Export results as CSV"
            >
              ↓ Export CSV
            </button>
          )}
          {running ? (
            <button className="btn btn-danger" disabled>
              <span
                style={{
                  animation: "spin 1s linear infinite",
                  display: "inline-block",
                }}
              >
                ↻
              </span>
              Verifying…
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleStartVerify}
              disabled={downloaded === 0}
              title={
                downloaded === 0
                  ? "No downloaded genomes to verify"
                  : "Start integrity check"
              }
            >
              {done ? "Re-run Verification" : "Start Verification"}
            </button>
          )}
        </div>
      </div>

      <div style={styles.body}>
        {/* ── Left panel: summary ── */}
        <div style={styles.leftCol}>
          {/* Overall summary card */}
          <div
            className="card"
            style={{ display: "flex", flexDirection: "column", gap: 18 }}
          >
            <div
              className="card-header"
              style={{ marginBottom: 0, paddingBottom: 10 }}
            >
              <span className="card-title">Summary</span>
              {done && <span className="badge badge-green">Complete</span>}
              {running && <span className="badge badge-blue">Running</span>}
            </div>

            {/* Donut + legend */}
            <div style={styles.donutRow}>
              <SummaryDonut
                ok={counts.ok}
                missing={counts.missing}
                corrupt={counts.corrupt}
                total={results.length}
              />
              <div style={styles.donutLegend}>
                <div style={styles.legendItem}>
                  <span
                    style={{
                      ...styles.legendDot,
                      background: "var(--accent-green)",
                    }}
                  />
                  <span style={styles.legendLabel}>Valid</span>
                  <span
                    style={{
                      ...styles.legendVal,
                      color: "var(--accent-green)",
                    }}
                  >
                    {counts.ok.toLocaleString()}
                  </span>
                </div>
                <div style={styles.legendItem}>
                  <span
                    style={{
                      ...styles.legendDot,
                      background: "var(--accent-yellow)",
                    }}
                  />
                  <span style={styles.legendLabel}>Missing</span>
                  <span
                    style={{
                      ...styles.legendVal,
                      color: "var(--accent-yellow)",
                    }}
                  >
                    {counts.missing.toLocaleString()}
                  </span>
                </div>
                <div style={styles.legendItem}>
                  <span
                    style={{
                      ...styles.legendDot,
                      background: "var(--accent-red)",
                    }}
                  />
                  <span style={styles.legendLabel}>Corrupt</span>
                  <span
                    style={{ ...styles.legendVal, color: "var(--accent-red)" }}
                  >
                    {counts.corrupt.toLocaleString()}
                  </span>
                </div>
                <div
                  style={{
                    ...styles.legendItem,
                    marginTop: 4,
                    borderTop: "1px solid var(--border-subtle)",
                    paddingTop: 8,
                  }}
                >
                  <span
                    style={{
                      ...styles.legendDot,
                      background: "var(--text-muted)",
                    }}
                  />
                  <span style={styles.legendLabel}>Checked</span>
                  <span
                    style={{
                      ...styles.legendVal,
                      color: "var(--text-secondary)",
                    }}
                  >
                    {results.length.toLocaleString()}
                    <span
                      style={{ color: "var(--text-muted)", fontWeight: 400 }}
                    >
                      {" "}
                      / {TOTAL_GENOMES.toLocaleString()}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Progress bar */}
            {(running || done) && (
              <LabeledProgress
                pct={
                  running
                    ? Math.round((checkedCount / Math.max(1, downloaded)) * 100)
                    : done
                      ? 100
                      : 0
                }
                color={
                  counts.corrupt > 0
                    ? "var(--accent-red)"
                    : counts.missing > 0
                      ? "var(--accent-yellow)"
                      : "var(--accent-green)"
                }
                label="Verification Progress"
                sub={`${checkedCount.toLocaleString()} checked`}
              />
            )}
          </div>

          {/* Stat cards */}
          <div style={styles.statGrid}>
            <StatCard
              label="Valid"
              value={counts.ok}
              color="var(--accent-green)"
              sub="integrity OK"
            />
            <StatCard
              label="Missing"
              value={counts.missing}
              color={
                counts.missing > 0
                  ? "var(--accent-yellow)"
                  : "var(--text-muted)"
              }
              sub="file not found"
            />
            <StatCard
              label="Corrupt"
              value={counts.corrupt}
              color={
                counts.corrupt > 0 ? "var(--accent-red)" : "var(--text-muted)"
              }
              sub="checksum mismatch"
            />
          </div>

          {/* Issues callout */}
          {done && (counts.missing > 0 || counts.corrupt > 0) && (
            <div style={styles.issueCallout}>
              <div style={styles.issueCalloutHeader}>
                <span
                  style={{
                    fontSize: 16,
                    color: "var(--accent-yellow)",
                    fontWeight: 700,
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  !
                </span>
                <span
                  style={{
                    fontWeight: 600,
                    color: "var(--accent-yellow)",
                    fontSize: 13,
                  }}
                >
                  {counts.missing + counts.corrupt} issue
                  {counts.missing + counts.corrupt !== 1 ? "s" : ""} found
                </span>
              </div>
              <p
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  lineHeight: 1.5,
                  margin: 0,
                }}
              >
                {counts.missing > 0 && (
                  <>
                    <strong style={{ color: "var(--text-primary)" }}>
                      {counts.missing}
                    </strong>{" "}
                    genome
                    {counts.missing !== 1 ? "s are" : " is"} missing from
                    disk.{" "}
                  </>
                )}
                {counts.corrupt > 0 && (
                  <>
                    <strong style={{ color: "var(--text-primary)" }}>
                      {counts.corrupt}
                    </strong>{" "}
                    genome
                    {counts.corrupt !== 1 ? "s have" : " has"} a checksum
                    mismatch.{" "}
                  </>
                )}
                Re-download affected assemblies from the Download Manager.
              </p>
            </div>
          )}

          {/* Success callout */}
          {done && counts.ok === results.length && results.length > 0 && (
            <div style={styles.successCallout}>
              <span style={{ fontSize: 18 }}>🎉</span>
              <span
                style={{
                  color: "var(--accent-green)",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                All {results.length.toLocaleString()} genomes passed
                verification!
              </span>
            </div>
          )}

          {/* Not started hint */}
          {neverRun && (
            <div style={styles.hintCard}>
              <span
                style={{
                  color: "var(--text-secondary)",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                No verification run yet
              </span>
              <span
                style={{
                  color: "var(--text-muted)",
                  fontSize: 12,
                  textAlign: "center",
                  lineHeight: 1.5,
                }}
              >
                Click{" "}
                <strong style={{ color: "var(--text-secondary)" }}>
                  Start Verification
                </strong>{" "}
                to check all downloaded assemblies for file integrity.
              </span>
              {downloaded === 0 && (
                <span style={styles.noneDownloaded}>
                  ℹ No genomes have been downloaded yet. Go to the Download
                  Manager first.
                </span>
              )}
            </div>
          )}
        </div>

        {/* ── Right panel: results table ── */}
        <div style={styles.rightCol}>
          {/* Toolbar */}
          <div style={styles.tableToolbar}>
            <FilterTabs
              active={statusFilter}
              onChange={setStatusFilter}
              counts={counts}
            />
            <div style={styles.searchWrap}>
              <input
                className="input"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search accession or name…"
                style={{ paddingLeft: 28, fontSize: 12 }}
              />
            </div>
            <span
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                flexShrink: 0,
              }}
            >
              {filtered.length.toLocaleString()} result
              {filtered.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Table */}
          <div style={styles.tableWrap}>
            {neverRun ? (
              <div className="empty-state">
                <div
                  style={{
                    fontSize: 22,
                    color: "var(--accent-green)",
                    fontWeight: 700,
                  }}
                >
                  ✓
                </div>
                <span className="empty-state-title">
                  Verification results will appear here
                </span>
                <span className="empty-state-sub">
                  Run the verification checker to see per-genome integrity
                  status.
                </span>
              </div>
            ) : running && results.length === 0 ? (
              <div className="empty-state">
                <span
                  style={{
                    fontSize: 32,
                    animation: "spin 1.2s linear infinite",
                    display: "inline-block",
                  }}
                >
                  ↻
                </span>
                <span className="empty-state-title">Checking genomes…</span>
                <span className="empty-state-sub">
                  Results populate in real-time as each genome is verified.
                </span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="empty-state">
                <span className="empty-state-title">
                  No results match your filter
                </span>
                <span className="empty-state-sub">
                  Try switching the filter tab or clearing the search.
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setStatusFilter("all");
                    setSearch("");
                  }}
                  style={{ marginTop: 10 }}
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th
                      style={{
                        ...styles.th,
                        width: 44,
                        textAlign: "right",
                        color: "var(--text-muted)",
                      }}
                    >
                      #
                    </th>
                    <th style={{ ...styles.th, width: 148 }}>GCF Accession</th>
                    <th style={{ ...styles.th, width: 200 }}>
                      Scientific Name
                    </th>
                    <th style={{ ...styles.th, width: 100 }}>Status</th>
                    <th style={{ ...styles.th }}>Detail</th>
                    <th style={{ ...styles.th, width: 110 }}>File Size</th>
                    <th style={{ ...styles.th, width: 80 }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((item, i) => (
                    <ResultRow
                      key={item.gcf}
                      item={item}
                      idx={page * PAGE_SIZE + i + 1}
                      onRecheck={(gcf) => setConfirmRecheck(gcf)}
                    />
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={styles.pagination}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPage(0)}
                disabled={page === 0}
              >
                «
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                ‹ Prev
              </button>
              <span style={styles.pageInfo}>
                Page{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {page + 1}
                </strong>{" "}
                of{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {totalPages}
                </strong>
              </span>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next ›
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setPage(totalPages - 1)}
                disabled={page >= totalPages - 1}
              >
                »
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Recheck confirmation modal ── */}
      {confirmRecheck && (
        <div
          style={styles.modalOverlay}
          onClick={() => setConfirmRecheck(null)}
        >
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: "var(--text-primary)",
                marginBottom: 8,
              }}
            >
              Re-verify genome?
            </h3>
            <p
              style={{
                fontSize: 13,
                color: "var(--text-secondary)",
                marginBottom: 16,
                lineHeight: 1.5,
              }}
            >
              Re-check integrity of{" "}
              <code
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--accent-blue)",
                }}
              >
                {confirmRecheck}
              </code>
              .
            </p>
            <div
              style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
            >
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setConfirmRecheck(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => handleRecheck(confirmRecheck)}
              >
                Re-verify
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Styles ────────────────────────────────────────────────── */
const styles = {
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
    background: "var(--bg-primary)",
  },

  pageHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 22px 12px",
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
    fontSize: 12,
    color: "var(--text-muted)",
    lineHeight: 1.4,
  },
  headerActions: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
    flexWrap: "wrap",
  },

  body: {
    flex: 1,
    display: "flex",
    minHeight: 0,
    overflow: "hidden",
  },

  /* Left panel */
  leftCol: {
    width: 320,
    minWidth: 280,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: 14,
    padding: 18,
    overflowY: "auto",
    borderRight: "1px solid var(--border)",
    background: "var(--bg-primary)",
  },

  donutRow: {
    display: "flex",
    alignItems: "center",
    gap: 20,
  },
  donutLegend: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 7,
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  },
  legendLabel: {
    flex: 1,
    color: "var(--text-secondary)",
  },
  legendVal: {
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    fontSize: 13,
  },

  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 10,
  },
  statCard: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  statCardRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statCardIcon: { fontSize: 13 },
  statCardValue: {
    fontSize: 17,
    fontWeight: 700,
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1,
  },
  statCardLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
  },
  statCardSub: {
    fontSize: 10,
    color: "var(--text-muted)",
  },

  issueCallout: {
    padding: "12px 14px",
    background: "rgba(210,153,34,0.08)",
    border: "1px solid rgba(210,153,34,0.25)",
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  issueCalloutHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },

  successCallout: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 14px",
    background: "rgba(63,185,80,0.08)",
    border: "1px solid rgba(63,185,80,0.25)",
    borderRadius: 8,
  },

  hintCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    padding: "28px 20px",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    textAlign: "center",
  },
  noneDownloaded: {
    fontSize: 11,
    color: "var(--accent-yellow)",
    background: "rgba(210,153,34,0.08)",
    border: "1px solid rgba(210,153,34,0.2)",
    borderRadius: 6,
    padding: "7px 10px",
    lineHeight: 1.45,
  },

  /* Right panel */
  rightCol: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
  },

  tableToolbar: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 16px",
    background: "var(--bg-secondary)",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
    flexWrap: "wrap",
  },
  tabs: {
    display: "flex",
    gap: 4,
    flexShrink: 0,
  },
  searchWrap: {
    position: "relative",
    flex: 1,
    minWidth: 140,
  },
  searchIcon: {
    position: "absolute",
    left: 8,
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: 12,
    pointerEvents: "none",
    zIndex: 1,
  },

  tableWrap: {
    flex: 1,
    overflowX: "auto",
    overflowY: "auto",
    minHeight: 0,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
    tableLayout: "fixed",
  },
  th: {
    position: "sticky",
    top: 0,
    zIndex: 2,
    background: "var(--bg-secondary)",
    color: "var(--text-secondary)",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    padding: "9px 10px",
    textAlign: "left",
    borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap",
    userSelect: "none",
    boxShadow: "0 1px 0 var(--border)",
  },
  td: {
    padding: "7px 10px",
    verticalAlign: "middle",
    overflow: "hidden",
    borderBottom: "1px solid var(--border-subtle)",
  },

  pagination: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 16px",
    borderTop: "1px solid var(--border)",
    background: "var(--bg-secondary)",
    flexShrink: 0,
  },
  pageInfo: {
    fontSize: 12,
    color: "var(--text-secondary)",
    marginLeft: 6,
    whiteSpace: "nowrap",
  },

  /* Modal */
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    backdropFilter: "blur(2px)",
  },
  modal: {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "22px 24px",
    minWidth: 340,
    maxWidth: 440,
    boxShadow: "0 12px 40px rgba(0,0,0,0.7)",
    animation: "fadeInUp 180ms ease",
  },
};
