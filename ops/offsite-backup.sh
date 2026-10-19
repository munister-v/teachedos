#!/usr/bin/env bash
# Off-site backup of the whole VPS (root@teached.tech, shared by ~10 projects)
# onto this MacBook. Pull-based: the Mac connects, the VPS never knows the Mac,
# so a compromised or burnt VPS cannot touch the copies.
#
# What goes: Postgres (pg_dumpall), project data/uploads/.env/sqlite files under
# /opt and /var/www, nginx, TLS certs, systemd units, cron.
# What does not: node_modules, .git, build artefacts, old releases, models,
# and the VPS-side backup folders (the live data is pulled instead).
#
# Layout:  $DEST/snapshots/YYYY-MM-DD-HHMM/   one full-looking tree per run,
#          unchanged files hard-linked to the previous run (cheap to keep);
#          $DEST/latest -> newest good snapshot.
#
# Second copy: the newest snapshot is mirrored into an AES-256 encrypted
# sparsebundle inside iCloud Drive (only changed bands upload). The password
# lives in the login Keychain - set it once, yourself:
#   security add-generic-password -U -a vps-backup -s vps-backup-icloud -w
# Write the same password in your password manager: without it the iCloud copy
# cannot be opened. Restore: open the .sparsebundle in Finder, enter the password.
#
# Run by launchd (~/Library/LaunchAgents/tech.teached.vps-backup.plist) daily;
# can also be run by hand. Usage: ops/offsite-backup.sh [--dry-run]

set -euo pipefail

HOST=${VPS_HOST:-root@teached.tech}
KEY=${VPS_KEY:-$HOME/.ssh/vps57801}
DEST=${BACKUP_DEST:-$HOME/Backups/vps}
KEEP=${BACKUP_KEEP:-14}            # snapshots to keep
ICLOUD_BUNDLE=${ICLOUD_BUNDLE:-$HOME/Library/Mobile Documents/com~apple~CloudDocs/Backups/vps-backup.sparsebundle}
ICLOUD_SIZE=${ICLOUD_SIZE:-30g}    # max size of the image; grows only as needed
STAGE=/root/offsite-staging        # dumps made on the VPS before the pull

DRY=()
[[ "${1:-}" == "--dry-run" ]] && DRY=(--dry-run)

SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=20 -o ServerAliveInterval=30)
RSYNC=(rsync -a --numeric-ids --delete --timeout=300 --partial -e "${SSH[*]}")

STAMP=$(date +%Y-%m-%d-%H%M)
SNAP="$DEST/snapshots/$STAMP"
LOG="$DEST/backup.log"
mkdir -p "$DEST/snapshots"
chmod 700 "$DEST"
log() { printf '[%s] %s\n' "$(date '+%F %T')" "$*" | tee -a "$LOG"; }
fail() {
  trap - ERR
  log "FAILED: $*"
  [[ ${#DRY[@]} -eq 0 && -d "$SNAP" ]] && rm -rf -- "$SNAP"
  osascript -e 'display notification "VPS backup failed - see ~/Backups/vps/backup.log" with title "VPS backup"' >/dev/null 2>&1 || true
  exit 1
}
trap 'fail "line $LINENO"' ERR

# Only one run at a time (mkdir is atomic); a stale lock older than 6 h is dropped.
LOCK="$DEST/.lock"
if [[ -d "$LOCK" && -n "$(find "$LOCK" -maxdepth 0 -mmin +360 2>/dev/null)" ]]; then rmdir "$LOCK"; fi
mkdir "$LOCK" 2>/dev/null || { log "another run is in progress, skipping"; exit 0; }
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT

log "start $STAMP ${DRY[*]:-}"

# 1. Consistent database dump on the VPS (restore with: gunzip -c all.sql.gz | sudo -u postgres psql)
"${SSH[@]}" "$HOST" "set -e; mkdir -p $STAGE; chmod 700 $STAGE
  sudo -u postgres pg_dumpall | gzip -9 > $STAGE/postgres-all.sql.gz.tmp
  mv $STAGE/postgres-all.sql.gz.tmp $STAGE/postgres-all.sql.gz
  crontab -l > $STAGE/root-crontab.txt 2>/dev/null || true
  systemctl list-unit-files --state=enabled --no-legend > $STAGE/enabled-units.txt
  rpm -qa | sort > $STAGE/rpm-packages.txt
  ls -la $STAGE >/dev/null"

# 2. Pull. Previous snapshot is the hard-link base so unchanged files cost no space.
LINK=()
[[ -L "$DEST/latest" ]] && LINK=(--link-dest="$(cd "$DEST/latest" && pwd -P)")
[[ ${#DRY[@]} -eq 0 ]] && mkdir -p "$SNAP"/{opt,www,etc,staging}

pull() { # pull <remote path> <subdir> [extra rsync args...]
  local src=$1 sub=$2; shift 2
  log "pull $src"
  local target="$SNAP/$sub/"
  [[ ${#DRY[@]} -gt 0 ]] && { target="$DEST/.dry/$sub/"; mkdir -p "$target"; }
  # code 24 = a file vanished mid-transfer (live app rewrote it) - harmless
  local rc=0
  "${RSYNC[@]}" ${DRY[@]+"${DRY[@]}"} ${LINK[@]+"${LINK[@]/%//$sub}"} "$@" "$HOST:$src" "$target" || rc=$?
  [[ $rc -eq 0 || $rc -eq 24 ]] || fail "rsync $src exited $rc"
}

COMMON=(--exclude=node_modules --exclude=.git)

pull "$STAGE/" staging
pull /opt/ opt "${COMMON[@]}" \
  --exclude=/builds --exclude=/ffmpeg-static --exclude=/containerd \
  --exclude=/src-snapshots --exclude=/eprisjournal-drift-backups \
  --exclude=/epris-backups --exclude=/epris-content/backups \
  --exclude=/epris-interviews/models
pull /var/www/ www "${COMMON[@]}" \
  --exclude='/eprisjournal-releases/*/' --exclude=/certbot
for d in /etc/nginx /etc/letsencrypt /etc/systemd/system /etc/cron.d /etc/fail2ban /etc/firewalld /root/.ssh; do
  pull "$d/" "etc/$(basename "$d")" "${COMMON[@]}"
done

[[ ${#DRY[@]} -gt 0 ]] && { rm -rf "$DEST/.dry"; log "dry run done"; exit 0; }

# 3. Sanity: the dump must be real, otherwise do not call this snapshot good.
DUMP="$SNAP/staging/postgres-all.sql.gz"
gzip -t "$DUMP" || fail "postgres dump is corrupt"
[[ $(gunzip -c "$DUMP" | grep -c '^CREATE DATABASE') -ge 2 ]] || fail "postgres dump misses databases"

ln -sfn "snapshots/$STAMP" "$DEST/latest"
date +%s > "$DEST/last-success"

# 4. Retention
ls -1d "$DEST"/snapshots/*/ | awk -v k="$KEEP" '{a[NR]=$0} END{for(i=1;i<=NR-k;i++)print a[i]}' | while read -r old; do
  chmod -R u+w "$old"; rm -rf -- "$old"; log "pruned $old"
done

log "ok $STAMP $(du -sh "$SNAP" | cut -f1) in snapshot, $(du -sh "$DEST" | cut -f1) total"

# 5. Encrypted copy in iCloud. A failure here never invalidates the local snapshot.
icloud_copy() {
  local pw mnt
  pw=$(security find-generic-password -a vps-backup -s vps-backup-icloud -w 2>/dev/null) || {
    log "iCloud copy skipped: no Keychain item 'vps-backup-icloud' (see header of this script)"; return 1; }
  if [[ ! -d "$ICLOUD_BUNDLE" ]]; then
    mkdir -p "$(dirname "$ICLOUD_BUNDLE")"
    printf %s "$pw" | hdiutil create -quiet -size "$ICLOUD_SIZE" -type SPARSEBUNDLE -fs APFS \
      -encryption AES-256 -stdinpass -volname vps-backup -nospotlight "$ICLOUD_BUNDLE" || return 1
    log "created encrypted image $ICLOUD_BUNDLE"
  fi
  mnt=$(mktemp -d /tmp/vps-backup-icloud.XXXXXX)
  printf %s "$pw" | hdiutil attach -quiet -stdinpass -nobrowse -noverify -mountpoint "$mnt" "$ICLOUD_BUNDLE" || { rmdir "$mnt"; return 1; }
  local rc=0
  rsync -rlt --delete --exclude=.DS_Store --exclude=.fseventsd --exclude=.Spotlight-V100 --exclude=.Trashes \
    "$DEST/latest/" "$mnt/" || rc=$?
  date '+%F %T' > "$mnt/BACKUP-DATE.txt"
  hdiutil detach -quiet "$mnt" || hdiutil detach -force -quiet "$mnt" || true
  rmdir "$mnt" 2>/dev/null || true
  [[ $rc -eq 0 || $rc -eq 24 ]]
}
if icloud_copy; then log "iCloud copy ok"; else
  log "iCloud copy FAILED or skipped (local snapshot is fine)"
  osascript -e 'display notification "iCloud copy of the VPS backup did not run - see backup.log" with title "VPS backup"' >/dev/null 2>&1 || true
fi
