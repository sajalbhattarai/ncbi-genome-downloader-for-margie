#!/usr/bin/env python3
"""prepare_batches.py — parse bacteria_3000.tsv and produce batch files.

Usage:
    python prepare_batches.py --tsv bacteria_3000.tsv --outdir ./batches
    python prepare_batches.py --tsv bacteria_3000.tsv --outdir ./batches --batch-size 100
"""

import argparse
import os
import sys

# ---------------------------------------------------------------------------
# Blocklist — accessions known to be broken / unavailable
# ---------------------------------------------------------------------------
BLOCKLIST = {"GCF_963665895.2"}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def parse_tsv(tsv_path: str) -> list[str]:
    """Read the TSV and return a deduplicated, ordered list of valid GCF accessions."""
    records: list[str] = []
    seen: set[str] = set()

    with open(tsv_path, encoding="utf-8") as fh:
        header = fh.readline()  # consume header row
        if not header:
            print("WARNING: TSV file appears to be empty.", file=sys.stderr)
            return records

        for lineno, line in enumerate(fh, start=2):
            line = line.rstrip("\n")
            if not line:
                continue

            cols = line.split("\t")
            if len(cols) < 3:
                print(
                    f"WARNING: line {lineno} has only {len(cols)} column(s), skipping.",
                    file=sys.stderr,
                )
                continue

            gcf = cols[2].strip()

            if not gcf:
                continue
            if not gcf.startswith("GCF_"):
                continue
            if gcf in BLOCKLIST:
                print(f"  [SKIP] blocklisted: {gcf}", file=sys.stderr)
                continue
            if gcf in seen:
                print(f"  [SKIP] duplicate: {gcf}", file=sys.stderr)
                continue

            seen.add(gcf)
            records.append(gcf)

    return records


def write_batches(records: list[str], outdir: str, batch_size: int) -> int:
    """Write batch_NNNN.txt files and return the number of batch files created."""
    n_batches = 0

    for i, start in enumerate(range(0, len(records), batch_size)):
        chunk = records[start : start + batch_size]
        batch_path = os.path.join(outdir, f"batch_{i:04d}.txt")
        with open(batch_path, "w", encoding="utf-8") as fh:
            fh.write("\n".join(chunk) + "\n")
        n_batches += 1

    return n_batches


def write_all_accessions(records: list[str], outdir: str) -> str:
    """Write accessions_all.txt containing every accession, one per line."""
    path = os.path.join(outdir, "accessions_all.txt")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(records) + "\n")
    return path


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Parse bacteria_3000.tsv and produce batch accession files.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--tsv",
        required=True,
        metavar="PATH",
        help="Path to bacteria_3000.tsv (tab-separated, GCF accession in column 3).",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        metavar="N",
        help="Number of accessions per batch file.",
    )
    parser.add_argument(
        "--outdir",
        required=True,
        metavar="DIR",
        help="Output directory for batch files and accessions_all.txt.",
    )
    args = parser.parse_args()

    # ── Validate inputs ──────────────────────────────────────────────────────
    if not os.path.isfile(args.tsv):
        print(f"ERROR: TSV file not found: {args.tsv}", file=sys.stderr)
        sys.exit(1)

    if args.batch_size < 1:
        print("ERROR: --batch-size must be a positive integer.", file=sys.stderr)
        sys.exit(1)

    # ── Parse ────────────────────────────────────────────────────────────────
    print(f"Reading TSV: {args.tsv}")
    records = parse_tsv(args.tsv)
    print(f"Valid accessions found: {len(records)}")

    if not records:
        print("No valid accessions found — nothing to write.")
        sys.exit(0)

    # ── Create output directory ──────────────────────────────────────────────
    os.makedirs(args.outdir, exist_ok=True)
    print(f"Output directory: {args.outdir}")

    # ── Write accessions_all.txt ─────────────────────────────────────────────
    all_path = write_all_accessions(records, args.outdir)
    print(f"Written: {all_path}")

    # ── Write batch files ────────────────────────────────────────────────────
    n_batches = write_batches(records, args.outdir, args.batch_size)
    print(f"Batch size:   {args.batch_size}")
    print(
        f"Batch files:  {n_batches}  (batch_0000.txt … batch_{n_batches - 1:04d}.txt)"
    )
    print(f"Total accessions: {len(records)}")


if __name__ == "__main__":
    main()
