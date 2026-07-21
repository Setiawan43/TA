# Implementation Plan

## Overview

Bugfix untuk menghapus `dependencies=[Depends(verify_admin)]` dari tiga endpoint analisis di `backend/app/main.py`. Fix sangat minimal (3 baris), tetapi divalidasi melalui pendekatan eksplorasi — tulis test sebelum fix untuk mengkonfirmasi bug, lalu verifikasi fix bekerja dan tidak memunculkan regresi.

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": ["1", "2"] },
    { "wave": 2, "tasks": ["3"] },
    { "wave": 3, "tasks": ["4"] }
  ]
}
```

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Endpoint Analisis Menolak Non-Admin (403)
  - **CRITICAL**: Test ini HARUS GAGAL setelah fix diterapkan — kegagalan pada kode unfixed mengkonfirmasi bug ada
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: Test ini mengenkode perilaku yang salah — ia akan memvalidasi bahwa bug sudah hilang ketika GAGAL setelah fix
  - **GOAL**: Surfacing counterexample yang membuktikan bug ada pada kode unfixed
  - **Scoped PBT Approach**: Scope properti ke kasus konkret yang gagal: request ke endpoint analisis dengan `x_role != "admin"`
  - Buat file `backend/tests/test_bug_condition.py` menggunakan `pytest` dan `httpx.AsyncClient` dengan ASGI transport
  - Test cases yang harus ditulis (jalankan pada kode **UNFIXED**):
    - `POST /analyze/arima` dengan header `X-Role: visitor` → assert HTTP **403** (ini yang terjadi sekarang, bug terkonfirmasi)
    - `POST /analyze/fundamental` dengan header `X-Role: visitor` → assert HTTP **403**
    - `POST /analyze/compare` dengan header `X-Role: visitor` → assert HTTP **403**
    - `POST /analyze/arima` tanpa header `X-Role` → assert HTTP **403** (None juga diblokir)
  - Jalankan test pada kode **UNFIXED** — **EXPECTED OUTCOME**: Test PASS (artinya bug memang ada)
  - Dokumentasikan counterexample: `POST /analyze/arima` dengan `X-Role: visitor` mengembalikan `{"detail": "Akses ditolak: Hanya Admin yang dapat mengunggah atau memproses data."}` status 403
  - Setelah fix diterapkan (task 3), test ini harus **GAGAL** — kegagalan membuktikan fix bekerja
  - Tandai task selesai setelah test ditulis, dijalankan, dan kegagalan (atau konfirmasi bug) didokumentasikan
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Protected Endpoints Tetap Menolak Non-Admin
  - **IMPORTANT**: Ikuti metodologi observation-first
  - **GOAL**: Pastikan baseline perilaku protected endpoints terekam sebelum fix, sehingga regresi dapat terdeteksi
  - Buat file `backend/tests/test_preservation.py` menggunakan `pytest`, `httpx.AsyncClient`, dan `hypothesis` untuk property-based testing
  - Langkah observation pada kode **UNFIXED**:
    - Amati: `POST /upload/price` dengan `X-Role: visitor` → HTTP 403
    - Amati: `POST /upload/financial` dengan `X-Role: visitor` → HTTP 403
    - Amati: `DELETE /data/files/test.csv` dengan `X-Role: visitor` → HTTP 403
    - Amati: `GET /data/files` dengan `X-Role: visitor` → HTTP 403
    - Amati: `POST /analyze/arima` dengan `X-Role: admin` → HTTP 200 (admin tetap bisa analisis)
  - Tulis property-based test menggunakan `hypothesis`:
    - **Property**: Untuk semua string role yang bukan `"admin"` (`strategy: st.text().filter(lambda r: r != "admin")`), request ke `/upload/price`, `/upload/financial`, `/data/files` (GET), `/data/files/{filename}` (DELETE) SHALL mengembalikan HTTP 403
    - **Property**: Untuk semua string role yang bukan `"admin"`, request ke endpoint **analisis** tetap menghasilkan respons yang sama sebelum dan sesudah fix (baseline preservation — tidak 403 karena guard dihapus, tetapi perilaku bisnis tidak berubah)
    - Unit test tambahan: `verify_admin` langsung → assert pass untuk `"admin"`, assert 403 untuk `"visitor"`, `""`, `None`, string acak
  - Jalankan test pada kode **UNFIXED** — **EXPECTED OUTCOME**: Test PASS (baseline terkonfirmasi)
  - Tandai task selesai setelah test ditulis, dijalankan, dan passing pada kode unfixed
  - _Requirements: 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 3. Fix — Hapus `dependencies=[Depends(verify_admin)]` dari 3 endpoint analisis

  - [x] 3.1 Implementasi fix di `backend/app/main.py`
    - Hapus `dependencies=[Depends(verify_admin)]` dari decorator `@app.post("/analyze/arima")`
    - Hapus `dependencies=[Depends(verify_admin)]` dari decorator `@app.post("/analyze/fundamental")`
    - Hapus `dependencies=[Depends(verify_admin)]` dari decorator `@app.post("/analyze/compare")`
    - Update komentar seksi dari `# ─── Analysis Endpoints (Admin only)` menjadi `# ─── Analysis Endpoints (All users)` agar konsisten
    - Jangan sentuh endpoint upload, delete, list-files, dan jangan hapus fungsi `verify_admin`
    - _Bug_Condition: `isBugCondition(request)` — `request.x_role != "admin"` AND `request.endpoint IN ["/analyze/arima", "/analyze/fundamental", "/analyze/compare"]`_
    - _Expected_Behavior: endpoint analisis mengembalikan HTTP 200 dengan hasil analisis valid untuk semua role_
    - _Preservation: upload/delete/list-files tetap HTTP 403 untuk non-admin; admin tetap bisa semua operasi_
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

  - [x] 3.2 Verify bug condition exploration test sekarang GAGAL (konfirmasi fix bekerja)
    - **Property 1: Expected Behavior** - Endpoint Analisis Dapat Diakses Non-Admin (200)
    - **IMPORTANT**: Jalankan ulang test yang SAMA dari task 1 — jangan tulis test baru
    - Test dari task 1 mengassert HTTP 403 — setelah fix, endpoint akan mengembalikan 200, sehingga test task 1 GAGAL
    - Kegagalan test task 1 ini adalah sinyal positif: bug sudah diperbaiki
    - Sebagai validasi tambahan, tulis/jalankan test eksplisit yang mengassert HTTP 200 untuk non-admin di ketiga endpoint analisis:
      - `POST /analyze/arima` dengan `X-Role: visitor` → assert HTTP **200**
      - `POST /analyze/fundamental` dengan `X-Role: visitor` → assert HTTP **200**
      - `POST /analyze/compare` dengan `X-Role: visitor` → assert HTTP **200**
      - `POST /analyze/arima` tanpa header `X-Role` → assert HTTP **200** (tidak ada guard lagi)
    - Jalankan pada kode **FIXED** — **EXPECTED OUTCOME**: Validasi 200 PASS (bug telah diperbaiki)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.3 Verify preservation tests masih PASS setelah fix
    - **Property 2: Preservation** - Protected Endpoints Tetap Membatasi Non-Admin
    - **IMPORTANT**: Jalankan ulang test yang SAMA dari task 2 — jangan tulis test baru
    - Jalankan `backend/tests/test_preservation.py` pada kode **FIXED**
    - **EXPECTED OUTCOME**: Semua test PASS (tidak ada regresi)
    - Konfirmasi: `/upload/price`, `/upload/financial`, `/data/files` (GET), `/data/files/{filename}` (DELETE) tetap 403 untuk non-admin
    - Konfirmasi: admin tetap bisa akses semua endpoint (analisis 200, upload 200, delete 200)
    - _Requirements: 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_

- [x] 4. Checkpoint — Pastikan semua test pass
  - Jalankan seluruh test suite: `pytest backend/tests/ -v`
  - Pastikan `test_preservation.py` semua PASS
  - Pastikan validasi 200 di task 3.2 semua PASS
  - Pastikan `test_bug_condition.py` (yang mengassert 403) GAGAL — ini adalah konfirmasi bahwa fix bekerja
  - Jika ada test yang unexpectedly fail, tanyakan kepada user sebelum melanjutkan
  - Tandai task selesai ketika hasil test konsisten dengan yang diharapkan di atas

## Notes

- Test files ditempatkan di `backend/tests/` (buat direktori jika belum ada, tambahkan `__init__.py` kosong)
- Gunakan `pytest-asyncio` dan `httpx[asyncio]` untuk async test client; `hypothesis` untuk property-based tests
- Jalankan test dengan: `cd backend && pytest tests/ -v`
- Task 1 (`test_bug_condition.py`) sengaja dirancang untuk PASS pada kode unfixed dan GAGAL setelah fix — ini adalah perilaku yang benar
- Jangan hapus fungsi `verify_admin` dari `main.py` karena masih dipakai oleh endpoint upload/delete/list-files
