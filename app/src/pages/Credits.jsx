import { useState } from "react";

/* ── BibTeX strings ──────────────────────────────────────────────────────── */
const BT_SAYERS2022 = `@article{Sayers2022,
  author  = {Sayers, Eric W. and others},
  title   = {Database resources of the National Center for Biotechnology Information},
  journal = {Nucleic Acids Research},
  year    = {2022},
  volume  = {50},
  number  = {D1},
  pages   = {D20--D26},
  doi     = {10.1093/nar/gkab1112}
}`;

const BT_OLEARY2016 = `@article{OLeary2016,
  author  = {O'Leary, Nuala A. and others},
  title   = {Reference sequence ({RefSeq}) database at {NCBI}: current status, taxonomic expansion, and functional annotation},
  journal = {Nucleic Acids Research},
  year    = {2016},
  volume  = {44},
  number  = {D1},
  pages   = {D733--D745},
  doi     = {10.1093/nar/gkv1189}
}`;

const BT_KURTZER2017 = `@article{Kurtzer2017,
  author  = {Kurtzer, Gregory M. and Sochat, Vanessa and Bauer, Michael W.},
  title   = {Singularity: Scientific containers for mobility of compute},
  journal = {PLoS ONE},
  year    = {2017},
  volume  = {12},
  number  = {5},
  pages   = {e0177459},
  doi     = {10.1371/journal.pone.0177459}
}`;

const BT_TANGE2011 = `@article{Tange2011,
  author  = {Tange, Ole},
  title   = {{GNU Parallel} - The Command-Line Power Tool},
  journal = {;login: The USENIX Magazine},
  year    = {2011},
  volume  = {36},
  number  = {1},
  pages   = {42--47},
  doi     = {10.5281/zenodo.16303}
}`;

const BT_YOO2003 = `@inproceedings{Yoo2003,
  author    = {Yoo, Andy B. and Jette, Morris A. and Grondona, Mark},
  title     = {{SLURM}: Simple {Linux} Utility for Resource Management},
  booktitle = {Job Scheduling Strategies for Parallel Processing},
  year      = {2003},
  pages     = {44--60},
  doi       = {10.1007/10968987_3}
}`;

/* ── Sections data ───────────────────────────────────────────────────────── */
const SECTIONS = [
  {
    id: "genome-data",
    title: "Genome Data",
    entries: [
      {
        id: "ncbi-refseq",
        name: "NCBI RefSeq",
        role: "Source database for all 2,999 reference bacterial genome assemblies",
        citations: [
          {
            text: "Sayers EW et al. \u201cDatabase resources of the National Center for Biotechnology Information.\u201d Nucleic Acids Research 50(D1): D20\u2013D26, 2022.",
            doi: "10.1093/nar/gkab1112",
          },
          {
            text: "O\u2019Leary NA et al. \u201cReference sequence (RefSeq) database at NCBI: current status, taxonomic expansion, and functional annotation.\u201d Nucleic Acids Research 44(D1): D733\u2013D745, 2016.",
            doi: "10.1093/nar/gkv1189",
          },
        ],
        url: "https://www.ncbi.nlm.nih.gov/refseq/",
        bibtex: BT_SAYERS2022 + "\n\n" + BT_OLEARY2016,
      },
      {
        id: "ncbi-datasets-cli",
        name: "NCBI Datasets CLI",
        role: "Command-line tool used to download genome assemblies, annotations, and protein sequences",
        citations: [
          {
            text: "Sayers EW et al. \u201cDatabase resources of the National Center for Biotechnology Information.\u201d Nucleic Acids Research 50(D1): D20\u2013D26, 2022.",
            doi: "10.1093/nar/gkab1112",
          },
        ],
        url: "https://www.ncbi.nlm.nih.gov/datasets/docs/v2/download-and-install/",
        bibtex: BT_SAYERS2022,
      },
    ],
  },
  {
    id: "hpc-container",
    title: "HPC & Container Infrastructure",
    entries: [
      {
        id: "apptainer",
        name: "Apptainer (formerly Singularity)",
        role: "HPC container runtime used in the SLURM pipeline",
        citations: [
          {
            text: "Kurtzer GM, Sochat V, Bauer MW. \u201cSingularity: Scientific containers for mobility of compute.\u201d PLoS ONE 12(5): e0177459, 2017.",
            doi: "10.1371/journal.pone.0177459",
          },
        ],
        url: "https://apptainer.org",
        bibtex: BT_KURTZER2017,
      },
      {
        id: "gnu-parallel",
        name: "GNU Parallel",
        role: "Parallel execution of batch download tasks within SLURM array jobs",
        citations: [
          {
            text: "Tange O. \u201cGNU Parallel \u2014 The Command-Line Power Tool.\u201d ;login: The USENIX Magazine 36(1): 42\u201347, 2011.",
            doi: "10.5281/zenodo.16303",
          },
        ],
        url: "https://www.gnu.org/software/parallel/",
        bibtex: BT_TANGE2011,
      },
      {
        id: "docker",
        name: "Docker / Buildx",
        role: "Container build toolchain for producing the portable HPC image",
        attribution:
          "Docker Inc. https://www.docker.com. No canonical peer-reviewed paper.",
        url: "https://docs.docker.com/buildx/",
      },
    ],
  },
  {
    id: "hpc-scheduling",
    title: "HPC Job Scheduling",
    entries: [
      {
        id: "slurm",
        name: "SLURM Workload Manager",
        role: "HPC cluster job scheduler used to run parallel genome download array jobs",
        citations: [
          {
            text: 'Yoo AB, Jette MA, Grondona M. "SLURM: Simple Linux Utility for Resource Management." In: Feitelson D, Rudolph L, Schwiegelshohn U (eds) Job Scheduling Strategies for Parallel Processing. JSSPP 2003. Lecture Notes in Computer Science, vol 2862. Springer, Berlin, Heidelberg.',
            doi: "10.1007/10968987_3",
          },
        ],
        url: "https://slurm.schedmd.com",
        bibtex: BT_YOO2003,
      },
    ],
  },
  {
    id: "desktop-app",
    title: "Desktop Application",
    entries: [
      {
        id: "electron",
        name: "Electron v33",
        role: "Cross-platform desktop runtime wrapping the React renderer",
        attribution: "OpenJS Foundation. https://www.electronjs.org",
        url: "https://www.electronjs.org",
      },
      {
        id: "react",
        name: "React v18",
        role: "UI component library",
        attribution: "Meta Open Source. https://react.dev",
        url: "https://react.dev",
      },
      {
        id: "vite",
        name: "Vite v6",
        role: "Frontend build tool and development server",
        attribution: "Evan You et al. https://vitejs.dev",
        url: "https://vitejs.dev",
      },
      {
        id: "electron-builder",
        name: "electron-builder",
        role: "Packaging and DMG distribution for macOS",
        attribution: "Loopline Systems. https://www.electron.build",
        url: "https://www.electron.build",
      },
      {
        id: "react-dom",
        name: "react-dom v18",
        role: "React renderer for the browser/Electron DOM environment",
        attribution: "Meta Open Source. Ships with React. https://react.dev",
        url: "https://www.npmjs.com/package/react-dom",
      },
      {
        id: "vitejs-plugin-react",
        name: "@vitejs/plugin-react",
        role: "Vite plugin enabling React Fast Refresh and the automatic JSX transform",
        attribution: "Evan You et al. MIT license.",
        url: "https://github.com/vitejs/vite-plugin-react",
      },
      {
        id: "concurrently",
        name: "concurrently",
        role: "Runs the Vite dev server and Electron process simultaneously during development",
        attribution: "Kimmo Brunfeldt et al. MIT license.",
        url: "https://github.com/open-cli-tools/concurrently",
      },
      {
        id: "wait-on",
        name: "wait-on",
        role: "Waits for the Vite dev server to become available before starting Electron",
        attribution: "Jeff Barczewski. MIT license.",
        url: "https://github.com/jeffbski/wait-on",
      },
    ],
  },
  {
    id: "runtime-scripting",
    title: "Runtime & Scripting",
    entries: [
      {
        id: "nodejs",
        name: "Node.js",
        role: "JavaScript runtime bundled with Electron; powers all main-process logic including filesystem operations, IPC, and download orchestration",
        attribution: "OpenJS Foundation. MIT license.",
        url: "https://nodejs.org",
      },
      {
        id: "python3",
        name: "Python 3",
        role: "Runtime for processing scripts (batch preparation, download verification, genome file processing)",
        attribution: "Python Software Foundation. PSF license.",
        url: "https://www.python.org",
      },
    ],
  },
  {
    id: "python-libraries",
    title: "Python Libraries",
    entries: [
      {
        id: "requests",
        name: "requests",
        role: "HTTP library for optional NCBI REST API calls",
        attribution: "Kenneth Reitz et al. Apache 2.0 license.",
        url: "https://requests.readthedocs.io",
      },
    ],
  },
];

/* ── Taxonomy data ───────────────────────────────────────────────────────── */
const TAXONOMY_SYNONYMS = [
  { current: "Bacillota", historical: "Firmicutes" },
  { current: "Pseudomonadota", historical: "Proteobacteria" },
  { current: "Actinomycetota", historical: "Actinobacteria" },
  { current: "Bacteroidota", historical: "Bacteroidetes" },
  { current: "Campylobacterota", historical: "Epsilonproteobacteria" },
  {
    current: "Thermodesulfobacteriota",
    historical: "Deltaproteobacteria (in part)",
  },
];

/* ── Helpers ─────────────────────────────────────────────────────────────── */
function openExternal(url) {
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url);
  } else {
    window.open(url, "_blank");
  }
}

/* ── CopyButton subcomponent ─────────────────────────────────────────────── */
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  return (
    <button className="btn btn-ghost btn-sm" onClick={handleCopy}>
      {copied ? "Copied" : "Copy BibTeX"}
    </button>
  );
}

/* ── EntryCard ───────────────────────────────────────────────────────────── */
function EntryCard({ name, role, citations, attribution, url, bibtex }) {
  return (
    <div style={S.card}>
      {/* Name + role row */}
      <div style={S.cardTopRow}>
        <span style={S.cardName}>{name}</span>
        <span style={S.cardRole}>{role}</span>
      </div>

      {/* Formal citations */}
      {citations &&
        citations.map((cite, i) => (
          <p key={i} style={S.citation}>
            {cite.text}
            {cite.doi && (
              <>
                {" "}
                <button
                  onClick={() => openExternal("https://doi.org/" + cite.doi)}
                  style={S.doiLink}
                >
                  DOI: {cite.doi}
                </button>
              </>
            )}
          </p>
        ))}

      {/* Informal attribution (no DOI) */}
      {attribution && <p style={S.attribution}>{attribution}</p>}

      {/* URL */}
      {url && (
        <p style={S.urlLine}>
          <button onClick={() => openExternal(url)} style={S.urlBtn}>
            {url}
          </button>
        </p>
      )}

      {/* BibTeX copy button — only for entries with formal citations */}
      {bibtex && (
        <div style={S.cardFooter}>
          <CopyButton text={bibtex} />
        </div>
      )}
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────── */
export default function Credits() {
  return (
    <div style={S.root}>
      {/* ── Page header (fixed, not scrolling) ── */}
      <div style={S.pageHeader}>
        <h2 style={S.pageTitle}>Credits &amp; Acknowledgements</h2>
        <p style={S.pageSubtitle}>
          Tools, databases, and publications used in this project.
        </p>
      </div>

      {/* ── Scrollable body ── */}
      <div style={S.body}>
        {/* ── Tool / database sections ── */}
        {SECTIONS.map((section) => (
          <section key={section.id} style={S.section}>
            <h3 style={S.sectionHeading}>{section.title}</h3>
            {section.entries.map((entry) => (
              <EntryCard key={entry.id} {...entry} />
            ))}
          </section>
        ))}

        {/* ── Taxonomy section ── */}
        <section style={S.section}>
          <h3 style={S.sectionHeading}>Taxonomy</h3>
          <div style={S.card}>
            <p style={S.taxonomyNote}>
              The phylum names in this dataset follow the 2021&ndash;2022 NCBI
              taxonomy update (ICNP-compliant nomenclature). Common historical
              synonyms are listed below.
            </p>
            <div style={S.tableWrap}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Current Name</th>
                    <th style={S.th}>Historical Synonym</th>
                  </tr>
                </thead>
                <tbody>
                  {TAXONOMY_SYNONYMS.map((row) => (
                    <tr key={row.current} style={S.tr}>
                      <td style={{ ...S.td, fontStyle: "italic" }}>
                        {row.current}
                      </td>
                      <td
                        style={{
                          ...S.td,
                          color: "var(--text-secondary)",
                          fontStyle: "italic",
                        }}
                      >
                        {row.historical}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Footer notice ── */}
        <footer style={S.pageFooter}>
          <p style={S.pageFooterText}>
            Genome data downloaded from NCBI RefSeq is subject to NCBI&apos;s
            data use policies.{" "}
            <button
              onClick={() =>
                openExternal(
                  "https://www.ncbi.nlm.nih.gov/home/about/policies/",
                )
              }
              style={S.footerLink}
            >
              https://www.ncbi.nlm.nih.gov/home/about/policies/
            </button>
          </p>
        </footer>
      </div>
    </div>
  );
}

/* ── Styles ──────────────────────────────────────────────────────────────── */
const S = {
  /* Root */
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    overflow: "hidden",
    background: "var(--bg-primary)",
  },

  /* Fixed page header */
  pageHeader: {
    padding: "13px 20px 12px",
    borderBottom: "1px solid var(--border)",
    background: "var(--bg-secondary)",
    flexShrink: 0,
  },
  pageTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: 12,
    color: "var(--text-secondary)",
    lineHeight: 1.4,
  },

  /* Scrollable body */
  body: {
    overflowY: "auto",
    padding: "20px 28px",
    flex: 1,
  },

  /* Section wrapper */
  section: {
    marginBottom: 28,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--text-muted)",
    borderBottom: "1px solid var(--border)",
    paddingBottom: 6,
    marginBottom: 14,
  },

  /* Entry card */
  card: {
    background: "var(--bg-secondary)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "14px 16px",
    marginBottom: 10,
  },
  cardTopRow: {
    display: "flex",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: 2,
  },
  cardName: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  cardRole: {
    fontSize: 12,
    color: "var(--text-secondary)",
    marginLeft: 10,
  },

  /* Citation paragraph */
  citation: {
    fontSize: 12,
    color: "var(--text-secondary)",
    fontStyle: "italic",
    marginTop: 6,
    lineHeight: 1.55,
  },

  /* DOI inline link */
  doiLink: {
    fontSize: 11,
    fontFamily: "var(--font-mono)",
    color: "var(--accent-blue)",
    fontStyle: "normal",
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
  },

  /* Informal attribution (no DOI) */
  attribution: {
    fontSize: 12,
    color: "var(--text-secondary)",
    marginTop: 6,
    lineHeight: 1.5,
  },

  /* URL line */
  urlLine: {
    marginTop: 5,
  },
  urlBtn: {
    fontSize: 11,
    color: "var(--text-muted)",
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
  },

  /* BibTeX button row */
  cardFooter: {
    display: "flex",
    justifyContent: "flex-end",
    marginTop: 10,
  },

  /* Taxonomy */
  taxonomyNote: {
    fontSize: 12,
    color: "var(--text-secondary)",
    lineHeight: 1.55,
    marginBottom: 0,
  },
  tableWrap: {
    marginTop: 14,
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    background: "var(--bg-secondary)",
    color: "var(--text-secondary)",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    padding: "8px 12px",
    textAlign: "left",
    borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap",
    userSelect: "none",
  },
  tr: {
    borderBottom: "1px solid var(--border-subtle)",
  },
  td: {
    padding: "7px 12px",
    color: "var(--text-primary)",
    verticalAlign: "middle",
  },

  /* Footer notice */
  pageFooter: {
    marginTop: 8,
    paddingTop: 16,
    paddingBottom: 24,
    borderTop: "1px solid var(--border)",
  },
  pageFooterText: {
    fontSize: 11,
    color: "var(--text-muted)",
    lineHeight: 1.6,
  },
  footerLink: {
    fontSize: 11,
    color: "var(--text-muted)",
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    textDecoration: "underline",
  },
};
