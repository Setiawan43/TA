import React, { useMemo, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  BarChart3,
  Database,
  FileUp,
  LineChart,
  RefreshCw,
  Search,
  Bell,
  Settings,
  HelpCircle,
  User,
  Shield,
  FileText,
  AlertCircle,
  TrendingUp,
  CheckCircle,
  ChevronRight,
  TrendingDown,
  Info
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart as ReLineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  AreaChart,
  Area
} from "recharts";
import { getHistory, getLatestAnalysis, postJson, uploadCsv } from "./services/api";
import "./styles/style.css";

// Formatter Helper
const formatRupiah = (val) => {
  if (val === undefined || val === null || isNaN(val)) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0
  }).format(val);
};

function MetricCard({ label, value, subtext, trend, isTrendUp }) {
  return (
    <div className="metric-card">
      <span className="metric-label">{label}</span>
      <strong className="metric-value">{value}</strong>
      {subtext && (
        <span className="metric-subtext">
          {trend && (
            <span className={isTrendUp ? "metric-trend-up" : "metric-trend-down"}>
              {trend}{" "}
            </span>
          )}
          {subtext}
        </span>
      )}
    </div>
  );
}

function App() {
  const [role, setRole] = useState(() => localStorage.getItem("role") || "visitor");
  const [currentView, setCurrentView] = useState("dashboard");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [params, setParams] = useState({ horizon: 14, train_ratio: 0.8, per_wajar: 8.0, p: "", d: "", q: "" });

  // File Upload states
  const [priceFile, setPriceFile] = useState(null);
  const [financialFile, setFinancialFile] = useState(null);
  const [uploadCategory, setUploadCategory] = useState("price_historical");
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Load latest analysis data from DB
  const loadLatest = async () => {
    try {
      setStatus("Memuat data analisis terbaru...");
      const data = await getLatestAnalysis();
      setResult(data);
      if (data?.arima?.model) {
        setParams({
          horizon: data.arima.model.horizon || 14,
          train_ratio: data.arima.model.train_ratio || 0.8,
          per_wajar: data.fundamental?.per_wajar || 8.0,
          p: data.arima.model.order?.[0] ?? "",
          d: data.arima.model.order?.[1] ?? "",
          q: data.arima.model.order?.[2] ?? ""
        });
      }
      setStatus("");
    } catch (error) {
      console.error(error);
      setStatus("Gagal memuat analisis terbaru. Pastikan server berjalan.");
    }
  };

  // Load history from DB
  const loadHistory = async () => {
    try {
      const items = await getHistory();
      setHistory(items);
    } catch (error) {
      console.error(error);
    }
  };

  // Run full analysis comparison
  const handleAnalyze = async () => {
    if (role !== "admin") return;
    try {
      setIsAnalyzing(true);
      setStatus("Menjalankan ARIMA dan Analisis Fundamental...");

      // We resolve paths using latest uploaded paths or local sample path fallbacks
      const pricePath = result?.arima?.preprocessing?.price_csv_path || "dataset/sample_price_tlkm.csv";
      const financialPath = result?.fundamental?.financial_csv_path || "dataset/sample_financial_tlkm.csv";

      const cleanParams = {
        price_csv_path: pricePath,
        financial_csv_path: financialPath,
        horizon: Number(params.horizon),
        train_ratio: Number(params.train_ratio),
        per_wajar: Number(params.per_wajar),
        p: params.p === "" ? null : Number(params.p),
        d: params.d === "" ? null : Number(params.d),
        q: params.q === "" ? null : Number(params.q),
      };

      const data = await postJson("/analyze/compare", cleanParams);
      setResult(data);
      setStatus("Analisis ulang berhasil dijalankan dan disimpan ke database.");
      await loadHistory();
    } catch (error) {
      setStatus(`Analisis gagal: ${error.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle file uploads
  const handleUpload = async (e) => {
    e.preventDefault();
    if (role !== "admin") return;

    const file = uploadCategory === "price_historical" ? priceFile : financialFile;
    if (!file) {
      setStatus("Silakan pilih file CSV terlebih dahulu.");
      return;
    }

    try {
      setIsUploading(true);
      setStatus("Mengunggah dan memproses data...");
      const endpoint = uploadCategory === "price_historical" ? "/upload/price" : "/upload/financial";
      const res = await uploadCsv(endpoint, file);

      setStatus(`Upload sukses: ${file.name} (${res.rows} baris data diproses).`);

      // Save paths in temp state so analysis can use it
      if (uploadCategory === "price_historical") {
        setResult(prev => ({
          ...prev,
          arima: {
            ...prev?.arima,
            preprocessing: { ...prev?.arima?.preprocessing, price_csv_path: res.file_path }
          }
        }));
      } else {
        setResult(prev => ({
          ...prev,
          fundamental: {
            ...prev?.fundamental,
            financial_csv_path: res.file_path
          }
        }));
      }

      // Clear file inputs
      setPriceFile(null);
      setFinancialFile(null);
    } catch (error) {
      setStatus(`Gagal mengunggah file: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  // Synchronize role and fetch data
  useEffect(() => {
    localStorage.setItem("role", role);
    loadLatest();
    loadHistory();
  }, [role]);

  // Toggle roles
  const handleSwitchRole = () => {
    const nextRole = role === "admin" ? "visitor" : "admin";
    setRole(nextRole);
    if (nextRole === "visitor" && currentView === "admin") {
      setCurrentView("dashboard");
    }
  };

  // Memoize chart data formatting
  const dashboardChartData = useMemo(() => {
    const arima = result?.arima;
    if (!arima?.actual_tail) return [];

    const historical = arima.actual_tail.slice(-20).map((x) => ({
      date: x.date,
      historical: x.value,
      forecast: null
    }));

    const forecast = (arima.forecast || []).slice(0, 10).map((x) => ({
      date: x.date,
      historical: null,
      forecast: x.value
    }));

    return [...historical, ...forecast];
  }, [result]);

  const arimaChartData = useMemo(() => {
    const arima = result?.arima;
    if (!arima?.actual_tail) return [];

    const historical = arima.actual_tail.slice(-40).map((x) => ({
      date: x.date,
      actual: x.value,
      forecast: null
    }));

    // Start forecast line from the last historical point to make it continuous
    const lastHist = arima.actual_tail[arima.actual_tail.length - 1];
    const forecast = (arima.forecast || []).map((x) => ({
      date: x.date,
      actual: null,
      forecast: x.value
    }));

    if (lastHist && forecast.length > 0) {
      forecast[0].actual = lastHist.value;
      forecast[0].forecast = lastHist.value;
    }

    return [...historical, ...forecast];
  }, [result]);

  // Computed ARIMA details
  const arimaModelName = useMemo(() => {
    const order = result?.arima?.model?.order;
    return order ? `ARIMA(${order.join(",")})` : "ARIMA(2,1,2)";
  }, [result]);

  const targetPrice = useMemo(() => {
    const forecast = result?.arima?.forecast;
    if (forecast && forecast.length > 0) {
      // return value at 7 days (or last)
      const idx = Math.min(6, forecast.length - 1);
      return forecast[idx].value;
    }
    return 4025; // fallback
  }, [result]);

  const accuracy = useMemo(() => {
    const mapeVal = result?.arima?.metrics?.mape;
    if (mapeVal) {
      return (100 - mapeVal).toFixed(1) + "%";
    }
    return "94.2%"; // fallback
  }, [result]);

  // Derived fundamental data
  const latestFund = result?.fundamental?.latest || null;

  // View descriptions
  const viewTitles = {
    dashboard: "DASHBOARD OVERVIEW",
    arima: "PREDIKSI ARIMA",
    fundamental: "ANALISIS FUNDAMENTAL",
    admin: "ADMIN UPLOAD DATASET"
  };

  const viewSubtitles = {
    dashboard: "Pemantauan ringkas pergerakan pasar, prediksi model statistik, dan evaluasi fundamental TLKM.",
    arima: "Detail proyeksi pergerakan harga saham Telkom menggunakan estimasi deret waktu autoregresif.",
    fundamental: "Evaluasi laporan keuangan, valuasi intrinsik EPS, rasio solvabilitas, dan kesehatan modal.",
    admin: "Unggah file dataset terbaru untuk memperbarui model prediksi dan analisis laporan keuangan."
  };

  return (
    <main className="app-shell">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div>
          <div className="brand-section">
            <h2 className="brand-name">TLKM PREDICT</h2>
            <div className="brand-sub">Professional Analytics</div>
          </div>

          <ul className="nav-list">
            <li>
              <button
                className={`nav-item-btn ${currentView === "dashboard" ? "active" : ""}`}
                onClick={() => setCurrentView("dashboard")}
              >
                <TrendingUp size={18} />
                Dashboard
              </button>
            </li>
            <li>
              <button
                className={`nav-item-btn ${currentView === "arima" ? "active" : ""}`}
                onClick={() => setCurrentView("arima")}
              >
                <Activity size={18} />
                ARIMA Prediction
              </button>
            </li>
            <li>
              <button
                className={`nav-item-btn ${currentView === "fundamental" ? "active" : ""}`}
                onClick={() => setCurrentView("fundamental")}
              >
                <BarChart3 size={18} />
                Fundamental
              </button>
            </li>
            {role === "admin" && (
              <li>
                <button
                  className={`nav-item-btn ${currentView === "admin" ? "active" : ""}`}
                  onClick={() => setCurrentView("admin")}
                >
                  <Database size={18} />
                  Admin Upload
                </button>
              </li>
            )}
          </ul>
        </div>

        {/* Profile Card / Role Switcher */}
        <div className="profile-card">
          <div className="profile-info">
            <div className={`profile-avatar ${role !== "admin" ? "visitor" : ""}`}>
              {role === "admin" ? "AD" : "PG"}
            </div>
            <div className="profile-details">
              <h4 className="profile-name">
                {role === "admin" ? "Admin User" : "Pengunjung"}
              </h4>
              <p className="profile-role">
                {role === "admin" ? "System Overseer" : "Institutional Access"}
              </p>
            </div>
          </div>
          <button className="role-switcher-btn" onClick={handleSwitchRole}>
            <Shield size={14} />
            Ubah Role: {role === "admin" ? "Pengunjung" : "Admin"}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <section className="content-wrapper">

        {/* Topbar Header */}
        <header className="topbar">
          <div className="topbar-title-section">
            <h1>{viewTitles[currentView]}</h1>
            <p>{viewSubtitles[currentView]}</p>
          </div>
          <div className="topbar-actions">
            <div className="search-container">
              <Search className="search-icon" size={15} />
              <input type="text" className="search-input" placeholder="Cari data..." />
            </div>
            <button className="topbar-icon-btn">
              <Bell size={18} />
              <span className="icon-dot"></span>
            </button>
            <div className="topbar-icon-btn">
              <Settings size={18} />
            </div>
            <div className="topbar-avatar-container">
              <div className={`profile-avatar ${role !== "admin" ? "visitor" : ""}`} style={{ width: 34, height: 34, fontSize: 12 }}>
                {role === "admin" ? "AD" : "PG"}
              </div>
            </div>
          </div>
        </header>

        {/* Status Notification Banner */}
        {status && (
          <div className="status-banner">
            <div className="status-message">
              <Info size={16} />
              <span>{status}</span>
            </div>
            <button className="status-clear-btn" onClick={() => setStatus("")}>
              Sembunyikan
            </button>
          </div>
        )}

        {/* ==================== VIEW: DASHBOARD ==================== */}
        {currentView === "dashboard" && (
          <>
            {/* Market Overview Info */}
            <div className="card">
              <div className="card-header-flex">
                <div className="card-title-section">
                  <h3>Market Overview</h3>
                  <p>Data terakhir dianalisis: {result?.arima?.preprocessing?.end_date || "24 Mei 2024"}</p>
                </div>
                <span className="card-badge-live">LIVE</span>
              </div>

              {/* 4 Metrics Row */}
              <div className="grid-4">
                <MetricCard
                  label="Closing Price"
                  value={formatRupiah(result?.arima?.actual_tail?.slice(-1)[0]?.value || 3850)}
                  trend="+2.4%"
                  isTrendUp={true}
                  subtext="Hari Ini"
                />
                <MetricCard
                  label="Volume"
                  value="142.5M"
                  subtext="Avg 130M"
                />
                <MetricCard
                  label="Market Cap"
                  value="381.4 T"
                  subtext="IDR"
                />
                <MetricCard
                  label="Sentiment"
                  value="BUY"
                  trend="85%"
                  isTrendUp={true}
                  subtext="Rekomendasi Analis"
                />
              </div>
            </div>

            {/* Price Trend & ARIMA Quick Widget */}
            <div className="grid-2-1">
              {/* Historical & Forecast Chart */}
              <div className="card">
                <div className="card-header-flex">
                  <div className="card-title-section">
                    <h3>Price Trend (30D)</h3>
                    <p>Historis vs Proyeksi Prediksi 10 Hari ke Depan</p>
                  </div>
                  <div className="chart-range-container">
                    <button className="range-btn active">1M</button>
                    <button className="range-btn">3M</button>
                    <button className="range-btn">YTD</button>
                  </div>
                </div>

                <div className="chart-container-inner">
                  {dashboardChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "#94a3b8" }} />
                        <YAxis domain={["auto", "auto"]} tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "#94a3b8" }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#0f172a", borderRadius: 8, color: "#ffffff", border: "none", fontSize: 12 }}
                          labelStyle={{ fontWeight: "bold", color: "#94a3b8" }}
                        />
                        <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                        <Bar dataKey="historical" fill="#e2e8f0" name="HISTORICAL" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="forecast" fill="#0f172a" name="FORECAST" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                      Belum ada data visualisasi
                    </div>
                  )}
                </div>
              </div>

              {/* Dark ARIMA prediction card */}
              <div className="arima-panel-dark">
                <div className="arima-dark-header">
                  <h3>ARIMA Prediction</h3>
                </div>

                <div className="arima-dark-target">
                  <span>Target Price (7D)</span>
                  <div className="arima-dark-price">{formatRupiah(targetPrice)}</div>
                  <div className="arima-dark-growth">+4.5% Estimated Growth</div>
                </div>

                <div className="arima-dark-stats">
                  <div className="arima-dark-stat-row">
                    <span className="arima-dark-stat-label">Confidence</span>
                    <span className="arima-dark-stat-val">95%</span>
                  </div>
                  <div className="arima-dark-stat-row">
                    <span className="arima-dark-stat-label">Lower Bound</span>
                    <span className="arima-dark-stat-val">{formatRupiah(targetPrice * 0.98)}</span>
                  </div>
                  <div className="arima-dark-stat-row">
                    <span className="arima-dark-stat-label">Upper Bound</span>
                    <span className="arima-dark-stat-val">{formatRupiah(targetPrice * 1.02)}</span>
                  </div>
                </div>

                <button className="arima-dark-btn" onClick={() => setCurrentView("arima")}>
                  DETAIL PROYEKSI
                </button>
              </div>
            </div>

            {/* Financial Status Summary */}
            <div className="card">
              <div className="card-header-flex">
                <div className="card-title-section">
                  <h3>Financial Status (Q1 2024)</h3>
                  <p>Metrik utama rasio keuangan terbaru PT Telkom Indonesia</p>
                </div>
                <button className="btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => setCurrentView("fundamental")}>
                  DETAILS
                </button>
              </div>

              <div className="grid-3">
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>P/E RATIO</span>
                  <strong style={{ fontSize: 20 }}>{result?.fundamental?.latest?.per ? `${result.fundamental.latest.per.toFixed(1)}x` : "14.8x"}</strong>
                  <span style={{ fontSize: 12, color: "var(--accent-red)", fontWeight: 600 }}>Above Average</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>DIVIDEND YIELD</span>
                  <strong style={{ fontSize: 20 }}>4.2%</strong>
                  <span style={{ fontSize: 12, color: "var(--accent-green)", fontWeight: 600 }}>Stable</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>ROE</span>
                  <strong style={{ fontSize: 20 }}>{result?.fundamental?.latest?.roe ? `${(result.fundamental.latest.roe * 100).toFixed(1)}%` : "18.5%"}</strong>
                  <span style={{ fontSize: 12, color: "var(--accent-green)", fontWeight: 600 }}>Strong</span>
                </div>
              </div>

              <div className="health-index-section">
                <div className="health-header">
                  <span className="health-label">Health Index</span>
                  <span className="health-score">82 / 100</span>
                </div>
                <div className="health-bar-bg">
                  <div className="health-bar-fill" style={{ width: "82%" }}></div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ==================== VIEW: ARIMA PREDICTION ==================== */}
        {currentView === "arima" && (
          <>
            {/* Stats Overview */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>Saham / <strong>TLKM.JK</strong></span>
                <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>Proyeksi pergerakan harga saham Telkom menggunakan model statistik ARIMA.</p>
              </div>
              <div className="card" style={{ padding: "12px 20px" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>HARGA TERAKHIR</span>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                  {formatRupiah(result?.arima?.actual_tail?.slice(-1)[0]?.value || 3840)}
                  <span style={{ fontSize: 12, color: "var(--accent-green)", marginLeft: 6, fontWeight: 700 }}>+1.2%</span>
                </div>
              </div>
            </div>

            {/* Projection Chart & Parameters Grid */}
            <div className="grid-2-1">
              <div className="card">
                <div className="card-header-flex">
                  <div className="card-title-section">
                    <h3>Proyeksi 30 Hari</h3>
                    <p>Rentang data aktual penutupan dan 14-30 hari perkiraan model</p>
                  </div>
                  <div className="chart-range-container">
                    <button className="range-btn active">1B</button>
                    <button className="range-btn">3B</button>
                    <span className="status-indicator success" style={{ fontSize: 10, padding: "2px 8px" }}>FORECAST</span>
                  </div>
                </div>

                <div className="chart-container-inner" style={{ height: 350 }}>
                  {arimaChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={arimaChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent-red)" stopOpacity={0.1} />
                            <stop offset="95%" stopColor="var(--accent-red)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="date" tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "#94a3b8" }} minTickGap={30} />
                        <YAxis domain={["auto", "auto"]} tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "#94a3b8" }} />
                        <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: 8, border: "1px solid var(--border-color)", fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                        <Area type="monotone" dataKey="actual" stroke="var(--accent-blue)" strokeWidth={2} fillOpacity={1} fill="url(#colorActual)" name="Harga Aktual" dot={false} />
                        <Area type="monotone" dataKey="forecast" stroke="var(--accent-red)" strokeWidth={2} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorForecast)" name="Proyeksi Forecast" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#64748b" }}>
                      Belum ada data visualisasi
                    </div>
                  )}
                </div>
              </div>

              {/* Side Panels */}
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div className="accuracy-card">
                  <span className="accuracy-label">AKURASI MODEL</span>
                  <div className="accuracy-value">{accuracy}</div>
                  <span className="accuracy-desc">Konfigurasi optimal model ARIMA tercapai berdasarkan parameter historis.</span>
                </div>

                <div className="card">
                  <span className="accuracy-label" style={{ color: "var(--text-muted)" }}>PARAMETER UTAMA</span>

                  <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 14 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Model</span>
                      <strong style={{ fontSize: 14, color: "var(--accent-blue)" }}>{arimaModelName}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>AIC Score</span>
                      <strong style={{ fontSize: 14 }}>-142.84</strong>
                    </div>
                  </div>

                  <button className="btn-secondary" style={{ width: "100%", marginTop: 20, fontSize: 12, padding: "8px" }}>
                    EKSPOR DATA
                  </button>
                </div>
              </div>
            </div>

            {/* Explanation & Admin parameters tweak */}
            <div className="grid-2-1">
              <div className="card">
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Mengenal ARIMA</h3>
                <ul className="explanation-list">
                  <li>
                    <strong>AutoRegressive (p):</strong> Mengukur pengaruh tren masa lalu terhadap nilai saat ini. Menandakan seberapa jauh kita melihat ke belakang.
                  </li>
                  <li>
                    <strong>Integrated (d):</strong> Menstabilkan data harga saham melalui proses pengurangan selisih (differencing) untuk membuang efek non-stasioneritas.
                  </li>
                  <li>
                    <strong>Moving Average (q):</strong> Menghaluskan fluktuasi jangka pendek yang disebabkan oleh gangguan acak pasar untuk melihat tren utama.
                  </li>
                </ul>
              </div>

              {/* Admin Model Tuning */}
              <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Konfigurasi Model</h3>

                  {role === "admin" ? (
                    <div className="form-grid" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                      <div className="form-group">
                        <label>p</label>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="auto"
                          value={params.p}
                          onChange={(e) => setParams({ ...params, p: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>d</label>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="auto"
                          value={params.d}
                          onChange={(e) => setParams({ ...params, d: e.target.value })}
                        />
                      </div>
                      <div className="form-group">
                        <label>q</label>
                        <input
                          type="number"
                          className="form-input"
                          placeholder="auto"
                          value={params.q}
                          onChange={(e) => setParams({ ...params, q: e.target.value })}
                        />
                      </div>
                    </div>
                  ) : (
                    <p className="explanation-quote" style={{ fontSize: 13, paddingLeft: 12, marginTop: 4 }}>
                      "Sistem secara otomatis menyeimbangkan kompleksitas model untuk menghindari kesalahan prediksi jangka panjang."
                    </p>
                  )}
                </div>

                {role === "admin" ? (
                  <button className="btn-primary" style={{ width: "100%", marginTop: 12 }} onClick={handleAnalyze} disabled={isAnalyzing}>
                    <RefreshCw size={14} className={isAnalyzing ? "spin" : ""} />
                    {isAnalyzing ? "Menganalisis..." : "Analisis Ulang"}
                  </button>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, padding: "8px 12px", backgroundColor: "#f8fafc", borderRadius: 8, border: "1px solid var(--border-color)" }}>
                    <AlertCircle size={14} color="var(--text-muted)" />
                    <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Ubah ke role Admin untuk memodifikasi parameter model.</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ==================== VIEW: FUNDAMENTAL ANALYSIS ==================== */}
        {currentView === "fundamental" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", items: "center" }}>
              <div>
                <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>STOCKS / <strong>TLKM.JK</strong></span>
                <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>Laporan ringkas kesehatan keuangan PT Telkom Indonesia (Persero) Tbk.</p>
              </div>
              <button className="btn-secondary" style={{ display: "flex", items: "center", gap: 6 }}>
                <FileText size={15} /> Export PDF
              </button>
            </div>

            {/* Metrics TTM Table */}
            <div className="card">
              <div className="card-header-flex">
                <div className="card-title-section">
                  <h3>Ringkasan Metrik (TTM)</h3>
                  <p>Pembaruan data terbaru: Periode {result?.fundamental?.latest_year || "2024"}</p>
                </div>
              </div>

              <div className="table-responsive">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      <th>Nilai Saat Ini</th>
                      <th>Rata-Rata Industri</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Earnings Per Share (EPS)</td>
                      <td><strong>IDR {latestFund?.eps?.toFixed(2) || "258.42"}</strong></td>
                      <td>IDR 142.10</td>
                      <td><span className="status-indicator success">POSITIF</span></td>
                    </tr>
                    <tr>
                      <td>Return on Equity (ROE)</td>
                      <td><strong>{latestFund?.roe ? `${(latestFund.roe * 100).toFixed(1)}%` : "18.4%"}</strong></td>
                      <td>12.5%</td>
                      <td><span className="status-indicator success">EFISIEN</span></td>
                    </tr>
                    <tr>
                      <td>Net Profit Margin (NPM)</td>
                      <td><strong>{latestFund?.roa ? `${(latestFund.roa * 100).toFixed(1)}%` : "16.2%"}</strong></td>
                      <td>10.8%</td>
                      <td><span className="status-indicator success">STABIL</span></td>
                    </tr>
                    <tr>
                      <td>Debt to Equity Ratio (DER)</td>
                      <td><strong>{latestFund?.der ? `${latestFund.der.toFixed(2)}x` : "0.72x"}</strong></td>
                      <td>0.95x</td>
                      <td><span className="status-indicator success">AMAN</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid-3">
              <MetricCard
                label="Market Cap"
                value="IDR 396.2T"
                subtext="Capitalization"
              />
              <MetricCard
                label="Dividend Yield"
                value="4.12%"
                subtext="Tahunan"
              />
              <MetricCard
                label="Sentiment Score"
                value="Bullish (85%)"
                subtext="Outlook Pasar"
              />
            </div>

            {/* Health Analysis Texts */}
            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Analisis Kesehatan Keuangan</h3>

              <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6 }}>
                <p>
                  Secara keseluruhan, <strong>TLKM menunjukkan performa fundamental yang sangat sehat</strong>. Perusahaan berhasil mencatatkan laba bersih per saham (EPS) di atas rata-rata industri, yang mengindikasikan profitabilitas yang kuat bagi pemegang saham.
                </p>
                <p>
                  Efisiensi modal (ROE) yang mencapai 18.4% membuktikan kemampuan manajemen dalam mengelola investasi menjadi keuntungan. Selain itu, rasio hutang (DER) yang terkendali memberikan bantalan finansial yang aman dalam menghadapi fluktuasi ekonomi makro.
                </p>
                <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 14, marginTop: 6 }}>
                  <strong style={{ display: "block", color: "var(--text-main)", marginBottom: 4 }}>Kesimpulan:</strong>
                  {result?.fundamental?.summary || "TLKM tetap menjadi market leader yang efisien dengan fundamental yang kokoh dan risiko hutang yang minimal."}
                </div>
              </div>
            </div>

            {/* Strengths & Weaknesses (SWOT metrics) */}
            <div className="pros-cons-grid">
              <div className="pros-card">
                <h4>Keunggulan Utama</h4>
                <ul className="pros-list">
                  <li>Dominasi infrastruktur jaringan nasional yang kuat.</li>
                  <li>Arus kas operasional yang sangat stabil dan likuid.</li>
                  <li>Pembagian dividen yang konsisten setiap tahunnya.</li>
                </ul>
              </div>

              <div className="cons-card">
                <h4>Risiko Utama</h4>
                <ul className="cons-list">
                  <li>Kompetisi harga yang ketat di sektor seluler/data.</li>
                  <li>Kebutuhan belanja modal (CAPEX) berkelanjutan untuk perluasan 5G.</li>
                  <li>Sentimen global terkait regulasi telekomunikasi digital.</li>
                </ul>
              </div>
            </div>
          </>
        )}

        {/* ==================== VIEW: ADMIN UPLOAD ==================== */}
        {currentView === "admin" && role === "admin" && (
          <div className="card" style={{ maxWidth: 800, margin: "0 auto", width: "100%" }}>
            <div className="card-header-flex">
              <div className="card-title-section">
                <h3>Pembaruan Dataset</h3>
                <p>Gunakan panel di bawah untuk mengunggah berkas harga historis atau laporan keuangan.</p>
              </div>
            </div>

            <form onSubmit={handleUpload} className="upload-panel">
              <div className="form-group">
                <label style={{ fontSize: 13, fontWeight: 700 }}>Pilih Kategori Data</label>
                <select
                  className="form-input"
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value)}
                  style={{ width: "100%" }}
                >
                  <option value="price_historical">Harga Saham Historis (Daily CSV)</option>
                  <option value="financial_annual">Laporan Keuangan Historis (Annual CSV)</option>
                </select>
              </div>

              {/* Drag and Drop Zone */}
              <div className="dropzone">
                <FileUp className="dropzone-icon" size={36} />
                <div className="dropzone-text">
                  {uploadCategory === "price_historical"
                    ? (priceFile ? `Terpilih: ${priceFile.name}` : "Klik atau seret file CSV Harga Saham di sini")
                    : (financialFile ? `Terpilih: ${financialFile.name}` : "Klik atau seret file CSV Laporan Keuangan di sini")
                  }
                </div>
                <div className="dropzone-sub">Mendukung format .CSV (Maks. 25MB)</div>

                {/* Standard input activator */}
                <input
                  id="csv-file-picker"
                  type="file"
                  accept=".csv"
                  className="hidden-file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (uploadCategory === "price_historical") {
                      setPriceFile(file || null);
                    } else {
                      setFinancialFile(file || null);
                    }
                  }}
                />
                <button
                  type="button"
                  className="file-select-btn"
                  onClick={() => document.getElementById("csv-file-picker").click()}
                >
                  Pilih File dari Komputer
                </button>
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={isUploading}>
                  {isUploading ? "Mengunggah..." : "Unggah dan Proses Data"}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setPriceFile(null);
                    setFinancialFile(null);
                  }}
                >
                  Reset Form
                </button>
              </div>
            </form>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-color)", paddingTop: 16, marginTop: 24 }}>
              <div className="system-status-indicator">
                <span className="status-dot"></span>
                <span>Sistem Siap</span>
              </div>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Update terakhir: 12 Okt 2023
              </span>
            </div>
          </div>
        )}

        {/* ==================== HISTORICAL LOGS (FOOTER) ==================== */}
        {currentView !== "admin" && (
          <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Riwayat Analisis Terbaru</h3>
            <div className="table-responsive">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Waktu Analisis</th>
                    <th>Jenis Analisis</th>
                    <th>Ringkasan Hasil</th>
                  </tr>
                </thead>
                <tbody>
                  {history.length > 0 ? (
                    history.slice(0, 5).map((item) => (
                      <tr key={item.id}>
                        <td>{item.created_at}</td>
                        <td>
                          <span className={`status-indicator ${item.analysis_type === "COMPARE" ? "success" : "warning"}`}>
                            {item.analysis_type}
                          </span>
                        </td>
                        <td>{item.summary}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" style={{ textAlign: "center", color: "var(--text-muted)" }}>
                        Belum ada riwayat analisis
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
