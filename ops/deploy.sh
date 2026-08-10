#!/usr/bin/env bash
# TeachEd production deploy. This file is copied to /opt/teachedos/deploy.sh
# by the release operator and kept versioned with the application source.
set -euo pipefail

exec 9>/var/lock/teached-deploy.lock
flock -n 9 || exit 0

REPO=${REPO:-/opt/teachedos/repo}
BACKEND=${BACKEND:-/opt/teachedos/backend}
FRONTEND=${FRONTEND:-/var/www/teached}
MARKER=${MARKER:-/opt/teachedos/.deployed_sha}
LOG=${LOG:-/var/log/teached-deploy.log}
BACKUPS=${BACKUPS:-/root/teached-backups}
FORCE_DEPLOY=${FORCE_DEPLOY:-0}

log() { echo "$(date '+%F %T') $*" >> "$LOG" 2>/dev/null || true; }

cd "$REPO"
git fetch --quiet origin main
REMOTE=$(git rev-parse origin/main)
DEPLOYED=$(cat "$MARKER" 2>/dev/null || echo none)
if [[ "$FORCE_DEPLOY" != 1 && "$DEPLOYED" == "$REMOTE" ]]; then
  exit 0
fi

STAMP=$(date -u '+%Y%m%dT%H%M%SZ')
BACKUP_DIR="$BACKUPS/pre-${REMOTE:0:12}-$STAMP"
mkdir -p "$BACKUP_DIR"
printf '%s\n' "$DEPLOYED" > "$BACKUP_DIR/previous-deployed-sha"

# Keep a recoverable copy before --delete removes stale production files.
if [[ -d "$FRONTEND" ]]; then
  tar -C "$(dirname "$FRONTEND")" -czf "$BACKUP_DIR/frontend.tgz" "$(basename "$FRONTEND")"
fi
if [[ -d "$BACKEND" ]]; then
  tar --exclude='node_modules' --exclude='.env' --exclude='db' \
    -C "$(dirname "$BACKEND")" -czf "$BACKUP_DIR/backend.tgz" "$(basename "$BACKEND")"
fi

log "new commit $REMOTE (deployed: $DEPLOYED) — deploying with clean sync"
git reset --hard --quiet "$REMOTE"

# Backend runtime keeps only its secret env, dependencies and database data.
rsync -a --delete \
  --exclude='.env' --exclude='node_modules/' --exclude='uploads/' \
  "$REPO/backend/" "$BACKEND/"
( cd "$BACKEND" && npm install --no-audit --no-fund --silent )

# Frontend is a reproducible allowlist. Private repo metadata, backups and
# server-only configuration must never be exposed below the nginx web root.
rsync -a --delete --delete-excluded \
  --exclude='.git/' --exclude='.github/' --exclude='backend/' \
  --exclude='node_modules/' --exclude='.claude/' --exclude='.vscode/' \
  --exclude='ops/' --exclude='*.md' --exclude='*.bak' --exclude='*.bak_*' \
  --exclude='render.yaml' \
  "$REPO/" "$FRONTEND/"

# Minify served assets without changing the Git working tree.
( set +e
  ESBUILD=/opt/teachedos/tools/node_modules/.bin/esbuild
  if [[ -x "$ESBUILD" ]]; then
    count=0
    for f in "$FRONTEND"/scripts/*.js "$FRONTEND"/js/*.js "$FRONTEND"/*.js "$FRONTEND"/styles/*.css; do
      [[ -f "$f" ]] || continue
      if "$ESBUILD" "$f" --minify --legal-comments=none > "$f.min.tmp" 2>>"$LOG" && [[ -s "$f.min.tmp" ]]; then
        mv -f "$f.min.tmp" "$f"
        count=$((count + 1))
      else
        rm -f "$f.min.tmp"
      fi
    done
    log "minified $count frontend assets"
  else
    log "esbuild missing at $ESBUILD — frontend served unminified"
  fi
) || log "minify step error (continuing deploy)"

systemctl restart teached-api.service
systemctl is-active --quiet teached-api.service
curl -fsS http://127.0.0.1:4000/health >/dev/null
printf '%s\n' "$REMOTE" > "$MARKER"
log "deployed $REMOTE OK; backup=$BACKUP_DIR"
