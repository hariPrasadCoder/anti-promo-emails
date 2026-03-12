"""
Run this script once per Gmail test account to authorize it.
Usage: python setup_gmail_auth.py account@gmail.com
"""
import sys
import os
from pathlib import Path
from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

def setup_account(account_email: str):
    creds_dir = Path(os.getenv("GMAIL_CREDENTIALS_DIR", "./gmail_credentials"))
    creds_dir.mkdir(exist_ok=True)

    creds_path = creds_dir / f"credentials_{account_email.replace('@', '_at_')}.json"
    token_path = creds_dir / f"token_{account_email.replace('@', '_at_')}.json"

    if not creds_path.exists():
        print(f"ERROR: credentials file not found at {creds_path}")
        print("Download OAuth2 credentials from Google Cloud Console and place it there.")
        sys.exit(1)

    flow = InstalledAppFlow.from_client_secrets_file(str(creds_path), SCOPES)
    creds = flow.run_local_server(port=0)

    with open(token_path, "w") as f:
        f.write(creds.to_json())

    print(f"SUCCESS: Token saved to {token_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python setup_gmail_auth.py account@gmail.com")
        sys.exit(1)
    setup_account(sys.argv[1])
