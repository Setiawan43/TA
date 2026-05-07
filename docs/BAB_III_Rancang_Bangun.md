# BAB III - Rancang Bangun Sistem

## 3.1 Gambaran Umum Sistem
Sistem yang dibangun merupakan aplikasi berbasis web untuk membandingkan prediksi harga saham PT Telkom Indonesia Tbk (TLKM) menggunakan metode ARIMA dan analisis fundamental saham. Sistem ini berfungsi sebagai alat bantu analisis agar pengguna dapat melihat prediksi harga saham jangka pendek dan kondisi fundamental perusahaan dalam satu dashboard.

## 3.2 Arsitektur Sistem
Sistem menggunakan arsitektur client-server. Frontend React digunakan sebagai antarmuka pengguna, backend FastAPI digunakan untuk proses perhitungan, dan SQLite digunakan untuk menyimpan riwayat analisis.

## 3.3 Modul Sistem
1. Modul upload data.
2. Modul validasi data.
3. Modul preprocessing data.
4. Modul prediksi ARIMA.
5. Modul analisis fundamental.
6. Modul perbandingan hasil.
7. Modul riwayat dan laporan.

## 3.4 Alur Sistem
Pengguna mengunggah CSV harga saham dan CSV laporan keuangan. Sistem melakukan validasi dan preprocessing. Data harga saham diproses dengan ARIMA, sedangkan data laporan keuangan digunakan untuk menghitung rasio fundamental. Hasil kedua metode ditampilkan dalam dashboard berupa grafik, tabel, dan rekomendasi akhir.

## 3.5 Output Sistem
Output sistem meliputi grafik aktual vs prediksi, nilai MAE, MSE, RMSE, MAPE, tabel rasio fundamental, status valuasi saham, dan rekomendasi akhir berdasarkan konteks jangka pendek serta jangka menengah-panjang.
