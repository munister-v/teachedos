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
