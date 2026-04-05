import { useState, useEffect, useMemo, useCallback, useRef } from "react";

/* ── Phylum synonym map ────────────────────────────────────── */
const PHYLUM_SYNONYMS = {
  Bacillota: "Firmicutes",
  Pseudomonadota: "Proteobacteria",
  Actinomycetota: "Actinobacteria",
  Bacteroidota: "Bacteroidetes",
  Campylobacterota: "Epsilonproteobacteria",
  Thermodesulfobacteriota: "Deltaproteobacteria",
};

const PAGE_SIZE = 50;

/* ── TSV column indices ────────────────────────────────────── */
const COL = {
  scientific_name: 0,
  strain: 1,
  gcf_accession: 2,
  refseq_category: 3,
  phylum: 4,
  class: 5,
  order: 6,
  family: 7,
  genus: 8,
  species: 9,
  habitat: 10,
  oxygen_requirement: 11,
  gut_flag: 12,
  pathogenicity: 13,
};

/* ── Parse raw TSV text into row objects ───────────────────── */
function parseTsv(raw) {
  const lines = raw.split("\n").filter(Boolean);
  if (lines.length === 0) return [];
  // skip header row
  const dataLines = lines[0].toLowerCase().includes("scientific_name")
    ? lines.slice(1)
    : lines;

  return dataLines
    .map((line) => {
      const cols = line.split("\t");
      return {
        scientific_name: (cols[COL.scientific_name] || "").trim(),
        strain: (cols[COL.strain] || "").trim(),
        gcf_accession: (cols[COL.gcf_accession] || "").trim(),
        refseq_category: (cols[COL.refseq_category] || "").trim(),
        phylum: (cols[COL.phylum] || "").trim(),
        class: (cols[COL.class] || "").trim(),
        order: (cols[COL.order] || "").trim(),
        family: (cols[COL.family] || "").trim(),
        genus: (cols[COL.genus] || "").trim(),
        species: (cols[COL.species] || "").trim(),
        habitat: (cols[COL.habitat] || "").trim(),
        oxygen_requirement: (cols[COL.oxygen_requirement] || "").trim(),
        gut_flag: (cols[COL.gut_flag] || "").trim(),
        pathogenicity: (cols[COL.pathogenicity] || "").trim(),
      };
    })
    .filter((r) => r.gcf_accession !== "");
}

/* ── Badge helpers ─────────────────────────────────────────── */
function O2Badge({ value }) {
  const v = (value || "").toLowerCase();
  let cls = "badge badge-muted";
  let label = value || "—";
  if (v.includes("facultative")) {
    cls = "badge badge-yellow";
    label = "facultative";
  } else if (v.includes("anaerobe")) {
    cls = "badge badge-red";
    label = "anaerobe";
  } else if (v.includes("aerobe")) {
    cls = "badge badge-green";
    label = "aerobe";
  } else if (v.includes("micro")) {
    cls = "badge badge-orange";
    label = "microaero";
  }
  return (
    <span className={cls} title={value}>
      {label}
    </span>
  );
}

function GutBadge({ value }) {
  const v = (value || "").toLowerCase();
  let cls = "badge badge-muted";
  let label = value || "—";
  if (v.includes("gut_dominant")) {
    cls = "badge badge-blue";
    label = "gut_dominant";
  } else if (v.includes("gut_assoc")) {
    cls = "badge badge-purple";
    label = "gut_associated";
  } else if (v.includes("non_gut")) {
    cls = "badge badge-muted";
    label = "non_gut";
  } else if (v.includes("gut")) {
    cls = "badge badge-blue";
    label = value;
  }
  return (
    <span className={cls} title={value}>
      {label}
    </span>
  );
}

function PathoBadge({ value }) {
  const v = (value || "").toLowerCase();
  if (v.includes("non_path") || v === "non-pathogenic") {
    return (
      <span className="badge badge-green" title={value}>
        non_pathogenic
      </span>
    );
  }
  if (v.includes("path")) {
    return (
      <span className="badge badge-red" title={value}>
        pathogenic
      </span>
    );
  }
  return <span className="badge badge-muted">{value || "—"}</span>;
}

/* ── Phylum cell ───────────────────────────────────────────── */
function PhylumCell({ value }) {
  const synonym = PHYLUM_SYNONYMS[value];
  return (
    <span title={synonym ? `Also known as: ${synonym}` : value}>
      {value}
      {synonym && (
        <span
          style={{ color: "var(--text-muted)", fontSize: 10, marginLeft: 4 }}
        >
          ({synonym})
        </span>
      )}
    </span>
  );
}

/* ── Sort icon ─────────────────────────────────────────────── */
function SortIcon({ col, sortKey, sortDir }) {
  if (sortKey !== col) {
    return (
      <span style={{ color: "var(--text-muted)", marginLeft: 4, fontSize: 10 }}>
        ⇅
      </span>
    );
  }
  return (
    <span style={{ color: "var(--accent-blue)", marginLeft: 4, fontSize: 10 }}>
      {sortDir === "asc" ? "▲" : "▼"}
    </span>
  );
}

/* ── Stats bar ─────────────────────────────────────────────── */
function StatsBar({ rows }) {
  const uniquePhyla = useMemo(
    () => new Set(rows.map((r) => r.phylum).filter(Boolean)).size,
    [rows],
  );
  const gutCount = useMemo(
    () =>
      rows.filter((r) => r.gut_flag && r.gut_flag.toLowerCase().includes("gut"))
        .length,
    [rows],
  );
  const pathCount = useMemo(
    () =>
      rows.filter((r) => {
        const v = (r.pathogenicity || "").toLowerCase();
        return (
          v.includes("path") &&
          !v.includes("non_path") &&
          !v.includes("non-path")
        );
      }).length,
    [rows],
  );

  return (
    <div style={barStyles.statsBar}>
      <StatPill
        label="Total genomes"
        value={rows.length.toLocaleString()}
        color="var(--text-primary)"
      />
      <StatPill
        label="Phyla"
        value={uniquePhyla}
        color="var(--accent-purple)"
      />
      <StatPill
        label="Gut-associated"
        value={gutCount.toLocaleString()}
        color="var(--accent-blue)"
      />
      <StatPill
        label="Pathogens"
        value={pathCount.toLocaleString()}
        color="var(--accent-red)"
      />
    </div>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div style={{ ...barStyles.pill }}>
      <span style={{ color: "var(--text-muted)", fontSize: 11 }}>{label}</span>
      <span
        style={{
          color,
          fontSize: 13,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </span>
    </div>
  );
}

const barStyles = {
  statsBar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    background: "var(--bg-secondary)",
    borderBottom: "1px solid var(--border)",
    flexWrap: "wrap",
    flexShrink: 0,
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 12px",
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 20,
    whiteSpace: "nowrap",
  },
};

/* ── Filter bar ────────────────────────────────────────────── */
function FilterBar({ rows, filters, setFilters, resultCount, totalCount }) {
  const phylaOptions = useMemo(() => {
    const set = new Set(rows.map((r) => r.phylum).filter(Boolean));
    return Array.from(set).sort();
  }, [rows]);

  const o2Options = [
    { value: "", label: "All O₂ types" },
    { value: "aerobe", label: "Aerobe" },
    { value: "anaerobe", label: "Anaerobe" },
    { value: "facultative_anaerobe", label: "Facultative" },
    { value: "microaerophile", label: "Microaerophile" },
  ];

  const gutOptions = [
    { value: "", label: "All gut types" },
    { value: "gut", label: "Gut-associated" },
    { value: "non_gut", label: "Non-gut" },
  ];

  const pathoOptions = [
    { value: "", label: "All pathogenicity" },
    { value: "pathogenic", label: "Pathogenic" },
    { value: "non_pathogenic", label: "Non-pathogenic" },
  ];

  const hasFilters =
    filters.search ||
    filters.phylum ||
    filters.gut ||
    filters.o2 ||
    filters.pathogenicity;

  return (
    <div style={fbStyles.bar}>
      {/* Search */}
      <div style={fbStyles.searchWrap}>
        <input
          className="input"
          type="text"
          value={filters.search}
          onChange={(e) =>
            setFilters((f) => ({ ...f, search: e.target.value }))
          }
          placeholder="Search name, strain, accession…"
          style={{ paddingLeft: 30, fontSize: 13 }}
        />
      </div>

      {/* Phylum */}
      <select
        className="input"
        value={filters.phylum}
        onChange={(e) => setFilters((f) => ({ ...f, phylum: e.target.value }))}
        style={{ width: 180, flexShrink: 0 }}
      >
        <option value="">All phyla</option>
        {phylaOptions.map((p) => (
          <option key={p} value={p}>
            {p}
            {PHYLUM_SYNONYMS[p] ? ` (${PHYLUM_SYNONYMS[p]})` : ""}
          </option>
        ))}
      </select>

      {/* Gut */}
      <select
        className="input"
        value={filters.gut}
        onChange={(e) => setFilters((f) => ({ ...f, gut: e.target.value }))}
        style={{ width: 150, flexShrink: 0 }}
      >
        {gutOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* O2 */}
      <select
        className="input"
        value={filters.o2}
        onChange={(e) => setFilters((f) => ({ ...f, o2: e.target.value }))}
        style={{ width: 150, flexShrink: 0 }}
      >
        {o2Options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Pathogenicity */}
      <select
        className="input"
        value={filters.pathogenicity}
        onChange={(e) =>
          setFilters((f) => ({ ...f, pathogenicity: e.target.value }))
        }
        style={{ width: 160, flexShrink: 0 }}
      >
        {pathoOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      {/* Clear */}
      {hasFilters && (
        <button
          className="btn btn-ghost btn-sm"
          onClick={() =>
            setFilters({
              search: "",
              phylum: "",
              gut: "",
              o2: "",
              pathogenicity: "",
            })
          }
          style={{ flexShrink: 0 }}
        >
          ✕ Clear
        </button>
      )}

      {/* Result count */}
      <div style={fbStyles.resultCount}>
        <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>
          {resultCount.toLocaleString()}
        </span>
        <span style={{ color: "var(--text-muted)" }}>
          {" "}
          / {totalCount.toLocaleString()} genomes
        </span>
      </div>
    </div>
  );
}

const fbStyles = {
  bar: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 16px",
    background: "var(--bg-primary)",
    borderBottom: "1px solid var(--border)",
    flexWrap: "wrap",
    flexShrink: 0,
  },
  searchWrap: {
    position: "relative",
    flex: 1,
    minWidth: 180,
  },
  searchIcon: {
    position: "absolute",
    left: 9,
    top: "50%",
    transform: "translateY(-50%)",
    fontSize: 13,
    pointerEvents: "none",
    zIndex: 1,
  },
  resultCount: {
    fontSize: 12,
    marginLeft: "auto",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
};

/* ── Pagination bar ────────────────────────────────────────── */
function PaginationBar({ page, totalPages, onPage }) {
  const [jumpVal, setJumpVal] = useState("");
  const inputRef = useRef(null);

  const handleJump = (e) => {
    e.preventDefault();
    const n = parseInt(jumpVal);
    if (!isNaN(n) && n >= 1 && n <= totalPages) {
      onPage(n - 1);
      setJumpVal("");
      inputRef.current?.blur();
    }
  };

  if (totalPages <= 1) return null;

  return (
    <div style={pgStyles.bar}>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => onPage(0)}
        disabled={page === 0}
        title="First page"
      >
        «
      </button>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => onPage(page - 1)}
        disabled={page === 0}
        title="Previous page"
      >
        ‹ Prev
      </button>

      {/* Page number buttons */}
      <div style={pgStyles.pageNums}>
        {buildPageRange(page, totalPages).map((item, i) =>
          item === "..." ? (
            <span key={`ellipsis-${i}`} style={pgStyles.ellipsis}>
              …
            </span>
          ) : (
            <button
              key={item}
              className={`btn btn-sm ${item - 1 === page ? "btn-primary" : "btn-ghost"}`}
              onClick={() => onPage(item - 1)}
              style={{ minWidth: 32 }}
            >
              {item}
            </button>
          ),
        )}
      </div>

      <button
        className="btn btn-ghost btn-sm"
        onClick={() => onPage(page + 1)}
        disabled={page >= totalPages - 1}
        title="Next page"
      >
        Next ›
      </button>
      <button
        className="btn btn-ghost btn-sm"
        onClick={() => onPage(totalPages - 1)}
        disabled={page >= totalPages - 1}
        title="Last page"
      >
        »
      </button>

      <span style={pgStyles.info}>
        Page{" "}
        <strong style={{ color: "var(--text-primary)" }}>{page + 1}</strong> of{" "}
        <strong style={{ color: "var(--text-primary)" }}>{totalPages}</strong>
      </span>

      {/* Jump to page */}
      <form onSubmit={handleJump} style={pgStyles.jumpForm}>
        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Go to</span>
        <input
          ref={inputRef}
          className="input"
          type="number"
          min={1}
          max={totalPages}
          value={jumpVal}
          onChange={(e) => setJumpVal(e.target.value)}
          placeholder="…"
          style={{ width: 60, padding: "4px 8px", fontSize: 12 }}
        />
        <button className="btn btn-ghost btn-sm" type="submit">
          Go
        </button>
      </form>
    </div>
  );
}

function buildPageRange(current, total) {
  // Always show first, last, current ± 2, with ellipsis
  const range = new Set([1, total, current + 1]);
  for (let i = Math.max(1, current - 1); i <= Math.min(total, current + 3); i++)
    range.add(i);
  const sorted = Array.from(range).sort((a, b) => a - b);
  const result = [];
  let prev = 0;
  for (const n of sorted) {
    if (n - prev > 1) result.push("...");
    result.push(n);
    prev = n;
  }
  return result;
}

const pgStyles = {
  bar: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    padding: "10px 16px",
    borderTop: "1px solid var(--border)",
    background: "var(--bg-secondary)",
    flexShrink: 0,
    flexWrap: "wrap",
  },
  pageNums: {
    display: "flex",
    gap: 3,
    alignItems: "center",
  },
  ellipsis: {
    color: "var(--text-muted)",
    padding: "0 4px",
    fontSize: 13,
  },
  info: {
    fontSize: 12,
    color: "var(--text-secondary)",
    marginLeft: 8,
    whiteSpace: "nowrap",
  },
  jumpForm: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    marginLeft: "auto",
  },
};

/* ── Column definitions ────────────────────────────────────── */
const COLUMNS = [
  { key: "gcf_accession", label: "GCF Accession", sortable: true, width: 148 },
  {
    key: "scientific_name",
    label: "Scientific Name",
    sortable: true,
    width: 200,
  },
  { key: "strain", label: "Strain", sortable: true, width: 140 },
  { key: "phylum", label: "Phylum", sortable: true, width: 200 },
  { key: "class", label: "Class", sortable: true, width: 160 },
  { key: "habitat", label: "Habitat", sortable: true, width: 160 },
  { key: "oxygen_requirement", label: "O₂", sortable: true, width: 110 },
  { key: "gut_flag", label: "Gut", sortable: true, width: 120 },
  { key: "pathogenicity", label: "Pathogenicity", sortable: true, width: 130 },
];

/* ── Main component ────────────────────────────────────────── */
export default function GenomeBrowser() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [sortKey, setSortKey] = useState("scientific_name");
  const [sortDir, setSortDir] = useState("asc");
  const [page, setPage] = useState(0);

  const [filters, setFilters] = useState({
    search: "",
    phylum: "",
    gut: "",
    o2: "",
    pathogenicity: "",
  });

  /* ── Load TSV on mount ── */
  useEffect(() => {
    loadData();
  }, []);

  /* ── Reset page when filters change ── */
  useEffect(() => {
    setPage(0);
  }, [filters, sortKey, sortDir]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      if (!window.electronAPI) {
        throw new Error("electronAPI is not available — run inside Electron.");
      }
      const tsvPath = await window.electronAPI.getTsvPath();
      const rawText = await window.electronAPI.readTsv(tsvPath);
      const parsed = parseTsv(rawText);
      setRows(parsed);
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  /* ── Filter logic ── */
  const filtered = useMemo(() => {
    let result = rows;

    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (r) =>
          r.scientific_name.toLowerCase().includes(q) ||
          r.strain.toLowerCase().includes(q) ||
          r.gcf_accession.toLowerCase().includes(q),
      );
    }

    if (filters.phylum) {
      result = result.filter((r) => r.phylum === filters.phylum);
    }

    if (filters.gut) {
      const gv = filters.gut.toLowerCase();
      if (gv === "gut") {
        result = result.filter(
          (r) =>
            r.gut_flag.toLowerCase().includes("gut") &&
            !r.gut_flag.toLowerCase().includes("non_gut"),
        );
      } else if (gv === "non_gut") {
        result = result.filter((r) =>
          r.gut_flag.toLowerCase().includes("non_gut"),
        );
      }
    }

    if (filters.o2) {
      const ov = filters.o2.toLowerCase();
      result = result.filter((r) =>
        r.oxygen_requirement.toLowerCase().includes(ov),
      );
    }

    if (filters.pathogenicity) {
      const pv = filters.pathogenicity.toLowerCase();
      result = result.filter((r) => r.pathogenicity.toLowerCase().includes(pv));
    }

    return result;
  }, [rows, filters]);

  /* ── Sort logic ── */
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = (a[sortKey] || "").toLowerCase();
      const bv = (b[sortKey] || "").toLowerCase();
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  /* ── Paginate ── */
  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  /* ── Handle sort click ── */
  const handleSort = useCallback((key) => {
    setSortKey((prev) => {
      if (prev === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return key;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  /* ── Open NCBI genome page ── */
  const openNcbi = useCallback((gcf) => {
    const url = `https://www.ncbi.nlm.nih.gov/datasets/genome/${gcf}/`;
    if (window.electronAPI?.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, "_blank", "noopener");
    }
  }, []);

  /* ── Loading state ── */
  if (loading) {
    return (
      <div style={styles.root}>
        <div style={styles.pageHeader}>
          <h2 style={styles.pageTitle}>Genome Browser</h2>
          <p style={styles.pageSubtitle}>
            Browse, filter, and explore all 2,999 reference genomes.
          </p>
        </div>
        <div className="empty-state" style={{ flex: 1 }}>
          <span
            style={{
              display: "inline-block",
              width: 24,
              height: 24,
              border: "2px solid var(--border)",
              borderTopColor: "var(--accent-blue)",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <span className="empty-state-title">Loading genome data…</span>
          <span className="empty-state-sub">
            Parsing TSV from disk, this takes just a moment.
          </span>
        </div>
      </div>
    );
  }

  /* ── Error state ── */
  if (error) {
    return (
      <div style={styles.root}>
        <div style={styles.pageHeader}>
          <h2 style={styles.pageTitle}>Genome Browser</h2>
        </div>
        <div className="empty-state" style={{ flex: 1 }}>
          <span
            style={{
              fontSize: 28,
              color: "var(--accent-red)",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
            }}
          >
            !
          </span>
          <span className="empty-state-title">Failed to load genome data</span>
          <span className="empty-state-sub">{error}</span>
          <button
            className="btn btn-primary"
            onClick={loadData}
            style={{ marginTop: 12 }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      {/* ── Page header ── */}
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>Genome Browser</h2>
          <p style={styles.pageSubtitle}>
            Browse, filter, and explore all 2,999 bacterial reference genomes.
          </p>
        </div>
        <button
          className="btn btn-ghost btn-sm"
          onClick={loadData}
          title="Reload TSV data"
          style={{ flexShrink: 0 }}
        >
          Reload
        </button>
      </div>

      {/* ── Stats bar ── */}
      <StatsBar rows={rows} />

      {/* ── Filter bar ── */}
      <FilterBar
        rows={rows}
        filters={filters}
        setFilters={setFilters}
        resultCount={filtered.length}
        totalCount={rows.length}
      />

      {/* ── Table area ── */}
      <div style={styles.tableWrap}>
        {pageRows.length === 0 ? (
          <div className="empty-state">
            <span className="empty-state-title">
              No genomes match your filters
            </span>
            <span className="empty-state-sub">
              Try broadening your search or clearing the active filters.
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() =>
                setFilters({
                  search: "",
                  phylum: "",
                  gut: "",
                  o2: "",
                  pathogenicity: "",
                })
              }
              style={{ marginTop: 10 }}
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                {/* Row number */}
                <th
                  style={{
                    ...styles.th,
                    width: 48,
                    textAlign: "right",
                    color: "var(--text-muted)",
                  }}
                >
                  #
                </th>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`sortable${sortKey === col.key ? " sort-active" : ""}`}
                    style={{
                      ...styles.th,
                      width: col.width,
                      minWidth: col.width,
                    }}
                    onClick={() => col.sortable && handleSort(col.key)}
                    title={`Sort by ${col.label}`}
                  >
                    {col.label}
                    {col.sortable && (
                      <SortIcon
                        col={col.key}
                        sortKey={sortKey}
                        sortDir={sortDir}
                      />
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, rowIdx) => {
                const globalIdx = page * PAGE_SIZE + rowIdx + 1;
                return (
                  <tr key={`${row.gcf_accession}-${rowIdx}`} style={styles.tr}>
                    {/* Row number */}
                    <td
                      style={{
                        ...styles.td,
                        textAlign: "right",
                        color: "var(--text-muted)",
                        fontSize: 11,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {globalIdx}
                    </td>

                    {/* GCF Accession */}
                    <td style={{ ...styles.td, width: 148, minWidth: 148 }}>
                      <button
                        onClick={() => openNcbi(row.gcf_accession)}
                        title={`Open ${row.gcf_accession} on NCBI Datasets`}
                        style={styles.gcfLink}
                      >
                        {row.gcf_accession}
                        <span style={styles.gcfArrow}>↗</span>
                      </button>
                    </td>

                    {/* Scientific Name */}
                    <td style={{ ...styles.td, width: 200, minWidth: 200 }}>
                      <span style={styles.sciName} title={row.scientific_name}>
                        {row.scientific_name}
                      </span>
                    </td>

                    {/* Strain */}
                    <td style={{ ...styles.td, width: 140, minWidth: 140 }}>
                      <span
                        className="truncate"
                        style={{
                          display: "block",
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          maxWidth: 134,
                        }}
                        title={row.strain}
                      >
                        {row.strain || (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </span>
                    </td>

                    {/* Phylum */}
                    <td style={{ ...styles.td, width: 200, minWidth: 200 }}>
                      <PhylumCell value={row.phylum} />
                    </td>

                    {/* Class */}
                    <td style={{ ...styles.td, width: 160, minWidth: 160 }}>
                      <span
                        className="truncate"
                        style={{
                          display: "block",
                          maxWidth: 154,
                          fontSize: 12,
                          color: "var(--text-secondary)",
                        }}
                        title={row.class}
                      >
                        {row.class || (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </span>
                    </td>

                    {/* Habitat */}
                    <td style={{ ...styles.td, width: 160, minWidth: 160 }}>
                      <span
                        className="truncate"
                        style={{
                          display: "block",
                          maxWidth: 154,
                          fontSize: 12,
                          color: "var(--text-secondary)",
                        }}
                        title={row.habitat}
                      >
                        {row.habitat || (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </span>
                    </td>

                    {/* O₂ */}
                    <td style={{ ...styles.td, width: 110, minWidth: 110 }}>
                      <O2Badge value={row.oxygen_requirement} />
                    </td>

                    {/* Gut */}
                    <td style={{ ...styles.td, width: 120, minWidth: 120 }}>
                      <GutBadge value={row.gut_flag} />
                    </td>

                    {/* Pathogenicity */}
                    <td style={{ ...styles.td, width: 130, minWidth: 130 }}>
                      <PathoBadge value={row.pathogenicity} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      <PaginationBar page={page} totalPages={totalPages} onPage={setPage} />
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
    padding: "14px 20px 12px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-secondary)",
    flexShrink: 0,
    gap: 12,
  },
  pageTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: 2,
  },
  pageSubtitle: {
    fontSize: 12,
    color: "var(--text-muted)",
    lineHeight: 1.4,
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

  tr: {
    borderBottom: "1px solid var(--border-subtle)",
    transition: "background 100ms ease",
  },

  td: {
    padding: "7px 10px",
    verticalAlign: "middle",
    overflow: "hidden",
  },

  gcfLink: {
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    fontFamily: "var(--font-mono)",
    fontSize: 12,
    color: "var(--accent-blue)",
    display: "inline-flex",
    alignItems: "center",
    gap: 3,
    textDecoration: "none",
    transition: "color 100ms ease",
    whiteSpace: "nowrap",
  },
  gcfArrow: {
    fontSize: 10,
    opacity: 0.7,
  },

  sciName: {
    fontStyle: "italic",
    color: "var(--text-primary)",
    fontSize: 13,
    display: "block",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    maxWidth: 194,
  },
};
