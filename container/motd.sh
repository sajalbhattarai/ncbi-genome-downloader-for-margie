#!/usr/bin/env bash
# motd.sh — sourced by /etc/bash.bashrc on container start
# Prints a styled welcome banner with tool credits and quick-start guide.

# ---------------------------------------------------------------------------
# ANSI colour codes
# ---------------------------------------------------------------------------
RESET="\033[0m"
BOLD="\033[1m"
GREEN="\033[1;32m"
CYAN="\033[0;36m"
WHITE="\033[0;37m"

# ---------------------------------------------------------------------------
# Banner
# ---------------------------------------------------------------------------
echo -e "${BOLD}${CYAN}"
echo -e "╔══════════════════════════════════════════════════════════════════╗"
echo -e "║     Microbial Reference Genome Downloader  v1.0.0               ║"
echo -e "║     2 999 complete-genome bacterial isolates (NCBI RefSeq)      ║"
echo -e "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${RESET}"

# ---------------------------------------------------------------------------
# Tools & Credits
# ---------------------------------------------------------------------------
echo -e "${GREEN}TOOLS & CREDITS:${RESET}"
echo -e "${WHITE}"

echo -e "  ${BOLD}•  NCBI Datasets CLI${RESET}${WHITE}  https://www.ncbi.nlm.nih.gov/datasets/"
echo -e "     Sayers et al. (2022) Nucleic Acids Res. 50(D1):D20-D26"
echo -e "     doi:10.1093/nar/gkab1112"
echo ""

echo -e "  ${BOLD}•  GNU Parallel${RESET}${WHITE}  https://www.gnu.org/software/parallel/"
echo -e "     Tange O. (2011) ;login: The USENIX Magazine 36(1):42-47"
echo -e "     doi:10.5281/zenodo.16303"
echo ""

echo -e "  ${BOLD}•  Apptainer (Singularity)${RESET}${WHITE}  https://apptainer.org/"
echo -e "     Kurtzer et al. (2017) PLoS ONE 12(5):e0177459"
echo -e "     doi:10.1371/journal.pone.0177459"
echo ""

echo -e "  ${BOLD}•  NCBI RefSeq${RESET}${WHITE}  https://www.ncbi.nlm.nih.gov/refseq/"
echo -e "     O'Leary et al. (2016) Nucleic Acids Res. 44(D1):D733-45"
echo -e "     doi:10.1093/nar/gkv1189"
echo ""

# ---------------------------------------------------------------------------
# Pipeline Source
# ---------------------------------------------------------------------------
echo -e "${RESET}${GREEN}PIPELINE SOURCE:${RESET}${WHITE}"
echo -e "  https://github.com/sajalbhattarai/genome-download"
echo ""

# ---------------------------------------------------------------------------
# Quick Start
# ---------------------------------------------------------------------------
echo -e "${RESET}${GREEN}QUICK START:${RESET}${WHITE}"
echo -e "  /app/scripts/01_prepare_accessions.py --tsv /data/bacteria_3000.tsv"
echo -e "  /app/scripts/02_download_genomes.sh /data/batches/batch_0000.txt /data/genomes 4"
echo -e "  /app/scripts/03_verify_downloads.py --outdir /data/genomes"
echo -e "${RESET}"
