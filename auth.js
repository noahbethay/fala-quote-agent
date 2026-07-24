# Copy this file to .env and fill in real values before running in production.

# Port the API listens on
PORT=4000

# Comma-separated list of frontend origins allowed to call this API.
# Example: https://quote.getfala.com,https://app.getfala.com
CORS_ORIGINS=http://localhost:5500,http://127.0.0.1:5500

# Secret used to sign producer-dashboard session tokens. Generate a long
# random string, e.g.: openssl rand -hex 32
AUTH_SECRET=change-this-to-a-long-random-string

# --- Email notifications (optional but recommended) ---
# If left blank, the server just logs new leads to the console instead of
# emailing them, so the app still works before you set this up.
# Any standard SMTP provider works: Gmail (app password), SendGrid, Resend,
# Postmark, Mailgun, etc.
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
# Address new-lead notifications are sent FROM
EMAIL_FROM="FALA Quote Agent <noreply@getfala.com>"
# Address new-lead notifications are sent TO (defaults to agent email in DB config if blank)
NOTIFY_EMAIL=

# --- Optional: also push every new lead to a Google Sheet via an Apps
# Script Web App (Noah already has infra for this pattern). Leave blank to skip.
SHEETS_WEBHOOK_URL=
