import logging
import os
import time
from pathlib import Path
from typing import List

logger = logging.getLogger(__name__)
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]
CREDENTIALS_DIR = Path(os.getenv("GMAIL_CREDENTIALS_DIR", "./gmail_credentials"))


def get_gmail_service(account_email: str):
    """Get authenticated Gmail API service for an account."""
    token_path = CREDENTIALS_DIR / f"token_{account_email.replace('@', '_at_')}.json"

    if not token_path.exists():
        raise FileNotFoundError(
            f"No token found for {account_email}. "
            f"Please authorize this account via Settings → Gmail Accounts."
        )

    creds = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    if not creds.valid:
        if creds.expired and creds.refresh_token:
            creds.refresh(Request())
            with open(token_path, "w") as f:
                f.write(creds.to_json())
        else:
            raise RuntimeError(
                f"Token for {account_email} is invalid. "
                f"Please re-authorize via Settings → Gmail Accounts."
            )

    return build("gmail", "v1", credentials=creds)


def check_email_label(account_email: str, send_meta: dict, max_wait: int = 120) -> str:
    """
    Poll Gmail until the email arrives, identified by sender + subject + time window.
    Returns 'inbox', 'promotions', or 'not_found'.
    """
    service = get_gmail_service(account_email)
    start = time.time()
    poll_interval = 15  # seconds

    from_email = send_meta["from_email"]
    subject = send_meta["subject"]
    sent_at = send_meta["sent_at"]

    # Search by sender + subject — no tag in subject needed
    query = f'from:{from_email} subject:"{subject}"'
    logger.info(f"Gmail query for {account_email}: {query} (sent_at={sent_at})")

    while time.time() - start < max_wait:
        results = service.users().messages().list(
            userId="me",
            q=query,
            maxResults=10
        ).execute()

        messages = results.get("messages", [])
        logger.info(f"Gmail search for {account_email}: found {len(messages)} messages")
        if messages:
            # Find the most recent one sent after our send time
            for m in messages:
                msg = service.users().messages().get(
                    userId="me",
                    id=m["id"],
                    format="metadata",
                    metadataHeaders=["Date"]
                ).execute()

                internal_date = int(msg.get("internalDate", 0)) // 1000  # ms -> s
                if internal_date >= sent_at - 10:  # 10s tolerance
                    labels = msg.get("labelIds", [])
                    if "CATEGORY_PROMOTIONS" in labels:
                        return "promotions"
                    elif "INBOX" in labels:
                        return "inbox"
                    else:
                        return "other"  # spam, updates, etc.

        time.sleep(poll_interval)

    return "not_found"


def check_all_accounts(accounts: List[str], send_meta: dict, max_wait: int = 120) -> List[dict]:
    """Check all test accounts in parallel using threads."""
    import concurrent.futures
    results = []

    with concurrent.futures.ThreadPoolExecutor(max_workers=len(accounts)) as executor:
        future_to_account = {
            executor.submit(check_email_label, acc, send_meta, max_wait): acc
            for acc in accounts
        }
        for future in concurrent.futures.as_completed(future_to_account):
            account = future_to_account[future]
            try:
                label = future.result()
            except Exception as e:
                label = f"error: {e}"
            results.append({"account": account, "label": label})

    return results
