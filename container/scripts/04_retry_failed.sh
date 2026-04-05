#!/usr/bin/env bash
# ==============================================================================
# 04_retry_failed.sh
# ==============================================================================
#
# Re-runs 02_download_genomes.sh for accessions that failed verification.
#
# USAGE:
#   ./04_retry_failed.sh <failed_accessions.txt> <output_dir> [n_parallel=2]
#
#   <failed_accessions.txt>  Path to the file written by 03_verify_downloads.py
#                            containing one failed GCF accession per line.
#                            Typically: <genomes_root>/failed_accessions.txt
#   <output_dir>             Root directory where per-genome subdirectories live.
#                            Must be the same directory passed to the original
#                            02_download_genomes.sh run.
#   [n_parallel]             Number of parallel download jobs (default: 2).
#                            A lower value than the initial run is intentional —
#                            transient failures are often caused by rate-limiting,
#                            so retries benefit from a more conservative setting.
#
# ==============================================================================

set -euo pipefail

# ------------------------------------------------------------------------------
# Arguments
# ------------------------------------------------------------------------------
if [[ $# -lt 2 ]]; then
    echo "Usage: $(basename "$0") <failed_accessions.txt> <output_dir> [n_parallel=2]" >&2
    echo "" >&2
    echo "  <failed_accessions.txt>  produced by 03_verify_downloads.py" >&2
    echo "  <output_dir>             root genome directory (same as original download run)" >&2
    echo "  [n_parallel]             parallel jobs (default: 2)" >&2
    exit 1
fi

FAILED_FILE="${1}"
OUTPUT_DIR="${2}"
N_PARALLEL="${3:-2}"

# ------------------------------------------------------------------------------
# Validate: file must exist and be non-empty
# ------------------------------------------------------------------------------
if [[ ! -f "${FAILED_FILE}" ]]; then
    echo "ERROR: failed accessions file does not exist: ${FAILED_FILE}" >&2
    exit 1
fi

if [[ ! -r "${FAILED_FILE}" ]]; then
    echo "ERROR: failed accessions file is not readable: ${FAILED_FILE}" >&2
    exit 1
fi

# Count non-blank lines
N_FAILED="$(grep -c '[^[:space:]]' "${FAILED_FILE}" || true)"

if [[ "${N_FAILED}" -eq 0 ]]; then
    echo "ERROR: ${FAILED_FILE} is empty — nothing to retry." >&2
    echo "       If all genomes passed verification, this file may have been" >&2
    echo "       removed automatically by 03_verify_downloads.py." >&2
    exit 1
fi

# ------------------------------------------------------------------------------
# Sanity-check n_parallel
# ------------------------------------------------------------------------------
if ! [[ "${N_PARALLEL}" =~ ^[1-9][0-9]*$ ]]; then
    echo "ERROR: n_parallel must be a positive integer, got: ${N_PARALLEL}" >&2
    exit 1
fi

# ------------------------------------------------------------------------------
# Run
# ------------------------------------------------------------------------------
echo "============================================================"
echo "04_retry_failed.sh"
echo "============================================================"
echo "  Failed accessions file : ${FAILED_FILE}"
echo "  Output directory       : ${OUTPUT_DIR}"
echo "  Parallel jobs          : ${N_PARALLEL}"
echo "============================================================"
echo ""
echo "Retrying ${N_FAILED} failed accession(s)..."
echo ""

bash /app/scripts/02_download_genomes.sh \
    "${FAILED_FILE}" \
    "${OUTPUT_DIR}" \
    "${N_PARALLEL}"

# ------------------------------------------------------------------------------
# Post-run advice
# ------------------------------------------------------------------------------
echo ""
echo "============================================================"
echo "Retry run complete."
echo ""
echo "Next step — re-verify to confirm all genomes are now present:"
echo ""
echo "  python3 /app/scripts/03_verify_downloads.py \\"
echo "      --outdir  ${OUTPUT_DIR} \\"
echo "      --accessions /data/batches/accessions_all.txt"
echo ""
echo "If failures persist, check ${OUTPUT_DIR}/logs/failed.log"
echo "and inspect individual per-batch log files in ${OUTPUT_DIR}/logs/"
echo "for error details before attempting another retry."
echo "============================================================"
