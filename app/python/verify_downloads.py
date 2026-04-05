#!/usr/bin/env python3
"""verify_downloads.py — check genome download completeness, output JSON.

Usage:
    python verify_downloads.py --outdir ./genomes --accessions accessions_all.txt
    python verify_downloads.py --outdir ./genomes --accessions accessions_all.txt --json
"""

import argparse
import glob
import json
import os
import sys
from typing import Any

# ---------------------------------------------------------------------------
# Per-genome verification
# ---------------------------------------------------------------------------


def verify_one(gcf: str, outdir: str) -> tuple[str, list[str]]:
    """Check a single genome directory for required files.

    Returns a (status, missing_files) tuple where status is one of:
        'PASS'    — all three required file types present
        'PARTIAL' — directory exists but one or more files are absent
        'MISSING' — directory does not exist at all
    """
    genome_dir = os.path.join(outdir, gcf)

    if not os.path.isdir(genome_dir):
        return "MISSING", ["directory absent"]

    missing: list[str] = []

    # 1. Genome FASTA  (*_genomic.fna or *_genomic.fna.gz)
    if not (
        glob.glob(os.path.join(genome_dir, "*_genomic.fna"))
        or glob.glob(os.path.join(genome_dir, "*_genomic.fna.gz"))
    ):
        missing.append("genome FASTA")

    # 2. Annotation GFF3 or GTF  (*_genomic.gff / .gff.gz / .gtf / .gtf.gz)
    has_gff = glob.glob(os.path.join(genome_dir, "*_genomic.gff")) or glob.glob(
        os.path.join(genome_dir, "*_genomic.gff.gz")
    )
    has_gtf = glob.glob(os.path.join(genome_dir, "*_genomic.gtf")) or glob.glob(
        os.path.join(genome_dir, "*_genomic.gtf.gz")
    )
    if not has_gff and not has_gtf:
        missing.append("annotation GFF/GTF")

    # 3. Protein FASTA  (*_protein.faa or *_protein.faa.gz)
    if not (
        glob.glob(os.path.join(genome_dir, "*_protein.faa"))
        or glob.glob(os.path.join(genome_dir, "*_protein.faa.gz"))
    ):
        missing.append("protein FASTA")

    if missing:
        return "PARTIAL", missing

    return "PASS", []


# ---------------------------------------------------------------------------
# Accession file reader
# ---------------------------------------------------------------------------


def read_accessions(path: str) -> list[str]:
    """Read one accession per line; ignore blank lines and # comments."""
    accessions: list[str] = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            stripped = line.strip()
            if stripped and not stripped.startswith("#"):
                accessions.append(stripped)
    return accessions


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Verify genome download completeness.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--outdir",
        required=True,
        metavar="DIR",
        help="Root directory that contains one sub-directory per GCF accession.",
    )
    parser.add_argument(
        "--accessions",
        required=True,
        metavar="FILE",
        help="Plain-text file with one GCF accession per line.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print a single JSON object to stdout instead of human-readable text.",
    )
    args = parser.parse_args()

    # ── Validate ─────────────────────────────────────────────────────────────
    if not os.path.isdir(args.outdir):
        msg = f"ERROR: output directory not found: {args.outdir}"
        if args.json:
            print(json.dumps({"error": msg}))
        else:
            print(msg, file=sys.stderr)
        sys.exit(1)

    if not os.path.isfile(args.accessions):
        msg = f"ERROR: accessions file not found: {args.accessions}"
        if args.json:
            print(json.dumps({"error": msg}))
        else:
            print(msg, file=sys.stderr)
        sys.exit(1)

    # ── Load accessions ───────────────────────────────────────────────────────
    accessions = read_accessions(args.accessions)
    if not accessions:
        msg = "WARNING: accessions file is empty."
        if args.json:
            print(
                json.dumps(
                    {
                        "pass": 0,
                        "partial": 0,
                        "missing": 0,
                        "total": 0,
                        "failedList": [],
                        "details": [],
                    }
                )
            )
        else:
            print(msg)
        return

    # ── Verify each accession ─────────────────────────────────────────────────
    counts = {"PASS": 0, "PARTIAL": 0, "MISSING": 0}
    failed_list: list[str] = []
    details: list[dict[str, Any]] = []

    total = len(accessions)

    for idx, gcf in enumerate(accessions, start=1):
        status, missing_files = verify_one(gcf, args.outdir)
        counts[status] += 1

        if status != "PASS":
            failed_list.append(gcf)
            details.append(
                {
                    "gcf": gcf,
                    "status": status,
                    "missing": missing_files,
                }
            )

        # Progress to stderr (suppressed when consuming JSON stdout)
        if not args.json:
            bar_done = int(40 * idx / total)
            bar = "#" * bar_done + "-" * (40 - bar_done)
            print(
                f"\r[{bar}] {idx}/{total}  "
                f"PASS={counts['PASS']}  "
                f"PARTIAL={counts['PARTIAL']}  "
                f"MISSING={counts['MISSING']}",
                end="",
                flush=True,
                file=sys.stderr,
            )

    if not args.json:
        print(file=sys.stderr)  # newline after progress bar

    # ── Output ────────────────────────────────────────────────────────────────
    result = {
        "pass": counts["PASS"],
        "partial": counts["PARTIAL"],
        "missing": counts["MISSING"],
        "total": total,
        "failedList": failed_list,
        "details": details,
    }

    if args.json:
        print(json.dumps(result))
    else:
        # Human-readable summary
        print()
        print("=" * 52)
        print("  Verification Summary")
        print("=" * 52)
        print(f"  Total checked : {total}")
        print(f"  PASS          : {counts['PASS']}")
        print(f"  PARTIAL       : {counts['PARTIAL']}")
        print(f"  MISSING       : {counts['MISSING']}")
        print("=" * 52)

        if failed_list:
            print(f"\nFailed accessions ({len(failed_list)}):")
            for entry in details:
                missing_str = ", ".join(list(entry["missing"]))  # type: ignore[arg-type]
                print(f"  [{entry['status']:7s}]  {entry['gcf']}  —  {missing_str}")
        else:
            print("\n✓ All genomes verified successfully.")


if __name__ == "__main__":
    main()
