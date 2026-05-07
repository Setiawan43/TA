# Backend TLKM Analysis

Backend memakai FastAPI untuk upload CSV, validasi data, preprocessing, prediksi ARIMA, analisis fundamental, perbandingan hasil, dan penyimpanan riwayat ke SQLite.

Endpoint utama:
- `GET /health`
- `POST /upload/price`
- `POST /upload/financial`
- `POST /analyze/arima`
- `POST /analyze/fundamental`
- `POST /analyze/compare`
- `GET /history`
