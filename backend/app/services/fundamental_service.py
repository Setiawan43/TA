from __future__ import annotations

from typing import Any, Dict

import numpy as np
import pandas as pd
from fastapi import HTTPException

from .preprocessing_service import normalize_columns


def _find_col(df: pd.DataFrame, names: list[str]) -> str | None:
    return next((name for name in names if name in df.columns), None)


def analyze_fundamental(df: pd.DataFrame, per_wajar: float = 8.0) -> Dict[str, Any]:
    data = normalize_columns(df)
    required = {
        "year": ["year", "tahun", "periode"],
        "net_income": ["net_income", "laba_bersih"],
        "total_equity": ["total_equity", "equity", "ekuitas"],
        "total_assets": ["total_assets", "aset_total", "assets"],
        "total_liabilities": ["total_liabilities", "liabilities", "kewajiban_total"],
        "shares_outstanding": ["shares_outstanding", "saham_beredar", "shares"],
        "market_price": ["market_price", "harga_pasar", "harga_saham", "close"],
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

    work["eps"] = work["net_income"] / work["shares_outstanding"]
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

    rows = []
    for _, row in work.iterrows():
        rows.append({
            "year": str(row["year"]),
            "eps": float(row["eps"]),
            "per": float(row["per"]),
            "roe": float(row["roe"]),
            "roa": float(row["roa"]),
            "der": float(row["der"]),
            "bvps": float(row["bvps"]),
            "pbv": float(row["pbv"]),
            "market_price": float(row["market_price"]),
            "intrinsic_value": float(row["intrinsic_value"]),
            "valuation_gap": float(row["valuation_gap"]),
        })

    return {
        "per_wajar": float(per_wajar),
        "latest_year": str(latest["year"]),
        "status": status,
        "latest": rows[-1],
        "rows": rows,
        "interpretation": [
            "ROE menunjukkan efisiensi perusahaan dalam menghasilkan laba dari ekuitas.",
            "DER menunjukkan struktur pendanaan dan tingkat ketergantungan terhadap liabilitas.",
            "PER dan PBV membantu membaca apakah harga saham relatif mahal atau murah terhadap laba dan nilai buku.",
        ],
        "summary": f"Berdasarkan nilai intrinsik EPS x PER wajar, TLKM berada pada kondisi {status}.",
    }
