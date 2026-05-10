---
name: testing-board
description: Test board.html end-to-end — covers local dev setup, auth, cloud save, and share link. Use when verifying board.html UI or API changes.
---

# Testing TeachedOS Board

## Architecture
- **Frontend**: Static HTML/CSS/JS served from repo root (`board.html` is ~5500 lines, single-file app)
- **Backend API**: `https://teachedos-api.onrender.com` (Node.js/Express on Render free tier — may cold-start, allow ~30s)
- **Database**: PostgreSQL on Render
- **WebSocket**: Real-time collaboration via `wss://teachedos-api.onrender.com`
- **Auth**: JWT tokens stored in `localStorage` (`teachedos_token`, `teachedos_user`)

## Local Dev Setup

1. Serve the repo root with a static HTTP server on **port 5500** (CORS-allowed):
   ```bash
   cd /home/ubuntu/teachedos && python3 -m http.server 5500
   ```
2. Open `http://localhost:5500/board.html`

### CORS Configuration
The backend allows these origins (hardcoded in `backend/server.js:14-20`):
- `http://localhost:3000`
- `http://localhost:5500` ← **use this for testing**
- `http://127.0.0.1:5500`
- `https://munister-v.github.io`
- `https://munister.com.ua`

Using any other port (e.g., 8080) will cause `Failed to fetch` errors on auth/save API calls.

## Key Test Flows

### 1. Console Error Check
- Open board.html and check browser console (F12)
- There should be no `ReferenceError` or other uncaught exceptions
- A `favicon.ico` 404 is benign and expected

### 2. Auth Flow
- On first visit, an auth modal appears automatically ("Welcome back" or registration)
- Registration: Click "Register", select role (Teacher/Student), fill name/email/password
- After login, the URL updates to include `?id=<boardId>` and board content loads
- If the auth modal doesn't appear, the init script may have crashed before reaching auth code (~line 5560)

### 3. Cloud Save
- After login, the status chip in the toolbar shows cloud sync state:
  - `● synced HH:MM` = cloud save working
  - `● saving...` = save in progress
  - `saved` (no cloud icon) = local-only mode (cloud save broken)
- To trigger a save: double-click canvas → add a Sticky Note → the status should briefly show "saving..." then update to "synced"

### 4. Share Link
- Click the "Share" button in the top toolbar
- **Working**: Share panel opens with board link containing `?id=<boardId>`, plus "Invite Student" section
- **Broken**: Toast notification says "Load a board first" (means `currentBoardId` was never initialized)
- Copy the share link and open in a new tab — the board should load with the same content

## Before vs After Testing
To compare broken vs fixed versions:
```bash
# Serve fixed version
cd /home/ubuntu/teachedos && python3 -m http.server 5500 &
# Serve broken version (from main branch)
mkdir -p /tmp/broken && git show main:board.html > /tmp/broken/board.html
cd /tmp/broken && python3 -m http.server 5501 &
```
Then compare console output between `localhost:5500/board.html` and `localhost:5501/board.html`.
Note: Only port 5500 will work for API calls (CORS). Port 5501 is only useful for checking console errors.

## Common Issues
- **Render cold start**: The free-tier backend may take 30+ seconds to respond on first request. Check with `curl -s -o /dev/null -w "%{http_code}" https://teachedos-api.onrender.com/health` before testing.
- **CORS errors**: Make sure you're serving on port 5500, not another port.
- **"Failed to fetch" on registration/login**: Usually a CORS issue (wrong port) or backend is cold-starting.
- **Script crashes silently**: If board.html has JS errors in the init block (~lines 4243-4260), the entire script stops — auth, save, and share all break simultaneously. Check console first.

## Devin Secrets Needed
No secrets required — the app uses self-registration for test accounts.
