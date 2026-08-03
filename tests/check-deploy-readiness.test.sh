#!/usr/bin/env bash

set -euo pipefail

readonly project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
readonly check_script="$project_root/scripts/check-deploy-readiness.sh"
test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT

assert_status() {
  local expected_status="$1"
  local fixture="$2"
  local output
  local actual_status

  set +e
  output="$($check_script "$fixture" 2>&1)"
  actual_status=$?
  set -e

  if [[ "$actual_status" -ne "$expected_status" ]]; then
    printf 'Expected status %s, got %s for %s:\n%s\n' \
      "$expected_status" "$actual_status" "$fixture" "$output" >&2
    exit 1
  fi
}

mkdir "$test_root/empty" "$test_root/lockfile-only" "$test_root/application"
touch "$test_root/lockfile-only/package-lock.json"
touch "$test_root/application/package.json"

assert_status 1 "$test_root/empty"
assert_status 1 "$test_root/lockfile-only"
assert_status 0 "$test_root/application"
assert_status 2 "$test_root/does-not-exist"

printf 'All deployment readiness tests passed.\n'
