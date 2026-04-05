# syntax=docker/dockerfile:1
# Platform pinned to linux/amd64 for HPC / Apptainer compatibility.
# Build on Apple Silicon with:
#   docker buildx build --platform linux/amd64 -t genome-download:1.0.0 .
FROM --platform=linux/amd64 ubuntu:22.04

# ---------------------------------------------------------------------------
# OCI image labels
# ---------------------------------------------------------------------------
LABEL org.opencontainers.image.title="Microbial Reference Genome Downloader" \
      org.opencontainers.image.description="Downloads ~3000 complete-genome bacterial reference assemblies from NCBI RefSeq using the datasets CLI and GNU Parallel." \
      org.opencontainers.image.version="1.0.0" \
      org.opencontainers.image.authors="sajalbhattarai <bhattar3@purdue.edu>" \
      org.opencontainers.image.source="https://github.com/sajalbhattarai/genome-download" \
      org.opencontainers.image.licenses="MIT"

# ---------------------------------------------------------------------------
# Prevent apt from prompting for input during package installation
# ---------------------------------------------------------------------------
ENV DEBIAN_FRONTEND=noninteractive

# ---------------------------------------------------------------------------
# System dependencies — all in one layer to minimise image size
# ---------------------------------------------------------------------------
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        wget \
        unzip \
        python3 \
        python3-pip \
        parallel \
        pigz \
        gzip \
        less \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# ---------------------------------------------------------------------------
# NCBI datasets CLI  (linux-amd64 binary)
# ---------------------------------------------------------------------------
RUN curl -fsSL \
        https://ftp.ncbi.nlm.nih.gov/pub/datasets/command-line/LATEST/linux-amd64/datasets \
        -o /usr/local/bin/datasets \
    && chmod +x /usr/local/bin/datasets

# ---------------------------------------------------------------------------
# NCBI dataformat CLI  (linux-amd64 binary)
# ---------------------------------------------------------------------------
RUN curl -fsSL \
        https://ftp.ncbi.nlm.nih.gov/pub/datasets/command-line/LATEST/linux-amd64/dataformat \
        -o /usr/local/bin/dataformat \
    && chmod +x /usr/local/bin/dataformat

# ---------------------------------------------------------------------------
# Python dependencies
# ---------------------------------------------------------------------------
RUN pip3 install requests --no-warn-script-location

# ---------------------------------------------------------------------------
# Working directory & application files
# ---------------------------------------------------------------------------
WORKDIR /app

COPY scripts/  /app/scripts/
COPY CREDITS.md /app/CREDITS.md
COPY motd.sh   /app/motd.sh

RUN chmod +x /app/scripts/*.sh /app/scripts/*.py /app/motd.sh

# ---------------------------------------------------------------------------
# Runtime environment variables
#   NCBI_API_KEY  – set at runtime: docker run -e NCBI_API_KEY=<key> ...
#   BATCH_SIZE    – number of accessions fed to each datasets call
#   OUTPUT_DIR    – root directory for downloaded genome files
# ---------------------------------------------------------------------------
ENV NCBI_API_KEY="" \
    BATCH_SIZE=50 \
    OUTPUT_DIR=/data/genomes

# ---------------------------------------------------------------------------
# Print the welcome banner whenever an interactive bash shell is opened
# (works for both docker run -it and apptainer shell)
# ---------------------------------------------------------------------------
RUN echo 'source /app/motd.sh' >> /etc/bash.bashrc

# ---------------------------------------------------------------------------
# Default: drop into an interactive bash shell.
# Override with `docker run ... /app/scripts/02_download_genomes.sh ...`
# ---------------------------------------------------------------------------
CMD ["/bin/bash"]
