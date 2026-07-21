# Bugfix Requirements Document

## Introduction

Pengunjung (visitor/non-admin) tidak dapat menjalankan analisis ARIMA, analisis fundamental, maupun analisis gabungan (compare) karena ketiga endpoint tersebut secara keliru menggunakan `dependencies=[Depends(verify_admin)]`. Padahal, pembatasan akses admin seharusnya hanya berlaku untuk operasi upload dan delete file CSV. Akibatnya, pengunjung mendapatkan error 403 "Akses ditolak: Hanya Admin yang dapat mengunggah atau memproses data." setiap kali mencoba menjalankan analisis menggunakan data yang sudah diupload admin.

## Bug Analysis

### Current Behavior (Defect)

Kondisi bug terpicu ketika pengguna dengan role selain `"admin"` memanggil endpoint analisis.

1.1 WHEN pengunjung mengirim POST request ke `/analyze/arima` THEN sistem mengembalikan HTTP 403 dengan pesan "Akses ditolak: Hanya Admin yang dapat mengunggah atau memproses data."

1.2 WHEN pengunjung mengirim POST request ke `/analyze/fundamental` THEN sistem mengembalikan HTTP 403 dengan pesan "Akses ditolak: Hanya Admin yang dapat mengunggah atau memproses data."

1.3 WHEN pengunjung mengirim POST request ke `/analyze/compare` THEN sistem mengembalikan HTTP 403 dengan pesan "Akses ditolak: Hanya Admin yang dapat mengunggah atau memproses data."

### Expected Behavior (Correct)

2.1 WHEN pengunjung mengirim POST request ke `/analyze/arima` dengan path file CSV yang valid THEN sistem SHALL menjalankan analisis ARIMA dan mengembalikan hasil proyeksi (HTTP 200)

2.2 WHEN pengunjung mengirim POST request ke `/analyze/fundamental` dengan path file CSV yang valid THEN sistem SHALL menjalankan analisis fundamental dan mengembalikan hasil evaluasi (HTTP 200)

2.3 WHEN pengunjung mengirim POST request ke `/analyze/compare` dengan path file CSV harga dan keuangan yang valid THEN sistem SHALL menjalankan analisis gabungan dan mengembalikan hasil rekomendasi (HTTP 200)

2.4 WHEN pengunjung mengirim POST request ke `/upload/price` THEN sistem SHALL mengembalikan HTTP 403 (upload tetap dibatasi hanya admin)

2.5 WHEN pengunjung mengirim POST request ke `/upload/financial` THEN sistem SHALL mengembalikan HTTP 403 (upload tetap dibatasi hanya admin)

2.6 WHEN pengunjung mengirim DELETE request ke `/data/files/{filename}` THEN sistem SHALL mengembalikan HTTP 403 (delete tetap dibatasi hanya admin)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN admin mengirim POST request ke `/analyze/arima` THEN sistem SHALL CONTINUE TO menjalankan analisis ARIMA dan mengembalikan hasil proyeksi (HTTP 200)

3.2 WHEN admin mengirim POST request ke `/analyze/fundamental` THEN sistem SHALL CONTINUE TO menjalankan analisis fundamental dan mengembalikan hasil evaluasi (HTTP 200)

3.3 WHEN admin mengirim POST request ke `/analyze/compare` THEN sistem SHALL CONTINUE TO menjalankan analisis gabungan dan mengembalikan hasil rekomendasi (HTTP 200)

3.4 WHEN admin mengirim POST request ke `/upload/price` dengan file CSV yang valid THEN sistem SHALL CONTINUE TO menyimpan file dan mengembalikan metadata (HTTP 200)

3.5 WHEN admin mengirim POST request ke `/upload/financial` dengan file CSV yang valid THEN sistem SHALL CONTINUE TO menyimpan file dan mengembalikan metadata (HTTP 200)

3.6 WHEN admin mengirim DELETE request ke `/data/files/{filename}` THEN sistem SHALL CONTINUE TO menghapus file dan mengembalikan konfirmasi (HTTP 200)

3.7 WHEN admin mengakses GET `/data/files` THEN sistem SHALL CONTINUE TO mengembalikan daftar file yang terupload (HTTP 200)

3.8 WHEN pengunjung mengakses GET `/data/files` THEN sistem SHALL CONTINUE TO mengembalikan HTTP 403 (daftar file tetap hanya untuk admin)
