#!/usr/bin/env python3
"""
03_verify_downloads.py
----------------------
Verify that every expected genome assembly was downloaded successfully by
checking for the three required file types inside each per-GCF directory:

  1. *_genomic.fna.gz   — assembled genome FASTA
  2. *_genomic.gff.gz   — GFF3 annotation  (OR *_genomic.gtf.gz)
  3. *_protein.faa.gz   — protein sequences

Each genome receives one of three statuses:

  PASS     All three file types are present.
  PARTIAL  The directory exists but one or more file types are absent.
  MISSING  The directory does not exist at all.

A coloured summary table is printed at the end, and a plain-text file
(failed_accessions.txt) is written inside --outdir listing every PARTIAL or
MISSING accession so that 04_retry_failed.sh can re-attempt them.

Exit code:
  0  if every accession is PASS
  1  if any accession is PARTIAL or MISSING
"""

import argparse
import glob
import os
import sys

# ---------------------------------------------------------------------------
# ANSI colour constants
# ---------------------------------------------------------------------------
GREEN = "\033[32m"
RED = "\033[31m"
YELLOW = "\033[33m"
BOLD = "\033[1m"
RESET = "\033[0m"


# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Verify genome downloads by checking for required file types in "
            "each per-GCF output directory."
        ),
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--outdir",
        default="/data/genomes",
        metavar="DIR",
        help="Root directory that contains one sub-directory per GCF accession.",
    )
    parser.add_argument(
        "--batch-dir",
        default="/data/batches",
        metavar="DIR",
        help="Directory produced by 01_prepare_accessions.py (used for context).",
    )
    parser.add_argument(
        "--accessions",
        default="/data/batches/accessions_all.txt",
        metavar="FILE",
        help="Plain-text file with one GCF accession per line.",
    )
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Accession loading
# ---------------------------------------------------------------------------


def load_accessions(path: str) -> list[str]:
    """Return a deduplicated, ordered list of GCF accessions from *path*."""
    if not os.path.isfile(path):
        print(
            f"{RED}ERROR{RESET}: accessions file not found: {path}",
            file=sys.stderr,
        )
        sys.exit(1)

    accessions: list[str] = []
    seen: set[str] = set()

    with open(path, encoding="utf-8") as fh:
        for lineno, raw in enumerate(fh, start=1):
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if line in seen:
                print(
                    f"  WARN: duplicate accession on line {lineno}: {line}",
                    file=sys.stderr,
                )
                continue
            seen.add(line)
            accessions.append(line)

    return accessions


# ---------------------------------------------------------------------------
# Per-genome verification
# ---------------------------------------------------------------------------


def _has_glob(directory: str, pattern: str) -> bool:
    """Return True if *directory* contains at least one file matching *pattern*."""
    return len(glob.glob(os.path.join(directory, pattern))) > 0


def verify_genome(gcf: str, outdir: str) -> tuple[str, list[str]]:
    """
    Check a single genome directory and return a (status, missing_items) tuple.

    status is one of: "PASS", "PARTIAL", "MISSING"
    missing_items is a list of human-readable descriptions of absent file types.
    """
    genome_dir = os.path.join(outdir, gcf)

    if not os.path.isdir(genome_dir):
        return "MISSING", ["directory absent"]

    missing: list[str] = []

    # 1. Genome FASTA
    if not _has_glob(genome_dir, "*_genomic.fna.gz"):
        missing.append("*_genomic.fna.gz")

    # 2. Annotation (GFF3 or GTF accepted)
    has_gff = _has_glob(genome_dir, "*_genomic.gff.gz")
    has_gtf = _has_glob(genome_dir, "*_genomic.gtf.gz")
    if not (has_gff or has_gtf):
        missing.append("*_genomic.gff.gz / *_genomic.gtf.gz")

    # 3. Protein FASTA
    if not _has_glob(genome_dir, "*_protein.faa.gz"):
        missing.append("*_protein.faa.gz")

    if not missing:
        return "PASS", []
    return "PARTIAL", missing


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    args = parse_args()

    print(f"Accessions file : {args.accessions}")
    print(f"Genome root dir : {args.outdir}")
    print()

    accessions = load_accessions(args.accessions)
    n_total = len(accessions)
    print(f"Loaded {n_total} accessions.\n")

    if n_total == 0:
        print("ERROR: no accessions to check.", file=sys.stderr)
        sys.exit(1)

    # -----------------------------------------------------------------------
    # Verification loop
    # -----------------------------------------------------------------------
    results: dict[str, tuple[str, list[str]]] = {}  # gcf -> (status, missing)
    counts: dict[str, int] = {"PASS": 0, "PARTIAL": 0, "MISSING": 0}

    for idx, gcf in enumerate(accessions, start=1):
        status, missing = verify_genome(gcf, args.outdir)
        results[gcf] = (status, missing)
        counts[status] += 1

        # Progress indicator every 100 genomes (and on the last one)
        if idx % 100 == 0 or idx == n_total:
            pct = 100.0 * idx / n_total
            n_pass = counts["PASS"]
            n_partial = counts["PARTIAL"]
            n_missing = counts["MISSING"]
            print(
                f"  Progress: {idx:>5}/{n_total}  ({pct:5.1f}%)  "
                f"pass={n_pass}  partial={n_partial}  missing={n_missing}"
            )

    # -----------------------------------------------------------------------
    # Detailed report for non-PASS genomes
    # -----------------------------------------------------------------------
    non_pass = [(gcf, st, mis) for gcf, (st, mis) in results.items() if st != "PASS"]

    if non_pass:
        print()
        print(f"{BOLD}Issues found ({len(non_pass)} genomes):{RESET}")
        print(f"  {'GCF Accession':<25}  {'Status':<8}  Missing")
        print(f"  {'-' * 25}  {'-' * 8}  {'-' * 40}")
        for gcf, status, missing in non_pass:
            colour = YELLOW if status == "PARTIAL" else RED
            missing_str = ", ".join(missing) if missing else "—"
            print(f"  {gcf:<25}  {colour}{status:<8}{RESET}  {missing_str}")

    # -----------------------------------------------------------------------
    # Coloured summary table
    # -----------------------------------------------------------------------
    col_w = 10  # width of the count column
    separator = "  " + "-" * (8 + col_w + 4)

    print()
    print(f"{BOLD}  Verification Summary{RESET}")
    print(separator)
    print(f"  {GREEN}PASS   {RESET} : {GREEN}{counts['PASS']:>{col_w}}{RESET}")
    print(f"  {YELLOW}PARTIAL{RESET} : {YELLOW}{counts['PARTIAL']:>{col_w}}{RESET}")
    print(f"  {RED}MISSING{RESET} : {RED}{counts['MISSING']:>{col_w}}{RESET}")
    print(separator)
    print(f"  {'TOTAL':<8} : {n_total:>{col_w}}")
    print()

    # -----------------------------------------------------------------------
    # Write failed_accessions.txt
    # -----------------------------------------------------------------------
    failed_gcfs = [
        gcf for gcf, (status, _) in results.items() if status in ("PARTIAL", "MISSING")
    ]

    failed_path = os.path.join(args.outdir, "failed_accessions.txt")

    if failed_gcfs:
        os.makedirs(args.outdir, exist_ok=True)
        with open(failed_path, "w", encoding="utf-8") as fh:
            for gcf in failed_gcfs:
                fh.write(gcf + "\n")
        print(f"Wrote {len(failed_gcfs)} failed accession(s) to: {failed_path}")
        print(
            "Run 04_retry_failed.sh to re-attempt these downloads, then "
            "re-run this script to confirm."
        )
    else:
        # Remove a stale failed_accessions.txt from a previous run if all pass
        if os.path.isfile(failed_path):
            os.remove(failed_path)
            print("Removed stale failed_accessions.txt — all genomes now PASS.")
        print(f"{GREEN}All {n_total} genomes passed verification.{RESET}")

    print()

    # -----------------------------------------------------------------------
    # Exit code
    # -----------------------------------------------------------------------
    sys.exit(0 if not failed_gcfs else 1)


if __name__ == "__main__":
    main()
