# Deployment

Production runs on a VPS (AlmaLinux) at teached.tech:
- **Frontend** static files: `/var/www/teached` (served by nginx).
- **Backend** API: `/opt/teachedos/backend`, run by systemd unit `teached-api.service` on port 4000 (nginx proxies `/api`). Env in `/opt/teachedos/backend/.env`.

## Auto-deploy
A systemd timer polls `main` every 2 minutes and deploys on new commits:
- `/opt/teachedos/deploy.sh` - fetches `origin/main`, and on change rsyncs `backend/` (keeping `.env`/`node_modules`), runs `npm install`, rsyncs the frontend, and restarts `teached-api.service`.
- `teached-deploy.service` + `teached-deploy.timer` drive it; last-deployed commit is tracked in `/opt/teachedos/.deployed_sha`.
- Log: `/var/log/teached-deploy.log`. Pre-deploy backups: `/root/teached-backups/`.

The versioned deploy implementation is `ops/deploy.sh`. The server copy at
`/opt/teachedos/deploy.sh` is kept in sync with it. Frontend and backend code
are mirrored with a clean sync so stale VPS-only files cannot survive a
release; `.env`, `node_modules`, database files and uploads stay outside the
release. Each run creates a rollback archive in `/root/teached-backups/`.

Before publishing a change locally, run:

```bash
node scripts/check-static-assets.mjs .
node scripts/bump-version.mjs
```

Push to `main` and the change is live within ~2 minutes - no manual step.

## Production configuration audit

The deployment and API health checks do not print secrets. To audit the
backend environment on the VPS, run:

```bash
node /opt/teachedos/repo/ops/check-prod-config.mjs /opt/teachedos/backend/.env
```

The audit reports only `ready`/`missing` states. Database, JWT, origin and
site URL settings are required. AI, Stripe, transactional email and image
search credentials are optional at boot, but missing values intentionally
leave those features in local/dev fallback mode. Add fresh provider keys in
`/opt/teachedos/backend/.env`, restart `teached-api.service`, and rerun the
audit when enabling them. The same redacted status is available to an
authenticated admin at `GET /api/admin/production-status` and is shown in
Admin → Settings. Never commit `.env` or paste key values into chat.

## nginx / edge

The site's nginx vhost is versioned at `ops/nginx/teached.conf` (the live
copy lives at `/etc/nginx/conf.d/teached.conf` on the VPS). It is **not**
auto-deployed - edit it on the server, `nginx -t`, then `systemctl reload
nginx`. Keep the repo copy in sync when you change it. Backups of prior
versions: `/root/nginx-backups/`.

Performance-relevant settings:
- **HTTP/2** enabled (`http2 on;`) - multiplexes all CSS/JS/img over one
  TLS connection instead of the HTTP/1.1 ~6-connection cap.
- **Brotli** (`nginx-mod-brotli`, EPEL) + **gzip** fallback on
  text/css/js/json/svg/xml; brotli is ~10-15% smaller than gzip.
- Static assets (`css|js|png|...|woff2`) get a single
  `Cache-Control: public, max-age=2592000` (30d).

## Several API processes (optional, `WEB_CONCURRENCY`)

By default the API runs as ONE process (`WEB_CONCURRENCY` unset or `1`) - the
right choice for the current 1.7 GB VPS shared by ~10 projects.

On a bigger server set `WEB_CONCURRENCY=2` (or more, max 8) in the unit's
environment (e.g. a drop-in `/etc/systemd/system/teached-api.service.d/cluster.conf`
with `Environment=WEB_CONCURRENCY=2`, then `systemctl daemon-reload && systemctl restart teached-api`).
`server.js` then starts `backend/lib/clusterPrimary.js`:

- the primary runs the migration once and restarts crashed children;
- N **web** workers serve HTTP on `PORT`; WebSocket upgrades are piped as raw
  TCP to the hub - nginx and the browser see no difference;
- one **hub** holds all collaboration rooms (they live in memory), runs the
  background jobs (deadline reminders, housekeeping) and answers
  `/internal/online` for presence, on `127.0.0.1:${TEACHED_HUB_PORT:-4101}`
  with a per-boot secret.

Each process needs its own heap (`--max-old-space-size` applies per process).
Measured locally (100 concurrent clients, mixed reads): 1 process ~2 000 req/s,
2 web workers ~3 560 req/s, p50 roughly halved.
Rollback: remove the variable (or set it to `1`) and restart.
