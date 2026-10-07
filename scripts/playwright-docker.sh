#!/usr/bin/env bash
# Run Playwright inside the official image that matches package-lock's
# @playwright/test version (same image CI uses for e2e / snapshot updates).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is required to run Playwright in the CI-matching image." >&2
  echo "Install Docker, or use workflow_dispatch with update_visual_snapshots=true." >&2
  exit 1
fi

DOCKER=(docker)
if ! docker info >/dev/null 2>&1; then
  if command -v sudo >/dev/null 2>&1 && sudo docker info >/dev/null 2>&1; then
    DOCKER=(sudo docker)
  else
    echo "Cannot talk to the Docker daemon (try adding your user to the docker group)." >&2
    exit 1
  fi
fi

if [[ ! -f package-lock.json ]]; then
  echo "package-lock.json missing; cannot resolve Playwright image tag." >&2
  exit 1
fi

PW_VERSION="$(node -p "require('./package-lock.json').packages['node_modules/@playwright/test'].version")"
if [[ -z "${PW_VERSION}" || "${PW_VERSION}" == "undefined" ]]; then
  echo "Could not read @playwright/test version from package-lock.json" >&2
  exit 1
fi

IMAGE="${PLAYWRIGHT_IMAGE:-mcr.microsoft.com/playwright:v${PW_VERSION}-jammy}"
PORT="${PLAYWRIGHT_PORT:-8790}"

echo "Using Playwright Docker image: ${IMAGE}"

"${DOCKER[@]}" pull "${IMAGE}"

# Quote playwright args for the inner bash -lc so flags like --update-snapshots survive.
PW_ARGS=""
for arg in "$@"; do
  PW_ARGS+=" $(printf '%q' "${arg}")"
done

# Browsers are preinstalled in the image. npm ci inside the container keeps
# native module ABI aligned with the image's Node.
"${DOCKER[@]}" run --rm --ipc=host \
  -v "${ROOT}:/work" \
  -w /work \
  -e CI="${CI:-true}" \
  -e PLAYWRIGHT_PORT="${PORT}" \
  -e HOME=/tmp \
  "${IMAGE}" \
  bash -lc "npm ci && npx playwright test${PW_ARGS}"

# Container often writes as root; normalize ownership for local git.
if [[ -d test/e2e/visual.spec.js-snapshots ]]; then
  if command -v sudo >/dev/null 2>&1 && [[ "$(id -u)" -ne 0 ]]; then
    sudo chown -R "$(id -u):$(id -g)" test/e2e/visual.spec.js-snapshots test-results 2>/dev/null || true
  fi
fi
