from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, List

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "tlkm_analysis.db")

os.makedirs(DATA_DIR, exist_ok=True)


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS analysis_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                analysis_type TEXT NOT NULL,
                created_at TEXT NOT NULL,
                price_file TEXT,
                financial_file TEXT,
                summary TEXT NOT NULL,
                result_json TEXT NOT NULL
            )
            """
        )
        conn.commit()


def save_history(analysis_type: str, result: Dict[str, Any], price_file: str | None = None, financial_file: str | None = None) -> int:
    summary = result.get("recommendation", {}).get("summary") or result.get("summary") or analysis_type
    with get_connection() as conn:
        cur = conn.execute(
            """
            INSERT INTO analysis_history
            (analysis_type, created_at, price_file, financial_file, summary, result_json)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (analysis_type, datetime.now().isoformat(timespec="seconds"), price_file, financial_file, summary, json.dumps(result, ensure_ascii=False)),
        )
        conn.commit()
        return int(cur.lastrowid)


def list_history(limit: int = 20) -> List[Dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT id, analysis_type, created_at, price_file, financial_file, summary
            FROM analysis_history
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return [dict(row) for row in rows]
