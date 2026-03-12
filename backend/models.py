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

class IterationResult(BaseModel):
    iteration: int
    subject: str
    body: str
    account_results: List[AccountResult]
    verdict: str  # "inbox" | "promotions" | "partial"
    changes_made: Optional[str] = None  # what claude changed

class RunStatus(BaseModel):
    run_id: str
    status: str  # "running" | "success" | "failed" | "max_iterations"
    iterations: List[IterationResult]
    final_subject: Optional[str] = None
    final_body: Optional[str] = None
    total_iterations: int = 0
