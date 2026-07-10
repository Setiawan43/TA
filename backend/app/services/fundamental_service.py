from __future__ import annotations

from typing import Any, Dict

import numpy as np
import pandas as pd
from fastapi import HTTPException

from .preprocessing_service import normalize_columns


def _find_col(df: pd.DataFrame, names: list[str]) -> str | None:
    return next((name for name in names if name in df.columns), None)


def _detect_scale(series: pd.Series) -> float:
    """
    Detect the scale factor of a numeric series so that values can be
    normalized to their base unit (e.g., billions → actual rupiah).

    Rules:
    - If median absolute value < 1_000 → likely already in billions/trillions, scale ×1e9
    - If median absolute value < 1_000_000 → likely in millions, scale ×1e6
    - If median absolute value < 1_000_000_000 → likely in thousands, scale ×1e3
    - Otherwise → already in base unit, scale ×1
    """
    med = series.abs().median()
    if med == 0:
        return 1.0
    if med < 1_000:
        return 1e9       # e.g., 26_000 means 26_000 billion = 26 trillion
    if med < 1_000_000:
        return 1e6       # e.g., 26_000_000 means 26 billion
    if med < 1_000_000_000:
        return 1e3       # e.g., 26_000_000_000 means 26 billion (thousands)
    return 1.0           # already full rupiah


def analyze_fundamental(df: pd.DataFrame, per_wajar: float = 8.0) -> Dict[str, Any]:
    data = normalize_columns(df)
    required = {
        "year": ["year", "tahun", "periode"],
        "net_income": ["net_income", "laba_bersih", "net_profit", "laba_bersih_setelah_pajak"],
        "total_equity": ["total_equity", "equity", "ekuitas", "total_ekuitas"],
        "total_assets": ["total_assets", "aset_total", "assets", "total_aset"],
        "total_liabilities": ["total_liabilities", "liabilities", "kewajiban_total", "total_liabilitas"],
        "shares_outstanding": ["shares_outstanding", "saham_beredar", "shares", "jumlah_saham"],
        "market_price": ["market_price", "harga_pasar", "harga_saham", "close", "harga_penutupan"],
    }
    resolved = {key: _find_col(data, names) for key, names in required.items()}
    missing = [key for key, value in resolved.items() if value is None]
    if missing:
        raise HTTPException(status_code=400, detail=f"CSV keuangan kurang kolom: {', '.join(missing)}")

    work = pd.DataFrame({key: data[col] for key, col in resolved.items() if col is not None})
    for col in work.columns:
        if col != "year":
            work[col] = pd.to_numeric(work[col], errors="coerce")
    work = work.dropna().sort_values("year")
    if work.empty:
        raise HTTPException(status_code=400, detail="Data keuangan tidak memiliki baris valid setelah dibersihkan.")

    # ── Auto-scale normalization ──────────────────────────────────────────────
    # Financial statement columns (income, equity, assets, liabilities) often
    # come in billions while shares_outstanding is in full units, and
    # market_price is in rupiah per share. We detect each column's scale
    # independently and normalize everything to full rupiah / full shares.

    fin_cols = ["net_income", "total_equity", "total_assets", "total_liabilities"]
    for col in fin_cols:
        scale = _detect_scale(work[col])
        if scale != 1.0:
            work[col] = work[col] * scale

    # shares_outstanding: if median < 10_000, it's in billions of shares
    shares_med = work["shares_outstanding"].abs().median()
    if shares_med < 10_000:
        work["shares_outstanding"] = work["shares_outstanding"] * 1e9
    elif shares_med < 10_000_000:
        work["shares_outstanding"] = work["shares_outstanding"] * 1e6

    # market_price: should be in rupiah per share (typically 100–50_000 for TLKM)
    # If median is extremely large, scale down
    price_med = work["market_price"].abs().median()
    if price_med > 1_000_000:
        work["market_price"] = work["market_price"] / 1000

    # ── Ratio calculations ────────────────────────────────────────────────────
    work["eps"] = work["net_income"] / work["shares_outstanding"].replace(0, np.nan)
    work["per"] = work["market_price"] / work["eps"].replace(0, np.nan)
    work["roe"] = work["net_income"] / work["total_equity"].replace(0, np.nan)
    work["roa"] = work["net_income"] / work["total_assets"].replace(0, np.nan)
    work["der"] = work["total_liabilities"] / work["total_equity"].replace(0, np.nan)
    work["bvps"] = work["total_equity"] / work["shares_outstanding"].replace(0, np.nan)
    work["pbv"] = work["market_price"] / work["bvps"].replace(0, np.nan)
    work["intrinsic_value"] = work["eps"] * per_wajar
    work["valuation_gap"] = work["intrinsic_value"] - work["market_price"]

    latest = work.iloc[-1]
    market_price = float(latest["market_price"])
    intrinsic = float(latest["intrinsic_value"])
    if market_price < intrinsic * 0.9:
        status = "undervalued"
    elif market_price > intrinsic * 1.1:
        status = "overvalued"
    else:
        status = "fair valued"

    def _safe(v: Any) -> float:
        """Return float or 0.0 if NaN/inf."""
        try:
            f = float(v)
            return f if np.isfinite(f) else 0.0
        except Exception:
            return 0.0

    rows = []
    for _, row in work.iterrows():
        rows.append({
            "year": str(row["year"]),
            "eps": _safe(row["eps"]),
            "per": _safe(row["per"]),
            "roe": _safe(row["roe"]),
            "roa": _safe(row["roa"]),
            "der": _safe(row["der"]),
            "bvps": _safe(row["bvps"]),
            "pbv": _safe(row["pbv"]),
            "market_price": _safe(row["market_price"]),
            "intrinsic_value": _safe(row["intrinsic_value"]),
            "valuation_gap": _safe(row["valuation_gap"]),
        })

    # ── Health Score (0–100) ─────────────────────────────────────────────────
    # Composite score dari 4 indikator utama, masing-masing 25 poin:
    #   ROE ≥ 15%      → 25 pts
    #   DER ≤ 1.5      → 25 pts
    #   Status wajar/undervalued → 25 pts
    #   ROA ≥ 5%       → 25 pts
    health_score = 0
    latest_roe = _safe(latest["roe"])
    latest_der = _safe(latest["der"])
    latest_roa = _safe(latest["roa"])
    if latest_roe >= 0.15:
        health_score += 25
    elif latest_roe >= 0.08:
        health_score += 13
    if latest_der <= 1.5:
        health_score += 25
    elif latest_der <= 2.5:
        health_score += 13
    if status in ("undervalued", "fair valued"):
        health_score += 25
    if latest_roa >= 0.05:
        health_score += 25
    elif latest_roa >= 0.02:
        health_score += 13

    return {
        "per_wajar": float(per_wajar),
        "latest_year": str(latest["year"]),
        "status": status,
        "latest": rows[-1],
        "health_score": health_score,
        "financial_csv_path": None,   # filled by caller if needed
        "rows": rows,
        "interpretation": [
            "ROE menunjukkan efisiensi perusahaan dalam menghasilkan laba dari ekuitas.",
            "DER menunjukkan struktur pendanaan dan tingkat ketergantungan terhadap liabilitas.",
            "PER dan PBV membantu membaca apakah harga saham relatif mahal atau murah terhadap laba dan nilai buku.",
        ],
        "summary": f"Berdasarkan nilai intrinsik EPS × PER wajar ({per_wajar}x), TLKM berada pada kondisi {status}. "
                   f"Nilai intrinsik: {intrinsic:,.0f} vs harga pasar: {market_price:,.0f}.",
    }
