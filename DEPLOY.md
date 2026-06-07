# Deployment

Production runs on a VPS (AlmaLinux) at teached.tech:
- **Frontend** static files: `/var/www/teached` (served by nginx).
- **Backend** API: `/opt/teachedos/backend`, run by systemd unit `teached-api.service` on port 4000 (nginx proxies `/api`). Env in `/opt/teachedos/backend/.env`.

## Auto-deploy
A systemd timer polls `main` every 2 minutes and deploys on new commits:
- `/opt/teachedos/deploy.sh` — fetches `origin/main`, and on change rsyncs `backend/` (keeping `.env`/`node_modules`), runs `npm install`, rsyncs the frontend, and restarts `teached-api.service`.
- `teached-deploy.service` + `teached-deploy.timer` drive it; last-deployed commit is tracked in `/opt/teachedos/.deployed_sha`.
- Log: `/var/log/teached-deploy.log`. Pre-deploy backups: `/root/teached-backups/`.

Push to `main` and the change is live within ~2 minutes — no manual step.

## nginx / edge

The site's nginx vhost is versioned at `ops/nginx/teached.conf` (the live
copy lives at `/etc/nginx/conf.d/teached.conf` on the VPS). It is **not**
auto-deployed — edit it on the server, `nginx -t`, then `systemctl reload
nginx`. Keep the repo copy in sync when you change it. Backups of prior
versions: `/root/nginx-backups/`.

Performance-relevant settings:
- **HTTP/2** enabled (`http2 on;`) — multiplexes all CSS/JS/img over one
  TLS connection instead of the HTTP/1.1 ~6-connection cap.
- **Brotli** (`nginx-mod-brotli`, EPEL) + **gzip** fallback on
  text/css/js/json/svg/xml; brotli is ~10-15% smaller than gzip.
- Static assets (`css|js|png|...|woff2`) get a single
  `Cache-Control: public, max-age=2592000` (30d).
