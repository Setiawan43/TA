# Visitor Analysis Access Bugfix Design

## Overview

Tiga endpoint analisis (`/analyze/arima`, `/analyze/fundamental`, `/analyze/compare`) secara keliru
menggunakan `dependencies=[Depends(verify_admin)]`, sehingga pengunjung (non-admin) mendapat HTTP 403
saat mencoba menjalankan analisis. Padahal pembatasan akses admin seharusnya hanya berlaku untuk
operasi write (upload dan delete file CSV).

Fix yang diperlukan sangat minimal: hapus `dependencies=[Depends(verify_admin)]` dari ketiga decorator
endpoint analisis tersebut di `backend/app/main.py`. Tidak ada perubahan pada frontend maupun pada
endpoint upload/delete/list-files.

## Glossary

- **Bug_Condition (C)**: Kondisi yang memicu bug — request ke endpoint analisis dikirim oleh pengguna
  dengan `x_role` bukan `"admin"`.
- **Property (P)**: Perilaku yang diinginkan — endpoint analisis mengembalikan HTTP 200 dengan hasil
  analisis, tanpa memandang role pengirim.
- **Preservation**: Perilaku yang TIDAK boleh berubah oleh fix ini — endpoint upload, delete, dan
  list-files tetap menolak non-admin dengan HTTP 403; endpoint analisis tetap berfungsi normal untuk admin.
- **verify_admin**: Fungsi dependency FastAPI di `backend/app/main.py` yang memeriksa header `X-Role`;
  melempar HTTPException 403 jika nilainya bukan `"admin"`.
- **analyze endpoints**: Tiga endpoint POST yang menjalankan komputasi — `/analyze/arima`,
  `/analyze/fundamental`, dan `/analyze/compare`.
- **protected endpoints**: Endpoint yang memang harus dibatasi admin — `/upload/price`,
  `/upload/financial`, `/data/files` (GET), `/data/files/{filename}` (DELETE).

## Bug Details

### Bug Condition

Bug terpicu ketika pengguna dengan role selain `"admin"` memanggil salah satu dari tiga endpoint
analisis. FastAPI mengevaluasi dependency `verify_admin` sebelum handler endpoint dijalankan,
sehingga request langsung ditolak 403 tanpa menyentuh logika analisis.

**Formal Specification:**
```
FUNCTION isBugCondition(request)
  INPUT: request berisi header X-Role dan target endpoint
  OUTPUT: boolean

  RETURN request.x_role != "admin"
         AND request.endpoint IN ["/analyze/arima",
                                   "/analyze/fundamental",
                                   "/analyze/compare"]
END FUNCTION
```

### Examples

- **Contoh 1**: Pengunjung POST `/analyze/arima` → HTTP 403 "Akses ditolak: Hanya Admin yang dapat
  mengunggah atau memproses data." *(seharusnya HTTP 200 dengan hasil proyeksi ARIMA)*
- **Contoh 2**: Pengunjung POST `/analyze/fundamental` → HTTP 403 *(seharusnya HTTP 200 dengan hasil
  evaluasi fundamental)*
- **Contoh 3**: Pengunjung POST `/analyze/compare` → HTTP 403 *(seharusnya HTTP 200 dengan hasil
  rekomendasi gabungan)*
- **Edge case**: Pengunjung POST `/upload/price` → HTTP 403 *(ini perilaku benar, tidak boleh berubah)*

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Upload file CSV (`/upload/price`, `/upload/financial`) tetap mengembalikan HTTP 403 untuk non-admin.
- Delete file (`/data/files/{filename}`) tetap mengembalikan HTTP 403 untuk non-admin.
- List files (`/data/files`) tetap mengembalikan HTTP 403 untuk non-admin.
- Admin tetap dapat mengakses semua endpoint analisis maupun upload/delete tanpa gangguan.
- Logika komputasi analisis (ARIMA, fundamental, compare) tidak berubah sama sekali.

**Scope:**
Semua request yang TIDAK memenuhi `isBugCondition` (yaitu: request ke endpoint analisis oleh admin,
atau request ke endpoint upload/delete/list-files oleh siapapun) harus menghasilkan respons yang
identik dengan sebelum fix diterapkan.

## Hypothesized Root Cause

Berdasarkan kode di `backend/app/main.py`, root cause sudah dapat dipastikan (bukan hipotesis):

1. **Salah pasang dependency**: Decorator ketiga endpoint analisis menggunakan
   `dependencies=[Depends(verify_admin)]` — sama persis dengan endpoint upload/delete — padahal
   analisis seharusnya terbuka untuk semua role.
   ```python
   # Baris yang keliru (sekarang):
   @app.post("/analyze/arima", dependencies=[Depends(verify_admin)])
   @app.post("/analyze/fundamental", dependencies=[Depends(verify_admin)])
   @app.post("/analyze/compare", dependencies=[Depends(verify_admin)])
   ```

2. **Tidak ada indikasi masalah lain**: Fungsi `verify_admin`, logika analisis, frontend, dan database
   semuanya benar. Tidak ada bug sekunder.

## Correctness Properties

Property 1: Bug Condition - Endpoint Analisis Dapat Diakses Pengunjung

_For any_ request ke `/analyze/arima`, `/analyze/fundamental`, atau `/analyze/compare` dimana
`isBugCondition(request)` bernilai `true` (yaitu `x_role != "admin"`), endpoint yang telah diperbaiki
SHALL mengembalikan HTTP 200 beserta hasil analisis yang valid, tanpa melempar HTTPException 403.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Protected Endpoints Tetap Membatasi Non-Admin

_For any_ request dimana `isBugCondition(request)` bernilai `false` — termasuk request ke endpoint
upload/delete/list-files oleh siapapun, atau request ke endpoint analisis oleh admin — endpoint yang
telah diperbaiki SHALL menghasilkan respons yang identik dengan kode sebelum fix, mempertahankan
seluruh pembatasan akses dan perilaku fungsional yang sudah ada.

**Validates: Requirements 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8**

## Fix Implementation

### Changes Required

**File**: `backend/app/main.py`

**Specific Changes**:

1. **Hapus dependency dari `/analyze/arima`**:
   ```python
   # Sebelum:
   @app.post("/analyze/arima", dependencies=[Depends(verify_admin)])

   # Sesudah:
   @app.post("/analyze/arima")
   ```

2. **Hapus dependency dari `/analyze/fundamental`**:
   ```python
   # Sebelum:
   @app.post("/analyze/fundamental", dependencies=[Depends(verify_admin)])

   # Sesudah:
   @app.post("/analyze/fundamental")
   ```

3. **Hapus dependency dari `/analyze/compare`**:
   ```python
   # Sebelum:
   @app.post("/analyze/compare", dependencies=[Depends(verify_admin)])

   # Sesudah:
   @app.post("/analyze/compare")
   ```

4. **Tidak ada perubahan lain**: Endpoint upload, delete, list-files, komentar seksi, dan semua
   logika bisnis lainnya tetap tidak disentuh.

**Catatan**: Fungsi `verify_admin` sendiri tidak dihapus karena masih digunakan oleh endpoint
yang memang harus dilindungi.

## Testing Strategy

### Validation Approach

Strategi pengujian mengikuti dua fase: pertama, jalankan tes eksplorasi pada kode yang **belum
diperbaiki** untuk mengonfirmasi bug dan memahami dampaknya; kedua, jalankan tes fix checking dan
preservation checking pada kode yang **sudah diperbaiki** untuk memverifikasi kebenaran.

### Exploratory Bug Condition Checking

**Goal**: Surfacing counterexample yang menunjukkan bug pada kode unfixed. Konfirmasi bahwa
`verify_admin` memang menjadi penyebab 403 untuk ketiga endpoint analisis.

**Test Plan**: Kirim POST request ke masing-masing endpoint analisis dengan header `X-Role: visitor`
(atau tanpa header), lalu assert bahwa respons HTTP 403 diterima. Jalankan pada kode **UNFIXED**
untuk memverifikasi bug memang ada.

**Test Cases**:
1. **ARIMA Visitor Test**: POST `/analyze/arima` dengan `X-Role: visitor` → assert HTTP 403
   *(akan gagal setelah fix diterapkan, membuktikan fix bekerja)*
2. **Fundamental Visitor Test**: POST `/analyze/fundamental` dengan `X-Role: visitor` → assert HTTP 403
3. **Compare Visitor Test**: POST `/analyze/compare` dengan `X-Role: visitor` → assert HTTP 403
4. **No Header Test**: POST `/analyze/arima` tanpa header `X-Role` → assert HTTP 403
   *(header kosong dievaluasi sebagai None oleh verify_admin, juga ter-block)*

**Expected Counterexamples**:
- Ketiga endpoint mengembalikan `{"detail": "Akses ditolak: Hanya Admin yang dapat mengunggah atau memproses data."}` dengan status 403.
- Root cause terkonfirmasi: kehadiran `dependencies=[Depends(verify_admin)]` pada decorator.

### Fix Checking

**Goal**: Verifikasi bahwa untuk semua input dimana `isBugCondition` bernilai true, endpoint yang
diperbaiki menghasilkan HTTP 200 dengan hasil analisis yang valid.

**Pseudocode:**
```
FOR ALL request WHERE isBugCondition(request) DO
  response := call_fixed_endpoint(request)
  ASSERT response.status_code == 200
  ASSERT response.body contains valid analysis result
END FOR
```

### Preservation Checking

**Goal**: Verifikasi bahwa untuk semua input dimana `isBugCondition` bernilai false, endpoint yang
diperbaiki menghasilkan respons yang identik dengan kode original.

**Pseudocode:**
```
FOR ALL request WHERE NOT isBugCondition(request) DO
  ASSERT original_endpoint(request) == fixed_endpoint(request)
END FOR
```

**Testing Approach**: Property-based testing direkomendasikan untuk preservation checking karena:
- Menghasilkan banyak kombinasi role/endpoint secara otomatis.
- Menangkap edge case (role string aneh, header null, dll.) yang sulit dicakup manual.
- Memberikan jaminan kuat bahwa tidak ada regresi di luar skenario yang terpikirkan.

**Test Plan**: Amati perilaku endpoint protected pada kode unfixed (harus 403 untuk non-admin),
lalu tulis property-based test yang memverifikasi perilaku ini tidak berubah setelah fix.

**Test Cases**:
1. **Upload Protected**: POST `/upload/price` dengan `X-Role: visitor` → TETAP HTTP 403 setelah fix.
2. **Delete Protected**: DELETE `/data/files/test.csv` dengan `X-Role: visitor` → TETAP HTTP 403.
3. **List Files Protected**: GET `/data/files` dengan `X-Role: visitor` → TETAP HTTP 403.
4. **Admin Analyze Still Works**: POST `/analyze/arima` dengan `X-Role: admin` → TETAP HTTP 200.
5. **Admin Upload Still Works**: POST `/upload/price` dengan `X-Role: admin` → TETAP HTTP 200.

### Unit Tests

- Test `verify_admin` secara langsung: assert 403 untuk role apapun selain `"admin"`, assert pass untuk `"admin"`.
- Test bahwa endpoint analisis mengembalikan 200 untuk berbagai kombinasi role (`"visitor"`, `""`, `None`, `"user"`).
- Test edge case: POST `/analyze/arima` dengan body valid tapi tanpa header `X-Role` → setelah fix harus 200 (tidak ada guard).

### Property-Based Tests

- Generate random string sebagai nilai `X-Role` header; untuk endpoint analisis, assert semua menghasilkan 200 (selama body valid); untuk endpoint protected, assert semua non-`"admin"` menghasilkan 403.
- Generate berbagai kombinasi (endpoint, role) dan verifikasi bahwa hanya endpoint protected yang menolak non-admin.
- Verifikasi bahwa respons admin pada endpoint analisis tidak berubah antara kode sebelum dan sesudah fix.

### Integration Tests

- Test full flow: visitor login → pilih file CSV yang sudah diupload admin → jalankan analisis → terima hasil (HTTP 200).
- Test bahwa visitor tidak bisa upload setelah fix (403 tetap muncul).
- Test bahwa admin masih bisa melakukan semua operasi (upload, analisis, delete) setelah fix tanpa gangguan.
