# FALA Quote Agent

One app, one deploy: the lead-intake quiz, the producer dashboard, and the
API all run from this single Node server. No separate frontend/backend
hosting to coordinate.

## Deploy it (drag-and-drop style)
This is built to work with any host that can run a Node app from a
folder/zip — Render, Railway, Coolify, a cPanel Node app, etc:

1. Upload/drag this whole folder in.
2. Set the build command to `npm install` and the start command to `npm start`
   (most platforms auto-detect this from `package.json`).
3. Add a **persistent disk/volume** if the platform offers one, and set the
   env var `DB_PATH=/that/mounted/path/fala.db` — otherwise your leads
   database gets wiped on every redeploy. (Render and Railway both support
   this — look for "disk" or "volume" in the service settings.)
4. Set these environment variables (copy from `.env.example`):
   - `AUTH_SECRET` — generate one with `openssl rand -hex 32`. Don't skip this.
   - `CORS_ORIGINS` — the URL the platform gives your app, e.g.
     `https://fala-quote.onrender.com`
   - SMTP settings if you want real email notifications (optional — without
     them, new leads just get logged server-side instead of emailed)
5. Deploy. Your site is live at whatever URL the platform gives you — the
   quote form is at `/`, the API is at `/api/...`. Nothing else to wire up.
6. Open the site, click **Producer login**, log in with the default passcode
   **1955**, go to **Settings**, and immediately change the passcode plus
   your real agent name/phone/email/stats.

## Running it locally
```bash
npm install
cp .env.example .env   # then set AUTH_SECRET at minimum
npm start
```
Visit `http://localhost:4000`.

## What's in here
```
server.js        Express app: serves the site + the API
db.js            SQLite storage (leads + agency config) — auto-creates fala.db
auth.js          Signed session tokens for the producer dashboard login
email.js         New-lead email notifications (+ optional Google Sheets webhook)
leadLogic.js     Server-side lead scoring/tagging (can't be spoofed from the browser)
public/          The quote-agent site (index.html) — plain HTML/React, no build step
```

## What changed vs. the original prototype
- Rebuilt out of the internal design tool's proprietary runtime into plain
  React + a real Express/SQLite backend — runs anywhere Node runs.
- Leads are saved to a real database and email you when they come in,
  instead of only living in the design tool's local storage.
- Lead scoring runs server-side so it can't be tampered with from the browser.
- The producer passcode issues a real signed session token — no more
  reaching the dashboard by guessing a URL.
- Everything else — copy, quiz flow, styling, savings meter, confetti,
  referral card, add-on cross-sell, CSV export — is a faithful 1:1 port of
  what you already had.

## Next up
AI Assistant (chat), AI Platform (landing page), and NOA still need the same
treatment — say the word and I'll fold them into this same app (as more
routes/pages off this one server) so you keep the one-deploy setup.
