#!/bin/bash
# One-off: move teached-api and auto-deploy from root to the `teached` user.
# Run once as root on the VPS, after ops/access/* and ops/deploy.sh are staged
# in /root/teached-access-stage. Rolls itself back (drop-ins removed, old
# deploy.sh restored) if /health does not answer.
set -uo pipefail
ST=/root/teached-access-stage
rollback() {
  echo "!!! ROLLBACK"
  rm -f /etc/systemd/system/teached-api.service.d/user.conf /etc/systemd/system/teached-deploy.service.d/user.conf
  rmdir /etc/systemd/system/teached-deploy.service.d 2>/dev/null
  cp -a "$(ls -d /root/teached-migration-* | tail -1)/deploy.sh" /opt/teachedos/deploy.sh
  [[ -d /opt/teachedos/deploy-backups ]] && mv /opt/teachedos/deploy-backups /root/teached-backups
  systemctl daemon-reload; systemctl restart teached-api.service
  systemctl start teached-deploy.timer
  exit 1
}
systemctl stop teached-deploy.timer
for i in {1..60}; do systemctl is-active --quiet teached-deploy.service || break; sleep 1; done
git -C /opt/teachedos/repo clean -fdq && echo "repo: untracked junk removed"
[[ -d /root/teached-backups ]] && mv /root/teached-backups /opt/teachedos/deploy-backups
chown -R teached:teached /opt/teachedos /var/www/teached
chown teached:teached /var/log/teached-deploy.log
chmod 600 /opt/teachedos/backend/.env
install -o teached -g teached -m 0755 $ST/deploy.sh /opt/teachedos/deploy.sh
install -d /etc/systemd/system/teached-deploy.service.d
install -m 0644 $ST/teached-api.user.conf /etc/systemd/system/teached-api.service.d/user.conf
install -m 0644 $ST/teached-deploy.user.conf /etc/systemd/system/teached-deploy.service.d/user.conf
systemctl daemon-reload
systemctl restart teached-api.service || rollback
ok=0
for i in {1..30}; do
  if curl -fsS http://127.0.0.1:4000/health >/dev/null 2>&1; then ok=1; break; fi; sleep 1
done
[[ $ok == 1 ]] || { journalctl -u teached-api -n 30 --no-pager; rollback; }
echo "API healthy after $i s"
ps -o user:12,pid,cmd -C node | grep teachedos
systemctl start teached-deploy.timer
systemctl list-timers --no-legend | grep teached
