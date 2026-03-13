# Anti-Promo Email Optimizer

Automatically tests and rewrites your marketing emails until they land in Gmail's inbox instead of the Promotions tab.

**How it works:** You paste your email → the app sends it to your test Gmail accounts → checks if it landed in inbox or promotions → if promotions, Claude rewrites it subtly → repeats until it hits the inbox.

---

## Prerequisites

- Python 3.10+
- Node.js 18+
- A [Mailgun](https://mailgun.com) or Gmail SMTP account for sending emails
- An [Anthropic API key](https://console.anthropic.com)
- A Google Cloud project with Gmail API enabled

---

## Setup

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd anti-promo-emails
make install
```

### 2. Configure environment variables

```bash
cp backend/.env.example backend/.env
```

Open `backend/.env` and fill in:

```env
ANTHROPIC_API_KEY=           # Anthropic API key
SMTP_EMAIL_NAME=             # Your display name (e.g. "Hari Prasad")
SMTP_HOST=                   # e.g. smtp.mailgun.org
SMTP_PORT=587
SMTP_USER=                   # SMTP username / sending email
SMTP_PASS=                   # SMTP password

TEST_ACCOUNTS=               # Comma-separated Gmail accounts to test with
CHECK_DELAY_SECONDS=10       # How long to wait after sending before checking
MAX_ITERATIONS=10            # Max rewrite attempts per run

GOOGLE_CLIENT_ID=            # From Google Cloud Console (see step 3)
GOOGLE_CLIENT_SECRET=        # From Google Cloud Console (see step 3)
```

### 3. Set up Google OAuth (one time)

This lets the app read your test Gmail accounts to check where emails landed.

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Enable the **Gmail API**: APIs & Services → Enable APIs → search "Gmail API" → Enable
4. Create credentials: APIs & Services → Credentials → Create Credentials → **OAuth client ID**
   - Application type: **Desktop app**
   - Download is not needed — just copy the **Client ID** and **Client Secret** into your `.env`
5. Configure consent screen: APIs & Services → OAuth consent screen
   - Add your test Gmail accounts as **Test users**
   - Click **Publish App** so tokens don't expire after 7 days

### 4. Authorize your Gmail test accounts

Start the app and go to **Settings → Gmail Accounts**:

```bash
make dev
```

Open [http://localhost:3000/settings](http://localhost:3000/settings), enter each test Gmail address, and click **Authorize with Google**. Log in with that Gmail account and grant read access. Repeat for each test account.

---

## Running the app

```bash
make dev
```

Opens at [http://localhost:3000](http://localhost:3000)

Or run backend and frontend separately in two terminals:

```bash
# Terminal 1
make backend

# Terminal 2
make frontend
```

---

## Features

- **Auto-optimization** — iteratively rewrites your email with Claude until it hits the inbox
- **Quick Check** — test an email once without rewriting
- **Spam Score** — heuristic pre-check before sending
- **Diff view** — see exactly what Claude changed between iterations
- **Email preview** — rendered HTML preview of each iteration
- **Pause & manual edit** — take control mid-run and edit before resuming
- **Run history** — all past runs persisted in a local SQLite database
- **Template library** — save and reuse emails that worked
- **Settings UI** — configure everything from the browser, no config file editing needed

---

## Project structure

```
anti-promo-emails/
├── backend/
│   ├── main.py           # FastAPI app + all API endpoints
│   ├── orchestrator.py   # Main optimization loop
│   ├── email_sender.py   # SMTP sending
│   ├── gmail_checker.py  # Gmail API label checking
│   ├── ai_rewriter.py    # Claude rewriting
│   ├── spam_checker.py   # Heuristic spam scoring
│   ├── database.py       # SQLite persistence
│   ├── models.py         # Pydantic models
│   └── requirements.txt
└── frontend/
    └── src/app/
        ├── page.tsx          # New run
        ├── history/          # Run history
        ├── run/[id]/         # Run detail
        ├── templates/        # Template library
        └── settings/         # Settings & Gmail auth
```
