#!/usr/bin/env bash
# Writes the GitHub release body for one version from CHANGELOG.md, with the
# Russian entry from CHANGELOG.ru_RU.md folded below it.
# Usage: release-notes.sh <version without v> <output file>
set -euo pipefail

version="$1"
out="$2"
root="$(cd "$(dirname "$0")/../.." && pwd)"

section() {
  awk -v head="## [$1]" '
    /^## \[/ { if (on) exit; on = index($0, head) == 1; next }
    on
  ' "$2" | sed -e '/./,$!d'
}

en="$(section "$version" "$root/CHANGELOG.md")"
ru="$(section "$version" "$root/CHANGELOG.ru_RU.md" || true)"
if [ -z "$en" ]; then
  echo "CHANGELOG.md has no entry for $version; add one before tagging" >&2
  exit 1
fi

mkdir -p "$(dirname "$out")"
{
  printf '%s\n' "$en"
  if [ -n "$ru" ]; then
    printf '\n<details>\n<summary>На русском</summary>\n\n%s\n\n</details>\n' "$ru"
  fi
} > "$out"
cat "$out"
