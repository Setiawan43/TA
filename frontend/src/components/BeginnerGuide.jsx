import React, { useState } from "react";

// ── Data Glossary ─────────────────────────────────────────────────────────────
const GLOSSARY = [
  {
    term: "Saham",
    icon: "📋",
    simple: "Bukti kepemilikan sebagian perusahaan",
    detail: "Ketika Anda membeli saham TLKM, Anda memiliki sebagian kecil dari PT Telkom Indonesia. Artinya Anda berhak atas sebagian keuntungan perusahaan dan nilainya bisa naik/turun sesuai performa bisnis.",
    example: "Contoh: Beli 1 lot (100 lembar) saham TLKM seharga Rp 2.800/lembar = investasi Rp 280.000",
  },
  {
    term: "Harga Penutupan",
    icon: "💰",
    simple: "Harga terakhir saham diperdagangkan hari itu",
    detail: "Setiap hari bursa buka pukul 09.00 dan tutup 15.30 WIB. Harga saat penutupan inilah yang dijadikan patokan — itulah 'harga penutupan'.",
    example: "Contoh: Harga TLKM tutup di Rp 2.802 artinya pada pukul 15.30, harga terakhir transaksi adalah Rp 2.802",
  },
  {
    term: "ARIMA",
    icon: "📈",
    simple: "Model matematika untuk menebak harga ke depan berdasarkan pola masa lalu",
    detail: "ARIMA (AutoRegressive Integrated Moving Average) adalah metode statistik yang mempelajari pola pergerakan harga historis lalu menggunakannya untuk memproyeksikan harga di masa depan. Seperti cuaca — kita tidak bisa 100% pasti, tapi bisa memperkirakan berdasarkan pola.",
    example: "Contoh: Jika harga TLKM selalu naik di bulan Juni 3 tahun terakhir, ARIMA akan memperhitungkan pola itu.",
  },
  {
    term: "Proyeksi / Forecast",
    icon: "🔮",
    simple: "Perkiraan harga di masa depan berdasarkan data historis",
    detail: "Proyeksi bukan kepastian, melainkan estimasi terbaik berdasarkan pola yang ada. Semakin jauh tanggal proyeksi, semakin lebar rentang ketidakpastiannya.",
    example: "Contoh: Proyeksi 30 hari ke depan lebih akurat dibanding proyeksi 90 hari ke depan.",
  },
  {
    term: "Akurasi Model",
    icon: "🎯",
    simple: "Seberapa sering prediksi model mendekati harga aslinya",
    detail: "Dihitung dari data historis: model diuji di data masa lalu yang sudah diketahui hasilnya. Akurasi 77% berarti dari 100 prediksi, sekitar 77 mendekati harga aktual. Ini bukan jaminan akurasi masa depan.",
    example: "Akurasi 77,9% = model cukup baik, tapi tetap ada potensi meleset ~22%",
  },
  {
    term: "MAPE",
    icon: "📏",
    simple: "Rata-rata persentase meleset dari harga asli",
    detail: "Mean Absolute Percentage Error (MAPE) mengukur rata-rata seberapa jauh prediksi meleset. MAPE 22% berarti rata-rata prediksi meleset ±22% dari harga aktual. Semakin kecil semakin baik.",
    example: "MAPE 22% + harga prediksi Rp 2.800 → harga asli kemungkinan antara Rp 2.184 - Rp 3.416",
    levels: [
      { label: "< 10%", desc: "Sangat Baik", color: "#10b981" },
      { label: "10–20%", desc: "Baik", color: "#f59e0b" },
      { label: "> 20%", desc: "Cukup / Perlu Perhatian", color: "#ef4444" },
    ],
  },
  {
    term: "MAE",
    icon: "📐",
    simple: "Rata-rata selisih harga prediksi vs harga asli dalam rupiah",
    detail: "Mean Absolute Error (MAE) mengukur rata-rata kesalahan prediksi dalam nominal rupiah. Lebih mudah dipahami dibanding MAPE karena langsung dalam angka rupiah.",
    example: "MAE Rp 659 berarti rata-rata prediksi meleset Rp 659 per lembar saham",
  },
  {
    term: "RMSE",
    icon: "📊",
    simple: "Ukuran kesalahan prediksi yang lebih sensitif terhadap meleset besar",
    detail: "Root Mean Square Error (RMSE) mirip MAE tapi memberikan bobot lebih besar pada kesalahan besar. Jika RMSE jauh lebih besar dari MAE, artinya ada beberapa prediksi yang sangat meleset.",
    example: "RMSE Rp 767 vs MAE Rp 659 — selisihnya kecil, artinya prediksi konsisten",
  },
  {
    term: "Confidence Interval (CI) 95%",
    icon: "↔️",
    simple: "Rentang harga di mana ada 95% kemungkinan harga asli berada",
    detail: "CI 95% artinya jika kita membuat 100 prediksi dengan metode yang sama, sekitar 95 dari prediksi tersebut akan mencakup harga aktual. Batas bawah dan atas membentuk 'koridor kemungkinan' harga.",
    example: "CI: Rp 2.346 – Rp 3.265 berarti ada 95% kemungkinan harga akan berada di rentang ini",
  },
  {
    term: "Undervalued",
    icon: "🟢",
    simple: "Harga saham lebih murah dari nilai wajarnya — potensi naik",
    detail: "Saham dikatakan undervalued ketika harga pasarnya lebih rendah dari nilai intrinsik (nilai sebenarnya berdasarkan kinerja keuangan). Ini bisa berarti peluang beli yang baik, tapi perlu analisis lebih lanjut.",
    example: "Nilai intrinsik Rp 3.000 tapi harga pasar Rp 2.400 → saham undervalued (diskon 20%)",
  },
  {
    term: "Overvalued",
    icon: "🔴",
    simple: "Harga saham lebih mahal dari nilai wajarnya — potensi turun",
    detail: "Saham overvalued berarti pasar membayar lebih mahal dari yang seharusnya berdasarkan kinerja keuangan. Ini bisa berarti risiko koreksi harga ke bawah.",
    example: "Nilai intrinsik Rp 2.000 tapi harga pasar Rp 2.800 → saham overvalued (premium 40%)",
  },
  {
    term: "Nilai Intrinsik",
    icon: "🏷️",
    simple: "Nilai 'sebenarnya' saham berdasarkan kinerja keuangan perusahaan",
    detail: "Nilai intrinsik dihitung dari EPS × PER Wajar — mengestimasi berapa harga 'adil' berdasarkan laba dan standar industri. Jika harga pasar di bawah nilai intrinsik → undervalued.",
    example: "EPS Rp 250 × PER Wajar 8x = Nilai Intrinsik Rp 2.000",
  },
  {
    term: "EPS (Earnings Per Share)",
    icon: "💵",
    simple: "Laba bersih perusahaan dibagi jumlah lembar saham",
    detail: "EPS menunjukkan berapa rupiah laba yang dihasilkan perusahaan untuk setiap lembar saham. Semakin tinggi EPS, semakin besar potensi dividen dan nilai saham.",
    example: "Laba bersih Rp 25 triliun ÷ 100 miliar lembar saham = EPS Rp 250/lembar",
  },
  {
    term: "PER / P/E Ratio",
    icon: "🔢",
    simple: "Harga saham dibagi laba per lembar — ukuran 'mahal atau murah'",
    detail: "Price-to-Earnings Ratio mengukur berapa kali investor membayar laba perusahaan. PER tinggi bisa berarti ekspektasi pertumbuhan tinggi atau saham terlalu mahal. PER rendah bisa berarti saham murah atau perusahaan bermasalah.",
    example: "Harga Rp 2.800 ÷ EPS Rp 250 = PER 11,2x (investor bayar 11x laba tahunan)",
    levels: [
      { label: "< 10x", desc: "Murah / Value Stock", color: "#10b981" },
      { label: "10–20x", desc: "Wajar", color: "#f59e0b" },
      { label: "> 20x", desc: "Mahal / Growth Premium", color: "#ef4444" },
    ],
  },
  {
    term: "ROE (Return on Equity)",
    icon: "💹",
    simple: "Seberapa efisien perusahaan menghasilkan laba dari modal sendiri",
    detail: "ROE = Laba Bersih ÷ Total Ekuitas. Semakin tinggi ROE, semakin efisien perusahaan. ROE di atas 15% umumnya dianggap baik untuk perusahaan besar.",
    example: "ROE 15% berarti setiap Rp 100 modal yang ditanam, perusahaan menghasilkan Rp 15 laba",
    levels: [
      { label: "> 15%", desc: "Sangat Baik", color: "#10b981" },
      { label: "10–15%", desc: "Baik", color: "#f59e0b" },
      { label: "< 10%", desc: "Perlu Perhatian", color: "#ef4444" },
    ],
  },
  {
    term: "DER (Debt to Equity Ratio)",
    icon: "⚖️",
    simple: "Perbandingan hutang vs modal sendiri perusahaan",
    detail: "DER = Total Hutang ÷ Total Ekuitas. DER tinggi berarti perusahaan banyak berhutang. Untuk sektor telekomunikasi, DER wajar umumnya di bawah 2x.",
    example: "DER 1,5x berarti hutang perusahaan 1,5 kali lipat modal sendiri",
    levels: [
      { label: "< 1x", desc: "Sangat Aman", color: "#10b981" },
      { label: "1–2x", desc: "Wajar", color: "#f59e0b" },
      { label: "> 2x", desc: "Risiko Tinggi", color: "#ef4444" },
    ],
  },
  {
    term: "ROA (Return on Assets)",
    icon: "🏗️",
    simple: "Seberapa efisien perusahaan menghasilkan laba dari semua aset",
    detail: "ROA = Laba Bersih ÷ Total Aset. Berbeda dengan ROE yang hanya melihat modal sendiri, ROA melihat seluruh aset termasuk yang dibiayai hutang.",
    example: "ROA 5% berarti setiap Rp 100 aset menghasilkan Rp 5 laba",
  },
  {
    term: "PBV (Price to Book Value)",
    icon: "📒",
    simple: "Harga saham dibandingkan nilai buku (aset bersih) per lembar",
    detail: "PBV = Harga Pasar ÷ BVPS. PBV < 1 berarti saham dijual di bawah nilai aset bersihnya (potensial murah). PBV > 1 berarti pasar memberikan nilai lebih dari nilai bukunya.",
    example: "PBV 2x berarti investor bayar 2x lipat nilai aset bersih perusahaan",
  },
  {
    term: "Health Index",
    icon: "❤️",
    simple: "Skor 0–100 yang merangkum kesehatan keuangan perusahaan secara keseluruhan",
    detail: "Health Index menggabungkan beberapa indikator keuangan (ROE, DER, ROA, pertumbuhan EPS) menjadi satu angka. Skor di atas 70 umumnya menunjukkan perusahaan dalam kondisi keuangan baik.",
    example: "Health Index 75/100 = perusahaan sehat secara finansial",
    levels: [
      { label: "70–100", desc: "Sehat", color: "#10b981" },
      { label: "40–70", desc: "Cukup", color: "#f59e0b" },
      { label: "0–40", desc: "Perlu Perhatian", color: "#ef4444" },
    ],
  },
];

const CHART_GUIDE = [
  {
    icon: "🔵",
    title: "Garis Biru — Harga Aktual",
    desc: "Menunjukkan harga nyata saham yang sudah terjadi di masa lalu. Data ini adalah fakta, bukan perkiraan.",
  },
  {
    icon: "🔴",
    title: "Garis Merah Putus-Putus — Proyeksi",
    desc: "Perkiraan harga di masa depan berdasarkan model ARIMA. Ingat: ini estimasi, bukan kepastian.",
  },
  {
    icon: "🩵",
    title: "Area Biru Muda — Confidence Interval 95%",
    desc: "Rentang di mana harga kemungkinan besar berada. Semakin melebar ke kanan = semakin tidak pasti karena proyeksi lebih jauh.",
  },
];

const DISCLAIMER = [
  "Prediksi harga saham adalah perkiraan berdasarkan pola historis, bukan kepastian.",
  "Selalu lakukan riset mandiri (due diligence) sebelum membeli atau menjual saham.",
  "Diversifikasikan portofolio — jangan menaruh semua dana di satu saham.",
  "Investasi saham mengandung risiko, termasuk risiko kehilangan sebagian atau seluruh modal.",
  "Website ini bersifat edukatif dan bukan merupakan saran investasi profesional.",
];

// ── BeginnerGuide Component ───────────────────────────────────────────────────
export default function BeginnerGuide({ onClose }) {
  const [activeTab, setActiveTab] = useState("glossary");
  const [expandedTerm, setExpandedTerm] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = GLOSSARY.filter(
    (g) =>
      g.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.simple.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="beginner-guide-overlay" onClick={onClose}>
      <div className="beginner-guide-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="beginner-guide-header">
          <div>
            <h2 className="beginner-guide-title">📚 Panduan Investor Pemula</h2>
            <p className="beginner-guide-subtitle">Pahami semua istilah sebelum mulai berinvestasi</p>
          </div>
          <button className="beginner-guide-close" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className="beginner-guide-tabs">
          {[
            { key: "glossary", label: "📖 Kamus Istilah" },
            { key: "chart", label: "📊 Cara Baca Grafik" },
            { key: "disclaimer", label: "⚠️ Penting Diketahui" },
          ].map(({ key, label }) => (
            <button
              key={key}
              className={`beginner-tab-btn ${activeTab === key ? "active" : ""}`}
              onClick={() => setActiveTab(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="beginner-guide-body">
          {/* ── TAB: GLOSSARY ── */}
          {activeTab === "glossary" && (
            <>
              <input
                className="beginner-search"
                type="text"
                placeholder="🔍 Cari istilah..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <div className="beginner-glossary-list">
                {filtered.map((item) => (
                  <div
                    key={item.term}
                    className={`beginner-glossary-item ${expandedTerm === item.term ? "expanded" : ""}`}
                  >
                    <button
                      className="beginner-glossary-header"
                      onClick={() => setExpandedTerm(expandedTerm === item.term ? null : item.term)}
                    >
                      <span className="beginner-glossary-icon">{item.icon}</span>
                      <div className="beginner-glossary-main">
                        <strong className="beginner-glossary-term">{item.term}</strong>
                        <span className="beginner-glossary-simple">{item.simple}</span>
                      </div>
                      <span className="beginner-glossary-chevron">
                        {expandedTerm === item.term ? "▲" : "▼"}
                      </span>
                    </button>

                    {expandedTerm === item.term && (
                      <div className="beginner-glossary-detail">
                        <p className="beginner-detail-desc">{item.detail}</p>
                        <div className="beginner-detail-example">
                          <span className="beginner-example-label">Contoh</span>
                          <span>{item.example}</span>
                        </div>
                        {item.levels && (
                          <div className="beginner-levels">
                            {item.levels.map((lv) => (
                              <div key={lv.label} className="beginner-level-row">
                                <span className="beginner-level-badge" style={{ background: lv.color + "22", color: lv.color, border: `1px solid ${lv.color}44` }}>
                                  {lv.label}
                                </span>
                                <span className="beginner-level-desc">{lv.desc}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {filtered.length === 0 && (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "#64748b" }}>
                    Istilah "{searchQuery}" tidak ditemukan
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── TAB: CHART GUIDE ── */}
          {activeTab === "chart" && (
            <div className="beginner-chart-guide">
              <div className="beginner-chart-preview">
                <div className="beginner-chart-legend">
                  {CHART_GUIDE.map((item) => (
                    <div key={item.title} className="beginner-chart-legend-item">
                      <div className="beginner-chart-legend-icon">{item.icon}</div>
                      <div>
                        <strong className="beginner-chart-legend-title">{item.title}</strong>
                        <p className="beginner-chart-legend-desc">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="beginner-tips-box">
                <h4>💡 Tips Membaca Proyeksi</h4>
                <ul>
                  <li>Proyeksi jangka pendek (7–14 hari) lebih akurat dari jangka panjang (30+ hari)</li>
                  <li>Perhatikan lebar area CI — semakin lebar berarti ketidakpastian semakin besar</li>
                  <li>Gunakan proyeksi sebagai salah satu referensi, bukan satu-satunya dasar keputusan</li>
                  <li>Kondisi pasar luar (berita, kebijakan) tidak tercermin dalam model statistik</li>
                </ul>
              </div>

              <div className="beginner-tips-box" style={{ borderColor: "rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.05)" }}>
                <h4 style={{ color: "#f87171" }}>🚨 Yang Tidak Bisa Diprediksi Model</h4>
                <ul>
                  <li>Berita mendadak (merger, bencana, kebijakan pemerintah)</li>
                  <li>Sentimen pasar global (perang, krisis keuangan)</li>
                  <li>Perubahan fundamental bisnis yang baru terjadi</li>
                  <li>Black swan events (kejadian ekstrem yang tidak terduga)</li>
                </ul>
              </div>
            </div>
          )}

          {/* ── TAB: DISCLAIMER ── */}
          {activeTab === "disclaimer" && (
            <div className="beginner-disclaimer">
              <div className="beginner-disclaimer-banner">
                <span style={{ fontSize: 32 }}>⚠️</span>
                <div>
                  <h3>Baca Sebelum Berinvestasi</h3>
                  <p>Informasi di bawah ini sangat penting untuk dipahami oleh investor pemula.</p>
                </div>
              </div>

              <div className="beginner-disclaimer-list">
                {DISCLAIMER.map((item, i) => (
                  <div key={i} className="beginner-disclaimer-item">
                    <span className="beginner-disclaimer-num">{i + 1}</span>
                    <p>{item}</p>
                  </div>
                ))}
              </div>

              <div className="beginner-tips-box" style={{ borderColor: "rgba(16,185,129,0.3)", background: "rgba(16,185,129,0.05)" }}>
                <h4 style={{ color: "#34d399" }}>✅ Langkah Aman untuk Pemula</h4>
                <ul>
                  <li><strong>Mulai kecil:</strong> Investasikan hanya dana yang siap Anda tanggung risikonya</li>
                  <li><strong>Diversifikasi:</strong> Jangan taruh semua di satu saham</li>
                  <li><strong>Pelajari terus:</strong> Gunakan platform ini sebagai alat belajar</li>
                  <li><strong>Sabar:</strong> Investasi saham idealnya jangka menengah-panjang (1–5 tahun+)</li>
                  <li><strong>Konsultasi:</strong> Untuk nominal besar, konsultasikan dengan perencana keuangan</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
