#!/usr/bin/env bash
# Regenerate Playwright visual baselines in the CI-matching Docker image.
# Usage:
#   ./scripts/update-visual-snapshots.sh
#   PLAYWRIGHT_IMAGE=mcr.microsoft.com/playwright:v1.63.0-jammy ./scripts/update-visual-snapshots.sh
#
# GitHub Actions: workflow_dispatch → update_visual_snapshots=true uploads an
# artifact (CI stays contents:read; commit the PNGs from the artifact locally).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
exec bash "${ROOT}/scripts/playwright-docker.sh" test/e2e/visual.spec.js --update-snapshots
