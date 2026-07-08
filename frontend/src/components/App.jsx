import React, { useMemo, useState, useEffect } from "react";
import {
  Activity, BarChart3, Database, FileUp, RefreshCw,
  Settings, Shield, Info, TrendingUp
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend
} from "recharts";
import { getHistory, getLatestAnalysis, postJson, uploadCsv, getFiles, deleteFile } from "../services/api";
import MetricCard from "./MetricCard";
import ProfileSettingsView from "./ProfileSettingsView";

// ── Formatter ─────────────────────────────────────────────────────────────────
const formatRupiah = (val) => {
  if (val === undefined || val === null || isNaN(val)) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", maximumFractionDigits: 0,
  }).format(val);
};

// ── App Component ─────────────────────────────────────────────────────────────
function App({ currentUser, onLogout, onUpdateUser }) {
  const role = currentUser?.role || "visitor";
  const [currentView, setCurrentView] = useState("dashboard");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [params, setParams] = useState({ horizon: 14, train_ratio: 0.8, per_wajar: 8.0, p: "", d: "", q: "", target_date: "" });
  const [dashboardTargetDate, setDashboardTargetDate] = useState("");
  const [dashboardForecastResult, setDashboardForecastResult] = useState(null);
  const [isDashboardLoading, setIsDashboardLoading] = useState(false);
  const [arimaTargetDate, setArimaTargetDate] = useState("");
  const [arimaForecastResult, setArimaForecastResult] = useState(null);
  const [isArimaLoading, setIsArimaLoading] = useState(false);
  const [uploadedPreview, setUploadedPreview] = useState(null);
  const [priceFile, setPriceFile] = useState(null);
  const [financialFile, setFinancialFile] = useState(null);
  const [uploadCategory, setUploadCategory] = useState("price_historical");
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [pendingPricePath, setPendingPricePath] = useState(null);
  const [pendingFinancialPath, setPendingFinancialPath] = useState(null);
  const [filesList, setFilesList] = useState([]);

  const loadFiles = async () => {
    try { setFilesList(await getFiles()); } catch (error) { console.error(error); }
  };

  const handleDeleteFile = async (filename) => {
    if (!window.confirm(`Yakin ingin menghapus ${filename}?`)) return;
    try {
      setStatus(`Menghapus ${filename}...`);
      await deleteFile(filename);
      setStatus(`File ${filename} berhasil dihapus.`);
      await loadFiles();
    } catch (error) { setStatus(`Gagal menghapus: ${error.message}`); }
  };

  const loadLatest = async () => {
    try {
      setStatus("Memuat data analisis terbaru...");
      const data = await getLatestAnalysis();
      setResult(data);
      if (data?.arima?.preprocessing?.price_csv_path) setPendingPricePath(data.arima.preprocessing.price_csv_path);
      if (data?.fundamental?.financial_csv_path) setPendingFinancialPath(data.fundamental.financial_csv_path);
      if (data?.arima?.model) {
        setParams({
          horizon: data.arima.model.horizon || 14,
          train_ratio: data.arima.model.train_ratio || 0.8,
          per_wajar: data.fundamental?.per_wajar || 8.0,
          p: data.arima.model.order?.[0] ?? "",
          d: data.arima.model.order?.[1] ?? "",
          q: data.arima.model.order?.[2] ?? "",
        });
      }
      setStatus("");
    } catch (error) {
      console.error(error);
      setStatus("Gagal memuat analisis terbaru. Pastikan server berjalan.");
    }
  };

  const loadHistory = async () => {
    try { setHistory(await getHistory()); } catch (error) { console.error(error); }
  };

  const handleAnalyzeArima = async (pricePath) => {
    try {
      setIsAnalyzing(true);
      setStatus("Menjalankan analisis ARIMA...");
      let computedHorizon = Number(params.horizon);
      if (params.target_date && result?.arima?.actual_tail?.length > 0) {
        const lastActual = new Date(result.arima.actual_tail[result.arima.actual_tail.length - 1].date);
        const target = new Date(params.target_date);
        if (target > lastActual) {
          let count = 0;
          let cur = new Date(lastActual);
          cur.setDate(cur.getDate() + 1);
          while (cur <= target) { if (cur.getDay() !== 0 && cur.getDay() !== 6) count++; cur.setDate(cur.getDate() + 1); }
          computedHorizon = Math.max(1, Math.min(90, count));
        }
      }
      const arimaData = await postJson("/analyze/arima", {
        price_csv_path: pricePath, horizon: computedHorizon,
        train_ratio: Number(params.train_ratio),
        p: params.p === "" ? null : Number(params.p),
        d: params.d === "" ? null : Number(params.d),
        q: params.q === "" ? null : Number(params.q),
      });
      setResult(prev => ({ ...(prev || {}), arima: arimaData, recommendation: prev?.recommendation || null }));
      setStatus("Analisis ARIMA selesai.");
      await loadHistory();
    } catch (error) { setStatus(`Analisis ARIMA gagal: ${error.message}`); }
    finally { setIsAnalyzing(false); }
  };

  const handleAnalyzeFundamental = async (financialPath) => {
    try {
      setIsAnalyzing(true);
      setStatus("Menjalankan analisis laporan keuangan...");
      const fundData = await postJson("/analyze/fundamental", {
        financial_csv_path: financialPath, per_wajar: Number(params.per_wajar),
      });
      setResult(prev => ({ ...(prev || {}), fundamental: fundData, recommendation: prev?.recommendation || null }));
      setStatus("Analisis laporan keuangan selesai.");
      await loadHistory();
    } catch (error) { setStatus(`Analisis fundamental gagal: ${error.message}`); }
    finally { setIsAnalyzing(false); }
  };

  const handleDashboardForecast = async () => {
    const pricePath = pendingPricePath || result?.arima?.preprocessing?.price_csv_path;
    if (!pricePath) { setStatus("Belum ada data harga. Silakan upload file CSV harga terlebih dahulu."); return; }
    if (!dashboardTargetDate) { setStatus("Silakan pilih tanggal target proyeksi terlebih dahulu."); return; }
    const lastActualArr = result?.arima?.actual_tail;
    if (!lastActualArr?.length) { setStatus("Data historis belum tersedia."); return; }
    const lastActual = new Date(lastActualArr[lastActualArr.length - 1].date);
    const target = new Date(dashboardTargetDate);
    if (target <= lastActual) { setStatus("Tanggal target harus lebih besar dari data aktual terakhir."); return; }
    let count = 0;
    let cur = new Date(lastActual);
    cur.setDate(cur.getDate() + 1);
    while (cur <= target) { if (cur.getDay() !== 0 && cur.getDay() !== 6) count++; cur.setDate(cur.getDate() + 1); }
    const computedHorizon = Math.max(1, Math.min(90, count));
    try {
      setIsDashboardLoading(true);
      setStatus(`Menghitung proyeksi hingga ${dashboardTargetDate}...`);
      const data = await postJson("/analyze/arima", {
        price_csv_path: pricePath, horizon: computedHorizon,
        train_ratio: Number(params.train_ratio),
        p: params.p === "" ? null : Number(params.p),
        d: params.d === "" ? null : Number(params.d),
        q: params.q === "" ? null : Number(params.q),
      });
      setDashboardForecastResult(data);
      setStatus(`Proyeksi hingga ${dashboardTargetDate} berhasil dihitung.`);
    } catch (err) { setStatus(`Gagal menghitung proyeksi: ${err.message}`); }
    finally { setIsDashboardLoading(false); }
  };

  const handleArimaForecast = async () => {
    const pricePath = pendingPricePath || result?.arima?.preprocessing?.price_csv_path;
    if (!pricePath) { setStatus("Belum ada data harga. Silakan upload file CSV harga terlebih dahulu."); return; }
    if (!arimaTargetDate) { setStatus("Silakan pilih tanggal target proyeksi terlebih dahulu."); return; }
    const lastActualArr = result?.arima?.actual_tail;
    if (!lastActualArr?.length) { setStatus("Data historis belum tersedia."); return; }
    const lastActual = new Date(lastActualArr[lastActualArr.length - 1].date);
    const target = new Date(arimaTargetDate);
    if (target <= lastActual) { setStatus("Tanggal target harus lebih besar dari data aktual terakhir."); return; }
    let count = 0;
    let cur = new Date(lastActual);
    cur.setDate(cur.getDate() + 1);
    while (cur <= target) { if (cur.getDay() !== 0 && cur.getDay() !== 6) count++; cur.setDate(cur.getDate() + 1); }
    const computedHorizon = Math.max(1, Math.min(365, count));
    try {
      setIsArimaLoading(true);
      setStatus(`Menghitung proyeksi hingga ${arimaTargetDate} (${computedHorizon} hari kerja)...`);
      const data = await postJson("/analyze/arima", {
        price_csv_path: pricePath, horizon: computedHorizon,
        train_ratio: Number(params.train_ratio),
        p: params.p === "" ? null : Number(params.p),
        d: params.d === "" ? null : Number(params.d),
        q: params.q === "" ? null : Number(params.q),
      });
      setArimaForecastResult(data);
      setStatus(`Proyeksi hingga ${arimaTargetDate} berhasil dihitung.`);
      await loadHistory();
    } catch (err) { setStatus(`Gagal menghitung proyeksi: ${err.message}`); }
    finally { setIsArimaLoading(false); }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (role !== "admin") return;
    const isPriceUpload = uploadCategory === "price_historical";
    const file = isPriceUpload ? priceFile : financialFile;
    if (!file) { setStatus("Silakan pilih file CSV terlebih dahulu."); return; }
    try {
      setIsUploading(true);
      setStatus("Mengunggah dan memproses data...");
      const endpoint = isPriceUpload ? "/upload/price" : "/upload/financial";
      const res = await uploadCsv(endpoint, file);
      const newFilePath = res.file_path;
      setStatus(`Upload sukses: ${file.name} (${res.rows} baris data diproses).`);
      if (res.preview_data) {
        setUploadedPreview({ filename: file.name, columns: res.columns, data: res.preview_data, rowsTotal: res.rows });
      }
      if (isPriceUpload) setPendingPricePath(newFilePath); else setPendingFinancialPath(newFilePath);
      if (isPriceUpload) setPriceFile(null); else setFinancialFile(null);
      if (isPriceUpload) await handleAnalyzeArima(newFilePath);
      else await handleAnalyzeFundamental(newFilePath);
      await loadFiles();
    } catch (error) { setStatus(`Gagal mengunggah file: ${error.message}`); }
    finally { setIsUploading(false); }
  };

  useEffect(() => { loadLatest(); loadHistory(); if (role === "admin") loadFiles(); }, [role]);
  useEffect(() => { if (role === "visitor" && currentView === "admin") setCurrentView("dashboard"); }, [role, currentView]);

  // ── Memoized chart data ──────────────────────────────────────────────────────
  const dashboardChartData = useMemo(() => {
    const arima = dashboardForecastResult || result?.arima;
    if (!arima?.actual_tail) return [];
    const historical = arima.actual_tail.slice(-25).map((x) => ({ date: x.date, actual: x.value, forecast: null }));
    const lastHist = arima.actual_tail[arima.actual_tail.length - 1];
    const forecastData = (arima.forecast || []).map((x) => ({ date: x.date, actual: null, forecast: x.value }));
    if (lastHist && forecastData.length > 0) { forecastData[0].actual = lastHist.value; forecastData[0].forecast = lastHist.value; }
    return [...historical, ...forecastData];
  }, [dashboardForecastResult, result]);

  const dashboardForecastPrice = useMemo(() => {
    if (!dashboardForecastResult?.forecast?.length) return null;
    const fc = dashboardForecastResult.forecast;
    return fc[fc.length - 1];
  }, [dashboardForecastResult]);

  const activeForecastLabel = dashboardForecastResult
    ? `Proyeksi hingga ${dashboardForecastPrice?.date || ""}`
    : "Historis vs Proyeksi 14 Hari ke Depan";

  const arimaChartData = useMemo(() => {
    const arima = arimaForecastResult || result?.arima;
    if (!arima?.actual_tail) return [];
    const historical = arima.actual_tail.slice(-40).map((x) => ({ date: x.date, actual: x.value, forecast: null }));
    const lastHist = arima.actual_tail[arima.actual_tail.length - 1];
    const forecast = (arima.forecast || []).map((x) => ({ date: x.date, actual: null, forecast: x.value }));
    if (lastHist && forecast.length > 0) { forecast[0].actual = lastHist.value; forecast[0].forecast = lastHist.value; }
    return [...historical, ...forecast];
  }, [arimaForecastResult, result]);

  const arimaModelName = useMemo(() => {
    const order = (arimaForecastResult || result?.arima)?.model?.order;
    return order ? `ARIMA(${order.join(",")})` : "-";
  }, [arimaForecastResult, result]);

  const arimaAccuracy = useMemo(() => {
    const mapeVal = (arimaForecastResult || result?.arima)?.metrics?.mape;
    return mapeVal != null ? (100 - mapeVal).toFixed(1) + "%" : null;
  }, [arimaForecastResult, result]);

  const arimaActiveForecast = arimaForecastResult || result?.arima;

  const targetPrice = useMemo(() => {
    const forecast = result?.arima?.forecast;
    if (forecast && forecast.length > 0) return forecast[Math.min(6, forecast.length - 1)].value;
    return null;
  }, [result]);

  const accuracy = useMemo(() => {
    const mapeVal = result?.arima?.metrics?.mape;
    return mapeVal != null ? (100 - mapeVal).toFixed(1) + "%" : null;
  }, [result]);

  const latestFund = result?.fundamental?.latest || null;

  const viewTitles = {
    dashboard: "DASHBOARD OVERVIEW", arima: "PREDIKSI ARIMA",
    fundamental: "ANALISIS FUNDAMENTAL", admin: "ADMIN UPLOAD DATASET", profile: "PENGATURAN PROFIL",
  };
  const viewSubtitles = {
    dashboard: "Pemantauan ringkas pergerakan pasar, prediksi model statistik, dan evaluasi fundamental TLKM.",
    arima: "Detail proyeksi pergerakan harga saham Telkom menggunakan estimasi deret waktu autoregresif.",
    fundamental: "Evaluasi laporan keuangan, valuasi intrinsik EPS, rasio solvabilitas, dan kesehatan modal.",
    admin: "Unggah file dataset terbaru untuk memperbarui model prediksi dan analisis laporan keuangan.",
    profile: "Perbarui informasi akun Anda seperti username, email, dan password.",
  };

  return (
    <main className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div>
          <div className="brand-section">
            <h2 className="brand-name">TLKM PREDICT</h2>
            <div className="brand-sub">Professional Analytics</div>
          </div>
          <ul className="nav-list">
            {[
              { view: "dashboard", icon: <TrendingUp size={18} />, label: "Dashboard" },
              { view: "arima", icon: <Activity size={18} />, label: "ARIMA Prediction" },
              { view: "fundamental", icon: <BarChart3 size={18} />, label: "Fundamental" },
              ...(role === "admin" ? [{ view: "admin", icon: <Database size={18} />, label: "Admin Upload" }] : []),
            ].map(({ view, icon, label }) => (
              <li key={view}>
                <button className={`nav-item-btn ${currentView === view ? "active" : ""}`} onClick={() => setCurrentView(view)}>
                  {icon}{label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="profile-card">
          <div className="profile-info" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className={`profile-avatar ${role !== "admin" ? "visitor" : ""}`}>
                {currentUser?.username?.slice(0, 2).toUpperCase() || (role === "admin" ? "AD" : "PG")}
              </div>
              <div className="profile-details">
                <h4 className="profile-name">{currentUser?.username || "Pengguna"}</h4>
                <p className="profile-role">{role === "admin" ? "Administrator" : "Pengunjung"}</p>
              </div>
            </div>
            <button onClick={() => setCurrentView("profile")} style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }} title="Pengaturan Profil">
              <Settings size={18} />
            </button>
          </div>
          <button className="role-switcher-btn" onClick={onLogout} style={{ borderColor: "#fee2e2", color: "#b91c1c", background: "#fef2f2", marginTop: 16 }}>
            <Shield size={14} />Keluar (Logout)
          </button>
        </div>
      </aside>

      {/* Content */}
      <section className="content-wrapper">
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar-title-section">
            <h1>{viewTitles[currentView]}</h1>
            <p>{viewSubtitles[currentView]}</p>
          </div>
          <div className="topbar-actions" style={{ justifyContent: "flex-end", gap: "16px" }}>
            <button className="topbar-icon-btn" onClick={() => setCurrentView("profile")} title="Pengaturan Profil"><Settings size={18} /></button>
            <div className={`profile-avatar ${role !== "admin" ? "visitor" : ""}`} style={{ width: 34, height: 34, fontSize: 12, cursor: "pointer" }} onClick={() => setCurrentView("profile")}>
              {currentUser?.username?.slice(0, 2).toUpperCase() || (role === "admin" ? "AD" : "PG")}
            </div>
          </div>
        </header>

        {/* Status Banner */}
        {status && (
          <div className="status-banner">
            <div className="status-message"><Info size={16} /><span>{status}</span></div>
            <button className="status-clear-btn" onClick={() => setStatus("")}>Sembunyikan</button>
          </div>
        )}

        {/* ── VIEW: DASHBOARD ── */}
        {currentView === "dashboard" && (
          <>
            {!result && (
              <div className="card" style={{ textAlign: "center", padding: "40px 24px", color: "var(--text-muted)" }}>
                <Database size={40} style={{ margin: "0 auto 16px", opacity: 0.4 }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "var(--text-main)" }}>Belum Ada Data Analisis</h3>
                <p style={{ fontSize: 14 }}>Silakan login sebagai <strong>Admin</strong>, lalu upload file CSV melalui menu <strong>Admin Upload</strong>.</p>
              </div>
            )}
            {result && (<>
              <div className="card">
                <div className="card-header-flex">
                  <div className="card-title-section">
                    <h3>Market Overview</h3>
                    <p>Data terakhir dianalisis: {result?.arima?.preprocessing?.end_date || "-"}</p>
                  </div>
                  <span className="card-badge-live">LIVE</span>
                </div>
                <div className="grid-4">
                  <MetricCard label="Closing Price" value={result?.arima?.actual_tail?.slice(-1)[0]?.value != null ? formatRupiah(result.arima.actual_tail.slice(-1)[0].value) : "-"} subtext="Harga Penutupan Terakhir" />
                  <MetricCard label="Volume" value="-" subtext="Tidak tersedia" />
                  <MetricCard label="Market Cap" value="-" subtext="Tidak tersedia" />
                  <MetricCard label="Rekomendasi" value={result?.recommendation?.summary ? "Lihat Detail" : "-"} subtext={result?.recommendation?.summary || "Belum ada analisis"} />
                </div>
              </div>

              {/* Date Picker */}
              <div className="card" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)", color: "white" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: "white" }}>🔍 Proyeksi Harga pada Tanggal Tertentu</h3>
                    <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>Pilih tanggal untuk melihat estimasi harga saham TLKM</p>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <input type="date" value={dashboardTargetDate} onChange={(e) => { setDashboardTargetDate(e.target.value); setDashboardForecastResult(null); }}
                      style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)", color: "white", fontSize: 14, outline: "none", colorScheme: "dark" }} />
                    <button onClick={handleDashboardForecast} disabled={isDashboardLoading || !dashboardTargetDate}
                      style={{ padding: "10px 22px", background: isDashboardLoading || !dashboardTargetDate ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #0047b3, #38bdf8)", color: isDashboardLoading || !dashboardTargetDate ? "#94a3b8" : "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                      <RefreshCw size={14} className={isDashboardLoading ? "spin" : ""} />
                      {isDashboardLoading ? "Menghitung..." : "Lanjutkan"}
                    </button>
                    {dashboardForecastPrice && (
                      <div style={{ background: "rgba(56,189,248,0.15)", border: "1.5px solid rgba(56,189,248,0.3)", borderRadius: 10, padding: "8px 16px" }}>
                        <span style={{ fontSize: 11, color: "#38bdf8", fontWeight: 700, textTransform: "uppercase" }}>Estimasi {dashboardForecastPrice.date}</span>
                        <div style={{ fontSize: 20, fontWeight: 800, color: "white" }}>{formatRupiah(dashboardForecastPrice.value)}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Chart + ARIMA Panel */}
              <div className="grid-2-1">
                <div className="card">
                  <div className="card-header-flex">
                    <div className="card-title-section"><h3>Price Trend</h3><p>{activeForecastLabel}</p></div>
                    <span className="status-indicator success" style={{ fontSize: 10, padding: "2px 8px" }}>LIVE</span>
                  </div>
                  <div className="chart-container-inner">
                    {dashboardChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={dashboardChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="dashActual" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0047b3" stopOpacity={0.15} /><stop offset="95%" stopColor="#0047b3" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="dashForecast" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.12} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "#94a3b8" }} minTickGap={20} />
                          <YAxis domain={["auto", "auto"]} tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "#94a3b8" }} />
                          <Tooltip contentStyle={{ backgroundColor: "#ffffff", borderRadius: 8, border: "1px solid var(--border-color)", fontSize: 12 }} formatter={(val, name) => [val != null ? formatRupiah(val) : "-", name]} />
                          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                          <Area type="monotone" dataKey="actual" stroke="#0047b3" strokeWidth={2} fill="url(#dashActual)" name="Harga Aktual" dot={false} connectNulls={false} />
                          <Area type="monotone" dataKey="forecast" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" fill="url(#dashForecast)" name="Proyeksi" dot={false} connectNulls={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#64748b" }}>Belum ada data visualisasi</div>
                    )}
                  </div>
                </div>

                <div className="arima-panel-dark">
                  <div className="arima-dark-header"><h3>ARIMA Prediction</h3></div>
                  <div className="arima-dark-target">
                    <span>{dashboardForecastPrice ? `Target Price (${dashboardForecastPrice.date})` : `Target Price (${result?.arima?.model?.horizon || 14}D)`}</span>
                    <div className="arima-dark-price">{dashboardForecastPrice ? formatRupiah(dashboardForecastPrice.value) : (targetPrice != null ? formatRupiah(targetPrice) : "-")}</div>
                    <div className="arima-dark-growth">{dashboardForecastPrice ? `Proyeksi hingga ${dashboardForecastPrice.date}` : `Proyeksi ${result?.arima?.model?.horizon || 14} hari ke depan`}</div>
                  </div>
                  <div className="arima-dark-stats">
                    {[
                      ["Akurasi Model", accuracy || "-"],
                      ["Lower Bound", (dashboardForecastPrice?.value ?? targetPrice) != null ? formatRupiah((dashboardForecastPrice?.value ?? targetPrice) * 0.98) : "-"],
                      ["Upper Bound", (dashboardForecastPrice?.value ?? targetPrice) != null ? formatRupiah((dashboardForecastPrice?.value ?? targetPrice) * 1.02) : "-"],
                    ].map(([label, val]) => (
                      <div className="arima-dark-stat-row" key={label}>
                        <span className="arima-dark-stat-label">{label}</span>
                        <span className="arima-dark-stat-val">{val}</span>
                      </div>
                    ))}
                  </div>
                  <button className="arima-dark-btn" onClick={() => setCurrentView("arima")}>DETAIL PROYEKSI</button>
                </div>
              </div>

              {/* Financial Status */}
              <div className="card">
                <div className="card-header-flex">
                  <div className="card-title-section"><h3>Financial Status</h3><p>Metrik utama rasio keuangan terbaru PT Telkom Indonesia</p></div>
                  <button className="btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => setCurrentView("fundamental")}>DETAILS</button>
                </div>
                <div className="grid-3">
                  {[
                    { label: "P/E RATIO", value: result?.fundamental?.latest?.per != null ? `${result.fundamental.latest.per.toFixed(1)}x` : "-", sub: "Above Average", subColor: "var(--accent-red)" },
                    { label: "DIVIDEND YIELD", value: "-", sub: "Tidak tersedia", subColor: "var(--text-muted)" },
                    { label: "ROE", value: result?.fundamental?.latest?.roe != null ? `${(result.fundamental.latest.roe * 100).toFixed(1)}%` : "-", sub: "Strong", subColor: "var(--accent-green)" },
                  ].map(({ label, value, sub, subColor }) => (
                    <div key={label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>{label}</span>
                      <strong style={{ fontSize: 20 }}>{value}</strong>
                      <span style={{ fontSize: 12, color: subColor, fontWeight: 600 }}>{sub}</span>
                    </div>
                  ))}
                </div>
                <div className="health-index-section">
                  <div className="health-header">
                    <span className="health-label">Health Index</span>
                    <span className="health-score">{result?.fundamental?.health_score != null ? `${result.fundamental.health_score} / 100` : "-"}</span>
                  </div>
                  <div className="health-bar-bg">
                    <div className="health-bar-fill" style={{ width: result?.fundamental?.health_score != null ? `${result.fundamental.health_score}%` : "0%" }} />
                  </div>
                </div>
              </div>
            </>)}
          </>
        )}

        {/* ── VIEW: ARIMA ── */}
        {currentView === "arima" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>Saham / <strong>TLKM.JK</strong></span>
                <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>Proyeksi pergerakan harga saham Telkom menggunakan model statistik ARIMA.</p>
              </div>
              <div className="card" style={{ padding: "12px 20px" }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>HARGA TERAKHIR</span>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>
                  {result?.arima?.actual_tail?.slice(-1)[0]?.value != null ? formatRupiah(result.arima.actual_tail.slice(-1)[0].value) : "-"}
                </div>
              </div>
            </div>

            {/* Date Picker ARIMA */}
            <div className="card" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)", color: "white" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: "white" }}>🔮 Proyeksi Harga Berkelanjutan</h3>
                  <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>Pilih tanggal target untuk melihat semua prediksi harga hingga tanggal tersebut</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <input
                    type="date"
                    value={arimaTargetDate}
                    onChange={(e) => { setArimaTargetDate(e.target.value); setArimaForecastResult(null); }}
                    style={{ padding: "10px 14px", borderRadius: 10, border: "1.5px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.08)", color: "white", fontSize: 14, outline: "none", colorScheme: "dark" }}
                  />
                  <button
                    onClick={handleArimaForecast}
                    disabled={isArimaLoading || !arimaTargetDate || !result?.arima}
                    style={{ padding: "10px 22px", background: isArimaLoading || !arimaTargetDate || !result?.arima ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #0047b3, #38bdf8)", color: isArimaLoading || !arimaTargetDate || !result?.arima ? "#94a3b8" : "white", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                    <RefreshCw size={14} className={isArimaLoading ? "spin" : ""} />
                    {isArimaLoading ? "Menghitung..." : "Jalankan Prediksi"}
                  </button>
                  {arimaForecastResult?.forecast?.length > 0 && (
                    <div style={{ background: "rgba(56,189,248,0.15)", border: "1.5px solid rgba(56,189,248,0.3)", borderRadius: 10, padding: "8px 16px" }}>
                      <span style={{ fontSize: 11, color: "#38bdf8", fontWeight: 700, textTransform: "uppercase" }}>
                        {arimaForecastResult.forecast.length} Hari Diprediksi
                      </span>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "white" }}>
                        {formatRupiah(arimaForecastResult.forecast[arimaForecastResult.forecast.length - 1].value)}
                      </div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>
                        Estimasi {arimaForecastResult.forecast[arimaForecastResult.forecast.length - 1].date}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="grid-2-1">
              <div className="card">
                <div className="card-header-flex">
                  <div className="card-title-section">
                    <h3>
                      {arimaForecastResult
                        ? `Proyeksi hingga ${arimaForecastResult.forecast?.[arimaForecastResult.forecast.length - 1]?.date || arimaTargetDate}`
                        : "Proyeksi 14 Hari ke Depan"}
                    </h3>
                    <p>
                      {arimaForecastResult
                        ? `${arimaForecastResult.forecast?.length || 0} titik prediksi ditampilkan`
                        : "Rentang data aktual penutupan dan perkiraan model"}
                    </p>
                  </div>
                </div>
                <div className="chart-container-inner" style={{ height: 350 }}>
                  {arimaChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={arimaChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent-blue)" stopOpacity={0.2} /><stop offset="95%" stopColor="var(--accent-blue)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--accent-red)" stopOpacity={0.1} /><stop offset="95%" stopColor="var(--accent-red)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="date" tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "#94a3b8" }} minTickGap={30} />
                        <YAxis domain={["auto", "auto"]} tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "#94a3b8" }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "#ffffff", borderRadius: 8, border: "1px solid var(--border-color)", fontSize: 12 }}
                          formatter={(val, name) => [val != null ? formatRupiah(val) : "-", name]}
                        />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                        <Area type="monotone" dataKey="actual" stroke="var(--accent-blue)" strokeWidth={2} fillOpacity={1} fill="url(#colorActual)" name="Harga Aktual" dot={false} />
                        <Area type="monotone" dataKey="forecast" stroke="var(--accent-red)" strokeWidth={2} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorForecast)" name="Proyeksi Forecast" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "#64748b" }}>Belum ada data visualisasi</div>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div className="accuracy-card">
                  <span className="accuracy-label">AKURASI MODEL</span>
                  <div className="accuracy-value">{arimaAccuracy || "-"}</div>
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
                      <strong style={{ fontSize: 14 }}>{arimaActiveForecast?.metrics?.aic != null ? arimaActiveForecast.metrics.aic.toFixed(2) : "-"}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>MAE</span>
                      <strong style={{ fontSize: 14 }}>{arimaActiveForecast?.metrics?.mae != null ? arimaActiveForecast.metrics.mae.toFixed(2) : "-"}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>RMSE</span>
                      <strong style={{ fontSize: 14 }}>{arimaActiveForecast?.metrics?.rmse != null ? arimaActiveForecast.metrics.rmse.toFixed(2) : "-"}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>MAPE</span>
                      <strong style={{ fontSize: 14 }}>{arimaActiveForecast?.metrics?.mape != null ? arimaActiveForecast.metrics.mape.toFixed(2) + "%" : "-"}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Jumlah Prediksi</span>
                      <strong style={{ fontSize: 14, color: arimaActiveForecast?.forecast?.length > 0 ? "var(--accent-green)" : "var(--text-muted)" }}>
                        {arimaActiveForecast?.forecast?.length ?? "-"} hari
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabel Forecast Lengkap */}
            {arimaActiveForecast?.forecast?.length > 0 && (
              <div className="card">
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
                  Detail Prediksi Harga — {arimaActiveForecast.forecast.length} Hari ke Depan
                </h3>
                <div className="table-responsive" style={{ maxHeight: 400, overflowY: "auto" }}>
                  <table className="custom-table" style={{ fontSize: 13 }}>
                    <thead>
                      <tr>
                        <th>No.</th>
                        <th>Tanggal</th>
                        <th>Harga Prediksi</th>
                        <th>Perubahan (vs hari sebelumnya)</th>
                        <th>Batas Bawah (−2%)</th>
                        <th>Batas Atas (+2%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {arimaActiveForecast.forecast.map((item, idx) => {
                        const prevVal = idx === 0
                          ? arimaActiveForecast.actual_tail?.[arimaActiveForecast.actual_tail.length - 1]?.value
                          : arimaActiveForecast.forecast[idx - 1].value;
                        const change = prevVal != null ? item.value - prevVal : null;
                        const changePct = prevVal != null ? ((item.value - prevVal) / prevVal * 100) : null;
                        return (
                          <tr key={idx}>
                            <td style={{ color: "var(--text-muted)" }}>{idx + 1}</td>
                            <td><strong>{item.date}</strong></td>
                            <td><strong style={{ color: "var(--accent-blue)" }}>{formatRupiah(item.value)}</strong></td>
                            <td>
                              {change != null ? (
                                <span style={{ color: change >= 0 ? "var(--accent-green)" : "var(--accent-red)", fontWeight: 600 }}>
                                  {change >= 0 ? "▲" : "▼"} {formatRupiah(Math.abs(change))} ({changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%)
                                </span>
                              ) : "-"}
                            </td>
                            <td style={{ color: "var(--text-muted)" }}>{formatRupiah(item.value * 0.98)}</td>
                            <td style={{ color: "var(--text-muted)" }}>{formatRupiah(item.value * 1.02)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="card">
              <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Mengenal ARIMA</h3>
              <ul className="explanation-list">
                <li><strong>AutoRegressive (p):</strong> Mengukur pengaruh tren masa lalu terhadap nilai saat ini.</li>
                <li><strong>Integrated (d):</strong> Menstabilkan data harga saham melalui proses differencing.</li>
                <li><strong>Moving Average (q):</strong> Menghaluskan fluktuasi jangka pendek akibat gangguan acak pasar.</li>
              </ul>
            </div>
          </>
        )}

        {/* ── VIEW: FUNDAMENTAL ── */}
        {currentView === "fundamental" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>STOCKS / <strong>TLKM.JK</strong></span>
                <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>
                  Laporan ringkas kesehatan keuangan PT Telkom Indonesia (Persero) Tbk.
                  {result?.fundamental?.latest_year && ` · Periode ${result.fundamental.latest_year}`}
                </p>
              </div>
              {result?.fundamental?.status && (
                <span className={`status-indicator ${result.fundamental.status === "undervalued" ? "success" : result.fundamental.status === "overvalued" ? "danger" : "warning"}`}
                  style={{ fontSize: 12, padding: "4px 12px", textTransform: "uppercase" }}>
                  {result.fundamental.status}
                </span>
              )}
            </div>
            {!latestFund && (
              <div className="card" style={{ textAlign: "center", padding: "40px 24px", color: "var(--text-muted)" }}>
                <BarChart3 size={40} style={{ margin: "0 auto 16px", opacity: 0.4 }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "var(--text-main)" }}>Belum Ada Data Fundamental</h3>
                <p style={{ fontSize: 14 }}>Upload file CSV laporan keuangan melalui menu <strong>Admin Upload</strong>.</p>
              </div>
            )}
            {latestFund && (<>
              <div className="card">
                <div className="card-header-flex">
                  <div className="card-title-section">
                    <h3>Ringkasan Metrik Keuangan</h3>
                    <p>Data terbaru — Periode {result?.fundamental?.latest_year || "-"}</p>
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="custom-table">
                    <thead><tr><th>Indikator</th><th>Nilai</th><th>Keterangan</th></tr></thead>
                    <tbody>
                      {[
                        ["EPS — Earnings Per Share", latestFund.eps != null ? `IDR ${latestFund.eps.toLocaleString("id-ID", { maximumFractionDigits: 2 })}` : "-", "Laba bersih per lembar saham"],
                        ["PER — Price to Earnings Ratio", latestFund.per != null ? `${latestFund.per.toFixed(2)}x` : "-", "Harga saham dibagi EPS"],
                        ["ROE — Return on Equity", latestFund.roe != null ? `${(latestFund.roe * 100).toFixed(2)}%` : "-", "Efisiensi penggunaan modal sendiri"],
                        ["DER — Debt to Equity Ratio", latestFund.der != null ? `${latestFund.der.toFixed(2)}x` : "-", "Rasio hutang terhadap ekuitas"],
                        ["BVPS — Book Value Per Share", latestFund.bvps != null ? `IDR ${latestFund.bvps.toLocaleString("id-ID", { maximumFractionDigits: 2 })}` : "-", "Nilai buku per lembar saham"],
                        ["PBV — Price to Book Value", latestFund.pbv != null ? `${latestFund.pbv.toFixed(2)}x` : "-", "Harga saham dibagi nilai buku"],
                        ["Harga Pasar", latestFund.market_price != null ? formatRupiah(latestFund.market_price) : "-", "Harga penutupan terakhir di dataset"],
                      ].map(([label, value, desc]) => (
                        <tr key={label}><td><strong>{label}</strong></td><td><strong>{value}</strong></td><td>{desc}</td></tr>
                      ))}
                      <tr>
                        <td><strong>Nilai Intrinsik</strong></td>
                        <td>
                          <strong style={{ color: latestFund.intrinsic_value != null && latestFund.market_price != null ? (latestFund.intrinsic_value > latestFund.market_price ? "var(--accent-green)" : "var(--accent-red)") : "inherit" }}>
                            {latestFund.intrinsic_value != null ? formatRupiah(latestFund.intrinsic_value) : "-"}
                          </strong>
                        </td>
                        <td>EPS × PER Wajar ({params.per_wajar}x) — {latestFund.intrinsic_value != null && latestFund.market_price != null ? (latestFund.intrinsic_value > latestFund.market_price ? "Saham undervalued ✓" : "Saham overvalued ✗") : "-"}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="grid-3">
                <MetricCard label="Harga Pasar" value={latestFund.market_price != null ? formatRupiah(latestFund.market_price) : "-"} subtext="Harga saham terakhir" />
                <MetricCard label="Nilai Intrinsik" value={latestFund.intrinsic_value != null ? formatRupiah(latestFund.intrinsic_value) : "-"} subtext={`Berdasarkan PER Wajar ${params.per_wajar}x`} />
                <MetricCard label="Selisih Valuasi" value={latestFund.valuation_gap != null ? formatRupiah(Math.abs(latestFund.valuation_gap)) : "-"}
                  subtext={latestFund.valuation_gap != null ? (latestFund.valuation_gap > 0 ? "Di bawah nilai wajar (Undervalued)" : "Di atas nilai wajar (Overvalued)") : "-"}
                  isTrendUp={latestFund.valuation_gap > 0} />
              </div>
              <div className="card">
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Kesimpulan Analisis</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
                  <p>{result?.fundamental?.summary || "-"}</p>
                  {result?.fundamental?.interpretation?.map((line, i) => <p key={i}>• {line}</p>)}
                </div>
              </div>
              {result?.fundamental?.rows?.length > 1 && (
                <div className="card">
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Riwayat Per Tahun</h3>
                  <div className="table-responsive">
                    <table className="custom-table" style={{ fontSize: 13 }}>
                      <thead><tr><th>Tahun</th><th>EPS</th><th>PER</th><th>ROE</th><th>DER</th><th>BVPS</th><th>PBV</th><th>Harga Pasar</th><th>Nilai Intrinsik</th></tr></thead>
                      <tbody>
                        {result.fundamental.rows.map((row, i) => (
                          <tr key={i}>
                            <td><strong>{row.year}</strong></td>
                            <td>{row.eps != null ? `IDR ${row.eps.toLocaleString("id-ID", { maximumFractionDigits: 0 })}` : "-"}</td>
                            <td>{row.per != null ? `${row.per.toFixed(2)}x` : "-"}</td>
                            <td>{row.roe != null ? `${(row.roe * 100).toFixed(1)}%` : "-"}</td>
                            <td>{row.der != null ? `${row.der.toFixed(2)}x` : "-"}</td>
                            <td>{row.bvps != null ? `IDR ${row.bvps.toLocaleString("id-ID", { maximumFractionDigits: 0 })}` : "-"}</td>
                            <td>{row.pbv != null ? `${row.pbv.toFixed(2)}x` : "-"}</td>
                            <td>{row.market_price != null ? formatRupiah(row.market_price) : "-"}</td>
                            <td>{row.intrinsic_value != null ? formatRupiah(row.intrinsic_value) : "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>)}
          </>
        )}

        {/* ── VIEW: ADMIN UPLOAD ── */}
        {currentView === "admin" && role === "admin" && (
          <div className="card" style={{ maxWidth: 800, margin: "0 auto", width: "100%" }}>
            <div className="card-header-flex">
              <div className="card-title-section"><h3>Pembaruan Dataset</h3><p>Gunakan panel di bawah untuk mengunggah berkas harga historis atau laporan keuangan.</p></div>
            </div>
            <form onSubmit={handleUpload} className="upload-panel">
              <div className="form-group">
                <label style={{ fontSize: 13, fontWeight: 700 }}>Pilih Kategori Data</label>
                <select className="form-input" value={uploadCategory}
                  onChange={(e) => { setUploadCategory(e.target.value); setPriceFile(null); setFinancialFile(null); const input = document.getElementById("csv-file-picker"); if (input) input.value = ""; }}
                  style={{ width: "100%" }}>
                  <option value="price_historical">Harga Saham Historis (Daily CSV)</option>
                  <option value="financial_annual">Laporan Keuangan Historis (Annual CSV)</option>
                </select>
              </div>
              <div className="dropzone">
                <FileUp className="dropzone-icon" size={36} />
                <div className="dropzone-text">
                  {uploadCategory === "price_historical"
                    ? (priceFile ? `Terpilih: ${priceFile.name}` : "Klik atau seret file CSV Harga Saham di sini")
                    : (financialFile ? `Terpilih: ${financialFile.name}` : "Klik atau seret file CSV Laporan Keuangan di sini")}
                </div>
                <div className="dropzone-sub">Mendukung format .CSV (Maks. 25MB)</div>
                <input id="csv-file-picker" type="file" accept=".csv" className="hidden-file-input"
                  onChange={(e) => { const file = e.target.files?.[0]; if (uploadCategory === "price_historical") setPriceFile(file || null); else setFinancialFile(file || null); }} />
                <button type="button" className="file-select-btn" onClick={() => document.getElementById("csv-file-picker").click()}>Pilih File dari Komputer</button>
              </div>
              <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={isUploading || isAnalyzing}>
                  {isUploading ? "Mengunggah..." : isAnalyzing ? "Menganalisis..." : "Unggah dan Proses Data"}
                </button>
                <button type="button" className="btn-secondary" onClick={() => { setPriceFile(null); setFinancialFile(null); setUploadedPreview(null); }}>Reset Form</button>
              </div>
            </form>

            {uploadedPreview && (
              <div style={{ marginTop: 24, borderTop: "1px solid var(--border-color)", paddingTop: 16 }}>
                <h4 style={{ marginBottom: 12, fontWeight: 700 }}>Pratinjau Data: {uploadedPreview.filename}</h4>
                <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>Menampilkan {uploadedPreview.data.length} dari {uploadedPreview.rowsTotal} baris data.</p>
                <div className="table-responsive" style={{ maxHeight: 400, overflow: "auto" }}>
                  <table className="custom-table" style={{ fontSize: 13 }}>
                    <thead><tr>{uploadedPreview.columns.map((col, idx) => <th key={idx}>{col}</th>)}</tr></thead>
                    <tbody>{uploadedPreview.data.map((row, rowIdx) => (
                      <tr key={rowIdx}>{uploadedPreview.columns.map((col, colIdx) => <td key={colIdx}>{row[col] !== null && row[col] !== undefined ? String(row[col]) : "-"}</td>)}</tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ marginTop: 24, borderTop: "1px solid var(--border-color)", paddingTop: 16 }}>
              <h4 style={{ marginBottom: 12, fontWeight: 700 }}>Manajemen File Dataset</h4>
              {filesList && filesList.length > 0 ? (
                <div className="table-responsive" style={{ maxHeight: 300, overflow: "auto" }}>
                  <table className="custom-table" style={{ fontSize: 13 }}>
                    <thead><tr><th>Nama File</th><th>Ukuran</th><th>Tanggal Upload</th><th style={{ textAlign: "center" }}>Aksi</th></tr></thead>
                    <tbody>{filesList.map((file, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{file.filename}</td>
                        <td>{(file.size_bytes / 1024).toFixed(1)} KB</td>
                        <td>{new Date(file.created_at * 1000).toLocaleString("id-ID")}</td>
                        <td style={{ textAlign: "center" }}>
                          <button className="btn-secondary" style={{ padding: "4px 8px", fontSize: 11, color: "var(--accent-red)", borderColor: "var(--accent-red)", background: "transparent" }} onClick={() => handleDeleteFile(file.filename)}>Hapus</button>
                        </td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              ) : <p style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic" }}>Belum ada file yang diunggah.</p>}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-color)", paddingTop: 16, marginTop: 24 }}>
              <div className="system-status-indicator"><span className="status-dot" /><span>Sistem Siap</span></div>
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Update terakhir: {result?.arima?.preprocessing?.end_date || "-"}</span>
            </div>
          </div>
        )}

        {/* ── Riwayat Analisis (Footer) ── */}
        {currentView !== "admin" && (
          <div className="card">
            <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Riwayat Analisis Terbaru</h3>
            <div className="table-responsive">
              <table className="custom-table">
                <thead><tr><th>Waktu Analisis</th><th>Jenis Analisis</th><th>Ringkasan Hasil</th></tr></thead>
                <tbody>
                  {history.length > 0 ? history.slice(0, 5).map((item) => (
                    <tr key={item.id}>
                      <td>{item.created_at}</td>
                      <td><span className={`status-indicator ${item.analysis_type === "COMPARE" ? "success" : "warning"}`}>{item.analysis_type}</span></td>
                      <td>{item.summary}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan="3" style={{ textAlign: "center", color: "var(--text-muted)" }}>Belum ada riwayat analisis</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── VIEW: PROFILE ── */}
        {currentView === "profile" && <ProfileSettingsView currentUser={currentUser} onUpdateUser={onUpdateUser} />}

      </section>
    </main>
  );
}

export default App;
