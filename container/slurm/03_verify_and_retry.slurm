#!/bin/bash
# =============================================================================
# 03_verify_and_retry.slurm
# -----------------------------------------------------------------------------
# Run after the array job completes. Set --dependency=afterany:JOBID to chain
# this job automatically after 02_download_array.slurm finishes.
#
# Usage:
#   # Submit immediately after the array job (replace 123456 with your job ID):
#   sbatch --dependency=afterany:123456 03_verify_and_retry.slurm
#
#   # Or submit independently once the array job is done:
#   sbatch 03_verify_and_retry.slurm
#
# FIXES vs original:
#   - Uses the top-level genome-download CLI for verify and retry commands
#   - Corrected failed_accessions.txt path: lives under OUTPUT_DIR (genomes/),
#     not under WORK_DIR directly.
# =============================================================================

#SBATCH --job-name=ncbi_verify
#SBATCH --output=logs/verify_%j.out
#SBATCH --error=logs/verify_%j.err
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=2
#SBATCH --mem=4G
#SBATCH --time=02:00:00
#SBATCH --partition=batch
# --dependency=afterany:ARRAY_JOB_ID   # Uncomment and set your array job ID here

# =============================================================================
# USER-CONFIGURABLE VARIABLES — edit these to match your environment
# =============================================================================
WORK_DIR="$HOME/genome_download"
SIF_NAME="genome_download.sif"
SIF_PATH="$WORK_DIR/$SIF_NAME"
OUTPUT_DIR="$WORK_DIR/genomes"          # root genome directory (one subdir per GCF)
BATCH_DIR="$WORK_DIR/batches"
ACCESSIONS_FILE="$BATCH_DIR/accessions_all.txt"
# failed_accessions.txt is written by 03_verify_downloads.py into OUTPUT_DIR:
FAILED_FILE="$OUTPUT_DIR/failed_accessions.txt"
# =============================================================================

# Ensure log directory exists
mkdir -p "$WORK_DIR/logs"

# Load Apptainer (with fallback to Singularity for older clusters)
module load apptainer 2>/dev/null || module load singularity 2>/dev/null || true

# ---------------------------------------------------------------------------
echo "=== Step 1: Verifying downloads ==="
echo "Start time:       $(date)"
echo "Output directory: $OUTPUT_DIR"
echo "Accessions file:  $ACCESSIONS_FILE"
echo ""

apptainer exec \
    --bind "$WORK_DIR:/data" \
    "$SIF_PATH" \
    genome-download verify \
        --output-dir /data/genomes \
        --accessions /data/batches/accessions_all.txt

VERIFY_EXIT=$?
echo ""
echo "Verification finished with exit code: $VERIFY_EXIT"
echo ""

# ---------------------------------------------------------------------------
# Check whether any accessions failed.
# failed_accessions.txt is written to OUTPUT_DIR (i.e. genomes/), NOT to WORK_DIR.
if [[ -f "$FAILED_FILE" ]] && [[ -s "$FAILED_FILE" ]]; then

    FAILED_COUNT=$(grep -c '[^[:space:]]' "$FAILED_FILE" || true)
    echo "=== Step 2: Retrying $FAILED_COUNT failed accession(s) ==="
    echo "Start time: $(date)"
    echo "Failed file: $FAILED_FILE"
    echo ""

    apptainer exec \
        --bind "$WORK_DIR:/data" \
        "$SIF_PATH" \
        genome-download retry \
            --failed-file /data/genomes/failed_accessions.txt \
            --output-dir /data/genomes

    RETRY_EXIT=$?
    echo ""
    echo "Retry finished with exit code: $RETRY_EXIT"
    echo ""

    # -------------------------------------------------------------------------
    echo "=== Step 3: Re-verifying after retry ==="
    echo "Start time: $(date)"
    echo ""

    apptainer exec \
        --bind "$WORK_DIR:/data" \
        "$SIF_PATH" \
        genome-download verify \
            --output-dir /data/genomes \
            --accessions /data/batches/accessions_all.txt

    REVERIFY_EXIT=$?
    echo ""
    echo "Re-verification finished with exit code: $REVERIFY_EXIT"
    echo ""

else
    echo "No failed accessions found — all downloads verified successfully."
    echo ""
fi

# ---------------------------------------------------------------------------
echo "=== Final Stats ==="
echo "End time: $(date)"
echo ""

GENOME_COUNT=$(find "$OUTPUT_DIR" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l)
echo "Genome directories present : $GENOME_COUNT"

# Check the authoritative location: OUTPUT_DIR/failed_accessions.txt
if [[ -f "$FAILED_FILE" ]] && [[ -s "$FAILED_FILE" ]]; then
    STILL_FAILED=$(grep -c '[^[:space:]]' "$FAILED_FILE" || true)
    echo "Accessions still failing   : $STILL_FAILED"
    echo ""
    echo "Investigate the entries in $FAILED_FILE"
    echo "and consider re-running the retry command manually:"
    echo ""
    echo "  apptainer exec --bind \"$WORK_DIR:/data\" \"$SIF_PATH\" \\"
    echo "    genome-download retry --failed-file /data/genomes/failed_accessions.txt \\"
    echo "      --output-dir /data/genomes"
else
    echo "Accessions still failing   : 0"
    echo ""
    echo "All accessions downloaded and verified successfully."
fi

echo ""
echo "Check logs/verify_*.out for full details."
