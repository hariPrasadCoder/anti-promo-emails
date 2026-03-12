import asyncio
import json
import os
import uuid
from typing import AsyncGenerator
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv

load_dotenv()

from models import EmailInput, RunStatus
from orchestrator import runs, run_optimization, get_test_accounts

app = FastAPI(title="Anti-Promo Email Optimizer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/run")
async def start_run(email_input: EmailInput, background_tasks: BackgroundTasks):
    run_id = str(uuid.uuid4())[:8]
    runs[run_id] = RunStatus(run_id=run_id, status="pending", iterations=[])
    background_tasks.add_task(run_optimization, run_id, email_input)
    return {"run_id": run_id}

@app.get("/api/run/{run_id}")
async def get_run(run_id: str):
    if run_id not in runs:
        raise HTTPException(status_code=404, detail="Run not found")
    return runs[run_id]

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

            if run.status in ("success", "failed", "max_iterations"):
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
