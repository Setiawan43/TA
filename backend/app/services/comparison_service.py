from __future__ import annotations

from typing import Any, Dict


def build_arima_only_recommendation(arima: Dict[str, Any]) -> Dict[str, Any]:
    """Rekomendasi otomatis saat hanya data ARIMA tersedia."""
    mape = float(arima["metrics"].get("mape", 999.0))
    order = arima.get("model", {}).get("order", ["-", "-", "-"])
    order_str = f"ARIMA({','.join(str(x) for x in order)})"
    forecast = arima.get("forecast", [])
    last_price = arima.get("actual_tail", [{}])[-1].get("value", 0) if arima.get("actual_tail") else 0
    last_forecast = forecast[-1].get("value", 0) if forecast else 0
    horizon = arima.get("model", {}).get("horizon", 30)

    mape_label = "sangat baik (< 10%)" if mape < 10 else "baik (10–20%)" if mape < 20 else "cukup (> 20%)"

    if last_price and last_forecast:
        arah = "cenderung stabil" if abs(last_forecast - last_price) / last_price < 0.02 \
            else ("menguat" if last_forecast > last_price else "melemah")
    else:
        arah = "belum dapat ditentukan"

    summary = (
        f"Berdasarkan model {order_str} dengan MAPE {mape:.2f}% ({mape_label}), "
        f"prediksi harga saham TLKM dalam {horizon} hari ke depan {arah} "
        f"di kisaran {_fmt(last_forecast)}. "
        f"Untuk analisis lebih komprehensif, upload data laporan keuangan."
    )

    if mape <= 10:
        detail = "Model memiliki akurasi tinggi — hasil proyeksi dapat dijadikan referensi jangka pendek dengan tingkat kepercayaan yang baik."
    elif mape <= 20:
        detail = "Model memiliki akurasi yang dapat diterima — proyeksi dapat digunakan sebagai gambaran arah harga, namun tetap perlu kehati-hatian."
    else:
        detail = "Akurasi model relatif rendah — proyeksi sebaiknya digunakan sebagai salah satu indikator saja, bukan satu-satunya acuan keputusan."

    return {
        "type": "arima_only",
        "summary": summary,
        "short_term": detail,
        "medium_long_term": "Data fundamental belum tersedia. Upload laporan keuangan untuk mendapatkan analisis valuasi dan rekomendasi jangka menengah-panjang.",
        "context_note": "Analisis saat ini hanya berdasarkan data harga historis menggunakan model statistik ARIMA.",
    }


def build_fundamental_only_recommendation(fundamental: Dict[str, Any]) -> Dict[str, Any]:
    """Rekomendasi otomatis saat hanya data Fundamental tersedia."""
    status = fundamental.get("status", "unknown")
    latest = fundamental.get("latest", {})
    year = fundamental.get("latest_year", "-")
    per_wajar = fundamental.get("per_wajar", 8.0)
    intrinsic = latest.get("intrinsic_value", 0)
    market = latest.get("market_price", 0)
    roe = latest.get("roe", 0)
    der = latest.get("der", 0)

    if status == "undervalued":
        valuasi = f"harga pasar ({_fmt(market)}) berada di bawah nilai intrinsik ({_fmt(intrinsic)}), mengindikasikan saham berpotensi undervalued"
        sinyal = "positif"
    elif status == "overvalued":
        valuasi = f"harga pasar ({_fmt(market)}) berada di atas nilai intrinsik ({_fmt(intrinsic)}), mengindikasikan saham berpotensi overvalued"
        sinyal = "perlu diwaspadai"
    else:
        valuasi = f"harga pasar ({_fmt(market)}) relatif mendekati nilai intrinsik ({_fmt(intrinsic)})"
        sinyal = "netral"

    summary = (
        f"Berdasarkan laporan keuangan periode {year} dengan PER wajar {per_wajar}x, "
        f"{valuasi}. Sinyal fundamental: {sinyal}. "
        f"Untuk analisis lebih komprehensif, upload data harga saham historis."
    )

    roe_desc = f"ROE {roe*100:.1f}% menunjukkan {'efisiensi penggunaan modal yang baik' if roe > 0.12 else 'efisiensi modal yang perlu diperhatikan'}."
    der_desc = f"DER {der:.2f}x menunjukkan {'struktur pendanaan yang sehat' if der <= 1.5 else 'ketergantungan hutang yang relatif tinggi'}."

    return {
        "type": "fundamental_only",
        "summary": summary,
        "short_term": "Data harga saham historis belum tersedia. Upload CSV harga untuk mendapatkan proyeksi ARIMA jangka pendek.",
        "medium_long_term": f"{roe_desc} {der_desc} Kondisi fundamental dapat menjadi pertimbangan untuk keputusan investasi jangka menengah-panjang.",
        "context_note": "Analisis saat ini hanya berdasarkan laporan keuangan menggunakan metode valuasi intrinsik EPS × PER wajar.",
    }


def build_recommendation(arima: Dict[str, Any], fundamental: Dict[str, Any]) -> Dict[str, Any]:
    """Rekomendasi gabungan saat kedua data ARIMA dan Fundamental tersedia."""
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
        "type": "compare",
        "summary": summary,
        "short_term": short_term,
        "medium_long_term": long_term,
        "context_note": "ARIMA membaca pola historis harga, sedangkan fundamental membaca kondisi keuangan dan kewajaran harga saham.",
    }


def _fmt(val: float) -> str:
    """Format rupiah singkat."""
    try:
        return f"Rp {int(val):,}".replace(",", ".")
    except Exception:
        return str(val)
