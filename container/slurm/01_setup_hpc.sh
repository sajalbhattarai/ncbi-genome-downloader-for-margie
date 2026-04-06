#!/usr/bin/env bash
# ==============================================================================
# 01_setup_hpc.sh
#
# PURPOSE:
#   Run this script ONCE on the HPC login node to:
#     1. Pull the Apptainer/Singularity image from GHCR
#     2. Copy bacteria_3000.tsv into your working directory
#     3. Partition the accession list into per-task batch files
#
# AFTER THIS SCRIPT COMPLETES:
#   You can either:
#     A. run the container CLI directly with apptainer exec ... genome-download run
#     B. edit 02_download_array.slurm and submit it with sbatch
#
# USAGE:
#   bash 01_setup_hpc.sh
#   (or: chmod +x 01_setup_hpc.sh && ./01_setup_hpc.sh)
# ==============================================================================
set -euo pipefail

# ==============================================================================
# === CONFIG ===
# Edit the variables below before running.
# ==============================================================================

GITHUB_USER="sajalbhattarai"    # your GitHub username (owner of the GHCR package)
IMAGE_TAG="latest"
SIF_NAME="genome_download.sif"
WORK_DIR="$HOME/genome_download"   # all output goes here (image, batches, genomes, logs)
TSV_FILE="$WORK_DIR/bacteria_3000.tsv"
BATCH_SIZE=50

# ==============================================================================
# (No edits needed below this line)
# ==============================================================================

echo "============================================================"
echo " Microbial Genome Download — HPC Setup"
echo "============================================================"
echo "  WORK_DIR   : $WORK_DIR"
echo "  GITHUB_USER: $GITHUB_USER"
echo "  IMAGE_TAG  : $IMAGE_TAG"
echo "  SIF_NAME   : $SIF_NAME"
echo "  BATCH_SIZE : $BATCH_SIZE"
echo "============================================================"
echo ""

# ------------------------------------------------------------------------------
# Create directory structure
# ------------------------------------------------------------------------------
echo "[setup] Creating directory structure under $WORK_DIR ..."
mkdir -p "$WORK_DIR/batches"
mkdir -p "$WORK_DIR/genomes"
mkdir -p "$WORK_DIR/logs"
echo "[setup] Directories created:"
echo "         $WORK_DIR/batches"
echo "         $WORK_DIR/genomes"
echo "         $WORK_DIR/logs"
echo ""

# ------------------------------------------------------------------------------
# Step 1: Pull Apptainer image from GHCR
# ------------------------------------------------------------------------------
echo "------------------------------------------------------------"
echo "[Step 1] Pulling Apptainer image from GHCR ..."
echo "         Source : docker://ghcr.io/${GITHUB_USER}/genome-download:${IMAGE_TAG}"
echo "         Dest   : $WORK_DIR/$SIF_NAME"
echo "------------------------------------------------------------"

apptainer pull --force "$WORK_DIR/$SIF_NAME" \
    "docker://ghcr.io/${GITHUB_USER}/genome-download:${IMAGE_TAG}"

echo ""
echo "[Step 1] Image pulled successfully: $WORK_DIR/$SIF_NAME"
echo ""

# ------------------------------------------------------------------------------
# Step 2: Copy bacteria_3000.tsv to WORK_DIR if not already there
# ------------------------------------------------------------------------------
echo "------------------------------------------------------------"
echo "[Step 2] Checking for bacteria_3000.tsv ..."
echo "------------------------------------------------------------"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_TSV="$SCRIPT_DIR/../../bacteria_3000.tsv"   # relative to this script in the repo

if [[ -f "$TSV_FILE" ]]; then
    echo "[Step 2] Found $TSV_FILE — skipping copy."
elif [[ -f "$REPO_TSV" ]]; then
    echo "[Step 2] Copying from repo: $REPO_TSV -> $TSV_FILE"
    cp "$REPO_TSV" "$TSV_FILE"
    echo "[Step 2] Copy complete."
else
    echo ""
    echo "  *** ERROR: bacteria_3000.tsv not found in either:"
    echo "       $TSV_FILE"
    echo "       $REPO_TSV"
    echo ""
    echo "  Please transfer bacteria_3000.tsv to your HPC and place it at:"
    echo "       $TSV_FILE"
    echo "  Then re-run this script."
    echo ""
    echo "  Example (run from your local machine):"
    echo "    scp bacteria_3000.tsv USER@hpc.example.edu:$TSV_FILE"
    echo ""
    exit 1
fi
echo ""

# ------------------------------------------------------------------------------
# Step 3: Run genome-download prepare inside container to create batch files
# ------------------------------------------------------------------------------
echo "------------------------------------------------------------"
echo "[Step 3] Partitioning accession list into batches of $BATCH_SIZE ..."
echo "         Input  : /data/bacteria_3000.tsv (bound from $WORK_DIR)"
echo "         Output : /data/batches/           (bound from $WORK_DIR/batches)"
echo "------------------------------------------------------------"

apptainer exec \
    --bind "$WORK_DIR:/data" \
    "$WORK_DIR/$SIF_NAME" \
    genome-download prepare \
        --tsv /data/bacteria_3000.tsv \
        --batch-size "$BATCH_SIZE" \
        --batch-dir /data/batches

echo ""
echo "[Step 3] Batch files written to $WORK_DIR/batches/"
echo ""

# ------------------------------------------------------------------------------
# Step 4: Count actual batches created
# ------------------------------------------------------------------------------
echo "------------------------------------------------------------"
echo "[Step 4] Counting batch files created ..."
echo "------------------------------------------------------------"

N_BATCHES=$(ls -1 "$WORK_DIR/batches/batch_"*.txt 2>/dev/null | wc -l)

if [[ "$N_BATCHES" -eq 0 ]]; then
    echo ""
    echo "  *** ERROR: No batch files were created under $WORK_DIR/batches/"
    echo "  Check that bacteria_3000.tsv is valid and that Step 3 completed cleanly."
    exit 1
fi

LAST_INDEX=$(( N_BATCHES - 1 ))

echo "[Step 4] Batch files found : $N_BATCHES"
echo "         Array index range : 0 - $LAST_INDEX"
echo "         (SLURM: --array=0-${LAST_INDEX}%%10)"
echo ""

# ------------------------------------------------------------------------------
# Step 5: Print next-steps instructions
# ------------------------------------------------------------------------------
echo "============================================================"
echo " SETUP COMPLETE — Next Steps"
echo "============================================================"
echo ""
echo "  Option A: run the full pipeline without SLURM:"
echo ""
echo "       apptainer exec --bind \"$WORK_DIR:/data\" \"$WORK_DIR/$SIF_NAME\" \\" 
echo "         genome-download run --tsv /data/bacteria_3000.tsv --batch-size $BATCH_SIZE \\" 
echo "         --batch-dir /data/batches --output-dir /data/genomes --parallel 4"
echo ""
echo "  Option B: use SLURM array jobs:"
echo ""
echo "  1. Edit container/slurm/02_download_array.slurm:"
echo "       - Set WORK_DIR=\"$WORK_DIR\""
echo "       - Set SIF_NAME=\"$SIF_NAME\""
echo "       - Set --array=0-${LAST_INDEX}%%10"
echo "         (adjust %%10 to change max concurrent tasks)"
echo "       - Set --partition= to your cluster's partition name"
echo "       - (Optional) Set NCBI_API_KEY= for higher rate limits"
echo ""
echo "  2. Submit the download array job:"
echo "       sbatch container/slurm/02_download_array.slurm"
echo ""
echo "  3. After ALL array tasks complete, submit the verify job:"
echo "       sbatch container/slurm/03_verify_and_retry.slurm"
echo "     Or with automatic dependency (replace JOBID with the array job ID):"
echo "       sbatch --dependency=afterany:JOBID container/slurm/03_verify_and_retry.slurm"
echo ""
echo "  Batch files : $WORK_DIR/batches/"
echo "  Genomes     : $WORK_DIR/genomes/"
echo "  Logs        : $WORK_DIR/logs/"
echo ""
echo "============================================================"
