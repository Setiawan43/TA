"""
Preservation Property Tests
============================
**Validates: Requirements 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

Tujuan test ini adalah untuk MEREKAM BASELINE PERILAKU protected endpoints SEBELUM fix.

Metodologi observation-first:
  - Amati perilaku kode unfixed
  - Rekam sebagai property-based test
  - Test ini HARUS PASS baik pada kode unfixed MAUPUN setelah fix diterapkan
  - Jika test gagal setelah fix → ada regresi (fix menyentuh sesuatu yang tidak boleh berubah)

OBSERVASI PADA KODE UNFIXED:
  - POST /upload/price        dengan X-Role: visitor → HTTP 403 ✓
  - POST /upload/financial    dengan X-Role: visitor → HTTP 403 ✓
  - DELETE /data/files/x.csv  dengan X-Role: visitor → HTTP 403 ✓
  - GET /data/files            dengan X-Role: visitor → HTTP 403 ✓
  - POST /analyze/arima        dengan X-Role: admin   → HTTP 200 ✓ (admin tetap bisa analisis)

Property yang diuji:
  Property 2: Preservation — Protected Endpoints Tetap Menolak Non-Admin
  - Untuk SEMUA role string bukan "admin": upload/delete/list-files SHALL 403
  - Admin tetap bisa mengakses semua endpoint yang memang untuknya
  - verify_admin: "admin" → pass, selain itu → 403

EXPECTED OUTCOME:
  - Pada kode UNFIXED: semua test PASS (baseline terkonfirmasi)
  - Setelah fix (task 3): semua test TETAP PASS (tidak ada regresi)
"""

import io
import pytest
from fastapi import HTTPException
from httpx import AsyncClient, ASGITransport
from hypothesis import given, settings, HealthCheck
from hypothesis import strategies as st

from app.main import app, verify_admin

EXPECTED_403_DETAIL = "Akses ditolak: Hanya Admin yang dapat mengunggah atau memproses data."

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _make_csv_file(filename: str = "test.csv") -> dict:
    """Buat multipart form-data file upload minimal untuk pytest."""
    content = b"date,close\n2024-01-01,3000\n2024-01-02,3100\n"
    return {"file": (filename, io.BytesIO(content), "text/csv")}


def _assert_403(response, endpoint: str, role: str) -> None:
    assert response.status_code == 403, (
        f"Expected 403 for {endpoint} with role={role!r}, "
        f"got {response.status_code}. Response: {response.text}"
    )
    assert response.json()["detail"] == EXPECTED_403_DETAIL


# ─── Unit Tests: verify_admin langsung ────────────────────────────────────────

def test_verify_admin_passes_for_admin():
    """verify_admin tidak melempar exception untuk role 'admin'."""
    # Tidak boleh raise — jika raise maka test gagal
    try:
        verify_admin(x_role="admin")
    except HTTPException as exc:
        pytest.fail(
            f"verify_admin melempar HTTPException untuk role 'admin': {exc.detail}"
        )


def test_verify_admin_raises_for_visitor():
    """verify_admin harus melempar HTTP 403 untuk role 'visitor'."""
    with pytest.raises(HTTPException) as exc_info:
        verify_admin(x_role="visitor")
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == EXPECTED_403_DETAIL


def test_verify_admin_raises_for_empty_string():
    """verify_admin harus melempar HTTP 403 untuk role string kosong."""
    with pytest.raises(HTTPException) as exc_info:
        verify_admin(x_role="")
    assert exc_info.value.status_code == 403


def test_verify_admin_raises_for_none():
    """verify_admin harus melempar HTTP 403 ketika tidak ada header (None)."""
    with pytest.raises(HTTPException) as exc_info:
        verify_admin(x_role=None)
    assert exc_info.value.status_code == 403


def test_verify_admin_raises_for_random_string():
    """verify_admin harus melempar HTTP 403 untuk string acak selain 'admin'."""
    for role in ["user", "superuser", "ADMIN", "Admin", "adm1n", "guest", "root"]:
        with pytest.raises(HTTPException) as exc_info:
            verify_admin(x_role=role)
        assert exc_info.value.status_code == 403, (
            f"Expected 403 for role={role!r}, got {exc_info.value.status_code}"
        )


# ─── Observation Tests: Perilaku Baseline Protected Endpoints ─────────────────

@pytest.mark.asyncio
async def test_upload_price_visitor_returns_403():
    """
    OBSERVASI: POST /upload/price dengan X-Role: visitor → HTTP 403.
    Behavior ini TIDAK BOLEH berubah setelah fix.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/upload/price",
            headers={"X-Role": "visitor"},
            files=_make_csv_file("price.csv"),
        )
    _assert_403(response, "/upload/price", "visitor")


@pytest.mark.asyncio
async def test_upload_financial_visitor_returns_403():
    """
    OBSERVASI: POST /upload/financial dengan X-Role: visitor → HTTP 403.
    Behavior ini TIDAK BOLEH berubah setelah fix.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/upload/financial",
            headers={"X-Role": "visitor"},
            files=_make_csv_file("financial.csv"),
        )
    _assert_403(response, "/upload/financial", "visitor")


@pytest.mark.asyncio
async def test_delete_file_visitor_returns_403():
    """
    OBSERVASI: DELETE /data/files/test.csv dengan X-Role: visitor → HTTP 403.
    403 guard diperiksa SEBELUM pengecekan keberadaan file, jadi file tidak perlu ada.
    Behavior ini TIDAK BOLEH berubah setelah fix.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.delete(
            "/data/files/test.csv",
            headers={"X-Role": "visitor"},
        )
    _assert_403(response, "DELETE /data/files/test.csv", "visitor")


@pytest.mark.asyncio
async def test_list_files_visitor_returns_403():
    """
    OBSERVASI: GET /data/files dengan X-Role: visitor → HTTP 403.
    Behavior ini TIDAK BOLEH berubah setelah fix.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get(
            "/data/files",
            headers={"X-Role": "visitor"},
        )
    _assert_403(response, "GET /data/files", "visitor")


@pytest.mark.asyncio
async def test_upload_price_no_role_returns_403():
    """
    POST /upload/price tanpa header X-Role (None) → HTTP 403.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/upload/price",
            files=_make_csv_file("price.csv"),
        )
    _assert_403(response, "/upload/price", None)


@pytest.mark.asyncio
async def test_list_files_no_role_returns_403():
    """
    GET /data/files tanpa header X-Role (None) → HTTP 403.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/data/files")
    _assert_403(response, "GET /data/files", None)


# ─── Property-Based Tests: Hypothesis ─────────────────────────────────────────


# Strategy: ASCII printable text excluding "admin".
# HTTP headers only accept ASCII bytes, so we constrain to printable ASCII chars (0x20–0x7E).
# This covers empty string, spaces, alphanumeric, symbols — a realistic role-string space.
NON_ADMIN_ASCII_ROLE = st.text(
    alphabet=st.characters(min_codepoint=0x20, max_codepoint=0x7E),
    min_size=0,
    max_size=40,
).filter(lambda r: r != "admin")


@pytest.mark.asyncio
@given(role=NON_ADMIN_ASCII_ROLE)
@settings(
    max_examples=30,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)
async def test_property_upload_price_non_admin_always_403(role: str):
    """
    **Validates: Requirements 2.4, 3.5**

    Property: Untuk SEMUA ASCII role string yang bukan "admin",
    POST /upload/price SHALL mengembalikan HTTP 403.

    Strategy: ASCII printable text (excluding "admin") — mencakup string kosong,
    alphanumeric, simbol; sesuai batasan valid HTTP header value.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/upload/price",
            headers={"X-Role": role},
            files=_make_csv_file("price.csv"),
        )
    assert response.status_code == 403, (
        f"Property violation: POST /upload/price dengan role={role!r} "
        f"mengembalikan {response.status_code}, bukan 403. "
        f"Response: {response.text}"
    )


@pytest.mark.asyncio
@given(role=NON_ADMIN_ASCII_ROLE)
@settings(
    max_examples=30,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)
async def test_property_upload_financial_non_admin_always_403(role: str):
    """
    **Validates: Requirements 2.5, 3.5**

    Property: Untuk SEMUA ASCII role string yang bukan "admin",
    POST /upload/financial SHALL mengembalikan HTTP 403.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.post(
            "/upload/financial",
            headers={"X-Role": role},
            files=_make_csv_file("financial.csv"),
        )
    assert response.status_code == 403, (
        f"Property violation: POST /upload/financial dengan role={role!r} "
        f"mengembalikan {response.status_code}, bukan 403. "
        f"Response: {response.text}"
    )


@pytest.mark.asyncio
@given(role=NON_ADMIN_ASCII_ROLE)
@settings(
    max_examples=30,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)
async def test_property_list_files_non_admin_always_403(role: str):
    """
    **Validates: Requirements 3.8**

    Property: Untuk SEMUA ASCII role string yang bukan "admin",
    GET /data/files SHALL mengembalikan HTTP 403.
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get(
            "/data/files",
            headers={"X-Role": role},
        )
    assert response.status_code == 403, (
        f"Property violation: GET /data/files dengan role={role!r} "
        f"mengembalikan {response.status_code}, bukan 403. "
        f"Response: {response.text}"
    )


@pytest.mark.asyncio
@given(
    filename=st.text(
        alphabet=st.characters(whitelist_categories=("Ll", "Lu", "Nd"), whitelist_characters="._-"),
        min_size=1,
        max_size=30,
    ).filter(lambda f: bool(f.strip())),
    role=NON_ADMIN_ASCII_ROLE,
)
@settings(
    max_examples=30,
    suppress_health_check=[HealthCheck.function_scoped_fixture],
)
async def test_property_delete_file_non_admin_always_403(filename: str, role: str):
    """
    **Validates: Requirements 2.6, 3.6**

    Property: Untuk SEMUA ASCII role string yang bukan "admin",
    DELETE /data/files/{filename} SHALL mengembalikan HTTP 403,
    tanpa memandang nama file (403 guard diperiksa sebelum file lookup).
    """
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.delete(
            f"/data/files/{filename}",
            headers={"X-Role": role},
        )
    assert response.status_code == 403, (
        f"Property violation: DELETE /data/files/{filename!r} dengan role={role!r} "
        f"mengembalikan {response.status_code}, bukan 403. "
        f"Response: {response.text}"
    )
