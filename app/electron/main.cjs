"use strict";

const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn, execFile } = require("child_process");
const https = require("https");

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const IS_DEV = !app.isPackaged;
const SETTINGS_FILE = path.join(app.getPath("userData"), "settings.json");
const BIN_DIR = path.join(app.getPath("userData"), "bin");
const DATASETS_BIN = path.join(BIN_DIR, "datasets");

// ---------------------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------------------
function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf8"));
    }
  } catch (_) {}
  return {
    outputDir: path.join(os.homedir(), "genome_download", "genomes"),
    batchesDir: path.join(os.homedir(), "genome_download", "batches"),
    apiKey: "",
    parallelism: 4,
    batchSize: 50,
  };
}

function saveSettings(settings) {
  fs.mkdirSync(path.dirname(SETTINGS_FILE), { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

// ---------------------------------------------------------------------------
// datasets binary helpers
// ---------------------------------------------------------------------------
function getDatasetsUrl() {
  // NCBI ships a single universal macOS binary — no arch subdirectory.
  // linux-amd64 is kept for the Docker/HPC container path (not used here).
  return "https://ftp.ncbi.nlm.nih.gov/pub/datasets/command-line/LATEST/mac/datasets";
}

function ensureExecutable(binPath) {
  try {
    fs.chmodSync(binPath, 0o755);
  } catch (_) {}
}

function isDatasetsInstalled() {
  // Check bundled binary first — also ensure it is executable
  if (fs.existsSync(DATASETS_BIN)) {
    ensureExecutable(DATASETS_BIN);
    try {
      const result = require("child_process").spawnSync(
        DATASETS_BIN,
        ["--version"],
        { timeout: 3000 },
      );
      return result.status === 0;
    } catch (_) {
      return false;
    }
  }
  // Check system PATH
  try {
    const result = require("child_process").spawnSync(
      "datasets",
      ["--version"],
      { timeout: 3000 },
    );
    return result.status === 0;
  } catch (_) {
    return false;
  }
}

function getDatasetsCmd() {
  if (fs.existsSync(DATASETS_BIN)) {
    ensureExecutable(DATASETS_BIN);
    return DATASETS_BIN;
  }
  return "datasets"; // fall back to PATH
}

function downloadDatasetsBinary(win) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(BIN_DIR, { recursive: true });

    // Remove any stale / zero-byte file from a previous failed download
    try {
      fs.unlinkSync(DATASETS_BIN);
    } catch (_) {}

    const url = getDatasetsUrl();
    win.webContents.send("log-line", {
      level: "INFO",
      message: `Downloading datasets CLI from ${url}`,
    });

    function doGet(currentUrl, redirectsLeft) {
      const mod = currentUrl.startsWith("https") ? https : require("http");
      mod
        .get(currentUrl, { timeout: 30000 }, (res) => {
          // Follow redirects (301, 302, 307, 308)
          if (
            [301, 302, 307, 308].includes(res.statusCode) &&
            res.headers.location &&
            redirectsLeft > 0
          ) {
            res.resume(); // drain so socket is released
            return doGet(res.headers.location, redirectsLeft - 1);
          }

          if (res.statusCode !== 200) {
            res.resume();
            const err = new Error(
              `datasets CLI download failed: HTTP ${res.statusCode} from ${currentUrl}`,
            );
            try {
              fs.unlinkSync(DATASETS_BIN);
            } catch (_) {}
            return reject(err);
          }

          const total = parseInt(res.headers["content-length"] || "0", 10);
          let received = 0;
          const file = fs.createWriteStream(DATASETS_BIN);

          res.on("data", (chunk) => {
            received += chunk.length;
            if (total > 0 && !win.isDestroyed()) {
              win.webContents.send("datasets-download-progress", {
                received,
                total,
              });
            }
          });

          res.pipe(file);

          file.on("finish", () => {
            file.close(() => {
              // Validate: file must be larger than 1 MB to be a real binary
              let stat;
              try {
                stat = fs.statSync(DATASETS_BIN);
              } catch (_) {}
              if (!stat || stat.size < 1024 * 1024) {
                try {
                  fs.unlinkSync(DATASETS_BIN);
                } catch (_) {}
                return reject(
                  new Error(
                    `Downloaded datasets binary is too small (${stat ? stat.size : 0} bytes) — download may have failed silently.`,
                  ),
                );
              }
              // Make executable
              try {
                fs.chmodSync(DATASETS_BIN, 0o755);
              } catch (_) {}
              if (!win.isDestroyed()) {
                win.webContents.send("log-line", {
                  level: "SUCCESS",
                  message: `datasets CLI ready (${(stat.size / 1024 / 1024).toFixed(1)} MB).`,
                });
                win.webContents.send("datasets-download-progress", {
                  received: stat.size,
                  total: stat.size,
                  done: true,
                });
              }
              resolve(DATASETS_BIN);
            });
          });

          file.on("error", (err) => {
            try {
              fs.unlinkSync(DATASETS_BIN);
            } catch (_) {}
            reject(err);
          });
        })
        .on("error", (err) => {
          try {
            fs.unlinkSync(DATASETS_BIN);
          } catch (_) {}
          reject(err);
        });
    }

    doGet(url, 5); // allow up to 5 redirects
  });
}

// ---------------------------------------------------------------------------
// Python helpers
// ---------------------------------------------------------------------------
function getPythonCmd() {
  // Try python3 first, then python
  for (const cmd of ["python3", "python"]) {
    try {
      const r = require("child_process").spawnSync(cmd, ["--version"], {
        timeout: 3000,
      });
      if (r.status === 0) return cmd;
    } catch (_) {}
  }
  return "python3";
}

function getPythonScriptsDir() {
  if (IS_DEV) {
    return path.join(__dirname, "..", "python");
  }
  return path.join(process.resourcesPath, "python");
}

// ---------------------------------------------------------------------------
// Active download tracking
// ---------------------------------------------------------------------------
let activeProcs = [];
let downloadStopped = false;

function stopAllDownloads() {
  downloadStopped = true;
  activeProcs.forEach((p) => {
    try {
      p.kill("SIGTERM");
    } catch (_) {}
  });
  activeProcs = [];
}

// ---------------------------------------------------------------------------
// Download queue
// ---------------------------------------------------------------------------
async function runDownloadQueue(win, accessions, outDir, apiKey, parallelism) {
  downloadStopped = false;
  const queue = [...accessions];
  const datasetsCmd = getDatasetsCmd();
  let success = 0,
    failed = 0;
  const failedList = [];

  function sendLog(level, msg) {
    if (!win.isDestroyed())
      win.webContents.send("log-line", {
        level,
        message: msg,
        timestamp: new Date().toISOString(),
      });
  }

  function downloadOne(gcf) {
    return new Promise((resolve) => {
      if (downloadStopped) {
        resolve({ gcf, ok: false, reason: "stopped" });
        return;
      }

      const gcfDir = path.join(outDir, gcf);
      // Resume: skip if already has FASTA
      const existingFa =
        fs.existsSync(gcfDir) &&
        fs
          .readdirSync(gcfDir)
          .some(
            (f) => f.endsWith("_genomic.fna.gz") || f.endsWith("_genomic.fna"),
          );
      if (existingFa) {
        sendLog("SKIP", `Already downloaded: ${gcf}`);
        if (!win.isDestroyed())
          win.webContents.send("genome-status", { gcf, status: "done" });
        resolve({ gcf, ok: true });
        return;
      }

      fs.mkdirSync(gcfDir, { recursive: true });
      const tmpZip = path.join(os.tmpdir(), `${gcf}_${Date.now()}.zip`);
      const args = [
        "download",
        "genome",
        "accession",
        gcf,
        "--include",
        "genome,gff3,protein",
        "--filename",
        tmpZip,
      ];
      if (apiKey) args.push("--api-key", apiKey);

      sendLog("INFO", `Downloading ${gcf}...`);
      if (!win.isDestroyed())
        win.webContents.send("genome-status", { gcf, status: "running" });

      const proc = spawn(datasetsCmd, args, { env: { ...process.env } });
      activeProcs.push(proc);
      let stderr = "";
      proc.stderr.on("data", (d) => {
        stderr += d.toString();
      });

      proc.on("close", (code) => {
        activeProcs = activeProcs.filter((p) => p !== proc);
        if (code !== 0 || !fs.existsSync(tmpZip)) {
          sendLog(
            "ERROR",
            `Failed: ${gcf} — ${stderr.trim().split("\n").pop() || "unknown error"}`,
          );
          if (!win.isDestroyed())
            win.webContents.send("genome-status", { gcf, status: "failed" });
          try {
            fs.unlinkSync(tmpZip);
          } catch (_) {}
          resolve({ gcf, ok: false });
          return;
        }

        // Unzip
        const unzip = spawn("unzip", ["-q", "-o", tmpZip, "-d", gcfDir]);
        unzip.on("close", (uzCode) => {
          try {
            fs.unlinkSync(tmpZip);
          } catch (_) {}
          if (uzCode !== 0) {
            sendLog("ERROR", `Unzip failed: ${gcf}`);
            if (!win.isDestroyed())
              win.webContents.send("genome-status", { gcf, status: "failed" });
            resolve({ gcf, ok: false });
            return;
          }
          // Flatten nested NCBI layout.
          // After unzip the structure is:
          //   <gcfDir>/
          //     ncbi_dataset/
          //       data/
          //         GCF_xxx/          <- genome files land here
          //         assembly_data_report.jsonl   <- loose file (NOT a dir)
          //       README.md
          //
          // Strategy:
          //   1. Move every file from ncbi_dataset/data/<gcf>/ up to gcfDir/
          //   2. Move any loose files sitting directly in ncbi_dataset/data/ up to gcfDir/
          //   3. Move README.md (if present) up to gcfDir/
          //   4. Remove the now-empty ncbi_dataset/ scaffold

          function moveFilesFromDir(srcDir) {
            // Guard: srcDir must exist AND be a directory
            let stat;
            try {
              stat = fs.statSync(srcDir);
            } catch (_) {
              return;
            }
            if (!stat.isDirectory()) return;

            fs.readdirSync(srcDir).forEach((f) => {
              const src = path.join(srcDir, f);
              const dst = path.join(gcfDir, f);
              try {
                if (fs.statSync(src).isFile() && !fs.existsSync(dst)) {
                  fs.renameSync(src, dst);
                }
              } catch (_) {}
            });
          }

          // 1. Primary path: ncbi_dataset/data/<GCF>/
          const primaryDir = path.join(gcfDir, "ncbi_dataset", "data", gcf);
          moveFilesFromDir(primaryDir);

          // 2. Fallback: scan ncbi_dataset/data/ and move files from any
          //    sub-directories; also move loose files (e.g. assembly_data_report.jsonl)
          //    directly up to gcfDir/
          const dataDir = path.join(gcfDir, "ncbi_dataset", "data");
          let dataStat;
          try {
            dataStat = fs.statSync(dataDir);
          } catch (_) {}
          if (dataStat && dataStat.isDirectory()) {
            fs.readdirSync(dataDir).forEach((entry) => {
              const entryPath = path.join(dataDir, entry);
              let entryStat;
              try {
                entryStat = fs.statSync(entryPath);
              } catch (_) {
                return;
              }
              if (entryStat.isDirectory()) {
                // Move genome files out of any GCF sub-directory
                moveFilesFromDir(entryPath);
              } else if (entryStat.isFile()) {
                // Loose files (assembly_data_report.jsonl, etc.) — move up
                const dst = path.join(gcfDir, entry);
                try {
                  if (!fs.existsSync(dst)) fs.renameSync(entryPath, dst);
                } catch (_) {}
              }
            });
          }

          // 3. Move top-level README from ncbi_dataset/ if present
          const ncbiDatasetDir = path.join(gcfDir, "ncbi_dataset");
          let ncbiStat;
          try {
            ncbiStat = fs.statSync(ncbiDatasetDir);
          } catch (_) {}
          if (ncbiStat && ncbiStat.isDirectory()) {
            fs.readdirSync(ncbiDatasetDir).forEach((f) => {
              const src = path.join(ncbiDatasetDir, f);
              const dst = path.join(gcfDir, f);
              try {
                if (fs.statSync(src).isFile() && !fs.existsSync(dst)) {
                  fs.renameSync(src, dst);
                }
              } catch (_) {}
            });
          }

          // 4. Clean up the ncbi_dataset scaffold
          try {
            fs.rmSync(path.join(gcfDir, "ncbi_dataset"), {
              recursive: true,
              force: true,
            });
          } catch (_) {}
          sendLog("SUCCESS", `Done: ${gcf}`);
          if (!win.isDestroyed())
            win.webContents.send("genome-status", { gcf, status: "done" });
          resolve({ gcf, ok: true });
        });
      });
    });
  }

  // Run N parallel workers
  async function worker() {
    while (queue.length > 0 && !downloadStopped) {
      const gcf = queue.shift();
      if (!gcf) break;
      const result = await downloadOne(gcf);
      if (result.ok) success++;
      else {
        failed++;
        failedList.push(result.gcf);
      }
      if (!win.isDestroyed())
        win.webContents.send("download-progress", {
          success,
          failed,
          remaining: queue.length,
          total: accessions.length,
        });
    }
  }

  const workers = Array.from({ length: parallelism }, () => worker());
  await Promise.all(workers);

  if (!win.isDestroyed())
    win.webContents.send("downloads-done", { success, failed, failedList });
}

// ---------------------------------------------------------------------------
// Processing pipeline helpers
// ---------------------------------------------------------------------------

function normalizeForFilename(str) {
  return (str || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function buildNormalizedBase(meta) {
  const sci = normalizeForFilename(meta.scientific_name || meta.gcf_accession);
  const strain = meta.strain ? normalizeForFilename(meta.strain) : "";
  const gcf = meta.gcf_accession || "";
  const parts = [sci];
  if (strain && strain !== sci && strain !== gcf) parts.push(strain);
  parts.push(gcf);
  return parts.join("_");
}

function getFileExtension(filename) {
  const lower = (filename || "").toLowerCase();
  for (const ext of [
    ".fna.gz",
    ".faa.gz",
    ".gff.gz",
    ".gtf.gz",
    ".fna",
    ".faa",
    ".gff",
    ".gtf",
  ]) {
    if (lower.endsWith(ext)) return ext;
  }
  return path.extname(filename);
}

function findGenomeFiles(gcfDir) {
  const result = { fna: null, faa: null, gff: null };
  let entries = [];
  try {
    entries = fs.readdirSync(gcfDir);
  } catch (_) {
    return result;
  }
  for (const f of entries) {
    const lower = f.toLowerCase();
    if (!result.fna && lower.match(/genomic\.fna(\.gz)?$/)) result.fna = f;
    if (
      !result.faa &&
      (lower.match(/protein\.faa(\.gz)?$/) || lower.match(/\.faa(\.gz)?$/))
    )
      result.faa = f;
    if (!result.gff && lower.match(/genomic\.(gff|gtf)(\.gz)?$/))
      result.gff = f;
  }
  return result;
}

/**
 * Recursively walks `rootDir` up to `maxDepth` levels deep, collecting
 * all directories whose name starts with "GCF_".
 * Returns an array of { gcf: string, dirPath: string }.
 */
function findGcfDirsRecursive(rootDir, maxDepth = 4) {
  const results = [];
  function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch (_) {
      return;
    }
    for (const entry of entries) {
      if (entry.startsWith(".")) continue; // skip hidden dirs
      const fullPath = path.join(dir, entry);
      let stat;
      try {
        stat = fs.statSync(fullPath);
      } catch (_) {
        continue;
      }
      if (!stat.isDirectory()) continue;
      if (entry.startsWith("GCF_")) {
        results.push({ gcf: entry, dirPath: fullPath });
      } else {
        walk(fullPath, depth + 1);
      }
    }
  }
  walk(rootDir, 0);
  return results;
}

function parseTsvMetadata(tsvPath) {
  const map = {};
  try {
    const lines = fs.readFileSync(tsvPath, "utf8").split("\n");
    if (lines.length < 2) return map;
    const header = lines[0].split("\t").map((h) => h.trim());
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split("\t");
      if (cols.length < 3) continue;
      const rec = {};
      header.forEach((h, j) => {
        rec[h] = (cols[j] || "").trim();
      });
      const gcf = rec.gcf_accession;
      if (gcf) map[gcf] = rec;
    }
  } catch (_) {}
  return map;
}

// ---------------------------------------------------------------------------
// HTML report generator
// ---------------------------------------------------------------------------

function generateHtmlReport(manifest, metadata) {
  function esc(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function o2Symbol(val) {
    const v = (val || "").toLowerCase();
    if (v.includes("aerobe") && !v.includes("anaerobe")) return "◎";
    if (v.includes("anaerobe")) return "●";
    if (v.includes("facultative")) return "◑";
    if (v.includes("microaerophile")) return "◔";
    return "–";
  }
  function gutBadge(val) {
    const v = (val || "").toLowerCase();
    if (v.includes("gut") && !v.includes("non"))
      return '<span class="badge" style="background:#27ae60;color:#fff">gut dominant</span>';
    if (v.includes("associated"))
      return '<span class="badge" style="background:#f39c12;color:#fff">gut assoc.</span>';
    return '<span class="badge" style="background:#444;color:#999">non-gut</span>';
  }
  function pathoBadge(val) {
    const v = (val || "").toLowerCase();
    if (v.includes("pathogenic") && !v.includes("non"))
      return '<span class="badge" style="background:#c0392b;color:#fff">pathogenic</span>';
    if (v.includes("opportunistic"))
      return '<span class="badge" style="background:#e67e22;color:#fff">opportunistic</span>';
    return '<span class="badge" style="background:#2c3e50;color:#aaa">non-pathogenic</span>';
  }
  function fileBadge(filename, role) {
    if (!filename)
      return '<span class="badge badge-missing">' + role + "</span>";
    return (
      '<span class="badge badge-present" title="' +
      esc(filename) +
      '">' +
      role +
      "</span>"
    );
  }

  // Build taxonomy tree
  const tree = {};
  const phylaSet = new Set(),
    classSet = new Set(),
    orderSet = new Set(),
    familySet = new Set(),
    genusSet = new Set();

  for (const entry of manifest) {
    const meta = metadata[entry.gcf] || {};
    const ph = meta.phylum || "Unclassified";
    const cl = meta.class || "Unclassified";
    const or = meta.order || "Unclassified";
    const fa = meta.family || "Unclassified";
    if (meta.phylum) phylaSet.add(meta.phylum);
    if (meta.class) classSet.add(meta.class);
    if (meta.order) orderSet.add(meta.order);
    if (meta.family) familySet.add(meta.family);
    if (meta.genus) genusSet.add(meta.genus);
    if (!tree[ph]) tree[ph] = {};
    if (!tree[ph][cl]) tree[ph][cl] = {};
    if (!tree[ph][cl][or]) tree[ph][cl][or] = {};
    if (!tree[ph][cl][or][fa]) tree[ph][cl][or][fa] = [];
    tree[ph][cl][or][fa].push({ entry, meta });
  }

  const totalGenomes = manifest.length;
  const withFna = manifest.filter((m) => m.fna).length;
  const withFaa = manifest.filter((m) => m.faa).length;
  const withGff = manifest.filter((m) => m.gff).length;
  const now = new Date().toLocaleString();

  let rows = "";
  let rowNum = 0;
  for (const ph of Object.keys(tree).sort()) {
    const phClasses = tree[ph];
    const phCount = Object.values(phClasses)
      .flatMap((c) => Object.values(c).flatMap((o) => Object.values(o)))
      .reduce((s, a) => s + a.length, 0);
    rows +=
      '\n<details open><summary class="ds">🦠 ' +
      esc(ph) +
      ' <span class="cnt">' +
      phCount +
      "</span></summary>";
    for (const cl of Object.keys(phClasses).sort()) {
      const clOrders = phClasses[cl];
      const clCount = Object.values(clOrders)
        .flatMap((o) => Object.values(o))
        .reduce((s, a) => s + a.length, 0);
      rows +=
        '\n<details><summary class="ps">🔬 ' +
        esc(cl) +
        ' <span class="cnt">' +
        clCount +
        "</span></summary>";
      for (const or of Object.keys(clOrders).sort()) {
        const orFamilies = clOrders[or];
        const orCount = Object.values(orFamilies).reduce(
          (s, a) => s + a.length,
          0,
        );
        rows +=
          '\n<details><summary class="cs">📋 ' +
          esc(or) +
          ' <span class="cnt">' +
          orCount +
          "</span></summary>";
        for (const fa of Object.keys(orFamilies).sort()) {
          const entries = orFamilies[fa];
          rows +=
            '\n<details><summary class="os">📁 ' +
            esc(fa) +
            ' <span class="cnt">' +
            entries.length +
            "</span></summary>";
          rows +=
            '\n<div class="tw"><table><thead><tr><th>#</th><th>Scientific Name</th><th>Strain</th><th>GCF</th><th>Cat</th><th>O₂</th><th>Habitat</th><th>Gut</th><th>Pathogenicity</th><th>FNA</th><th>FAA</th><th>GFF</th></tr></thead><tbody>';
          entries.sort((a, b) =>
            (a.meta.scientific_name || "").localeCompare(
              b.meta.scientific_name || "",
            ),
          );
          for (const { entry, meta } of entries) {
            rowNum++;
            const cat = (meta.refseq_category || "")
              .toLowerCase()
              .includes("reference")
              ? '<span class="cat-ref">REF</span>'
              : '<span class="cat-rep">REP</span>';
            rows += "\n<tr>";
            rows += '<td style="color:#666">' + rowNum + "</td>";
            rows +=
              "<td><em>" +
              esc(meta.scientific_name || entry.gcf) +
              "</em></td>";
            rows +=
              '<td style="font-size:.82em">' + esc(meta.strain || "") + "</td>";
            rows +=
              '<td style="font-family:monospace"><a href="https://www.ncbi.nlm.nih.gov/datasets/genome/' +
              esc(entry.gcf) +
              '" target="_blank">' +
              esc(entry.gcf) +
              "</a></td>";
            rows += "<td>" + cat + "</td>";
            rows +=
              '<td title="' +
              esc(meta.oxygen_requirement || "") +
              '">' +
              o2Symbol(meta.oxygen_requirement) +
              "</td>";
            rows +=
              '<td style="font-size:.8em">' + esc(meta.habitat || "") + "</td>";
            rows += "<td>" + gutBadge(meta.gut_flag) + "</td>";
            rows += "<td>" + pathoBadge(meta.pathogenicity) + "</td>";
            rows += "<td>" + fileBadge(entry.fna, "FNA") + "</td>";
            rows += "<td>" + fileBadge(entry.faa, "FAA") + "</td>";
            rows += "<td>" + fileBadge(entry.gff, "GFF") + "</td>";
            rows += "</tr>";
          }
          rows += "\n</tbody></table></div>\n</details>";
        }
        rows += "\n</details>";
      }
      rows += "\n</details>";
    }
    rows += "\n</details>";
  }

  const css =
    ':root{--bg:#0f1117;--sur:#1a1d27;--sur2:#22263a;--brd:#2e3350;--txt:#e0e4f0;--mut:#8892b0;--acc:#3d5af1;--acc2:#00d4ff}*{box-sizing:border-box;margin:0;padding:0}body{background:var(--bg);color:var(--txt);font-family:"Segoe UI",Arial,sans-serif;font-size:13px;line-height:1.5;padding:20px}h1{font-size:1.6em;color:var(--acc2);margin-bottom:4px}.sub{color:var(--mut);font-size:.88em;margin-bottom:18px}.sg{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:22px}.sc{background:var(--sur);border:1px solid var(--brd);border-radius:7px;padding:10px 18px;text-align:center;min-width:80px}.sn{font-size:1.7em;font-weight:700;color:var(--acc2)}.sl{font-size:.72em;color:var(--mut);margin-top:2px}.leg{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:18px;font-size:.8em;color:var(--mut)}.li{display:flex;align-items:center;gap:5px}.swatch{width:11px;height:11px;border-radius:2px;display:inline-block}details{margin:4px 0}details>summary{cursor:pointer;user-select:none;padding:7px 11px;border-radius:6px;background:var(--sur);border:1px solid var(--brd);font-weight:600;list-style:none;display:flex;align-items:center;gap:8px}details>summary::-webkit-details-marker{display:none}details>summary::before{content:"\u25b6";font-size:.65em;color:var(--acc);transition:transform .15s}details[open]>summary::before{transform:rotate(90deg)}details>summary:hover{background:var(--sur2)}.ds{font-size:1.1em;color:var(--acc2)}.ps{font-size:.98em;color:#a8d8ea;margin-left:14px}.cs{font-size:.9em;color:#d4a5f5;margin-left:28px}.os{font-size:.84em;color:#ffd580;margin-left:42px}.cnt{margin-left:auto;background:var(--brd);padding:1px 7px;border-radius:9px;font-size:.74em;font-weight:400;color:var(--mut)}.tw{overflow-x:auto;margin:6px 0 4px 56px}table{border-collapse:collapse;width:100%;background:var(--sur);border:1px solid var(--brd);border-radius:5px;overflow:hidden}thead tr{background:var(--sur2)}th{padding:7px 9px;text-align:left;color:var(--mut);font-size:.78em;font-weight:600;border-bottom:1px solid var(--brd);white-space:nowrap}td{padding:5px 9px;border-bottom:1px solid var(--brd);vertical-align:middle}tr:last-child td{border-bottom:none}tr:hover td{background:var(--sur2)}a{text-decoration:none;color:#3498db}a:hover{text-decoration:underline}.badge{padding:1px 6px;border-radius:3px;font-size:.76em;white-space:nowrap;display:inline-block}.badge-present{background:#1e4620;color:#4caf50;border:1px solid #2d6a30}.badge-missing{background:#2a2a2a;color:#555;border:1px solid #333}.cat-ref{color:#ffd580;font-size:.75em}.cat-rep{color:#90ee90;font-size:.75em}';

  return (
    '<!DOCTYPE html><html lang="en"><head>\n' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    "<title>Downloaded Genome Browser</title>\n<style>" +
    css +
    "</style></head><body>\n" +
    "<h1>🦬 Downloaded Genome Browser</h1>\n" +
    '<p class="sub">Generated ' +
    now +
    " &bull; " +
    totalGenomes +
    " genomes processed</p>\n" +
    '<div class="sg">' +
    '<div class="sc"><div class="sn">' +
    totalGenomes +
    '</div><div class="sl">Genomes</div></div>' +
    '<div class="sc"><div class="sn">' +
    phylaSet.size +
    '</div><div class="sl">Phyla</div></div>' +
    '<div class="sc"><div class="sn">' +
    classSet.size +
    '</div><div class="sl">Classes</div></div>' +
    '<div class="sc"><div class="sn">' +
    orderSet.size +
    '</div><div class="sl">Orders</div></div>' +
    '<div class="sc"><div class="sn">' +
    familySet.size +
    '</div><div class="sl">Families</div></div>' +
    '<div class="sc"><div class="sn">' +
    genusSet.size +
    '</div><div class="sl">Genera</div></div>' +
    '<div class="sc"><div class="sn">' +
    withFna +
    '</div><div class="sl">w/ FNA</div></div>' +
    '<div class="sc"><div class="sn">' +
    withFaa +
    '</div><div class="sl">w/ FAA</div></div>' +
    '<div class="sc"><div class="sn">' +
    withGff +
    '</div><div class="sl">w/ GFF</div></div>' +
    "</div>\n" +
    '<div class="leg">' +
    '<span style="font-weight:600;color:var(--txt)">Gut:</span>' +
    '<span class="li"><span class="swatch" style="background:#27ae60"></span>gut dominant</span>' +
    '<span class="li"><span class="swatch" style="background:#f39c12"></span>gut associated</span>' +
    '<span class="li"><span class="swatch" style="background:#555"></span>non-gut</span>' +
    '<span style="font-weight:600;margin-left:14px;color:var(--txt)">Files:</span>' +
    '<span class="li"><span class="badge badge-present">FNA</span> genome scaffold</span>' +
    '<span class="li"><span class="badge badge-present">FAA</span> protein sequences</span>' +
    '<span class="li"><span class="badge badge-present">GFF</span> annotation</span>' +
    '<span class="li"><span class="badge badge-missing">?</span> not downloaded</span>' +
    "</div>" +
    rows +
    "\n</body></html>"
  );
}

// ---------------------------------------------------------------------------
// Processing pipeline
// ---------------------------------------------------------------------------

async function runProcessingPipeline(
  win,
  {
    downloadDir,
    outputDir,
    tsvPath,
    segregateByTaxonomy = false,
    generateHtml = true,
  },
) {
  function emit(channel, data) {
    if (!win.isDestroyed()) win.webContents.send(channel, data);
  }
  function stepUpdate(stepId, status, message, extra = {}) {
    emit("processing-step", { stepId, status, message, ...extra });
  }
  function logLine(level, message) {
    emit("processing-log", {
      level,
      message,
      timestamp: new Date().toISOString(),
    });
  }

  let htmlPath = null;

  try {
    // ── Step 1: Scan ────────────────────────────────────────────────────────────────────────
    stepUpdate("scan", "running", "Scanning download folder…");
    logLine("INFO", "Source: " + downloadDir);
    logLine("INFO", "Output: " + outputDir);

    const metadata = parseTsvMetadata(tsvPath);
    logLine(
      "INFO",
      "Loaded " + Object.keys(metadata).length + " entries from metadata TSV.",
    );

    let gcfDirNames = [];
    try {
      gcfDirNames = fs.readdirSync(downloadDir).filter((d) => {
        if (!d.startsWith("GCF_")) return false;
        try {
          return fs.statSync(path.join(downloadDir, d)).isDirectory();
        } catch (_) {
          return false;
        }
      });
    } catch (e) {
      throw new Error("Cannot read download directory: " + e.message);
    }

    const genomes = gcfDirNames.map((gcf) => {
      const meta = metadata[gcf] || {
        gcf_accession: gcf,
        scientific_name: gcf,
        strain: "",
      };
      const files = findGenomeFiles(path.join(downloadDir, gcf));
      return { gcf, meta, files, gcfDir: path.join(downloadDir, gcf) };
    });

    const withFiles = genomes.filter(
      (g) => g.files.fna || g.files.faa || g.files.gff,
    );
    const noMetadata = genomes.filter((g) => !metadata[g.gcf]);

    stepUpdate(
      "scan",
      "done",
      "Found " +
        genomes.length +
        " genome directories (" +
        withFiles.length +
        " with files).",
      {
        total: genomes.length,
        withFiles: withFiles.length,
        noMetadata: noMetadata.length,
      },
    );
    if (noMetadata.length)
      logLine(
        "WARN",
        noMetadata.length + " GCFs not found in TSV — will use GCF ID as name.",
      );

    // ── Step 2: Copy & Rename ──────────────────────────────────────────────────────────────────────────────
    stepUpdate(
      "normalize",
      "running",
      "Creating output directories and copying files…",
    );

    const dirs = {
      root: outputDir,
      genomesScaffolds: path.join(outputDir, "genomes-scaffolds"),
      proteinSeqs: path.join(outputDir, "protein-sequences"),
      gffFiles: path.join(outputDir, "gff-files"),
      input: path.join(outputDir, "input"),
    };
    Object.values(dirs).forEach((d) => fs.mkdirSync(d, { recursive: true }));

    const manifest = [];
    let filesCopied = 0;
    const copyErrors = [];

    for (let idx = 0; idx < genomes.length; idx++) {
      const { gcf, meta, files, gcfDir } = genomes[idx];
      const base = buildNormalizedBase(meta);
      const entry = {
        gcf,
        normalized_base: base,
        scientific_name: meta.scientific_name || "",
        strain: meta.strain || "",
        phylum: meta.phylum || "",
        fna: "",
        faa: "",
        gff: "",
      };

      function safeCopy(srcFile, destDir, newName) {
        const src = path.join(gcfDir, srcFile);
        const dst = path.join(destDir, newName);
        try {
          fs.copyFileSync(src, dst);
          const inputDst = path.join(dirs.input, newName);
          if (!fs.existsSync(inputDst)) fs.copyFileSync(src, inputDst);
          filesCopied++;
          return newName;
        } catch (e) {
          copyErrors.push(gcf + "/" + srcFile + ": " + e.message);
          return "";
        }
      }

      if (files.fna) {
        const ext = getFileExtension(files.fna);
        entry.fna = safeCopy(files.fna, dirs.genomesScaffolds, base + ext);
      }
      if (files.faa) {
        const ext = getFileExtension(files.faa);
        entry.faa = safeCopy(files.faa, dirs.proteinSeqs, base + ext);
      }
      if (files.gff) {
        const ext = getFileExtension(files.gff);
        entry.gff = safeCopy(files.gff, dirs.gffFiles, base + ext);
      }

      manifest.push(entry);
      logLine(
        "SUCCESS",
        "[" + (idx + 1) + "/" + genomes.length + "] " + gcf + " → " + base,
      );
      emit("processing-file", {
        gcf,
        normalized_base: base,
        idx: idx + 1,
        total: genomes.length,
      });
    }

    stepUpdate(
      "normalize",
      "done",
      "Copied " + filesCopied + " files (" + copyErrors.length + " errors).",
      { filesCopied, copyErrors },
    );
    if (copyErrors.length) copyErrors.forEach((e) => logLine("ERROR", e));

    // ── Step 3: Taxonomic table ───────────────────────────────────────────────────────────────────────
    stepUpdate("taxonomy", "running", "Writing taxonomic table…");

    const TAX_COLS = [
      "normalized_name",
      "gcf_accession",
      "scientific_name",
      "strain",
      "phylum",
      "class",
      "order",
      "family",
      "genus",
      "species",
      "habitat",
      "oxygen_requirement",
      "gut_flag",
      "pathogenicity",
    ];

    const taxRows = manifest.map((m) => {
      const meta = metadata[m.gcf] || {};
      return TAX_COLS.map((col) => {
        if (col === "normalized_name") return m.normalized_base;
        return (meta[col] || "").replace(/\t/g, " ");
      }).join("\t");
    });

    const taxContent = [TAX_COLS.join("\t"), ...taxRows].join("\n") + "\n";
    const taxPath = path.join(outputDir, "taxonomic_table.tsv");
    fs.writeFileSync(taxPath, taxContent);
    fs.copyFileSync(taxPath, path.join(dirs.input, "taxonomic_table.tsv"));

    stepUpdate(
      "taxonomy",
      "done",
      "Taxonomic table written (" + manifest.length + " rows).",
    );
    logLine("INFO", "taxonomic_table.tsv → " + taxPath);

    // ── Step 4: Verify ────────────────────────────────────────────────────────────────────────────────
    stepUpdate(
      "verify",
      "running",
      "Verifying GCF accession ↔ scientific name matches…",
    );

    const verifyWarnings = [];
    for (const { gcf, meta } of genomes) {
      const tsvMeta = metadata[gcf];
      if (!tsvMeta) {
        verifyWarnings.push(
          gcf + ": not found in metadata TSV — name used as-is.",
        );
      } else if (tsvMeta.scientific_name !== meta.scientific_name) {
        verifyWarnings.push(
          gcf +
            ": name mismatch — TSV: \ + tsvMeta.scientific_name + \\ | used: \ + meta.scientific_name + \\",
        );
      }
    }
    verifyWarnings.forEach((w) => logLine("WARN", w));
    stepUpdate(
      "verify",
      verifyWarnings.length ? "warn" : "done",
      verifyWarnings.length
        ? verifyWarnings.length + " warning(s) — see log for details."
        : "All " + genomes.length + " GCF accessions verified OK.",
      { warnings: verifyWarnings },
    );

    // ── Step 5: Manifest ───────────────────────────────────────────────────────────────────────────────
    stepUpdate("manifest", "running", "Writing genome manifest…");

    const MAN_COLS = [
      "gcf_accession",
      "normalized_base",
      "scientific_name",
      "strain",
      "phylum",
      "fna_file",
      "faa_file",
      "gff_file",
    ];
    const manRows = manifest.map((m) =>
      [
        m.gcf,
        m.normalized_base,
        m.scientific_name,
        m.strain,
        m.phylum,
        m.fna,
        m.faa,
        m.gff,
      ].join("\t"),
    );
    const manPath = path.join(outputDir, "genome_manifest.tsv");
    fs.writeFileSync(
      manPath,
      [MAN_COLS.join("\t"), ...manRows].join("\n") + "\n",
    );

    stepUpdate(
      "manifest",
      "done",
      "Manifest written (" + manifest.length + " entries).",
    );
    logLine("INFO", "genome_manifest.tsv → " + manPath);

    // ── Step 6: Taxonomic Segregation (optional) ──────────────────────────────────────────────────────────────
    if (segregateByTaxonomy) {
      stepUpdate(
        "segregate",
        "running",
        "Organizing files by taxonomy hierarchy…",
      );
      const taxRoot = path.join(outputDir, "by-taxonomy");
      fs.mkdirSync(taxRoot, { recursive: true });
      let segregated = 0;
      const segregateErrors = [];

      for (const entry of manifest) {
        const meta = metadata[entry.gcf] || {};
        const ph = normalizeForFilename(meta.phylum || "Unclassified");
        const cl = normalizeForFilename(meta.class || "Unclassified");
        const or = normalizeForFilename(meta.order || "Unclassified");
        const fa = normalizeForFilename(meta.family || "Unclassified");
        const taxDir = path.join(taxRoot, ph, cl, or, fa);
        fs.mkdirSync(taxDir, { recursive: true });

        const filePairs = [
          [entry.fna, dirs.genomesScaffolds],
          [entry.faa, dirs.proteinSeqs],
          [entry.gff, dirs.gffFiles],
        ];
        for (const [filename, srcDir] of filePairs) {
          if (!filename) continue;
          const src = path.join(srcDir, filename);
          const dst = path.join(taxDir, filename);
          try {
            fs.copyFileSync(src, dst);
            segregated++;
          } catch (e) {
            segregateErrors.push(entry.gcf + "/" + filename + ": " + e.message);
          }
        }
      }

      stepUpdate(
        "segregate",
        segregateErrors.length ? "warn" : "done",
        "Taxonomy tree created (" +
          segregated +
          " files" +
          (segregateErrors.length
            ? ", " + segregateErrors.length + " errors"
            : "") +
          ").",
        { segregated, errors: segregateErrors },
      );
      logLine("INFO", "by-taxonomy/ → " + taxRoot);
    } else {
      stepUpdate("segregate", "skip", "Taxonomic segregation skipped.");
    }

    // ── Step 7: HTML Report (optional) ─────────────────────────────────────────────────────────────────────────
    if (generateHtml) {
      stepUpdate("html", "running", "Generating HTML report…");
      try {
        const htmlContent = generateHtmlReport(manifest, metadata);
        htmlPath = path.join(outputDir, "genome_browser.html");
        fs.writeFileSync(htmlPath, htmlContent, "utf8");
        stepUpdate("html", "done", "HTML report written.", { htmlPath });
        logLine("INFO", "genome_browser.html → " + htmlPath);
      } catch (e) {
        stepUpdate("html", "warn", "HTML generation failed: " + e.message);
        logLine("WARN", "HTML report generation failed: " + e.message);
      }
    } else {
      stepUpdate("html", "skip", "HTML report generation skipped.");
    }

    logLine("SUCCESS", "Processing complete. Output: " + outputDir);

    emit("processing-done", {
      success: true,
      outputDir,
      htmlPath,
      total: genomes.length,
      filesCopied,
      copyErrors,
      verifyWarnings,
      manifest,
    });
  } catch (err) {
    logLine("ERROR", "Pipeline failed: " + err.message);
    emit("processing-done", { success: false, error: err.message });
  }
}

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------
let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: "hiddenInset",
    backgroundColor: "#0d1117",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (IS_DEV) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(
      path.join(__dirname, "..", "dist", "renderer", "index.html"),
    );
  }
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------

ipcMain.handle("get-settings", () => loadSettings());
ipcMain.handle("save-settings", (_, settings) => {
  saveSettings(settings);
  return true;
});

ipcMain.handle("select-directory", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "createDirectory"],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle("open-external", (_, url) => shell.openExternal(url));
ipcMain.handle("open-path", (_, p) => shell.openPath(p));

ipcMain.handle("get-datasets-status", () => {
  const installed = isDatasetsInstalled();
  return {
    ok: installed,
    installed,
    path: fs.existsSync(DATASETS_BIN) ? DATASETS_BIN : "system PATH",
    arch: os.arch(),
    version: installed ? "datasets CLI ready" : null,
    detail: installed ? null : "Not found in bundled path or system PATH",
  };
});

ipcMain.handle("download-datasets-cli", async () => {
  try {
    await downloadDatasetsBinary(mainWindow);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("get-tsv-path", () => {
  if (IS_DEV) return path.join(__dirname, "..", "..", "bacteria_3000.tsv");
  return path.join(process.resourcesPath, "bacteria_3000.tsv");
});

ipcMain.handle("read-tsv", (_, tsvPath) => {
  try {
    return fs.readFileSync(tsvPath, "utf8");
  } catch (e) {
    return null;
  }
});

ipcMain.handle("prepare-batches", (_, { tsvPath, batchSize, batchesDir }) => {
  const python = getPythonCmd();
  const script = path.join(getPythonScriptsDir(), "prepare_batches.py");
  return new Promise((resolve) => {
    const proc = spawn(python, [
      script,
      "--tsv",
      tsvPath,
      "--batch-size",
      String(batchSize),
      "--outdir",
      batchesDir,
    ]);
    let out = "",
      err = "";
    proc.stdout.on("data", (d) => {
      out += d;
    });
    proc.stderr.on("data", (d) => {
      err += d;
    });
    proc.on("close", (code) =>
      resolve({ ok: code === 0, stdout: out, stderr: err }),
    );
  });
});

ipcMain.handle(
  "start-downloads",
  async (_, { accessions, outDir, apiKey, parallelism }) => {
    fs.mkdirSync(outDir, { recursive: true });
    runDownloadQueue(mainWindow, accessions, outDir, apiKey, parallelism);
    return { ok: true };
  },
);

ipcMain.handle("stop-downloads", () => {
  stopAllDownloads();
  return { ok: true };
});

ipcMain.handle("verify-downloads", (_, { outDir, accessions }) => {
  const python = getPythonCmd();
  const script = path.join(getPythonScriptsDir(), "verify_downloads.py");
  const tmpAccFile = path.join(os.tmpdir(), `acc_${Date.now()}.txt`);
  fs.writeFileSync(tmpAccFile, accessions.join("\n"));
  return new Promise((resolve) => {
    const proc = spawn(python, [
      script,
      "--outdir",
      outDir,
      "--accessions",
      tmpAccFile,
      "--json",
    ]);
    let out = "",
      err = "";
    proc.stdout.on("data", (d) => {
      out += d;
    });
    proc.stderr.on("data", (d) => {
      err += d;
    });
    proc.on("close", () => {
      try {
        fs.unlinkSync(tmpAccFile);
      } catch (_) {}
      try {
        resolve({ ok: true, result: JSON.parse(out) });
      } catch (_) {
        resolve({ ok: false, stderr: err, stdout: out });
      }
    });
  });
});

ipcMain.handle("check-python", () => {
  const cmd = getPythonCmd();
  try {
    const r = require("child_process").spawnSync(cmd, ["--version"], {
      timeout: 3000,
    });
    return {
      ok: r.status === 0,
      version: r.stdout.toString().trim() || r.stderr.toString().trim(),
      cmd,
    };
  } catch (e) {
    return { ok: false, error: e.message, cmd };
  }
});

ipcMain.handle("scan-downloads", async (_, { downloadDir, tsvPath }) => {
  try {
    const metadata = parseTsvMetadata(tsvPath);
    const gcfEntries = findGcfDirsRecursive(downloadDir);
    const results = gcfEntries.map(({ gcf, dirPath }) => {
      const meta = metadata[gcf] || {
        gcf_accession: gcf,
        scientific_name: gcf,
        strain: "",
      };
      const files = findGenomeFiles(dirPath);
      return {
        gcf,
        scientific_name: meta.scientific_name || gcf,
        strain: meta.strain || "",
        normalized_base: buildNormalizedBase(meta),
        has_fna: !!files.fna,
        has_faa: !!files.faa,
        has_gff: !!files.gff,
      };
    });
    return { ok: true, results, total: results.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

ipcMain.handle("start-processing", (_, opts) => {
  runProcessingPipeline(mainWindow, opts);
  return { ok: true };
});

// Scan output dir for already-downloaded genomes
ipcMain.handle("scan-output-dir", (_, { outputDir, tsvPath }) => {
  try {
    const metadata = parseTsvMetadata(tsvPath);
    const gcfEntries = findGcfDirsRecursive(outputDir);
    const results = gcfEntries.map(({ gcf, dirPath }) => {
      const meta = metadata[gcf] || {
        gcf_accession: gcf,
        scientific_name: gcf,
        strain: "",
        phylum: "",
      };
      const files = findGenomeFiles(dirPath);
      return {
        gcf,
        scientific_name: meta.scientific_name || gcf,
        strain: meta.strain || "",
        phylum: meta.phylum || "",
        has_fna: !!files.fna,
        has_faa: !!files.faa,
        has_gff: !!files.gff,
      };
    });
    return { ok: true, results, total: results.length };
  } catch (e) {
    return { ok: false, error: e.message, results: [], total: 0 };
  }
});

// Delete genome directories from output folder
ipcMain.handle("delete-genomes", (_, { outputDir, gcfList }) => {
  const deleted = [];
  const errors = [];
  for (const gcf of gcfList || []) {
    const dirPath = path.join(outputDir, gcf);
    try {
      fs.rmSync(dirPath, { recursive: true, force: true });
      deleted.push(gcf);
    } catch (e) {
      errors.push(gcf + ": " + e.message);
    }
  }
  return { ok: errors.length === 0, deleted, errors };
});

// Get filtered genome list from TSV
ipcMain.handle("get-genome-list", (_, { tsvPath, filters = {} }) => {
  try {
    const metadata = parseTsvMetadata(tsvPath);
    let rows = Object.values(metadata);
    if (filters.refseq_category) {
      rows = rows.filter((r) =>
        (r.refseq_category || "")
          .toLowerCase()
          .includes(filters.refseq_category.toLowerCase()),
      );
    }
    if (filters.phylum) {
      rows = rows.filter(
        (r) => (r.phylum || "").toLowerCase() === filters.phylum.toLowerCase(),
      );
    }
    if (filters.class) {
      rows = rows.filter(
        (r) => (r.class || "").toLowerCase() === filters.class.toLowerCase(),
      );
    }
    if (filters.order) {
      rows = rows.filter(
        (r) => (r.order || "").toLowerCase() === filters.order.toLowerCase(),
      );
    }
    if (filters.family) {
      rows = rows.filter(
        (r) => (r.family || "").toLowerCase() === filters.family.toLowerCase(),
      );
    }
    if (filters.genus) {
      rows = rows.filter(
        (r) => (r.genus || "").toLowerCase() === filters.genus.toLowerCase(),
      );
    }
    if (filters.species) {
      rows = rows.filter(
        (r) =>
          (r.species || "").toLowerCase() === filters.species.toLowerCase(),
      );
    }
    if (filters.strain) {
      rows = rows.filter(
        (r) => (r.strain || "").toLowerCase() === filters.strain.toLowerCase(),
      );
    }
    if (filters.gut) {
      rows = rows.filter((r) => {
        const v = (r.gut_flag || "").toLowerCase();
        if (filters.gut === "gut")
          return v.includes("gut") && !v.includes("non");
        if (filters.gut === "non_gut") return v.includes("non_gut");
        return true;
      });
    }
    return { ok: true, rows, total: rows.length };
  } catch (e) {
    return { ok: false, error: e.message, rows: [], total: 0 };
  }
});
