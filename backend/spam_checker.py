"""
Heuristic spam scorer — no external services.
Returns a score 0-100 (lower is better) and a list of specific issues.
"""

import re
from typing import List, Dict, Any

SPAM_TRIGGER_WORDS = [
    "free", "guaranteed", "limited time", "act now", "click here",
    "winner", "congratulations", "urgent", "buy now", "discount",
    "offer expires", "no obligation", "risk-free", "risk free",
    "you have been selected", "you've been selected",
    "earn money", "make money", "extra income", "double your",
    "miracle", "lose weight", "weight loss", "billion", "million dollars",
    "casino", "viagra", "lowest price", "best price",
    "satisfaction guaranteed", "money back guarantee",
    "100% free", "absolutely free", "completely free",
    "special promotion", "special offer", "exclusive deal",
    "once in a lifetime", "apply now", "order now", "call now",
    "don't delete", "don't miss", "do not delete",
    "dear friend", "dear winner",
    "eliminate debt", "financial freedom",
    "no cost", "no fees", "no strings attached",
    "pre-approved", "pre approved", "you're approved",
    "unsubscribe", "opt out",  # not inherently spam but flags
    "click below", "click the link",
]

PROMOTIONAL_PHRASES = [
    r"\d+\s*%\s*off",
    r"save\s+now",
    r"order\s+now",
    r"shop\s+now",
    r"buy\s+now",
    r"get\s+it\s+now",
    r"limited\s+offer",
    r"expires?\s+soon",
    r"while\s+supplies?\s+last",
    r"today\s+only",
    r"flash\s+sale",
    r"mega\s+sale",
    r"clearance",
    r"free\s+gift",
    r"free\s+shipping",
    r"no\s+credit\s+card",
]


def _count_all_caps_words(text: str) -> int:
    """Count words that are all uppercase (3+ chars, ignoring common acronyms like URL, FAQ)."""
    common_acronyms = {"URL", "FAQ", "CEO", "CTO", "CFO", "API", "HTML", "CSS", "SMTP", "USA", "UK", "EU"}
    words = re.findall(r"\b[A-Z]{3,}\b", text)
    return sum(1 for w in words if w not in common_acronyms)


def check_spam_score(subject: str, body: str) -> Dict[str, Any]:
    """
    Heuristic spam score. Returns:
    {
        "score": int (0-100, lower is better),
        "issues": [str],
        "verdict": "good" | "warning" | "danger"
    }
    """
    issues: List[str] = []
    score = 0

    combined = (subject + " " + body).lower()
    subject_lower = subject.lower()
    body_lower = body.lower()

    # 1. Spam trigger words
    found_triggers = []
    for word in SPAM_TRIGGER_WORDS:
        if word in combined:
            found_triggers.append(word)
    if found_triggers:
        penalty = min(len(found_triggers) * 4, 30)
        score += penalty
        issues.append(f"Spam trigger words found: {', '.join(found_triggers[:8])}" +
                      (" and more" if len(found_triggers) > 8 else ""))

    # 2. All-caps words in subject
    caps_in_subject = _count_all_caps_words(subject)
    if caps_in_subject > 0:
        score += caps_in_subject * 5
        issues.append(f"{caps_in_subject} all-caps word(s) in subject line")

    # 3. All-caps words in body
    caps_in_body = _count_all_caps_words(body)
    if caps_in_body > 2:
        score += min(caps_in_body * 2, 10)
        issues.append(f"{caps_in_body} all-caps word(s) in body")

    # 4. Excessive exclamation marks
    excl_subject = subject.count("!")
    excl_body = body.count("!")
    if excl_subject > 0:
        score += excl_subject * 5
        issues.append(f"{excl_subject} exclamation mark(s) in subject")
    if excl_body > 2:
        score += min(excl_body * 2, 8)
        issues.append(f"{excl_body} exclamation mark(s) in body")

    # 5. Too many links
    link_count = body_lower.count("http")
    if link_count > 5:
        score += min((link_count - 5) * 3, 12)
        issues.append(f"{link_count} links in body (consider reducing)")

    # 6. Excessive dollar signs
    dollar_count = body.count("$") + subject.count("$")
    if dollar_count > 1:
        score += min(dollar_count * 3, 9)
        issues.append(f"{dollar_count} dollar sign(s) found")

    # 7. Subject line too long
    if len(subject) > 60:
        score += 5
        issues.append(f"Subject line is {len(subject)} chars (recommended: ≤60)")

    # 8. Promotional phrases (regex)
    found_promos = []
    for pattern in PROMOTIONAL_PHRASES:
        if re.search(pattern, combined):
            found_promos.append(pattern.replace(r"\s+", " ").replace("\\", "").replace("?", "").replace(r"\d+", "X%"))
    if found_promos:
        penalty = min(len(found_promos) * 4, 20)
        score += penalty
        issues.append(f"Promotional phrases detected: {', '.join(found_promos[:5])}" +
                      (" and more" if len(found_promos) > 5 else ""))

    # 9. All-caps subject
    alpha_chars = re.sub(r"[^a-zA-Z]", "", subject)
    if alpha_chars and alpha_chars == alpha_chars.upper() and len(alpha_chars) > 4:
        score += 15
        issues.append("Subject line is all uppercase")

    # 10. Question marks in subject (excessive)
    q_marks = subject.count("?")
    if q_marks > 1:
        score += q_marks * 3
        issues.append(f"{q_marks} question marks in subject")

    # 11. Very short body (suspicious)
    plain_body = re.sub(r"<[^>]+>", "", body).strip()
    if len(plain_body) < 50:
        score += 5
        issues.append("Body is very short (less than 50 characters)")

    # 12. No plain text / all HTML with no prose
    if body.strip().startswith("<") and not re.search(r"[a-zA-Z]{20,}", re.sub(r"<[^>]+>", "", body)):
        score += 8
        issues.append("Body appears to be mostly HTML tags with little readable text")

    # Cap score at 100
    score = min(score, 100)

    if score <= 30:
        verdict = "good"
    elif score <= 60:
        verdict = "warning"
    else:
        verdict = "danger"

    return {
        "score": score,
        "issues": issues,
        "verdict": verdict,
    }
