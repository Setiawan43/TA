# TLKM ARIMA Fundamental Web

Sistem berbasis web untuk membandingkan prediksi harga saham PT Telkom Indonesia Tbk (TLKM) menggunakan metode ARIMA dan analisis fundamental saham.

## Fitur Utama
- Upload CSV harga saham TLKM dan laporan keuangan.
- Validasi dan preprocessing data.
- Prediksi harga saham jangka pendek menggunakan ARIMA.
- Evaluasi model dengan MAE, MSE, RMSE, dan MAPE.
- Analisis fundamental: EPS, PER, ROE, ROA, DER, BVPS, PBV, dan nilai intrinsik.
- Rekomendasi akhir berdasarkan konteks jangka pendek dan jangka menengah-panjang.
- Riwayat analisis menggunakan SQLite.
- Dashboard React dengan grafik, tabel, dan ringkasan rekomendasi.

## Struktur Project
```text
tlkm-arima-fundamental-web/
|-- backend/
|-- frontend/
|-- dataset/
|-- docs/
`-- laporan/
```

Baca `run_project.md` untuk cara menjalankan.
