IMAGE_NAME ?= genome-download
IMAGE_TAG ?= latest
GHCR_OWNER ?= sajalbhattarai
GHCR_IMAGE ?= ghcr.io/$(GHCR_OWNER)/genome-download:$(IMAGE_TAG)
LOCAL_IMAGE ?= $(IMAGE_NAME):$(IMAGE_TAG)
DOCKER_CONTEXT ?= container
BUILDER_NAME ?= genome-download-multi
DATA_DIR ?= $(CURDIR)/3000-cli
WORKSPACE_DIR ?= $(CURDIR)
TSV_FILE ?= /workspace/bacteria_3000.tsv
BATCH_SIZE ?= 50
PARALLEL ?= 4

.PHONY: help builder build-mac build-amd64 test-help run prepare verify retry push-ghcr

help:
	@printf "Targets:\n"
	@printf "  make build-mac      Build a local linux/arm64 image for Apple Silicon Macs\n"
	@printf "  make build-amd64    Build a local linux/amd64 image for Linux or Apptainer export\n"
	@printf "  make builder        Create or select the multi-arch Buildx builder\n"
	@printf "  make test-help      Run the container help command\n"
	@printf "  make run            Run the full non-interactive pipeline with Docker\n"
	@printf "  make prepare        Generate batches only\n"
	@printf "  make verify         Verify downloaded genomes\n"
	@printf "  make retry          Retry failed genomes\n"
	@printf "  make push-ghcr      Push a multi-arch image to GHCR\n"
	@printf "\nVariables:\n"
	@printf "  GHCR_OWNER=%s\n" "$(GHCR_OWNER)"
	@printf "  IMAGE_TAG=%s\n" "$(IMAGE_TAG)"
	@printf "  DATA_DIR=%s\n" "$(DATA_DIR)"
	@printf "  BATCH_SIZE=%s\n" "$(BATCH_SIZE)"
	@printf "  PARALLEL=%s\n" "$(PARALLEL)"

build-mac:
	docker buildx build --platform linux/arm64 -t $(LOCAL_IMAGE) --load $(DOCKER_CONTEXT)

build-amd64:
	docker buildx build --platform linux/amd64 -t $(GHCR_IMAGE) --load $(DOCKER_CONTEXT)

builder:
	@if docker buildx inspect $(BUILDER_NAME) >/dev/null 2>&1; then \
		docker buildx use $(BUILDER_NAME); \
	else \
		docker buildx create --name $(BUILDER_NAME) --driver docker-container --use; \
	fi
	docker buildx inspect --bootstrap

test-help:
	docker run --rm $(LOCAL_IMAGE) help

run:
	mkdir -p $(DATA_DIR)/batches $(DATA_DIR)/genomes
	docker run --rm \
		-v "$(WORKSPACE_DIR):/workspace" \
		-v "$(DATA_DIR):/data" \
		-e NCBI_API_KEY="$$NCBI_API_KEY" \
		$(LOCAL_IMAGE) run \
		--tsv $(TSV_FILE) \
		--batch-size $(BATCH_SIZE) \
		--batch-dir /data/batches \
		--output-dir /data/genomes \
		--parallel $(PARALLEL)

prepare:
	mkdir -p $(DATA_DIR)/batches
	docker run --rm \
		-v "$(WORKSPACE_DIR):/workspace" \
		-v "$(DATA_DIR):/data" \
		$(LOCAL_IMAGE) prepare \
		--tsv $(TSV_FILE) \
		--batch-size $(BATCH_SIZE) \
		--batch-dir /data/batches

verify:
	docker run --rm \
		-v "$(DATA_DIR):/data" \
		$(LOCAL_IMAGE) verify \
		--output-dir /data/genomes \
		--accessions /data/batches/accessions_all.txt

retry:
	docker run --rm \
		-v "$(DATA_DIR):/data" \
		-e NCBI_API_KEY="$$NCBI_API_KEY" \
		$(LOCAL_IMAGE) retry \
		--failed-file /data/genomes/failed_accessions.txt \
		--output-dir /data/genomes \
		--parallel 2

push-ghcr: builder
	docker buildx build --builder $(BUILDER_NAME) --platform linux/arm64,linux/amd64 -t $(GHCR_IMAGE) --push $(DOCKER_CONTEXT)