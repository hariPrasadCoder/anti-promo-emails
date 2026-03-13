"""
SQLite database layer using Python's built-in sqlite3 module.
No external ORM — just raw SQL with a thin helper layer.
"""

import sqlite3
import os
import json
from datetime import datetime
from contextlib import contextmanager
from typing import Optional, List, Dict, Any

DB_PATH = os.getenv("DB_PATH", "./apeo.db")


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def create_tables():
    """Create all tables if they don't exist."""
    with get_db() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS runs (
                id TEXT PRIMARY KEY,
                status TEXT NOT NULL DEFAULT 'pending',
                from_name TEXT NOT NULL DEFAULT '',
                from_email TEXT NOT NULL DEFAULT '',
                subject TEXT NOT NULL DEFAULT '',
                body TEXT NOT NULL DEFAULT '',
                final_subject TEXT,
                final_body TEXT,
                total_iterations INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS iterations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
                iteration_num INTEGER NOT NULL,
                subject TEXT NOT NULL DEFAULT '',
                body TEXT NOT NULL DEFAULT '',
                verdict TEXT NOT NULL DEFAULT '',
                changes_made TEXT,
                spam_score INTEGER,
                spam_issues TEXT,
                spam_verdict TEXT,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS account_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                iteration_id INTEGER NOT NULL REFERENCES iterations(id) ON DELETE CASCADE,
                account TEXT NOT NULL,
                label TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                subject TEXT NOT NULL DEFAULT '',
                body TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
        """)


def now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


# ─── Runs ────────────────────────────────────────────────────────────────────

def create_run(run_id: str, from_name: str, from_email: str, subject: str, body: str, status: str = "pending"):
    ts = now_iso()
    with get_db() as conn:
        conn.execute(
            """INSERT INTO runs (id, status, from_name, from_email, subject, body, total_iterations, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)""",
            (run_id, status, from_name, from_email, subject, body, ts, ts)
        )


def update_run_status(run_id: str, status: str, final_subject: Optional[str] = None,
                      final_body: Optional[str] = None, total_iterations: Optional[int] = None):
    ts = now_iso()
    with get_db() as conn:
        if final_subject is not None and total_iterations is not None:
            conn.execute(
                "UPDATE runs SET status=?, final_subject=?, final_body=?, total_iterations=?, updated_at=? WHERE id=?",
                (status, final_subject, final_body, total_iterations, ts, run_id)
            )
        elif total_iterations is not None:
            conn.execute(
                "UPDATE runs SET status=?, total_iterations=?, updated_at=? WHERE id=?",
                (status, total_iterations, ts, run_id)
            )
        else:
            conn.execute(
                "UPDATE runs SET status=?, updated_at=? WHERE id=?",
                (status, ts, run_id)
            )


def get_run(run_id: str) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM runs WHERE id=?", (run_id,)).fetchone()
        if not row:
            return None
        return dict(row)


def list_runs(limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute(
            "SELECT * FROM runs ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (limit, offset)
        ).fetchall()
        return [dict(r) for r in rows]


def delete_run(run_id: str):
    with get_db() as conn:
        conn.execute("DELETE FROM runs WHERE id=?", (run_id,))


def mark_interrupted_runs():
    """On server startup, mark any 'running' or 'quick_check' runs as 'interrupted'."""
    with get_db() as conn:
        conn.execute(
            "UPDATE runs SET status='interrupted', updated_at=? WHERE status IN ('running', 'pending')",
            (now_iso(),)
        )


# ─── Iterations ──────────────────────────────────────────────────────────────

def create_iteration(run_id: str, iteration_num: int, subject: str, body: str,
                     verdict: str, changes_made: Optional[str],
                     spam_score: Optional[int] = None,
                     spam_issues: Optional[List[str]] = None,
                     spam_verdict: Optional[str] = None) -> int:
    ts = now_iso()
    issues_str = json.dumps(spam_issues) if spam_issues is not None else None
    with get_db() as conn:
        cur = conn.execute(
            """INSERT INTO iterations (run_id, iteration_num, subject, body, verdict, changes_made,
               spam_score, spam_issues, spam_verdict, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (run_id, iteration_num, subject, body, verdict, changes_made,
             spam_score, issues_str, spam_verdict, ts)
        )
        return cur.lastrowid


def create_account_result(iteration_id: int, account: str, label: str):
    with get_db() as conn:
        conn.execute(
            "INSERT INTO account_results (iteration_id, account, label) VALUES (?, ?, ?)",
            (iteration_id, account, label)
        )


def get_iterations_for_run(run_id: str) -> List[Dict[str, Any]]:
    with get_db() as conn:
        iters = conn.execute(
            "SELECT * FROM iterations WHERE run_id=? ORDER BY iteration_num ASC",
            (run_id,)
        ).fetchall()
        results = []
        for it in iters:
            it_dict = dict(it)
            if it_dict.get("spam_issues"):
                try:
                    it_dict["spam_issues"] = json.loads(it_dict["spam_issues"])
                except Exception:
                    it_dict["spam_issues"] = []
            else:
                it_dict["spam_issues"] = []
            acc_rows = conn.execute(
                "SELECT account, label FROM account_results WHERE iteration_id=?",
                (it_dict["id"],)
            ).fetchall()
            it_dict["account_results"] = [dict(r) for r in acc_rows]
            results.append(it_dict)
        return results


# ─── Templates ───────────────────────────────────────────────────────────────

def create_template(name: str, subject: str, body: str) -> int:
    ts = now_iso()
    with get_db() as conn:
        cur = conn.execute(
            "INSERT INTO templates (name, subject, body, created_at) VALUES (?, ?, ?, ?)",
            (name, subject, body, ts)
        )
        return cur.lastrowid


def list_templates() -> List[Dict[str, Any]]:
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM templates ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]


def get_template(template_id: int) -> Optional[Dict[str, Any]]:
    with get_db() as conn:
        row = conn.execute("SELECT * FROM templates WHERE id=?", (template_id,)).fetchone()
        return dict(row) if row else None


def delete_template(template_id: int):
    with get_db() as conn:
        conn.execute("DELETE FROM templates WHERE id=?", (template_id,))


# ─── Settings ────────────────────────────────────────────────────────────────

def get_setting(key: str) -> Optional[str]:
    with get_db() as conn:
        row = conn.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
        return row["value"] if row else None


def set_setting(key: str, value: str):
    with get_db() as conn:
        conn.execute(
            "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            (key, value)
        )


def get_all_settings() -> Dict[str, str]:
    with get_db() as conn:
        rows = conn.execute("SELECT key, value FROM settings").fetchall()
        return {r["key"]: r["value"] for r in rows}
