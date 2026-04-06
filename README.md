# ncbi-genome-downloader-for-margie

> **Note:** This repository was set up specifically for **MARGIE's testing workflow**. It is shared as a private resource for that purpose. It may be used for other research or personal projects at your own discretion — please review the [License](#license) and [NCBI data use policies](https://www.ncbi.nlm.nih.gov/home/about/policies/) before doing so.

A reproducible pipeline for bulk-downloading 2,999 complete bacterial reference genomes from NCBI RefSeq.

Three ways to use this project:

| Mode | Best for | What you need |
|------|----------|---------------|
| **Mac Desktop App** (DMG) | Individual researchers on Apple Silicon or Intel Macs | macOS 12+, ~100 GB free disk space |
| **Container CLI** (Docker or Apptainer) | Simple non-interactive command-line runs on Mac or Linux | Docker Desktop on Mac, or Apptainer on Linux |
| **HPC Pipeline** (optional SLURM) | Large-scale cluster downloads | Apptainer, optional SLURM, internet access from login node |

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
cd ncbi-genome-downloader-for-margie/app
brew install npm #needs to have brew installed in mac (or you can use any other way to install npm)
npm install
npm run dist          # builds app/dist/electron/*.dmg
```

The DMG output stays architecture-specific and is generated dynamically by Electron Builder for the machine target you build for. Release users should continue using the latest DMG artifacts from the Releases page.

---

## Container CLI — Simple Non-Interactive Usage

The container now exposes a single top-level CLI named `genome-download`.

For an even simpler Docker workflow, the repository root also includes a `Makefile` with `make help`, `make build-mac`, `make run`, `make verify`, and `make push-ghcr` targets.

That gives you one simple contract across environments:

- Docker on Apple Silicon Mac: native `linux/arm64`
- Docker on Intel Linux or Mac: native `linux/amd64`
- Apptainer on HPC: typically built or pulled as `linux/amd64`

SLURM is no longer required for the core pipeline. Users who already have their own cluster orchestration can call the same container commands directly.

### CLI help

After building or pulling the image, show the built-in help with:

```bash
docker run --rm ghcr.io/YOUR_GITHUB_USER/genome-download:latest help
```

Or inside Apptainer:

```bash
apptainer exec genome_download.sif genome-download help
```

### Commands

The container CLI supports:

- `help` — show usage
- `shell` — open an interactive shell inside the container
- `prepare` — create batch files from `bacteria_3000.tsv`
- `download` — download one batch file
- `verify` — verify completed downloads
- `retry` — retry only failed accessions
- `run` — execute prepare, all batch downloads, and verification in one command

### Mac Docker quick start

From the repository root:

```bash
make build-mac
```

Run the full pipeline non-interactively:

```bash
make run
```

This produces a plain directory layout under `3000-cli/` with batches, genomes, logs, and any retry file written automatically.

Show the available shortcuts with:

```bash
make help
```

### Run step-by-step instead of all at once

Prepare:

```bash
docker run --rm \
  -v "$PWD:/workspace" \
  -v "$PWD/3000-cli:/data" \
  genome-download:latest prepare \
  --tsv /workspace/bacteria_3000.tsv \
  --batch-size 50 \
  --batch-dir /data/batches
```

Download a single batch:

```bash
docker run --rm \
  -v "$PWD/3000-cli:/data" \
  -e NCBI_API_KEY="$NCBI_API_KEY" \
  genome-download:latest download \
  --batch-file /data/batches/batch_0000.txt \
  --output-dir /data/genomes \
  --parallel 4
```

Verify:

```bash
docker run --rm \
  -v "$PWD/3000-cli:/data" \
  genome-download:latest verify \
  --output-dir /data/genomes \
  --accessions /data/batches/accessions_all.txt
```

Retry failed genomes after verification:

```bash
docker run --rm \
  -v "$PWD/3000-cli:/data" \
  -e NCBI_API_KEY="$NCBI_API_KEY" \
  genome-download:latest retry \
  --failed-file /data/genomes/failed_accessions.txt \
  --output-dir /data/genomes \
  --parallel 2
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

## Container Build And Publish

### 1. Build locally for Mac Apple Silicon

```bash
docker buildx build --platform linux/arm64 \
  -t genome-download:latest \
  --load container
```

### 2. Build locally for Linux amd64 / Apptainer export

From the repository root:

```bash
docker buildx build --platform linux/amd64 \
  -t ghcr.io/YOUR_GITHUB_USER/genome-download:latest \
  --load container
```

> `--load` imports the image into your local Docker daemon for testing.
> On Apple Silicon, Docker Buildx handles the amd64 cross-build.

### 3. Test locally

Verify the CLI is functional inside the container:

```bash
docker run --rm ghcr.io/YOUR_GITHUB_USER/genome-download:latest help
```

You should see the `genome-download` command help.

### 4. Push multi-arch images to GitHub Container Registry (GHCR)

```bash
# Authenticate (requires a Personal Access Token with write:packages scope)
echo $GITHUB_TOKEN | docker login ghcr.io -u YOUR_GITHUB_USER --password-stdin

# Build and push both arm64 and amd64 manifests in one step
docker buildx build --platform linux/arm64,linux/amd64 \
  -t ghcr.io/YOUR_GITHUB_USER/genome-download:latest \
  --push container
```

If you use GitHub CLI instead of a manually exported `GITHUB_TOKEN`, make sure the active token also has `write:packages`. A plain repo-scoped token is not sufficient for GHCR pushes.

The GitHub Actions workflow (`.github/workflows/build-push.yml`) automates this on every push to `main` that touches `container/**`.

---

## Apptainer Usage Without SLURM

If you just want a simple Linux CLI flow without any scheduler, use the same container commands through Apptainer.

### 1. Build or pull an amd64 image

Either pull from GHCR:

```bash
apptainer pull genome_download.sif docker://ghcr.io/YOUR_GITHUB_USER/genome-download:latest
```

Or convert a local Docker image on a Linux host in the usual way supported by your environment.

### 2. Run the full pipeline

```bash
mkdir -p genome_download/{batches,genomes}

apptainer exec \
  --bind "$PWD:/workspace" \
  --bind "$PWD/genome_download:/data" \
  genome_download.sif \
  genome-download run \
  --tsv /workspace/bacteria_3000.tsv \
  --batch-size 50 \
  --batch-dir /data/batches \
  --output-dir /data/genomes \
  --parallel 4
```

### 3. Show CLI help

```bash
apptainer exec genome_download.sif genome-download help
```

---

## HPC Usage (Apptainer + Optional SLURM)

### Prerequisites

- Apptainer (or Singularity ≥ 3.x) available on the cluster
- SLURM workload manager if you want scheduler-managed batch execution
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

This launches up to 10 concurrent SLURM array tasks (configurable via `%10` in the `--array` directive). Each task downloads one batch of 50 genomes using the same `genome-download` container tooling under the hood.

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
