import asyncio
import logging
import os
import uuid
from typing import AsyncGenerator, List, Optional
from models import RunStatus, IterationResult, AccountResult, EmailInput, SpamCheckResult, QuickCheckInput
from email_sender import send_test_email
from gmail_checker import check_all_accounts
from ai_rewriter import rewrite_email
from spam_checker import check_spam_score
import database as db

logger = logging.getLogger(__name__)

# In-memory store for active runs (for real-time SSE streaming)
runs: dict[str, RunStatus] = {}

# Control flags keyed by run_id
cancel_flags: dict[str, bool] = {}
pause_flags: dict[str, bool] = {}
manual_edits: dict[str, dict] = {}


def get_test_accounts() -> List[str]:
    # Check DB settings first, fall back to env
    accounts_setting = db.get_setting("test_accounts")
    if accounts_setting:
        return [a.strip() for a in accounts_setting.split(",") if a.strip()]
    accounts_str = os.getenv("TEST_ACCOUNTS", "")
    return [a.strip() for a in accounts_str.split(",") if a.strip()]


def get_max_iterations() -> int:
    val = db.get_setting("max_iterations")
    if val:
        try:
            return int(val)
        except ValueError:
            pass
    return int(os.getenv("MAX_ITERATIONS", "10"))


def get_check_delay() -> int:
    val = db.get_setting("check_delay_seconds")
    if val:
        try:
            return int(val)
        except ValueError:
            pass
    return int(os.getenv("CHECK_DELAY_SECONDS", "90"))


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
    max_iterations = get_max_iterations()
    check_delay = get_check_delay()
    test_accounts = get_test_accounts()

    run = runs[run_id]
    run.status = "running"
    db.update_run_status(run_id, "running")

    current_subject = email_input.subject
    current_body = email_input.body
    previous_feedback = ""

    for iteration in range(1, max_iterations + 1):
        # Check cancel flag
        if cancel_flags.get(run_id):
            run.status = "cancelled"
            db.update_run_status(run_id, "cancelled",
                                 final_subject=current_subject,
                                 final_body=current_body,
                                 total_iterations=iteration - 1)
            cancel_flags.pop(run_id, None)
            pause_flags.pop(run_id, None)
            manual_edits.pop(run_id, None)
            return

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

        logger.info(f"[{run_id}] Iteration {iteration}: email sent, waiting {check_delay}s")

        # Wait for delivery (with cancel check every 5s)
        waited = 0
        while waited < check_delay:
            if cancel_flags.get(run_id):
                break
            await asyncio.sleep(min(5, check_delay - waited))
            waited += 5

        if cancel_flags.get(run_id):
            run.status = "cancelled"
            db.update_run_status(run_id, "cancelled",
                                 final_subject=current_subject,
                                 final_body=current_body,
                                 total_iterations=iteration - 1)
            cancel_flags.pop(run_id, None)
            pause_flags.pop(run_id, None)
            manual_edits.pop(run_id, None)
            return

        logger.info(f"[{run_id}] Iteration {iteration}: checking Gmail labels")
        account_results_raw = await asyncio.get_event_loop().run_in_executor(
            None,
            check_all_accounts,
            test_accounts,
            send_meta,
            120
        )

        account_results = [AccountResult(**r) for r in account_results_raw]
        verdict = determine_verdict([r.dict() for r in account_results])
        logger.info(f"[{run_id}] Iteration {iteration}: verdict={verdict}")

        # Run spam check
        spam_result_raw = check_spam_score(current_subject, current_body)
        spam_result = SpamCheckResult(**spam_result_raw)

        iter_result = IterationResult(
            iteration=iteration,
            subject=current_subject,
            body=current_body,
            account_results=account_results,
            verdict=verdict,
            changes_made=None,
            spam_score=spam_result,
        )
        run.iterations.append(iter_result)

        # Persist iteration to DB
        iter_db_id = db.create_iteration(
            run_id=run_id,
            iteration_num=iteration,
            subject=current_subject,
            body=current_body,
            verdict=verdict,
            changes_made=None,
            spam_score=spam_result.score,
            spam_issues=spam_result.issues,
            spam_verdict=spam_result.verdict,
        )
        for ar in account_results:
            db.create_account_result(iter_db_id, ar.account, ar.label)

        db.update_run_status(run_id, "running", total_iterations=iteration)

        if verdict == "inbox":
            run.status = "success"
            run.final_subject = current_subject
            run.final_body = current_body
            db.update_run_status(run_id, "success",
                                 final_subject=current_subject,
                                 final_body=current_body,
                                 total_iterations=iteration)
            cancel_flags.pop(run_id, None)
            pause_flags.pop(run_id, None)
            manual_edits.pop(run_id, None)
            return

        if verdict == "not_found":
            previous_feedback = "Email may not have been delivered. Check SMTP configuration."
        else:
            previous_feedback = f"Went to promotions on: {[r.account for r in account_results if r.label == 'promotions']}"

        if iteration < max_iterations:
            # Check if paused — wait until resumed or cancelled
            if pause_flags.get(run_id):
                logger.info(f"[{run_id}] Paused after iteration {iteration}, waiting for resume")
                while pause_flags.get(run_id):
                    if cancel_flags.get(run_id):
                        break
                    await asyncio.sleep(2)

                if cancel_flags.get(run_id):
                    run.status = "cancelled"
                    db.update_run_status(run_id, "cancelled",
                                         final_subject=current_subject,
                                         final_body=current_body,
                                         total_iterations=iteration)
                    cancel_flags.pop(run_id, None)
                    pause_flags.pop(run_id, None)
                    manual_edits.pop(run_id, None)
                    return

                # Check for manual edits provided at resume time
                if run_id in manual_edits and manual_edits[run_id]:
                    edits = manual_edits.pop(run_id)
                    if edits.get("subject"):
                        current_subject = edits["subject"]
                    if edits.get("body"):
                        current_body = edits["body"]
                    logger.info(f"[{run_id}] Resuming with manual edits")
                    # Update the last iteration's changes_made note
                    iter_result.changes_made = "Manually edited by user"
                    # Update DB
                    from database import get_db as _get_db
                    with _get_db() as conn:
                        conn.execute(
                            "UPDATE iterations SET changes_made=? WHERE id=?",
                            ("Manually edited by user", iter_db_id)
                        )
                    continue  # Skip AI rewrite, go to next iteration

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

            # Update changes in DB
            from database import get_db as _get_db
            with _get_db() as conn:
                conn.execute(
                    "UPDATE iterations SET changes_made=? WHERE id=?",
                    (rewritten["changes"], iter_db_id)
                )

    run.status = "max_iterations"
    run.final_subject = current_subject
    run.final_body = current_body
    db.update_run_status(run_id, "max_iterations",
                         final_subject=current_subject,
                         final_body=current_body,
                         total_iterations=max_iterations)
    cancel_flags.pop(run_id, None)
    pause_flags.pop(run_id, None)
    manual_edits.pop(run_id, None)


async def run_quick_check(run_id: str, email_input: QuickCheckInput):
    """Send once and check — no rewriting."""
    test_accounts = get_test_accounts()
    check_delay = get_check_delay()

    run = runs[run_id]
    run.status = "running"
    db.update_run_status(run_id, "running")

    current_subject = email_input.subject
    current_body = email_input.body

    try:
        send_meta = send_test_email(
            from_name=email_input.from_name,
            from_email=email_input.from_email,
            to_emails=test_accounts,
            subject=current_subject,
            body=current_body,
            run_id=run_id,
            iteration=1
        )

        # Wait with cancel check
        waited = 0
        while waited < check_delay:
            if cancel_flags.get(run_id):
                break
            await asyncio.sleep(min(5, check_delay - waited))
            waited += 5

        if cancel_flags.get(run_id):
            run.status = "cancelled"
            db.update_run_status(run_id, "cancelled",
                                 final_subject=current_subject,
                                 final_body=current_body,
                                 total_iterations=0)
            cancel_flags.pop(run_id, None)
            return

        account_results_raw = await asyncio.get_event_loop().run_in_executor(
            None,
            check_all_accounts,
            test_accounts,
            send_meta,
            120
        )

        account_results = [AccountResult(**r) for r in account_results_raw]
        verdict = determine_verdict([r.dict() for r in account_results])

        spam_result_raw = check_spam_score(current_subject, current_body)
        spam_result = SpamCheckResult(**spam_result_raw)

        iter_result = IterationResult(
            iteration=1,
            subject=current_subject,
            body=current_body,
            account_results=account_results,
            verdict=verdict,
            changes_made=None,
            spam_score=spam_result,
        )
        run.iterations.append(iter_result)
        run.total_iterations = 1

        iter_db_id = db.create_iteration(
            run_id=run_id,
            iteration_num=1,
            subject=current_subject,
            body=current_body,
            verdict=verdict,
            changes_made=None,
            spam_score=spam_result.score,
            spam_issues=spam_result.issues,
            spam_verdict=spam_result.verdict,
        )
        for ar in account_results:
            db.create_account_result(iter_db_id, ar.account, ar.label)

        final_status = "success" if verdict == "inbox" else "quick_check"
        run.status = final_status
        run.final_subject = current_subject
        run.final_body = current_body
        db.update_run_status(run_id, final_status,
                             final_subject=current_subject,
                             final_body=current_body,
                             total_iterations=1)

    except Exception as e:
        logger.error(f"[{run_id}] Quick check failed: {e}")
        run.status = "failed"
        db.update_run_status(run_id, "failed", total_iterations=0)
    finally:
        cancel_flags.pop(run_id, None)
