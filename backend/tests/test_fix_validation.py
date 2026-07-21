"""
Fix Validation Test
===================
**Validates: Requirements 2.1, 2.2, 2.3**

Tujuan test ini adalah untuk MENGKONFIRMASI bahwa fix bekerja dengan benar:
endpoint analisis sekarang dapat diakses oleh non-admin (visitor) dan mengembalikan HTTP 200.

Kondisi yang divalidasi:
  - POST /analyze/arima  dengan X-Role: visitor  → HTTP 200
  - POST /analyze/fundamental dengan X-Role: visitor  → HTTP 200
  - POST /analyze/compare dengan X-Role: visitor  → HTTP 200
  - POST /analyze/arima tanpa header X-Role → HTTP 200 (tidak ada guard lagi)

EXPECTED OUTCOME (kode FIXED): Semua test PASS.
"""

import os
import pytest
from httpx import AsyncClient, ASGITransport

from app.main import app

# ─── Paths ke file CSV nyata ──────────────────────────────────────────────────
# Gunakan sample dataset yang sudah memiliki kolom yang benar (date/close dan financial columns)
_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DATASET_DIR = os.path.normpath(os.path.join(_BASE_DIR, "..", "dataset"))

PRICE_CSV_PATH = os.path.join(_DATASET_DIR, "sample_price_tlkm.csv")
FINANCIAL_CSV_PATH = os.path.join(_DATASET_DIR, "sample_financial_tlkm.csv")

# Request bodies dengan path CSV nyata
ARIMA_BODY = {
    "price_csv_path": PRICE_CSV_PATH,
    "horizon": 30,
    "train_ratio": 0.8,
}

FUNDAMENTAL_BODY = {
    "financial_csv_path": FINANCIAL_CSV_PATH,
    "per_wajar": 8.0,
}

COMPARE_BODY = {
    "price_csv_path": PRICE_CSV_PATH,
    "financial_csv_path": FINANCIAL_CSV_PATH,
    "horizon": 30,
    "train_ratio": 0.8,
    "per_wajar": 8.0,
}


@pytest.mark.asyncio
async def test_arima_visitor_returns_200():
    """
    POST /analyze/arima dengan X-Role: visitor harus mengembalikan HTTP 200 setelah fix.
    Bug telah diperbaiki — verify_admin tidak lagi dipasang pada endpoint ini.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/analyze/arima",
            json=ARIMA_BODY,
            headers={"X-Role": "visitor"},
        )

    assert response.status_code == 200, (
        f"Expected 200 (fix validated), got {response.status_code}. "
        f"Response: {response.text}"
    )
    data = response.json()
    # Verifikasi bahwa respons mengandung hasil analisis yang valid
    assert "forecast" in data or "scenarios" in data or "preprocessing" in data, (
        f"Response tidak mengandung hasil analisis ARIMA yang valid: {data}"
    )


@pytest.mark.asyncio
async def test_fundamental_visitor_returns_200():
    """
    POST /analyze/fundamental dengan X-Role: visitor harus mengembalikan HTTP 200 setelah fix.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/analyze/fundamental",
            json=FUNDAMENTAL_BODY,
            headers={"X-Role": "visitor"},
        )

    assert response.status_code == 200, (
        f"Expected 200 (fix validated), got {response.status_code}. "
        f"Response: {response.text}"
    )
    data = response.json()
    # Verifikasi bahwa respons mengandung hasil analisis fundamental yang valid
    assert "financial_csv_path" in data or "per_wajar" in data or "valuation" in data or "recommendation" in data, (
        f"Response tidak mengandung hasil analisis fundamental yang valid: {data}"
    )


@pytest.mark.asyncio
async def test_compare_visitor_returns_200():
    """
    POST /analyze/compare dengan X-Role: visitor harus mengembalikan HTTP 200 setelah fix.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/analyze/compare",
            json=COMPARE_BODY,
            headers={"X-Role": "visitor"},
        )

    assert response.status_code == 200, (
        f"Expected 200 (fix validated), got {response.status_code}. "
        f"Response: {response.text}"
    )
    data = response.json()
    # Verifikasi bahwa respons mengandung hasil compare yang valid
    assert "arima" in data or "fundamental" in data or "recommendation" in data, (
        f"Response tidak mengandung hasil analisis compare yang valid: {data}"
    )


@pytest.mark.asyncio
async def test_arima_no_role_header_returns_200():
    """
    POST /analyze/arima tanpa header X-Role harus mengembalikan HTTP 200 setelah fix.
    Tidak ada guard lagi — request tanpa role diterima dan diproses normal.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/analyze/arima",
            json=ARIMA_BODY,
            # Tidak ada header X-Role sama sekali
        )

    assert response.status_code == 200, (
        f"Expected 200 (no role header — fix validated), got {response.status_code}. "
        f"Response: {response.text}"
    )
    data = response.json()
    assert "forecast" in data or "scenarios" in data or "preprocessing" in data, (
        f"Response tidak mengandung hasil analisis ARIMA yang valid: {data}"
    )
