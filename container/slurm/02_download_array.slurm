#!/bin/bash
# =============================================================================
# 02_download_array.slurm
# =============================================================================
# SLURM array job: download NCBI genomes in parallel batches.
#
# USAGE:
#   1. Run 01_setup_hpc.sh first to pull the container and create batch files.
#   2. Edit the USER-CONFIGURABLE block below (WORK_DIR, SIF_NAME, etc.).
#   3. Adjust --array to match the actual number of batches created:
#        If 01_setup_hpc.sh reports 60 batches, use --array=0-59%10
#        If it reports 45 batches,            use --array=0-44%10
#   4. Submit:
#        sbatch 02_download_array.slurm
#   5. Note the job ID printed by sbatch (e.g. "Submitted batch job 123456").
#      You will need it for 03_verify_and_retry.slurm.
#
# WHAT THIS JOB DOES:
#   Each array task picks up one batch file (batch_XXXX.txt) containing up to
#   BATCH_SIZE accession numbers, then runs 02_download_genomes.sh inside the
#   Apptainer container to fetch genome FASTA, GFF3, and protein FASTA from
#   NCBI Datasets, writing output under $WORK_DIR/genomes/.
#
# DISK ESTIMATE:
#   ~30-50 GB total for 2999 genomes (compressed).
# =============================================================================

#SBATCH --job-name=ncbi_dl
#SBATCH --output=logs/dl_%A_%a.out
#SBATCH --error=logs/dl_%A_%a.err
#SBATCH --array=0-59%10        # adjust 59 to (n_batches - 1); %10 = max 10 concurrent tasks
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=4
#SBATCH --mem=8G
#SBATCH --time=12:00:00
#SBATCH --partition=batch      # change to your cluster's partition name

set -euo pipefail

# =============================================================================
# === USER-CONFIGURABLE VARIABLES =============================================
# =============================================================================

WORK_DIR="$HOME/genome_download"       # must match what you used in 01_setup_hpc.sh
SIF_NAME="genome_download.sif"
SIF_PATH="$WORK_DIR/$SIF_NAME"
OUTPUT_DIR="$WORK_DIR/genomes"
BATCH_DIR="$WORK_DIR/batches"
N_PARALLEL=4                           # parallel downloads per task (matches --cpus-per-task)
NCBI_API_KEY=""                        # optional: paste your NCBI API key here for higher rate limits

# =============================================================================
# === RUNTIME (do not edit below this line) ===================================
# =============================================================================

# Ensure output directories exist
mkdir -p "$OUTPUT_DIR" "$WORK_DIR/logs"

# Derive the batch filename for this array task
printf -v BATCH_FILE "batch_%04d.txt" "$SLURM_ARRAY_TASK_ID"

# Verify the batch file exists before attempting any work
if [[ ! -f "$BATCH_DIR/$BATCH_FILE" ]]; then
    echo "ERROR: Batch file not found: $BATCH_DIR/$BATCH_FILE" >&2
    echo "       Array task ID $SLURM_ARRAY_TASK_ID has no corresponding batch." >&2
    echo "       Check that 01_setup_hpc.sh completed successfully and that" >&2
    echo "       --array upper bound matches the actual number of batches." >&2
    exit 1
fi

# Load Apptainer (try apptainer first, fall back to singularity module name)
module load apptainer 2>/dev/null || module load singularity 2>/dev/null || true

# Log start
echo "============================================================"
echo "SLURM Job:       $SLURM_JOB_ID"
echo "Array Task:      $SLURM_ARRAY_TASK_ID"
echo "Batch File:      $BATCH_DIR/$BATCH_FILE"
echo "Output Dir:      $OUTPUT_DIR"
echo "N Parallel:      $N_PARALLEL"
echo "Start Time:      $(date '+%Y-%m-%d %H:%M:%S')"
echo "Node:            $(hostname)"
echo "============================================================"

# Run the download script inside the container
apptainer exec \
    --bind "$WORK_DIR:/data" \
    --env NCBI_API_KEY="$NCBI_API_KEY" \
    "$SIF_PATH" \
    bash /app/scripts/02_download_genomes.sh \
        "/data/batches/$BATCH_FILE" \
        "/data/genomes" \
        "$N_PARALLEL"

EXIT_CODE=$?

# Log end
echo "============================================================"
echo "End Time:        $(date '+%Y-%m-%d %H:%M:%S')"
echo "Exit Code:       $EXIT_CODE"
echo "============================================================"

exit $EXIT_CODE
