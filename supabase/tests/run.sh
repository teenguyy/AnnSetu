#!/usr/bin/env bash
# Runs every migration, the seed and all SQL tests against a fresh local database.
# Requires Postgres 16+ with PostGIS, pgvector and pgcrypto.
# Usage: supabase/tests/run.sh [--schema-only]   (TEST_DB=name to choose the database)
set -euo pipefail
shopt -s nullglob
cd "$(dirname "$0")/.."

DB="${TEST_DB:-annsetu_test}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1 -d "$DB")
if [ "$(id -u)" = "0" ] && id postgres >/dev/null 2>&1; then
  run() { su postgres -c "$(printf '%q ' "$@")"; }
else
  run() { "$@"; }
fi

run dropdb --if-exists "$DB"
run createdb "$DB"

apply() { echo "→ $1"; run "${PSQL[@]}" -f "$1" >/dev/null; }

apply tests/00_supabase_shim.sql
for f in migrations/*.sql; do apply "$f"; done
apply seed.sql
apply tests/01_helpers.sql
if [ "${1:-}" = "--schema-only" ]; then echo "schema ready in $DB"; exit 0; fi

pass=0; fail=0
for t in tests/[1-9][0-9]_*.sql; do
  if out=$(run "${PSQL[@]}" -f "$t" 2>&1); then
    n=$(grep -c 'ok - ' <<<"$out" || true)
    echo "✓ $t ($n assertions)"; pass=$((pass + n))
  else
    echo "✗ $t"; grep -E 'FAIL|ERROR' <<<"$out" | head -5; fail=$((fail + 1))
  fi
done
echo "assertions passed: $pass, failing files: $fail"
[ "$fail" -eq 0 ]
