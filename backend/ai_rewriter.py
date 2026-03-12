import os
import anthropic
import json
import re

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

SYSTEM_PROMPT = """You are an email deliverability expert. Your job is to subtly rewrite marketing emails so they land in Gmail's inbox instead of the Promotions tab.

STRICT RULES:
1. Keep ALL links exactly as-is. Never remove, replace, or alter any URL or hyperlink.
2. Keep ALL call-to-action buttons/text — you can rephrase them slightly but not remove them.
3. Keep the core message, offer, and intent identical.
4. Keep the overall email length similar (±20%).
5. Do NOT add "Reply to this email" or similar workarounds if they weren't in the original.
6. Do NOT make it look like a transactional email if it isn't.

WHAT YOU CAN CHANGE (subtly):
- Subject line: make it feel more personal, conversational, less salesy. Remove excessive punctuation, emojis, all-caps words.
- Body tone: reduce overly promotional language. Make it sound like one human writing to another.
- Reduce repetitive CTAs (if there are 5, maybe use 3).
- Remove excessive formatting (multiple colors, lots of bold, etc.) if present.
- Replace spam-trigger words (free, guaranteed, limited time, act now, click here, etc.) with natural alternatives.
- Add subtle personalization if missing.

OUTPUT FORMAT (JSON only, no markdown):
{
  "subject": "rewritten subject line",
  "body": "rewritten body",
  "changes": "brief description of what you changed and why"
}"""

def rewrite_email(subject: str, body: str, iteration: int, previous_feedback: str = "") -> dict:
    """Ask Claude to subtly rewrite the email for better deliverability."""

    user_message = f"""This email went to Gmail's Promotions tab. Please rewrite it subtly so it lands in the inbox.

{f"Previous attempt feedback: {previous_feedback}" if previous_feedback else ""}

CURRENT SUBJECT:
{subject}

CURRENT BODY:
{body}

Remember: minimal changes only. Keep all links and CTAs. Make it feel more human and less promotional.
Respond with JSON only."""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}]
    )

    content = response.content[0].text.strip()

    # Extract JSON (handle cases where Claude adds markdown fences)
    if "```" in content:
        match = re.search(r"```(?:json)?\s*([\s\S]+?)\s*```", content)
        if match:
            content = match.group(1)

    result = json.loads(content)
    return {
        "subject": result.get("subject", subject),
        "body": result.get("body", body),
        "changes": result.get("changes", "")
    }
