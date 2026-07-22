from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional

# pyrefly: ignore [missing-import]
from passlib.context import CryptContext

BASE_DIR = os.path.dirname(__file__)
DATA_DIR = os.path.join(BASE_DIR, "data")
DB_PATH = os.path.join(DATA_DIR, "tlkm_analysis.db")

os.makedirs(DATA_DIR, exist_ok=True)

# Password hashing context
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


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
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'visitor',
                created_at TEXT NOT NULL
            )
            """
        )
        conn.commit()
        
        # Add new columns if they don't exist
        try:
            conn.execute("ALTER TABLE users ADD COLUMN first_name TEXT DEFAULT ''")
            conn.execute("ALTER TABLE users ADD COLUMN last_name TEXT DEFAULT ''")
            conn.execute("ALTER TABLE users ADD COLUMN phone TEXT DEFAULT ''")
            conn.commit()
        except sqlite3.OperationalError:
            pass # Columns likely exist already
        
        # Seed default admin account if not yet created
        _seed_admin(conn)


def _seed_admin(conn: sqlite3.Connection) -> None:
    """Create a default admin account on first run."""
    exists = conn.execute("SELECT 1 FROM users WHERE username = 'admin'").fetchone()
    if not exists:
        conn.execute(
            """
            INSERT INTO users (username, email, password_hash, role, first_name, last_name, phone, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "admin",
                "admin@tlkm.local",
                pwd_context.hash("admin123"),
                "admin",
                "Super",
                "Admin",
                "",
                datetime.now().isoformat(timespec="seconds"),
            ),
        )
        conn.commit()


# ─── User Auth Functions ──────────────────────────────────────────────────────

def create_user(
    username: str, 
    email: str, 
    password: str, 
    role: str = "visitor",
    first_name: str = "",
    last_name: str = "",
    phone: str = ""
) -> Dict[str, Any]:
    password_hash = pwd_context.hash(password)
    with get_connection() as conn:
        try:
            cur = conn.execute(
                """
                INSERT INTO users (username, email, password_hash, role, first_name, last_name, phone, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (username, email, password_hash, role, first_name, last_name, phone, datetime.now().isoformat(timespec="seconds")),
            )
            conn.commit()
            return {"id": cur.lastrowid, "username": username, "email": email, "role": role}
        except sqlite3.IntegrityError as e:
            if "username" in str(e):
                raise ValueError("Username sudah digunakan.")
            if "email" in str(e):
                raise ValueError("Email sudah terdaftar.")
            raise ValueError("Registrasi gagal. Data tidak valid.")


def get_user_by_username(username: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, username, email, password_hash, role, first_name, last_name, phone, created_at FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        return dict(row) if row else None


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT id, username, email, password_hash, role, first_name, last_name, phone, created_at FROM users WHERE email = ?",
            (email,),
        ).fetchone()
        return dict(row) if row else None


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    user = get_user_by_username(username)
    if not user:
        return None
    if not verify_password(password, user["password_hash"]):
        return None
    return {
        "id": user["id"],
        "username": user["username"],
        "email": user["email"],
        "role": user["role"],
        "first_name": user.get("first_name", ""),
        "last_name": user.get("last_name", ""),
        "phone": user.get("phone", ""),
    }


def list_users() -> List[Dict[str, Any]]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, username, email, role, first_name, last_name, phone, created_at FROM users ORDER BY id ASC"
        ).fetchall()
        return [dict(row) for row in rows]


def update_user(
    user_id: int, 
    username: str | None = None, 
    email: str | None = None, 
    password: str | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
    phone: str | None = None
) -> Optional[Dict[str, Any]]:
    with get_connection() as conn:
        # Check existence
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        if not row:
            return None
        
        updates = []
        params = []
        if username is not None:
            updates.append("username = ?")
            params.append(username)
        if email is not None:
            updates.append("email = ?")
            params.append(email)
        if password is not None:
            updates.append("password_hash = ?")
            params.append(pwd_context.hash(password))
        if first_name is not None:
            updates.append("first_name = ?")
            params.append(first_name)
        if last_name is not None:
            updates.append("last_name = ?")
            params.append(last_name)
        if phone is not None:
            updates.append("phone = ?")
            params.append(phone)
            
        if not updates:
            return dict(row)
            
        params.append(user_id)
        try:
            conn.execute(f"UPDATE users SET {', '.join(updates)} WHERE id = ?", params)
            conn.commit()
            
            # Return updated user
            updated_row = conn.execute("SELECT id, username, email, role, first_name, last_name, phone, created_at FROM users WHERE id = ?", (user_id,)).fetchone()
            return dict(updated_row) if updated_row else None
        except sqlite3.IntegrityError as e:
            if "username" in str(e):
                raise ValueError("Username sudah digunakan.")
            if "email" in str(e):
                raise ValueError("Email sudah terdaftar.")
            raise ValueError("Update gagal. Data tidak valid.")


# ─── Analysis History Functions ───────────────────────────────────────────────

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


def get_latest_analysis() -> Dict[str, Any] | None:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT result_json, price_file, financial_file
            FROM analysis_history
            ORDER BY id DESC
            LIMIT 1
            """
        ).fetchone()
        if row:
            try:
                data = json.loads(row["result_json"])
                # Pastikan path file terinjeksi kembali agar frontend dapat mengakses path CSV untuk forecast ulang
                if isinstance(data, dict):
                    if "arima" in data and isinstance(data["arima"], dict):
                        if "preprocessing" not in data["arima"] or data["arima"]["preprocessing"] is None:
                            data["arima"]["preprocessing"] = {}
                        data["arima"]["preprocessing"]["price_csv_path"] = row["price_file"]
                    if "fundamental" in data and isinstance(data["fundamental"], dict):
                        data["fundamental"]["financial_csv_path"] = row["financial_file"]
                return data
            except Exception:
                return None
        return None
