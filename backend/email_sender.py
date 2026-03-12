import smtplib
import os
import re
import time
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List


def send_test_email(
    from_name: str,
    from_email: str,
    to_emails: List[str],
    subject: str,
    body: str,
    run_id: str,
    iteration: int
) -> dict:
    """Send test email to all test accounts. Returns search metadata."""
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")

    sent_at = int(time.time())

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject  # Clean subject — no tags appended
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = ", ".join(to_emails)
    # Hidden header for identification — not visible to recipients
    msg["X-APEO-Tag"] = f"{run_id}-{iteration}"

    # Always send both plain text and HTML parts
    # If body looks like HTML, use it as-is; otherwise wrap it
    if body.strip().startswith("<"):
        html_body = body
        # Strip tags for plain text fallback
        plain_body = re.sub(r"<[^>]+>", "", body).strip()
    else:
        plain_body = body
        # Split into paragraphs (blank-line separated) and wrap each in <p>
        paragraphs = re.split(r"\n{2,}", body.strip())
        html_body = "<html><body style='font-family:sans-serif;font-size:15px;line-height:1.6'>" + "".join(
            f"<p>{'<br>'.join(line for line in para.split(chr(10)))}</p>"
            for para in paragraphs if para.strip()
        ) + "</body></html>"

    msg.attach(MIMEText(plain_body, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    with smtplib.SMTP(smtp_host, smtp_port) as server:
        server.ehlo()
        server.starttls()
        server.login(smtp_user, smtp_pass)
        server.sendmail(smtp_user, to_emails, msg.as_string())

    return {
        "from_email": from_email,
        "subject": subject,
        "sent_at": sent_at,
    }
