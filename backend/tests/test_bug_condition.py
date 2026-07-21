"""
Bug Condition Exploration Test
==============================
**Validates: Requirements 1.1, 1.2, 1.3**

Tujuan test ini adalah untuk MENGKONFIRMASI bahwa bug ADA pada kode unfixed.

Kondisi bug (isBugCondition):
  - Request dikirim ke salah satu dari tiga endpoint analisis
  - Header X-Role bernilai bukan "admin" (atau tidak ada sama sekali)

PERILAKU YANG DIHARAPKAN SAAT DIJALANKAN:
  - Pada kode UNFIXED: semua test PASS — ini mengkonfirmasi bug ada (403 memang terjadi)
  - Setelah fix diterapkan (task 3): semua test GAGAL — ini membuktikan fix bekerja

COUNTEREXAMPLE YANG DIDOKUMENTASIKAN:
  - POST /analyze/arima  dengan X-Role: visitor  → HTTP 403
    {"detail": "Akses ditolak: Hanya Admin yang dapat mengunggah atau memproses data."}
  - POST /analyze/fundamental dengan X-Role: visitor  → HTTP 403
    {"detail": "Akses ditolak: Hanya Admin yang dapat mengunggah atau memproses data."}
  - POST /analyze/compare dengan X-Role: visitor  → HTTP 403
    {"detail": "Akses ditolak: Hanya Admin yang dapat mengunggah atau memproses data."}
  - POST /analyze/arima tanpa header X-Role (None) → HTTP 403
    {"detail": "Akses ditolak: Hanya Admin yang dapat mengunggah atau memproses data."}

ROOT CAUSE:
  Decorator ketiga endpoint analisis menggunakan `dependencies=[Depends(verify_admin)]`
  yang seharusnya TIDAK ADA — pembatasan admin hanya berlaku untuk upload/delete/list-files.
"""

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

from app.main import app

# Body minimal yang valid untuk setiap endpoint
# (nilai path tidak perlu ada di disk — verify_admin di-trigger SEBELUM handler dieksekusi)
ARIMA_BODY = {
    "price_csv_path": "dummy_price.csv",
    "horizon": 30,
    "train_ratio": 0.8,
}

FUNDAMENTAL_BODY = {
    "financial_csv_path": "dummy_financial.csv",
    "per_wajar": 8.0,
}

COMPARE_BODY = {
    "price_csv_path": "dummy_price.csv",
    "financial_csv_path": "dummy_financial.csv",
    "horizon": 30,
    "train_ratio": 0.8,
    "per_wajar": 8.0,
}

EXPECTED_ERROR_DETAIL = "Akses ditolak: Hanya Admin yang dapat mengunggah atau memproses data."


@pytest.mark.asyncio
async def test_arima_visitor_returns_403():
    """
    POST /analyze/arima dengan X-Role: visitor harus mengembalikan HTTP 403.
    Counterexample: {"detail": "Akses ditolak: Hanya Admin yang dapat mengunggah atau memproses data."}
    Test ini PASS pada kode unfixed (bug terkonfirmasi) dan GAGAL setelah fix.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/analyze/arima",
            json=ARIMA_BODY,
            headers={"X-Role": "visitor"},
        )

    assert response.status_code == 403, (
        f"Expected 403 (bug condition), got {response.status_code}. "
        "If this fails, the fix has been applied and the bug is gone."
    )
    assert response.json()["detail"] == EXPECTED_ERROR_DETAIL


@pytest.mark.asyncio
async def test_fundamental_visitor_returns_403():
    """
    POST /analyze/fundamental dengan X-Role: visitor harus mengembalikan HTTP 403.
    Test ini PASS pada kode unfixed (bug terkonfirmasi) dan GAGAL setelah fix.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/analyze/fundamental",
            json=FUNDAMENTAL_BODY,
            headers={"X-Role": "visitor"},
        )

    assert response.status_code == 403, (
        f"Expected 403 (bug condition), got {response.status_code}. "
        "If this fails, the fix has been applied and the bug is gone."
    )
    assert response.json()["detail"] == EXPECTED_ERROR_DETAIL


@pytest.mark.asyncio
async def test_compare_visitor_returns_403():
    """
    POST /analyze/compare dengan X-Role: visitor harus mengembalikan HTTP 403.
    Test ini PASS pada kode unfixed (bug terkonfirmasi) dan GAGAL setelah fix.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/analyze/compare",
            json=COMPARE_BODY,
            headers={"X-Role": "visitor"},
        )

    assert response.status_code == 403, (
        f"Expected 403 (bug condition), got {response.status_code}. "
        "If this fails, the fix has been applied and the bug is gone."
    )
    assert response.json()["detail"] == EXPECTED_ERROR_DETAIL


@pytest.mark.asyncio
async def test_arima_no_role_header_returns_403():
    """
    POST /analyze/arima tanpa header X-Role (None) harus mengembalikan HTTP 403.
    verify_admin memperlakukan None sebagai non-admin dan memblokir request.
    Test ini PASS pada kode unfixed (bug terkonfirmasi) dan GAGAL setelah fix.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/analyze/arima",
            json=ARIMA_BODY,
            # Tidak ada header X-Role sama sekali
        )

    assert response.status_code == 403, (
        f"Expected 403 (bug condition — no X-Role header treated as non-admin), "
        f"got {response.status_code}. "
        "If this fails, the fix has been applied and the bug is gone."
    )
    assert response.json()["detail"] == EXPECTED_ERROR_DETAIL
