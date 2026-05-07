from __future__ import annotations

from typing import Any, Dict


def build_recommendation(arima: Dict[str, Any], fundamental: Dict[str, Any]) -> Dict[str, Any]:
    mape = float(arima["metrics"].get("mape", 999.0))
    status = fundamental.get("status", "unknown")

    if mape <= 10:
        short_term = "ARIMA cukup relevan untuk prediksi jangka pendek karena nilai MAPE rendah."
    elif mape <= 20:
        short_term = "ARIMA masih dapat digunakan sebagai gambaran jangka pendek, tetapi akurasinya perlu diperhatikan."
    else:
        short_term = "ARIMA kurang kuat untuk dijadikan dasar tunggal karena nilai MAPE relatif tinggi."

    if status == "undervalued":
        long_term = "Analisis fundamental memberi sinyal positif untuk jangka menengah hingga panjang karena harga pasar di bawah nilai intrinsik."
    elif status == "overvalued":
        long_term = "Analisis fundamental memberi catatan risiko karena harga pasar berada di atas nilai intrinsik."
    else:
        long_term = "Analisis fundamental menunjukkan harga relatif wajar terhadap nilai intrinsik."

    if mape <= 15 and status == "undervalued":
        summary = "Sinyal analisis cukup kuat: ARIMA mendukung prediksi jangka pendek dan fundamental menunjukkan saham undervalued."
    elif mape > 20 and status == "overvalued":
        summary = "Sinyal analisis perlu diwaspadai: akurasi ARIMA rendah dan fundamental menunjukkan saham overvalued."
    else:
        summary = "Hasil akhir perlu dibaca berdasarkan konteks: ARIMA untuk jangka pendek, fundamental untuk keputusan menengah-panjang."

    return {
        "summary": summary,
        "short_term": short_term,
        "medium_long_term": long_term,
        "context_note": "ARIMA membaca pola historis harga, sedangkan fundamental membaca kondisi keuangan dan kewajaran harga saham.",
    }
