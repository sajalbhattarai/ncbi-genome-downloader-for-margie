#!/usr/bin/env python3
"""
01_prepare_accessions.py
------------------------
Parse bacteria_3000.tsv and produce:
  - batches/batch_NNNN.txt        one GCF accession per line, split into fixed-size batches
  - batches/accessions_all.txt    all valid GCF accessions, one per line
  - batches/metadata.tsv          four-column TSV: gcf_accession, scientific_name, strain, phylum

The batch files are consumed by 02_download_genomes.sh (via GNU parallel).

Column layout in bacteria_3000.tsv (0-indexed, tab-separated):
  0  scientific_name
  1  strain
  2  gcf_accession
  3  refseq_category   (not used here)
  4  phylum
"""

import argparse
import os
import sys

# ---------------------------------------------------------------------------
# Hard-coded blocklist – extend this list as needed.
# GCF_963665895.2 is a known MAG (metagenome-assembled genome) that was
# mistakenly included in some RefSeq reference-genome reports.
# ---------------------------------------------------------------------------
BLOCKLIST = {
    "GCF_963665895.2",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Parse bacteria_3000.tsv, filter invalid accessions, "
            "and write batch files plus metadata for downstream genome downloads."
        ),
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument(
        "--tsv",
        default="/data/bacteria_3000.tsv",
        metavar="PATH",
        help="Path to the input bacteria_3000.tsv file.",
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
        default="/data/batches",
        metavar="DIR",
        help="Output directory where batch files and metadata are written.",
    )
    return parser.parse_args()


def read_accessions(tsv_path: str) -> list[dict]:
    """
    Read the TSV and return a list of dicts for every valid, non-blocked row.

    A row is skipped when:
      - gcf_accession (column 2) is empty or whitespace-only
      - gcf_accession does not start with "GCF_"
      - gcf_accession is in BLOCKLIST
    """
    records: list[dict] = []
    skipped_empty = 0
    skipped_prefix = 0
    skipped_blocklist = 0

    try:
        with open(tsv_path, newline="", encoding="utf-8") as fh:
            header = fh.readline()  # consume header row
            if not header:
                print(f"ERROR: {tsv_path} appears to be empty.", file=sys.stderr)
                sys.exit(1)

            for lineno, line in enumerate(fh, start=2):
                line = line.rstrip("\n")
                if not line:
                    continue  # skip blank lines

                cols = line.split("\t")

                # Pad with empty strings if the row is short (malformed rows)
                while len(cols) < 5:
                    cols.append("")

                scientific_name = cols[0].strip()
                strain = cols[1].strip()
                gcf_accession = cols[2].strip()
                phylum = cols[4].strip()

                # --- filter 1: empty accession ---
                if not gcf_accession:
                    skipped_empty += 1
                    continue

                # --- filter 2: must start with GCF_ ---
                if not gcf_accession.startswith("GCF_"):
                    skipped_prefix += 1
                    print(
                        f"  SKIP (bad prefix) line {lineno}: {gcf_accession!r}",
                        file=sys.stderr,
                    )
                    continue

                # --- filter 3: blocklist ---
                if gcf_accession in BLOCKLIST:
                    skipped_blocklist += 1
                    print(
                        f"  SKIP (blocklist)  line {lineno}: {gcf_accession}",
                        file=sys.stderr,
                    )
                    continue

                records.append(
                    {
                        "gcf_accession": gcf_accession,
                        "scientific_name": scientific_name,
                        "strain": strain,
                        "phylum": phylum,
                    }
                )

    except FileNotFoundError:
        print(f"ERROR: TSV file not found: {tsv_path}", file=sys.stderr)
        sys.exit(1)

    # Summary of skipped rows
    total_skipped = skipped_empty + skipped_prefix + skipped_blocklist
    if total_skipped:
        print(
            f"Skipped rows — empty accession: {skipped_empty}, "
            f"bad prefix: {skipped_prefix}, "
            f"blocklist: {skipped_blocklist}",
            file=sys.stderr,
        )

    return records


def write_batches(records: list[dict], outdir: str, batch_size: int) -> int:
    """
    Write batch_NNNN.txt files (one GCF per line) and return the number of
    batch files created.
    """
    n_batches = 0
    for batch_idx, start in enumerate(range(0, len(records), batch_size)):
        chunk = records[start : start + batch_size]
        batch_path = os.path.join(outdir, f"batch_{batch_idx:04d}.txt")
        with open(batch_path, "w", encoding="utf-8") as fh:
            for rec in chunk:
                fh.write(rec["gcf_accession"] + "\n")
        n_batches += 1
    return n_batches


def write_accessions_all(records: list[dict], outdir: str) -> None:
    """Write a flat file with every GCF accession, one per line."""
    path = os.path.join(outdir, "accessions_all.txt")
    with open(path, "w", encoding="utf-8") as fh:
        for rec in records:
            fh.write(rec["gcf_accession"] + "\n")


def write_metadata(records: list[dict], outdir: str) -> None:
    """
    Write a four-column TSV:
        gcf_accession  scientific_name  strain  phylum
    """
    path = os.path.join(outdir, "metadata.tsv")
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("gcf_accession\tscientific_name\tstrain\tphylum\n")
        for rec in records:
            fh.write(
                "\t".join(
                    [
                        rec["gcf_accession"],
                        rec["scientific_name"],
                        rec["strain"],
                        rec["phylum"],
                    ]
                )
                + "\n"
            )


def main() -> None:
    args = parse_args()

    print(f"Reading accessions from: {args.tsv}")
    records = read_accessions(args.tsv)

    n_accessions = len(records)
    print(f"Total valid accessions : {n_accessions}")

    if n_accessions == 0:
        print("ERROR: No valid accessions found. Check your TSV file.", file=sys.stderr)
        sys.exit(1)

    os.makedirs(args.outdir, exist_ok=True)

    # --- write outputs ---
    n_batches = write_batches(records, args.outdir, args.batch_size)
    write_accessions_all(records, args.outdir)
    write_metadata(records, args.outdir)

    # --- final summary ---
    print(f"Created {n_batches} batch files in {args.outdir}")
    print(
        f"Total: {n_accessions} accessions, "
        f"{n_batches} batches of {args.batch_size} each"
    )
    print()
    print(
        "REMINDER: Set the NCBI_API_KEY environment variable before running "
        "02_download_genomes.sh to benefit from higher NCBI API rate limits "
        "(10 requests/sec vs 3 requests/sec for anonymous access).\n"
        "  export NCBI_API_KEY=<your_key>"
    )


if __name__ == "__main__":
    main()
