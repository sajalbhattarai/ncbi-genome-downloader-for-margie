# Microbial Reference Genome Downloader

A reproducible pipeline for bulk-downloading 2,999 complete bacterial reference genomes from NCBI RefSeq.

Two ways to use this project:

| Mode | Best for | What you need |
|------|----------|---------------|
| **Mac Desktop App** (DMG) | Individual researchers on Apple Silicon or Intel Macs | macOS 12+, ~100 GB free disk space |
| **HPC Pipeline** (Docker + SLURM) | Large-scale cluster downloads | Apptainer, SLURM, internet access from login node |

---

## Mac Desktop App — Quick Start

### Download

Grab the latest DMG from the [**Releases**](../../releases/latest) page:

| File | Architecture |
|------|-------------|
| `Microbial.Genome.Downloader-arm64.dmg` | Apple Silicon (M1 / M2 / M3 / M4) |
| `Microbial.Genome.Downloader-x64.dmg` | Intel Mac |

> **Not sure which chip you have?**  Apple menu → About This Mac → look for "Apple M…" (ARM) or "Intel Core" (x64).

### Install

1. Open the downloaded `.dmg` file.
2. Drag **Microbial Genome Downloader** into your **Applications** folder.
3. Close the disk image window and eject it from Finder.

### First Launch — Bypass Gatekeeper

Because the app is not distributed through the Mac App Store, macOS will block it on the first open.

**Option A — Right-click method (recommended):**
1. In Finder, navigate to **Applications**.
2. **Right-click** (or Control-click) the app icon → **Open**.
3. Click **Open** in the security dialog that appears.
4. The app opens normally on all future launches.

**Option B — System Settings:**
1. Attempt to open the app normally; macOS shows a blocked dialog.
2. Go to **System Settings → Privacy & Security**.
3. Scroll down to the "Security" section; click **Open Anyway** next to the app name.
4. Confirm with **Open**.

### Using the App

The app walks you through every step in its sidebar:

| Screen | What to do |
|--------|-----------|
| **Setup** | Choose an output folder, set batch size (default 50) and parallelism (default 4). The app auto-downloads the NCBI `datasets` CLI on first run — no manual install needed. Optionally paste your free [NCBI API key](https://www.ncbi.nlm.nih.gov/account/) to raise the rate limit. |
| **Genome Browser** | Browse and filter all 2,999 reference genomes before downloading. |
| **Download Manager** | Start, pause, or resume batch downloads. A dot grid shows the live status of every genome (pending / downloading / done / failed). |
| **Verification** | Scan completed batches for corrupt or missing files and re-queue failures automatically. |
| **Logs** | Real-time download log with colour-coded INFO / SUCCESS / WARN / ERROR messages. |
| **Credits** | Tool citations and license information. |

### Disk Space

Allow roughly **30–50 GB** for all 2,999 genomes in gzip-compressed format (`.fna.gz`, `.gff.gz`, `.faa.gz` per genome).

### Building the DMG Yourself

If you prefer to compile from source:

```bash
# Prerequisites: Node.js ≥ 18, npm
cd app
npm install
npm run dist          # builds app/dist/electron/*.dmg
```

---

## Contents

| Path | Description |
|------|-------------|
| `bacteria_3000.tsv` | 2,999 complete-genome bacterial reference isolates from NCBI RefSeq |
| `app/` | Electron + React Mac desktop app source code |
| `container/` | Docker container definition and download scripts |
| `container/slurm/` | HPC SLURM job scripts for array downloading, verification, and retry |
| `container/CREDITS.md` | Full tool credits and citations |

---

## Genome Collection

### Statistics

| Category | Count |
|----------|-------|
| Total genomes | 2,999 |
| Phyla | 54 |
| Classes | 107 |
| Orders | 245 |
| Families | 580 |
| Genera | 1,941 |

### Phylum Nomenclature Note

This dataset uses current NCBI/GTDB-aligned phylum names. Common synonyms you may encounter in older literature:

| Current Name | Synonym(s) |
|---|---|
| Bacillota | Firmicutes |
| Pseudomonadota | Proteobacteria |
| Bacteroidota | Bacteroidetes |
| Actinomycetota | Actinobacteria |
| Thermodesulfobacteriota | Deltaproteobacteria (in part) |
| Campylobacterota | Epsilonproteobacteria |

### Selection Criteria

All 2,999 genomes satisfy **every** one of the following filters:

- **Assembly level:** Complete genome (no scaffolds, no contigs)
- **RefSeq category:** `reference genome` designation
- **Source:** Isolated pure cultures — no metagenome-assembled genomes (MAGs), no single-amplified genomes (SAGs), no environmental metagenomes
- **Assembly type:** `haploid`
- **Domain:** Bacteria (Archaea excluded)

---

## Quick Start (Mac M2 / Apple Silicon)

### 1. Build the container

The image targets `linux/amd64` for HPC compatibility. From the repository root:

```bash
cd container
docker buildx build --platform linux/amd64 \
  -t ghcr.io/YOUR_GITHUB_USER/genome-download:latest \
  --load .
```

> **Note:** The `--load` flag loads the image into your local Docker daemon for local testing.
> On Apple Silicon, this cross-compilation step is handled transparently by Buildx + QEMU.

### 2. Test locally

Verify the NCBI `datasets` CLI is functional inside the container:

```bash
docker run --rm ghcr.io/YOUR_GITHUB_USER/genome-download:latest datasets --version
```

You should see output like `datasets version: 16.x.x`.

### 3. Push to GitHub Container Registry (GHCR)

```bash
# Authenticate (requires a Personal Access Token with write:packages scope)
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin

# Build and push in one step
docker buildx build --platform linux/amd64 \
  -t ghcr.io/YOUR_GITHUB_USER/genome-download:latest \
  --push .
```

The GitHub Actions workflow (`.github/workflows/build-push.yml`) automates this on every push to `main` that touches `container/**`.

---

## HPC Usage (Apptainer + SLURM)

### Prerequisites

- Apptainer (or Singularity ≥ 3.x) available on the cluster
- SLURM workload manager
- Internet access from the login node (to pull the image)
- `bacteria_3000.tsv` copied to the HPC

### Step-by-step

#### 1. Copy `bacteria_3000.tsv` to HPC

```bash
scp bacteria_3000.tsv YOUR_USER@hpc.example.edu:~/genome_download/
```

#### 2. Edit and run the setup script

Open `container/slurm/01_setup_hpc.sh` and set your GitHub username and any other paths in the `CONFIG` section at the top of the file. Then run it **once** on the login node:

```bash
bash container/slurm/01_setup_hpc.sh
```

This script will:
- Create the working directory structure (`~/genome_download/{batches,genomes,logs}`)
- Pull the Apptainer image from GHCR
- Run `01_prepare_accessions.py` inside the container to split `bacteria_3000.tsv` into batch files
- Print the exact `sbatch` command to run next

#### 3. Edit and submit the download array job

Open `container/slurm/02_download_array.slurm` and confirm the `CONFIG` block matches your cluster (partition name, working directory, etc.). Then submit:

```bash
sbatch container/slurm/02_download_array.slurm
```

This launches up to 10 concurrent SLURM array tasks (configurable via `%10` in the `--array` directive). Each task downloads one batch of 50 genomes using `ncbi-datasets` inside the container.

#### 4. Verify and retry failures

After all array tasks complete, submit the verification job:

```bash
# Option A: submit immediately and let SLURM wait
sbatch --dependency=afterany:ARRAY_JOB_ID container/slurm/03_verify_and_retry.slurm

# Option B: submit manually after checking the array finished
sbatch container/slurm/03_verify_and_retry.slurm
```

This script:
1. Runs `03_verify_downloads.py` to detect missing or incomplete genomes
2. If failures exist, reruns `04_retry_failed.sh` on only the failed accessions
3. Runs `03_verify_downloads.py` a second time and prints final stats

---

## Output Directory Structure

After a successful run, `~/genome_download/` will look like:

```
genome_download/
├── genome_download.sif          # Apptainer image
├── bacteria_3000.tsv            # Input manifest
├── batches/
│   ├── batch_0000.txt           # Accession list, 50 entries each
│   ├── batch_0001.txt
│   └── ...                      # 60 batch files total
├── genomes/
│   ├── GCF_000005845.2/         # One directory per genome
│   │   ├── GCF_000005845.2_ASM584v2_genomic.fna.gz
│   │   ├── GCF_000005845.2_ASM584v2_genomic.gff.gz
│   │   └── GCF_000005845.2_ASM584v2_protein.faa.gz
│   └── ...
└── logs/
    ├── dl_12345_0.out            # stdout per array task
    ├── dl_12345_0.err            # stderr per array task
    └── verify_12346.out
```

---

## Disk Space

Expect approximately **30–50 GB** total for all 2,999 genomes, depending on genome sizes in your collection. Each genome directory contains:

- Genome assembly FASTA (`.fna.gz`)
- Genome annotation GFF3 (`.gff.gz`)
- Protein sequences FASTA (`.faa.gz`)

All files are downloaded in gzip-compressed format directly from NCBI.

---

## Adjusting Concurrency and Rate Limits

| Parameter | Where to set | Default | Notes |
|---|---|---|---|
| Max concurrent SLURM tasks | `02_download_array.slurm` `--array=0-59%10` | `10` | Increase carefully; NCBI may throttle |
| Parallel downloads per task | `N_PARALLEL=4` | `4` | Matches `--cpus-per-task=4` |
| NCBI API key | `NCBI_API_KEY=""` in the slurm script | *(none)* | Raises rate limit from 3 to 10 req/s |

To register for a free NCBI API key: https://www.ncbi.nlm.nih.gov/account/

---

## Reproducibility

The container image is pinned by SHA tag in addition to `latest`:

```bash
# Pull a specific immutable SHA-tagged build
apptainer pull genome_download_sha.sif \
  docker://ghcr.io/YOUR_GITHUB_USER/genome-download:sha-a1b2c3d
```

SHA tags are generated automatically by the GitHub Actions workflow using `docker/metadata-action`.

---

## Credits & Citations

Brief credits are listed below. Full tool versions, licenses, and citation details are in [`container/CREDITS.md`](container/CREDITS.md).

| Tool | Use | Reference |
|------|-----|-----------|
| **NCBI Datasets** (`datasets` CLI) | Genome download | Sayers et al., *Nucleic Acids Res.* 2022; doi:[10.1093/nar/gkab1112](https://doi.org/10.1093/nar/gkab1112) |
| **GNU Parallel** | Parallel downloads within each task | Tange O., *USENIX ;login:* 2011; doi:[10.5281/zenodo.1146014](https://doi.org/10.5281/zenodo.1146014) |
| **Apptainer** | HPC container runtime | Kurtzer et al., *PLoS ONE* 2017; doi:[10.1371/journal.pone.0177459](https://doi.org/10.1371/journal.pone.0177459) |
| **Docker / Buildx** | Container build toolchain | https://docs.docker.com/buildx/ |

---

## License

This project is released under the **MIT License**. See [`LICENSE`](LICENSE) for the full text.

Genome data downloaded from NCBI RefSeq is subject to NCBI's data use policies:
https://www.ncbi.nlm.nih.gov/home/about/policies/