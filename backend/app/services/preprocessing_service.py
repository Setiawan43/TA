from __future__ import annotations

import io
import os
import uuid
from typing import Any, Dict, Tuple

import pandas as pd
from fastapi import HTTPException, UploadFile
from statsmodels.tsa.stattools import adfuller

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "data", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def read_uploaded_csv(upload: UploadFile) -> pd.DataFrame:
    if not upload.filename or not upload.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File harus berformat .csv")
    raw = upload.file.read()
    try:
        df = pd.read_csv(io.BytesIO(raw))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"CSV gagal dibaca: {exc}") from exc
    if df.empty:
        raise HTTPException(status_code=400, detail="CSV kosong")
    return df


def save_upload(upload: UploadFile, prefix: str) -> Tuple[str, Dict[str, Any]]:
    df = read_uploaded_csv(upload)
    file_name = f"{prefix}_{uuid.uuid4().hex}.csv"
    path = os.path.join(UPLOAD_DIR, file_name)
    df.to_csv(path, index=False)
    return path, {"rows": int(len(df)), "columns": list(df.columns)}


def load_csv(path: str) -> pd.DataFrame:
    if not path or not os.path.exists(path):
        raise HTTPException(status_code=404, detail="File tidak ditemukan. Upload data terlebih dahulu.")
    try:
        return pd.read_csv(path)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Gagal membaca file CSV: {exc}") from exc


def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out.columns = [str(col).strip().lower().replace(" ", "_") for col in out.columns]
    return out


def run_adf_test(series: pd.Series) -> Dict[str, Any]:
    try:
        result = adfuller(series.astype(float), autolag="AIC")
        p_value = float(result[1])
        return {
            "statistic": float(result[0]),
            "p_value": p_value,
            "is_stationary": bool(p_value < 0.05),
            "note": "Stasioner" if p_value < 0.05 else "Belum stasioner, differencing direkomendasikan",
        }
    except Exception:
        return {"statistic": None, "p_value": None, "is_stationary": False, "note": "ADF test gagal, gunakan differencing default"}


def prepare_price_data(df: pd.DataFrame) -> tuple[pd.DataFrame, Dict[str, Any]]:
    df = normalize_columns(df)
    date_col = next((col for col in ["date", "tanggal", "datetime"] if col in df.columns), None)
    close_col = next((col for col in ["close", "harga_penutupan", "price", "harga"] if col in df.columns), None)
    if not date_col or not close_col:
        raise HTTPException(status_code=400, detail="CSV harga wajib memiliki kolom tanggal/date dan close/harga_penutupan.")

    before_rows = len(df)
    data = df[[date_col, close_col]].copy()
    data.columns = ["date", "close"]
    data["date"] = pd.to_datetime(data["date"], errors="coerce")
    data["close"] = pd.to_numeric(data["close"], errors="coerce")
    missing_before = data.isna().sum().to_dict()
    data = data.dropna(subset=["date", "close"])
    data = data.drop_duplicates(subset=["date"], keep="last")
    data = data.sort_values("date")
    if len(data) < 40:
        raise HTTPException(status_code=400, detail="Data harga minimal 40 baris agar ARIMA dapat dievaluasi.")

    series = data.set_index("date")["close"]
    return data, {
        "rows_before": int(before_rows),
        "rows_after": int(len(data)),
        "missing_before_cleaning": missing_before,
        "start_date": data["date"].min().strftime("%Y-%m-%d"),
        "end_date": data["date"].max().strftime("%Y-%m-%d"),
        "adf": run_adf_test(series),
    }
