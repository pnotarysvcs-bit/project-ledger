#!/usr/bin/env bash

set -euo pipefail

readonly repository_root="${1:-.}"

if [[ ! -d "$repository_root" ]]; then
  printf 'Deployment readiness check failed: %s is not a directory.\n' "$repository_root" >&2
  exit 2
fi

readonly application_markers=(
  package.json
  pyproject.toml
  Gemfile
  go.mod
  Cargo.toml
  Dockerfile
  vercel.json
  netlify.toml
  index.html
)

for marker in "${application_markers[@]}"; do
  if [[ -f "$repository_root/$marker" ]]; then
    printf 'Deployment readiness check passed: found %s.\n' "$marker"
    exit 0
  fi
done

cat >&2 <<'EOF'
::error title=Application source is missing::No application or deployment manifest was found. Lockfiles alone do not make a revision deployable. Restore the application source before deploying.
EOF
exit 1
