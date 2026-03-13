from pydantic import BaseModel
from typing import Optional, List
from enum import Enum


class EmailInput(BaseModel):
    from_name: str
    from_email: str
    subject: str
    body: str  # HTML or plain text


class AccountResult(BaseModel):
    account: str
    label: str  # "inbox" or "promotions"


class SpamCheckResult(BaseModel):
    score: int
    issues: List[str]
    verdict: str  # "good", "warning", "danger"


class IterationResult(BaseModel):
    iteration: int
    subject: str
    body: str
    account_results: List[AccountResult]
    verdict: str  # "inbox" | "promotions" | "partial"
    changes_made: Optional[str] = None  # what claude changed
    spam_score: Optional[SpamCheckResult] = None


class RunStatus(BaseModel):
    run_id: str
    status: str  # "running" | "success" | "failed" | "max_iterations" | "cancelled" | "interrupted" | "quick_check"
    iterations: List[IterationResult]
    final_subject: Optional[str] = None
    final_body: Optional[str] = None
    total_iterations: int = 0
    from_name: Optional[str] = None
    from_email: Optional[str] = None
    original_subject: Optional[str] = None
    original_body: Optional[str] = None
    created_at: Optional[str] = None


class RunSummary(BaseModel):
    run_id: str
    status: str
    from_name: Optional[str] = None
    from_email: Optional[str] = None
    original_subject: Optional[str] = None
    total_iterations: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class TemplateCreate(BaseModel):
    name: str
    subject: str
    body: str


class Template(BaseModel):
    id: int
    name: str
    subject: str
    body: str
    created_at: str


class SettingsUpdate(BaseModel):
    check_delay_seconds: Optional[int] = None
    max_iterations: Optional[int] = None
    test_accounts: Optional[List[str]] = None
    smtp_from_name: Optional[str] = None


class QuickCheckInput(BaseModel):
    from_name: str
    from_email: str
    subject: str
    body: str


class SpamCheckInput(BaseModel):
    subject: str
    body: str


class ResumeInput(BaseModel):
    manual_subject: Optional[str] = None
    manual_body: Optional[str] = None
