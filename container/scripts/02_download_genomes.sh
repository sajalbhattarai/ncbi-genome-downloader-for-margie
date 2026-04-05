#!/usr/bin/env bash
# ==============================================================================
# 02_download_genomes.sh
# ==============================================================================
#
# USAGE:
#   ./02_download_genomes.sh <batch_file> <output_dir> [n_parallel]
#
#   <batch_file>   Path to a plain-text file with one GCF accession per line
#                  (produced by 01_prepare_accessions.py)
#   <output_dir>   Root directory where per-genome subdirectories are created
#   [n_parallel]   Number of parallel download jobs (default: 4)
#
# DESCRIPTION:
#   Downloads NCBI RefSeq genome assemblies (genome FASTA, GFF3 annotation,
#   and protein FASTA) for every accession listed in the batch file.
#
#   Features:
#     - Resume logic: skips any accession whose output directory already
#       contains at least one *_genomic.fna.gz file
#     - Retry logic: up to 3 attempts per accession with a 15-second pause
#       between attempts
#     - Flattens NCBI's nested zip layout so all files land directly in
#       $OUTPUT_DIR/<GCF>/
#     - Logs every SUCCESS and FAILURE to a per-batch log file
#     - Appends failed accessions to a shared failed.log for easy retry
#     - Respects NCBI_API_KEY if set in the environment
#
# DEPENDENCIES:
#   - ncbi datasets CLI  (datasets / dataformat)
#   - GNU parallel
#   - unzip
#   - Standard GNU coreutils (date, basename, mkdir, mv, rm, find, wc)
#
# AUTHOR NOTE:
#   Designed to run inside the project Apptainer/Docker container where all
#   dependencies are pre-installed.  Mount your data volume at /data.
#
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Arguments
# ------------------------------------------------------------------------------
if [[ $# -lt 2 ]]; then
    echo "Usage: $(basename "$0") <batch_file> <output_dir> [n_parallel=4]" >&2
    echo "       <batch_file>  one GCF accession per line" >&2
    echo "       <output_dir>  root directory for downloaded genomes" >&2
    exit 1
fi

BATCH_FILE="${1}"
OUTPUT_DIR="${2}"
N_PARALLEL="${3:-4}"

# ------------------------------------------------------------------------------
# Validate arguments
# ------------------------------------------------------------------------------
if [[ -z "${BATCH_FILE}" ]]; then
    echo "ERROR: batch_file argument is required." >&2
    exit 1
fi

if [[ ! -f "${BATCH_FILE}" ]]; then
    echo "ERROR: batch file does not exist: ${BATCH_FILE}" >&2
    exit 1
fi

if [[ ! -r "${BATCH_FILE}" ]]; then
    echo "ERROR: batch file is not readable: ${BATCH_FILE}" >&2
    exit 1
fi

if ! [[ "${N_PARALLEL}" =~ ^[1-9][0-9]*$ ]]; then
    echo "ERROR: n_parallel must be a positive integer, got: ${N_PARALLEL}" >&2
    exit 1
fi

# ------------------------------------------------------------------------------
# Directory and log setup
# ------------------------------------------------------------------------------
mkdir -p "${OUTPUT_DIR}" "${OUTPUT_DIR}/logs"

BATCH_BASENAME="$(basename "${BATCH_FILE}" .txt)"
LOGFILE="${OUTPUT_DIR}/logs/${BATCH_BASENAME}.log"
FAILED_LOG="${OUTPUT_DIR}/logs/failed.log"

# ------------------------------------------------------------------------------
# Logging function
# ------------------------------------------------------------------------------
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOGFILE}"
}

# ------------------------------------------------------------------------------
# NCBI datasets CLI extra flags
# ------------------------------------------------------------------------------
DATASETS_ARGS=""
if [[ -n "${NCBI_API_KEY:-}" ]]; then
    DATASETS_ARGS="--api-key ${NCBI_API_KEY}"
    log "INFO: NCBI_API_KEY detected — using authenticated rate limits (10 req/s)."
else
    log "INFO: NCBI_API_KEY not set — using anonymous rate limits (3 req/s)."
fi

# ------------------------------------------------------------------------------
# Per-accession download function (exported for GNU parallel)
# ------------------------------------------------------------------------------
download_one() {
    local GCF="${1}"

    # --- Resume logic ---------------------------------------------------
    # If the output directory already has at least one assembled FASTA,
    # assume this accession was downloaded successfully in a prior run.
    local GENOME_DIR="${OUTPUT_DIR}/${GCF}"
    if compgen -G "${GENOME_DIR}/*_genomic.fna.gz" > /dev/null 2>&1; then
        log "SKIP (already downloaded): ${GCF}"
        return 0
    fi

    mkdir -p "${GENOME_DIR}"

    # --- Retry loop -----------------------------------------------------
    local ATTEMPT
    local MAX_ATTEMPTS=3
    local SLEEP_BETWEEN=15
    local SUCCESS=0
    local TMPZIP

    for ATTEMPT in $(seq 1 "${MAX_ATTEMPTS}"); do
        TMPZIP="$(mktemp /tmp/GCF_XXXXXX.zip)"

        log "INFO: Downloading ${GCF} (attempt ${ATTEMPT}/${MAX_ATTEMPTS})..."

        # shellcheck disable=SC2086
        if datasets download genome accession "${GCF}" \
               --include genome,gff3,protein \
               --filename "${TMPZIP}" \
               ${DATASETS_ARGS}; then

            # --- Unzip --------------------------------------------------
            if unzip -q "${TMPZIP}" -d "${GENOME_DIR}"; then
                rm -f "${TMPZIP}"
                SUCCESS=1
                break
            else
                log "WARN: unzip failed for ${GCF} on attempt ${ATTEMPT}."
                rm -f "${TMPZIP}"
            fi
        else
            log "WARN: datasets download failed for ${GCF} on attempt ${ATTEMPT}."
            rm -f "${TMPZIP}"
        fi

        if [[ "${ATTEMPT}" -lt "${MAX_ATTEMPTS}" ]]; then
            log "INFO: Waiting ${SLEEP_BETWEEN}s before retry..."
            sleep "${SLEEP_BETWEEN}"
        fi
    done

    if [[ "${SUCCESS}" -eq 0 ]]; then
        log "FAILED: ${GCF}"
        echo "${GCF}" >> "${FAILED_LOG}"
        return 1
    fi

    # --- Flatten NCBI zip nesting ---------------------------------------
    # NCBI wraps files inside:
    #   ncbi_dataset/data/<GCF>/<files>
    # We move everything up to $GENOME_DIR/ and remove the empty scaffold.
    local NESTED_DATA_DIR="${GENOME_DIR}/ncbi_dataset/data/${GCF}"
    local ALT_NESTED_DIR="${GENOME_DIR}/ncbi_dataset/data"

    if [[ -d "${NESTED_DATA_DIR}" ]]; then
        find "${NESTED_DATA_DIR}" -maxdepth 1 -type f | while read -r f; do
            mv -n "${f}" "${GENOME_DIR}/"
        done
    elif [[ -d "${ALT_NESTED_DIR}" ]]; then
        # Fallback: flatten any subdirectory one level below ncbi_dataset/data/
        find "${ALT_NESTED_DIR}" -mindepth 2 -maxdepth 2 -type f | while read -r f; do
            mv -n "${f}" "${GENOME_DIR}/"
        done
    fi

    # Also capture README and any assembly reports at the top of ncbi_dataset/
    if [[ -d "${GENOME_DIR}/ncbi_dataset" ]]; then
        find "${GENOME_DIR}/ncbi_dataset" -maxdepth 1 -type f | while read -r f; do
            mv -n "${f}" "${GENOME_DIR}/"
        done
        # Clean up the now-empty ncbi_dataset scaffold
        rm -rf "${GENOME_DIR}/ncbi_dataset"
    fi

    # Move the top-level README if present
    if [[ -f "${GENOME_DIR}/README.md" ]]; then
        : # already at top level — leave it
    fi

    log "SUCCESS: ${GCF}"
    return 0
}

# Export everything GNU parallel needs to call download_one in a sub-shell
export -f download_one log
export OUTPUT_DIR LOGFILE FAILED_LOG DATASETS_ARGS

# ------------------------------------------------------------------------------
# Main
# ------------------------------------------------------------------------------
N_ACCESSIONS="$(grep -c '[^[:space:]]' "${BATCH_FILE}" || true)"

log "============================================================"
log "Batch file  : ${BATCH_FILE}"
log "Output dir  : ${OUTPUT_DIR}"
log "Accessions  : ${N_ACCESSIONS}"
log "Parallel    : ${N_PARALLEL} jobs"
log "Log file    : ${LOGFILE}"
log "============================================================"

parallel -j "${N_PARALLEL}" --bar download_one {} < "${BATCH_FILE}"

# ------------------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------------------
N_SUCCESS="$(grep -c "^.\[.\{19\}\] SUCCESS:" "${LOGFILE}" 2>/dev/null || true)"
N_FAILED="$(grep -c "^.\[.\{19\}\] FAILED:"  "${LOGFILE}" 2>/dev/null || true)"
N_SKIPPED="$(grep -c "^.\[.\{19\}\] SKIP"    "${LOGFILE}" 2>/dev/null || true)"

log "============================================================"
log "SUMMARY for batch: ${BATCH_BASENAME}"
log "  Succeeded : ${N_SUCCESS}"
log "  Skipped   : ${N_SKIPPED}  (already downloaded)"
log "  Failed    : ${N_FAILED}"
log "============================================================"

if [[ "${N_FAILED}" -gt 0 ]]; then
    log "Failed accessions appended to: ${FAILED_LOG}"
    log "Run 04_retry_failed.sh to re-attempt them."
fi
