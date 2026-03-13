import asyncio
import json
import os
import uuid
from pathlib import Path
from typing import AsyncGenerator, Optional
from fastapi import FastAPI, BackgroundTasks, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, RedirectResponse
from dotenv import load_dotenv
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request

load_dotenv()

import database as db
from models import (
    EmailInput, RunStatus, RunSummary, SpamCheckInput, SpamCheckResult,
    TemplateCreate, Template, SettingsUpdate, QuickCheckInput, ResumeInput
)
from orchestrator import (
    runs, run_optimization, run_quick_check, get_test_accounts,
    cancel_flags, pause_flags, manual_edits
)
from spam_checker import check_spam_score

app = FastAPI(title="Anti-Promo Email Optimizer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    db.create_tables()
    db.mark_interrupted_runs()


# ─── Existing endpoints ───────────────────────────────────────────────────────

@app.post("/api/run")
async def start_run(email_input: EmailInput, background_tasks: BackgroundTasks):
    run_id = str(uuid.uuid4())[:8]
    runs[run_id] = RunStatus(
        run_id=run_id,
        status="pending",
        iterations=[],
        from_name=email_input.from_name,
        from_email=email_input.from_email,
        original_subject=email_input.subject,
        original_body=email_input.body,
    )
    db.create_run(
        run_id=run_id,
        from_name=email_input.from_name,
        from_email=email_input.from_email,
        subject=email_input.subject,
        body=email_input.body,
        status="pending",
    )
    background_tasks.add_task(run_optimization, run_id, email_input)
    return {"run_id": run_id}


@app.get("/api/run/{run_id}")
async def get_run(run_id: str):
    # First check in-memory (active run)
    if run_id in runs:
        return runs[run_id]
    # Fall back to DB
    run_row = db.get_run(run_id)
    if not run_row:
        raise HTTPException(status_code=404, detail="Run not found")
    iterations = db.get_iterations_for_run(run_id)
    iter_results = []
    for it in iterations:
        from models import AccountResult, IterationResult, SpamCheckResult
        accs = [AccountResult(account=a["account"], label=a["label"]) for a in it.get("account_results", [])]
        spam = None
        if it.get("spam_score") is not None:
            spam = SpamCheckResult(
                score=it["spam_score"],
                issues=it.get("spam_issues", []),
                verdict=it.get("spam_verdict", "good"),
            )
        iter_results.append(IterationResult(
            iteration=it["iteration_num"],
            subject=it["subject"],
            body=it["body"],
            account_results=accs,
            verdict=it["verdict"],
            changes_made=it.get("changes_made"),
            spam_score=spam,
        ))
    return RunStatus(
        run_id=run_row["id"],
        status=run_row["status"],
        iterations=iter_results,
        final_subject=run_row.get("final_subject"),
        final_body=run_row.get("final_body"),
        total_iterations=run_row.get("total_iterations", 0),
        from_name=run_row.get("from_name"),
        from_email=run_row.get("from_email"),
        original_subject=run_row.get("subject"),
        original_body=run_row.get("body"),
        created_at=run_row.get("created_at"),
    )


@app.get("/api/run/{run_id}/stream")
async def stream_run(run_id: str):
    """Server-Sent Events stream for real-time updates."""
    if run_id not in runs:
        raise HTTPException(status_code=404, detail="Run not found")

    async def event_generator() -> AsyncGenerator[str, None]:
        last_iteration_count = 0
        last_status = None

        while True:
            run = runs.get(run_id)
            if not run:
                break

            current_count = len(run.iterations)
            if current_count > last_iteration_count or run.status != last_status:
                data = run.model_dump()
                yield f"data: {json.dumps(data)}\n\n"
                last_iteration_count = current_count
                last_status = run.status

            if run.status in ("success", "failed", "max_iterations", "cancelled", "interrupted", "quick_check"):
                break

            await asyncio.sleep(2)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        }
    )


@app.get("/api/accounts")
async def list_accounts():
    return {"accounts": get_test_accounts()}


@app.get("/api/config")
async def get_config():
    return {
        "from_email": os.getenv("SMTP_USER", ""),
        "from_name": os.getenv("SMTP_EMAIL_NAME", ""),
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


# ─── Runs management ─────────────────────────────────────────────────────────

@app.get("/api/runs")
async def list_runs(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    rows = db.list_runs(limit=limit, offset=offset)
    summaries = [
        RunSummary(
            run_id=r["id"],
            status=r["status"],
            from_name=r.get("from_name"),
            from_email=r.get("from_email"),
            original_subject=r.get("subject"),
            total_iterations=r.get("total_iterations", 0),
            created_at=r.get("created_at"),
            updated_at=r.get("updated_at"),
        )
        for r in rows
    ]
    return {"runs": [s.model_dump() for s in summaries], "total": len(summaries)}


@app.delete("/api/run/{run_id}")
async def delete_run(run_id: str):
    if not db.get_run(run_id):
        raise HTTPException(status_code=404, detail="Run not found")
    # Cancel if running
    cancel_flags[run_id] = True
    db.delete_run(run_id)
    runs.pop(run_id, None)
    return {"ok": True}


@app.post("/api/run/{run_id}/cancel")
async def cancel_run(run_id: str):
    if run_id not in runs and not db.get_run(run_id):
        raise HTTPException(status_code=404, detail="Run not found")
    cancel_flags[run_id] = True
    return {"ok": True}


@app.post("/api/run/{run_id}/pause")
async def pause_run(run_id: str):
    if run_id not in runs:
        raise HTTPException(status_code=404, detail="Run not active")
    pause_flags[run_id] = True
    return {"ok": True}


@app.post("/api/run/{run_id}/resume")
async def resume_run(run_id: str, body: ResumeInput):
    if run_id not in runs:
        raise HTTPException(status_code=404, detail="Run not active")
    if body.manual_subject or body.manual_body:
        manual_edits[run_id] = {
            "subject": body.manual_subject,
            "body": body.manual_body,
        }
    pause_flags[run_id] = False
    return {"ok": True}


# ─── Templates ───────────────────────────────────────────────────────────────

@app.get("/api/templates")
async def list_templates():
    rows = db.list_templates()
    templates = [
        Template(
            id=r["id"],
            name=r["name"],
            subject=r["subject"],
            body=r["body"],
            created_at=r["created_at"],
        )
        for r in rows
    ]
    return {"templates": [t.model_dump() for t in templates]}


@app.post("/api/templates")
async def create_template(template: TemplateCreate):
    new_id = db.create_template(template.name, template.subject, template.body)
    row = db.get_template(new_id)
    return Template(
        id=row["id"],
        name=row["name"],
        subject=row["subject"],
        body=row["body"],
        created_at=row["created_at"],
    )


@app.delete("/api/templates/{template_id}")
async def delete_template(template_id: int):
    if not db.get_template(template_id):
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete_template(template_id)
    return {"ok": True}


# ─── Settings ────────────────────────────────────────────────────────────────

@app.get("/api/settings")
async def get_settings():
    db_settings = db.get_all_settings()
    return {
        "check_delay_seconds": int(db_settings.get("check_delay_seconds", os.getenv("CHECK_DELAY_SECONDS", "90"))),
        "max_iterations": int(db_settings.get("max_iterations", os.getenv("MAX_ITERATIONS", "10"))),
        "test_accounts": [
            a.strip()
            for a in db_settings.get("test_accounts", os.getenv("TEST_ACCOUNTS", "")).split(",")
            if a.strip()
        ],
        "smtp_from_name": db_settings.get("smtp_from_name", os.getenv("SMTP_EMAIL_NAME", "")),
    }


@app.put("/api/settings")
async def update_settings(settings: SettingsUpdate):
    if settings.check_delay_seconds is not None:
        db.set_setting("check_delay_seconds", str(settings.check_delay_seconds))
    if settings.max_iterations is not None:
        db.set_setting("max_iterations", str(settings.max_iterations))
    if settings.test_accounts is not None:
        db.set_setting("test_accounts", ",".join(settings.test_accounts))
    if settings.smtp_from_name is not None:
        db.set_setting("smtp_from_name", settings.smtp_from_name)
    return {"ok": True}


# ─── Quick check ─────────────────────────────────────────────────────────────

@app.post("/api/quick-check")
async def quick_check(email_input: QuickCheckInput, background_tasks: BackgroundTasks):
    run_id = str(uuid.uuid4())[:8]
    runs[run_id] = RunStatus(
        run_id=run_id,
        status="pending",
        iterations=[],
        from_name=email_input.from_name,
        from_email=email_input.from_email,
        original_subject=email_input.subject,
        original_body=email_input.body,
    )
    db.create_run(
        run_id=run_id,
        from_name=email_input.from_name,
        from_email=email_input.from_email,
        subject=email_input.subject,
        body=email_input.body,
        status="quick_check",
    )
    background_tasks.add_task(run_quick_check, run_id, email_input)
    return {"run_id": run_id}


# ─── Spam check ──────────────────────────────────────────────────────────────

@app.post("/api/spam-check")
async def spam_check_endpoint(input: SpamCheckInput):
    result = check_spam_score(input.subject, input.body)
    return SpamCheckResult(**result)


# ─── Gmail OAuth ──────────────────────────────────────────────────────────────

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
CREDENTIALS_DIR = Path(os.getenv("GMAIL_CREDENTIALS_DIR", "./gmail_credentials"))
OAUTH_REDIRECT_URI = "http://localhost:8000/api/oauth/callback"
FRONTEND_URL = "http://localhost:3000"

# Build OAuth client config from env vars
def _oauth_client_config() -> dict:
    client_id = os.getenv("GOOGLE_CLIENT_ID")
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET")
    if not client_id or not client_secret:
        raise RuntimeError("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env")
    return {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost"],
        }
    }

# Temp store for in-progress OAuth flows (state -> flow)
_oauth_flows: dict[str, Flow] = {}


@app.get("/api/oauth/accounts")
async def list_oauth_accounts():
    """List all Gmail accounts that have been authorized."""
    tokens = list(CREDENTIALS_DIR.glob("token_*.json"))
    accounts = []
    for t in tokens:
        # Convert filename back to email: token_foo_at_gmail.com.json -> foo@gmail.com
        name = t.stem.replace("token_", "").replace("_at_", "@")
        # Check if token is still valid / refreshable
        try:
            creds = Credentials.from_authorized_user_file(str(t), SCOPES)
            if creds.expired and creds.refresh_token:
                creds.refresh(Request())
                with open(t, "w") as f:
                    f.write(creds.to_json())
            status = "active" if creds.valid else "expired"
        except Exception:
            status = "error"
        accounts.append({"email": name, "status": status})
    return {"accounts": accounts}


@app.post("/api/oauth/start")
async def oauth_start(body: dict):
    """Generate Google OAuth URL for a Gmail account."""
    email = body.get("email", "").strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email required")

    try:
        client_config = _oauth_client_config()
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    state = f"{email}_{uuid.uuid4().hex[:8]}"
    flow = Flow.from_client_config(
        client_config,
        scopes=SCOPES,
        redirect_uri=OAUTH_REDIRECT_URI,
    )
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        state=state,
        login_hint=email,
        prompt="consent",  # always prompt so we get a refresh token
    )
    _oauth_flows[state] = flow
    return {"auth_url": auth_url, "state": state}


@app.get("/api/oauth/callback")
async def oauth_callback(code: str, state: str):
    """Handle Google's redirect after user grants permission."""
    flow = _oauth_flows.pop(state, None)
    if not flow:
        raise HTTPException(status_code=400, detail="Invalid or expired OAuth state")

    # Extract email from state (format: email_randomhex)
    email = state.rsplit("_", 1)[0]

    flow.fetch_token(code=code)
    creds = flow.credentials

    token_path = CREDENTIALS_DIR / f"token_{email.replace('@', '_at_')}.json"
    with open(token_path, "w") as f:
        f.write(creds.to_json())

    # Redirect back to frontend settings page with success indicator
    return RedirectResponse(f"{FRONTEND_URL}/settings?oauth=success&email={email}")
