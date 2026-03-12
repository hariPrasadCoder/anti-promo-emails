import asyncio
import logging
import os
import uuid
from typing import AsyncGenerator, List
from models import RunStatus, IterationResult, AccountResult, EmailInput
from email_sender import send_test_email
from gmail_checker import check_all_accounts
from ai_rewriter import rewrite_email

logger = logging.getLogger(__name__)

# In-memory store (replace with Redis/DB for production)
runs: dict[str, RunStatus] = {}

def get_test_accounts() -> List[str]:
    accounts_str = os.getenv("TEST_ACCOUNTS", "")
    return [a.strip() for a in accounts_str.split(",") if a.strip()]

def determine_verdict(account_results: List[dict]) -> str:
    labels = [r["label"] for r in account_results]
    if all(l == "inbox" for l in labels):
        return "inbox"
    elif all(l == "promotions" for l in labels):
        return "promotions"
    elif "not_found" in labels:
        return "not_found"
    else:
        return "partial"  # mixed results

async def run_optimization(run_id: str, email_input: EmailInput):
    """Main optimization loop."""
    max_iterations = int(os.getenv("MAX_ITERATIONS", "10"))
    check_delay = int(os.getenv("CHECK_DELAY_SECONDS", "90"))
    test_accounts = get_test_accounts()

    run = runs[run_id]
    run.status = "running"

    current_subject = email_input.subject
    current_body = email_input.body
    previous_feedback = ""

    for iteration in range(1, max_iterations + 1):
        run.total_iterations = iteration

        logger.info(f"[{run_id}] Iteration {iteration}: sending email to {test_accounts}")
        # Send emails
        send_meta = send_test_email(
            from_name=email_input.from_name,
            from_email=email_input.from_email,
            to_emails=test_accounts,
            subject=current_subject,
            body=current_body,
            run_id=run_id,
            iteration=iteration
        )

        logger.info(f"[{run_id}] Iteration {iteration}: email sent, waiting {check_delay}s for delivery")
        # Wait for delivery
        await asyncio.sleep(check_delay)

        logger.info(f"[{run_id}] Iteration {iteration}: checking Gmail labels")
        # Check all accounts
        account_results_raw = await asyncio.get_event_loop().run_in_executor(
            None,
            check_all_accounts,
            test_accounts,
            send_meta,
            120
        )

        account_results = [AccountResult(**r) for r in account_results_raw]
        verdict = determine_verdict([r.dict() for r in account_results])
        logger.info(f"[{run_id}] Iteration {iteration}: verdict={verdict}, results={account_results_raw}")

        iter_result = IterationResult(
            iteration=iteration,
            subject=current_subject,
            body=current_body,
            account_results=account_results,
            verdict=verdict,
            changes_made=None
        )
        run.iterations.append(iter_result)

        if verdict == "inbox":
            run.status = "success"
            run.final_subject = current_subject
            run.final_body = current_body
            return

        if verdict == "not_found":
            # Email delivery issue
            previous_feedback = "Email may not have been delivered. Check SMTP configuration."
        else:
            previous_feedback = f"Went to promotions on: {[r.account for r in account_results if r.label == 'promotions']}"

        if iteration < max_iterations:
            # Rewrite with Claude
            rewritten = await asyncio.get_event_loop().run_in_executor(
                None,
                rewrite_email,
                current_subject,
                current_body,
                iteration,
                previous_feedback
            )
            current_subject = rewritten["subject"]
            current_body = rewritten["body"]
            iter_result.changes_made = rewritten["changes"]

    run.status = "max_iterations"
    run.final_subject = current_subject
    run.final_body = current_body
