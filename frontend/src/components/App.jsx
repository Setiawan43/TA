import React, { useMemo, useState, useEffect } from "react";
import {
  Activity, BarChart3, Database, FileUp, RefreshCw,
  Settings, Shield, Info, TrendingUp
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip as RechartsTooltip, Legend,
  BarChart, Bar, Cell
} from "recharts";
import { getHistory, getLatestAnalysis, postJson, uploadCsv, getFiles, deleteFile } from "../services/api";
import MetricCard from "./MetricCard";
import ProfileSettingsView from "./ProfileSettingsView";
import BeginnerGuide from "./BeginnerGuide";

// ── Formatter ─────────────────────────────────────────────────────────────────
const formatRupiah = (val) => {
  if (val === undefined || val === null || isNaN(val)) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency", currency: "IDR", maximumFractionDigits: 0,
  }).format(val);
};

// ── Tooltip Component ─────────────────────────────────────────────────────────
function Tooltip({ text, children }) {
  const [visible, setVisible] = React.useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%",
          transform: "translateX(-50%)", background: "#1e293b",
          color: "#e2e8f0", fontSize: 11, fontWeight: 500, lineHeight: 1.5,
          padding: "7px 10px", borderRadius: 7, whiteSpace: "nowrap",
          maxWidth: 220, whiteSpace: "normal", textAlign: "center",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)", zIndex: 999,
          pointerEvents: "none",
        }}>
          {text}
          <span style={{
            position: "absolute", top: "100%", left: "50%",
            transform: "translateX(-50%)", border: "5px solid transparent",
            borderTopColor: "#1e293b",
          }} />
        </span>
      )}
    </span>
  );
}

// ── InfoIcon ──────────────────────────────────────────────────────────────────
function InfoIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ marginLeft: 4, opacity: 0.5, cursor: "help", flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function App({ currentUser, onLogout, onUpdateUser, onGoLogin = () => {} }) {
  const role = currentUser?.role || "visitor";
  const [currentView, setCurrentView] = useState("dashboard");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [params, setParams] = useState({ horizon: 30, train_ratio: 0.8, per_wajar: 8.0, p: "", d: "", q: "" });
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
  const [uploadSuccess, setUploadSuccess] = useState(null); // { filename, rows }
  const [beginnerMode, setBeginnerMode] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

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
          horizon: data.arima.model.horizon || 30,
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

  const handleAnalyzeCompare = async (pricePath, financialPath) => {
    // Run combined analysis — updates both arima, fundamental, AND recommendation
    const currentPricePath = pricePath || pendingPricePath || result?.arima?.preprocessing?.price_csv_path;
    const currentFinancialPath = financialPath || pendingFinancialPath || result?.fundamental?.financial_csv_path;
    if (!currentPricePath || !currentFinancialPath) {
      // Fall back to individual analysis if only one file is available
      if (pricePath || pendingPricePath || result?.arima?.preprocessing?.price_csv_path) {
        await handleAnalyzeArima(currentPricePath);
      }
      if (financialPath || pendingFinancialPath || result?.fundamental?.financial_csv_path) {
        await handleAnalyzeFundamental(currentFinancialPath);
      }
      return;
    }
    try {
      setIsAnalyzing(true);
      setStatus("Menjalankan analisis lengkap (ARIMA + Fundamental)...");
      const compareData = await postJson("/analyze/compare", {
        price_csv_path: currentPricePath,
        financial_csv_path: currentFinancialPath,
        horizon: Number(params.horizon),
        train_ratio: Number(params.train_ratio),
        per_wajar: Number(params.per_wajar),
        p: params.p === "" ? null : Number(params.p),
        d: params.d === "" ? null : Number(params.d),
        q: params.q === "" ? null : Number(params.q),
      });
      setResult(compareData);
      setStatus("Analisis lengkap selesai.");
      await loadHistory();
    } catch (error) { setStatus(`Analisis gagal: ${error.message}`); }
    finally { setIsAnalyzing(false); }
  };

  const handleAnalyzeArima = async (pricePath) => {
    try {
      setIsAnalyzing(true);
      setStatus("Menjalankan analisis ARIMA...");
      const computedHorizon = Number(params.horizon);
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
    const computedHorizon = Math.max(1, Math.min(90, count));
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

  // ── Upload handlers per modul ─────────────────────────────────────────────

  const handleUploadArima = async (e) => {
    e.preventDefault();
    if (role !== "admin") return;
    if (!priceFile) { setStatus("Silakan pilih file CSV harga terlebih dahulu."); return; }
    try {
      setIsUploading(true);
      setStatus("Mengunggah data harga saham...");
      const res = await uploadCsv("/upload/price", priceFile);
      const newPricePath = res.file_path;
      setPendingPricePath(newPricePath);
      if (res.preview_data) {
        setUploadedPreview({ filename: priceFile.name, columns: res.columns, data: res.preview_data, rowsTotal: res.rows });
      }
      setPriceFile(null);
      // Jalankan analisis ARIMA
      try {
        setIsAnalyzing(true);
        setStatus("Menjalankan analisis ARIMA...");
        const arimaData = await postJson("/analyze/arima", {
          price_csv_path: newPricePath,
          horizon: Number(params.horizon),
          train_ratio: Number(params.train_ratio),
          p: params.p === "" ? null : Number(params.p),
          d: params.d === "" ? null : Number(params.d),
          q: params.q === "" ? null : Number(params.q),
        });
        // Simpan hasil ARIMA, pertahankan fundamental jika ada
        // Jika fundamental juga ada → jalankan compare untuk rekomendasi gabungan
        const currentFinancialPath = pendingFinancialPath || result?.fundamental?.financial_csv_path;
        if (currentFinancialPath) {
          const compareData = await postJson("/analyze/compare", {
            price_csv_path: newPricePath,
            financial_csv_path: currentFinancialPath,
            horizon: Number(params.horizon),
            train_ratio: Number(params.train_ratio),
            per_wajar: Number(params.per_wajar),
            p: params.p === "" ? null : Number(params.p),
            d: params.d === "" ? null : Number(params.d),
            q: params.q === "" ? null : Number(params.q),
          });
          setResult(compareData);
        } else {
          setResult(prev => ({ ...(prev || {}), arima: arimaData, recommendation: arimaData.recommendation }));
        }
        setStatus("Analisis ARIMA selesai.");
        await loadHistory();
      } catch (err) { setStatus(`Analisis ARIMA gagal: ${err.message}`); }
      finally { setIsAnalyzing(false); }
      await loadFiles();
      setUploadSuccess({ filename: priceFile.name || res.rows + " baris", rows: res.rows, type: "arima" });
      setTimeout(() => { setUploadSuccess(null); }, 2500);
    } catch (error) { setStatus(`Gagal mengunggah: ${error.message}`); }
    finally { setIsUploading(false); }
  };

  const handleUploadFundamental = async (e) => {
    e.preventDefault();
    if (role !== "admin") return;
    if (!financialFile) { setStatus("Silakan pilih file CSV laporan keuangan terlebih dahulu."); return; }
    try {
      setIsUploading(true);
      setStatus("Mengunggah data laporan keuangan...");
      const res = await uploadCsv("/upload/financial", financialFile);
      const newFinancialPath = res.file_path;
      setPendingFinancialPath(newFinancialPath);
      if (res.preview_data) {
        setUploadedPreview({ filename: financialFile.name, columns: res.columns, data: res.preview_data, rowsTotal: res.rows });
      }
      setFinancialFile(null);
      // Jalankan analisis Fundamental
      try {
        setIsAnalyzing(true);
        setStatus("Menjalankan analisis fundamental...");
        const fundData = await postJson("/analyze/fundamental", {
          financial_csv_path: newFinancialPath,
          per_wajar: Number(params.per_wajar),
        });
        // Simpan hasil Fundamental, pertahankan ARIMA jika ada
        // Jika ARIMA juga ada → jalankan compare untuk rekomendasi gabungan
        const currentPricePath = pendingPricePath || result?.arima?.preprocessing?.price_csv_path;
        if (currentPricePath) {
          const compareData = await postJson("/analyze/compare", {
            price_csv_path: currentPricePath,
            financial_csv_path: newFinancialPath,
            horizon: Number(params.horizon),
            train_ratio: Number(params.train_ratio),
            per_wajar: Number(params.per_wajar),
            p: params.p === "" ? null : Number(params.p),
            d: params.d === "" ? null : Number(params.d),
            q: params.q === "" ? null : Number(params.q),
          });
          setResult(compareData);
        } else {
          setResult(prev => ({ ...(prev || {}), fundamental: fundData, recommendation: fundData.recommendation }));
        }
        setStatus("Analisis fundamental selesai.");
        await loadHistory();
      } catch (err) { setStatus(`Analisis fundamental gagal: ${err.message}`); }
      finally { setIsAnalyzing(false); }
      await loadFiles();
      setUploadSuccess({ filename: financialFile.name || res.rows + " baris", rows: res.rows, type: "fundamental" });
      setTimeout(() => { setUploadSuccess(null); }, 2500);
    } catch (error) { setStatus(`Gagal mengunggah: ${error.message}`); }
    finally { setIsUploading(false); }
  };

  // Legacy handler (tidak dipakai lagi, dipertahankan untuk kompatibilitas test)
  const handleUpload = async (e) => {
    e.preventDefault();
    if (role !== "admin") return;
    const isPriceUpload = uploadCategory === "price_historical";
    if (isPriceUpload) { await handleUploadArima(e); } else { await handleUploadFundamental(e); }
  };

  useEffect(() => { loadLatest(); loadHistory(); if (role === "admin") loadFiles(); }, [role]);

  // ── Memoized chart data ──────────────────────────────────────────────────────
  const dashboardChartData = useMemo(() => {
    const arima = dashboardForecastResult || result?.arima;
    if (!arima?.actual_tail) return [];
    const historical = arima.actual_tail.slice(-25).map((x) => ({ date: x.date, actual: x.value, forecast: null, lower: null, upper: null }));
    const lastHist = arima.actual_tail[arima.actual_tail.length - 1];
    const forecastData = (arima.forecast || []).map((x) => ({ date: x.date, actual: null, forecast: x.value, lower: x.lower ?? null, upper: x.upper ?? null }));
    if (lastHist && forecastData.length > 0) { forecastData[0].actual = lastHist.value; forecastData[0].forecast = lastHist.value; }
    return [...historical, ...forecastData];
  }, [dashboardForecastResult, result]);

  // Y-axis domain untuk dashboard chart — zoom ke area proyeksi saat ada forecast result
  const dashboardYDomain = useMemo(() => {
    if (!dashboardForecastResult) return ["auto", "auto"];
    const arima = dashboardForecastResult;
    const allValues = [
      ...(arima.actual_tail?.slice(-10).map(x => x.value) || []),
      ...(arima.forecast?.map(x => x.value) || []),
      ...(arima.forecast?.map(x => x.lower).filter(Boolean) || []),
      ...(arima.forecast?.map(x => x.upper).filter(Boolean) || []),
    ].filter(v => v != null);
    if (!allValues.length) return ["auto", "auto"];
    const min = Math.min(...allValues);
    const max = Math.max(...allValues);
    const pad = (max - min) * 0.15;
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [dashboardForecastResult]);

  const dashboardForecastPrice = useMemo(() => {
    if (!dashboardForecastResult?.forecast?.length) return null;
    const fc = dashboardForecastResult.forecast;
    return fc[fc.length - 1];
  }, [dashboardForecastResult]);

  const arimaChartData = useMemo(() => {
    const arima = arimaForecastResult || result?.arima;
    if (!arima?.actual_tail) return [];
    const historical = arima.actual_tail.slice(-40).map((x) => ({ date: x.date, actual: x.value, forecast: null }));
    const lastHist = arima.actual_tail[arima.actual_tail.length - 1];
    const forecast = (arima.forecast || []).map((x) => ({ date: x.date, actual: null, forecast: x.value }));
    if (lastHist && forecast.length > 0) { forecast[0].actual = lastHist.value; forecast[0].forecast = lastHist.value; }
    return [...historical, ...forecast];
  }, [arimaForecastResult, result]);

  // Chart data hanya untuk titik proyeksi — dengan CI band, skala ketat
  const arimaForecastOnlyData = useMemo(() => {
    const arima = arimaForecastResult || result?.arima;
    if (!arima?.forecast?.length) return [];
    const lastActual = arima.actual_tail?.[arima.actual_tail.length - 1];
    const points = arima.forecast.map((x) => ({
      date: x.date,
      forecast: x.value,
      lower: x.lower ?? null,
      upper: x.upper ?? null,
    }));
    // Prepend last actual point agar chart tidak mulai dari tengah
    if (lastActual) {
      return [{ date: lastActual.date, forecast: lastActual.value, lower: lastActual.value, upper: lastActual.value }, ...points];
    }
    return points;
  }, [arimaForecastResult, result]);

  const arimaForecastYDomain = useMemo(() => {
    if (!arimaForecastOnlyData.length) return ["auto", "auto"];
    const vals = arimaForecastOnlyData.flatMap(d => [d.forecast, d.lower, d.upper]).filter(v => v != null);
    if (!vals.length) return ["auto", "auto"];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const pad = Math.max((max - min) * 0.2, 50); // minimum padding 50
    return [Math.floor(min - pad), Math.ceil(max + pad)];
  }, [arimaForecastOnlyData]);

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
    fundamental: "ANALISIS FUNDAMENTAL", profile: "PENGATURAN PROFIL",
    admin_mgmt: "MANAJEMEN ADMIN",
  };
  const viewSubtitles = {
    dashboard: "Perbandingan hasil prediksi ARIMA dan analisis fundamental TLKM beserta rekomendasi.",
    arima: "Upload data harga dan lihat proyeksi pergerakan harga saham Telkom menggunakan model ARIMA.",
    fundamental: "Upload laporan keuangan dan lihat evaluasi fundamental, valuasi intrinsik, dan rasio keuangan.",
    profile: "Perbarui informasi akun Anda seperti username, email, dan password.",
    admin_mgmt: "Tambah dan kelola akun administrator.",
  };

  return (
    <main className={`app-shell ${role !== "admin" ? "visitor-mode" : ""}`}>
      {/* Sidebar - Admin Only */}
      {role === "admin" && (
      <aside className="sidebar">
        <div>
          <div className="brand-section">
            <h2 className="brand-name">TLKM PREDICT</h2>
            <div className="brand-sub">Professional Analytics</div>
          </div>
          <ul className="nav-list">
            {[
              { view: "dashboard", icon: <TrendingUp size={16} />, label: "Dashboard" },
              { view: "arima", icon: <Activity size={16} />, label: "Prediksi ARIMA" },
              { view: "fundamental", icon: <BarChart3 size={16} />, label: "Fundamental" },
              ...(role === "admin" ? [{ view: "admin_mgmt", icon: <Shield size={16} />, label: "Manajemen Admin" }] : [])
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
            <button onClick={() => setCurrentView("profile")} style={{ background: "transparent", border: "none", cursor: "pointer", color: "#475569", display: "flex" }} title="Pengaturan Profil">
              <Settings size={16} />
            </button>
          </div>
          <button className="role-switcher-btn" onClick={onLogout} style={{ borderColor: "var(--accent-red)", color: "#f87171", background: "rgba(239,68,68,0.1)", marginTop: 16 }}>
            <Shield size={14} />Keluar (Logout)
          </button>
        </div>
      </aside>
      )}

      {/* Navbar - Visitor Only */}
      {role !== "admin" && (
        <>
          <nav className="visitor-navbar">
            <div className="visitor-navbar-brand">
              <h2 className="brand-name">TLKM PREDICT</h2>
              <div className="brand-sub">Professional Analytics</div>
            </div>
            <div className="visitor-navbar-links">
              {[
                { view: "dashboard", label: "Dashboard" },
                { view: "arima", label: "Prediksi ARIMA" },
                { view: "fundamental", label: "Fundamental" },
              ].map(({ view, label }) => (
                <button 
                  key={view} 
                  className={`visitor-nav-item ${currentView === view ? "active" : ""}`} 
                  onClick={() => setCurrentView(view)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="visitor-navbar-actions">
              <button className={`beginner-toggle-btn ${beginnerMode ? "active" : ""}`} onClick={() => setBeginnerMode(b => !b)}>
                {beginnerMode ? "🎓 Mode Pemula: ON" : "🎓 Mode Pemula"}
              </button>
              <button className="visitor-login-btn" onClick={onGoLogin}>
                <Shield size={14} /> Login Admin
              </button>
            </div>
          </nav>

          {/* Bottom Navigation - Mobile Only */}
          <nav className="visitor-bottom-nav">
            {[
              {
                view: "dashboard",
                label: "Dashboard",
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                    <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                  </svg>
                )
              },
              {
                view: "arima",
                label: "Prediksi",
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                  </svg>
                )
              },
              {
                view: "fundamental",
                label: "Fundamental",
                icon: (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
                    <line x1="6" y1="20" x2="6" y2="14"/>
                  </svg>
                )
              },
            ].map(({ view, label, icon }) => (
              <button
                key={view}
                className={`visitor-bottom-nav-item ${currentView === view ? "active" : ""}`}
                onClick={() => setCurrentView(view)}
              >
                {icon}
                <span>{label}</span>
              </button>
            ))}
            <button
              className={`visitor-bottom-nav-item ${showGuide ? "active" : ""}`}
              onClick={() => setShowGuide(true)}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
              </svg>
              <span>Panduan</span>
            </button>
          </nav>
        </>
      )}

      {/* Admin Top Navbar - Mobile Only */}
      {role === "admin" && (
        <nav className="admin-mobile-top-nav">
          <div className="admin-mobile-brand">
            <h2 className="brand-name">TLKM PREDICT</h2>
            <div className="brand-sub">Admin Panel</div>
          </div>
          <div className="admin-mobile-actions" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button className={`beginner-toggle-btn ${beginnerMode ? "active" : ""}`} onClick={() => setBeginnerMode(b => !b)} style={{ fontSize: 11, padding: "5px 10px" }}>
              {beginnerMode ? "🎓 ON" : "🎓"}
            </button>
            <div className={`profile-avatar`} style={{ width: 32, height: 32, fontSize: 11, cursor: "pointer" }} onClick={() => setCurrentView("profile")}>
              {currentUser?.username?.slice(0, 2).toUpperCase() || "AD"}
            </div>
          </div>
        </nav>
      )}

      {/* Admin Bottom Navigation - Mobile Only */}
      {role === "admin" && (
        <nav className="admin-bottom-nav">
          {[
            {
              view: "dashboard",
              label: "Dashboard",
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                </svg>
              )
            },
            {
              view: "arima",
              label: "ARIMA",
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
                </svg>
              )
            },
            {
              view: "fundamental",
              label: "Fundamental",
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              )
            },
            {
              view: "admin_mgmt",
              label: "Admin",
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              )
            },
            {
              view: "profile",
              label: "Profil",
              icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              )
            },
          ].map(({ view, label, icon }) => (
            <button
              key={view}
              className={`admin-bottom-nav-item ${currentView === view ? "active" : ""}`}
              onClick={() => setCurrentView(view)}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
          <button
            className={`admin-bottom-nav-item ${showGuide ? "active" : ""}`}
            onClick={() => setShowGuide(true)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <span>Panduan</span>
          </button>
        </nav>
      )}

      {/* Content */}
      {showGuide && <BeginnerGuide onClose={() => setShowGuide(false)} />}
      <section className="content-wrapper">
        {/* Topbar - Admin Only */}
        {role === "admin" && (
        <header className="topbar">
          <div className="topbar-title-section">
            <h1>{viewTitles[currentView]}</h1>
            <p>{viewSubtitles[currentView]}</p>
          </div>
          <div className="topbar-actions" style={{ justifyContent: "flex-end", gap: "16px" }}>
            <button className={`beginner-toggle-btn ${beginnerMode ? "active" : ""}`} onClick={() => setBeginnerMode(b => !b)}>
              {beginnerMode ? "🎓 Mode Pemula: ON" : "🎓 Mode Pemula"}
            </button>
            <button className="topbar-icon-btn" onClick={() => setCurrentView("profile")} title="Pengaturan Profil"><Settings size={18} /></button>
            <div className={`profile-avatar ${role !== "admin" ? "visitor" : ""}`} style={{ width: 34, height: 34, fontSize: 12, cursor: "pointer" }} onClick={() => setCurrentView("profile")}>
              {currentUser?.username?.slice(0, 2).toUpperCase() || (role === "admin" ? "AD" : "PG")}
            </div>
          </div>
        </header>
        )}

        {/* Status Banner */}
        {status && (
          <div className="status-banner">
            <div className="status-message"><Info size={16} /><span>{status}</span></div>
            <button className="status-clear-btn" onClick={() => setStatus("")}>Sembunyikan</button>
          </div>
        )}

        {/* Upload Success Modal */}
        {uploadSuccess && (
          <div style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <div style={{
              background: "#1e293b", borderRadius: 16, padding: "40px 48px",
              textAlign: "center", maxWidth: 400, width: "90%",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)"
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                background: "var(--accent-green-light)", display: "flex", alignItems: "center",
                justifyContent: "center", margin: "0 auto 20px"
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--text-main)", marginBottom: 8 }}>Data Berhasil Diproses</h3>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 4 }}>
                <strong>{uploadSuccess.filename}</strong>
              </p>
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
                {uploadSuccess.rows} baris data berhasil dianalisis
              </p>
              <p style={{ fontSize: 12, color: "#94a3b8" }}>
                {uploadSuccess.type === "arima" ? "Hasil analisis ARIMA siap dilihat di bawah." : "Hasil analisis fundamental siap dilihat di bawah."}
              </p>
            </div>
          </div>
        )}

        {/* ── VIEW: DASHBOARD ── */}
        {currentView === "dashboard" && (
          <>
            {!result && (
              <div className="card" style={{ textAlign: "center", padding: "40px 24px", color: "var(--text-muted)" }}>
                <Database size={40} style={{ margin: "0 auto 16px", opacity: 0.4 }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "var(--text-main)" }}>Belum Ada Data Analisis</h3>
                <p style={{ fontSize: 14 }}>
                  Mulai dari halaman <strong>Prediksi ARIMA</strong> untuk upload data harga saham,
                  lalu ke <strong>Fundamental</strong> untuk upload laporan keuangan.
                </p>
                {role !== "admin" && (
                  <button
                    onClick={() => setShowGuide(true)}
                    style={{ marginTop: 16, padding: "9px 20px", background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 8, color: "#fbbf24", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}
                  >
                    📚 Baru di sini? Baca Panduan Pemula
                  </button>
                )}
              </div>
            )}
            {/* Partial state — hanya ARIMA */}
            {result && result.arima && !result.fundamental && (
              <div className="card" style={{ padding: "16px 20px", background: "rgba(217,119,6,0.15)", border: "1px solid rgba(217,119,6,0.3)", borderRadius: 10, display: "flex", alignItems: "center", gap: 14 }}>
                <Info size={18} color="#d97706" style={{ flexShrink: 0 }} />
                <p style={{ fontSize: 13, color: "#fbbf24", margin: 0 }}>
                  Data ARIMA sudah tersedia. Upload laporan keuangan di halaman <strong>Fundamental</strong> untuk melihat perbandingan lengkap dan rekomendasi gabungan.
                </p>
                <button className="btn-secondary" style={{ padding: "6px 14px", fontSize: 12, flexShrink: 0 }} onClick={() => setCurrentView("fundamental")}>
                  Ke Fundamental
                </button>
              </div>
            )}
            {/* Partial state — hanya Fundamental */}
            {result && result.fundamental && !result.arima && (
              <div className="card" style={{ padding: "16px 20px", background: "rgba(217,119,6,0.15)", border: "1px solid rgba(217,119,6,0.3)", borderRadius: 10, display: "flex", alignItems: "center", gap: 14 }}>
                <Info size={18} color="#d97706" style={{ flexShrink: 0 }} />
                <p style={{ fontSize: 13, color: "#fbbf24", margin: 0 }}>
                  Data Fundamental sudah tersedia. Upload data harga saham di halaman <strong>Prediksi ARIMA</strong> untuk melihat perbandingan lengkap dan rekomendasi gabungan.
                </p>
                <button className="btn-secondary" style={{ padding: "6px 14px", fontSize: 12, flexShrink: 0 }} onClick={() => setCurrentView("arima")}>
                  Ke Prediksi ARIMA
                </button>
              </div>
            )}
            {result && (<>

              {/* ── Row 1: 4 Metric Cards ── */}
              <div className="grid-4">
                <div>
                  <MetricCard
                    label="Harga Penutupan"
                    value={result?.arima?.actual_tail?.slice(-1)[0]?.value != null ? formatRupiah(result.arima.actual_tail.slice(-1)[0].value) : "-"}
                    subtext={`Data per ${result?.arima?.preprocessing?.end_date || "-"}`}
                  />
                  {beginnerMode && <div className="beginner-hint">💡 Harga terakhir saham TLKM ditutup di bursa. Ini patokan harga saat ini.</div>}
                </div>
                <div>
                  <MetricCard
                    label="Akurasi Model"
                    value={accuracy || "-"}
                    subtext={`Model ${result?.arima?.model?.order ? `ARIMA(${result.arima.model.order.join(",")})` : "-"} · MAPE ${result?.arima?.metrics?.mape != null ? result.arima.metrics.mape.toFixed(1) + "%" : "-"}`}
                    isTrendUp={result?.arima?.metrics?.mape != null && result.arima.metrics.mape < 10}
                  />
                  {beginnerMode && (() => {
                    const mape = result?.arima?.metrics?.mape;
                    if (mape == null) return null;
                    const cls = mape < 10 ? "good" : mape < 20 ? "warn" : "warn";
                    const msg = mape < 10 ? "✅ Akurasi sangat baik — prediksi cukup dapat diandalkan" : mape < 20 ? "⚠️ Akurasi baik — prediksi cukup handal, tetap perhatikan CI" : "⚠️ Akurasi cukup — gunakan rentang CI sebagai acuan";
                    return <div className={`beginner-hint ${cls}`}>{msg}</div>;
                  })()}
                </div>
                <div>
                  <MetricCard
                    label="Status Valuasi"
                    value={result?.fundamental?.status ? result.fundamental.status.toUpperCase() : "-"}
                    subtext={result?.fundamental?.latest?.intrinsic_value != null ? `Intrinsik: ${formatRupiah(result.fundamental.latest.intrinsic_value)}` : "Belum ada data fundamental"}
                    isTrendUp={result?.fundamental?.status === "undervalued"}
                  />
                  {beginnerMode && result?.fundamental?.status && (
                    <div className={`beginner-hint ${result.fundamental.status === "undervalued" ? "good" : result.fundamental.status === "overvalued" ? "danger" : "warn"}`}>
                      {result.fundamental.status === "undervalued" && "✅ Harga saham lebih murah dari nilai wajarnya — potensi peluang beli"}
                      {result.fundamental.status === "overvalued" && "🔴 Harga saham lebih mahal dari nilai wajarnya — pertimbangkan risiko"}
                      {result.fundamental.status === "fairvalued" && "⚖️ Harga saham mendekati nilai wajarnya — harga adil saat ini"}
                    </div>
                  )}
                </div>
                <div>
                  <MetricCard
                    label="ROE"
                    value={result?.fundamental?.latest?.roe != null ? `${(result.fundamental.latest.roe * 100).toFixed(1)}%` : "-"}
                    subtext={result?.fundamental?.latest?.per != null ? `P/E Ratio: ${result.fundamental.latest.per.toFixed(1)}x` : "Belum ada data fundamental"}
                    isTrendUp={result?.fundamental?.latest?.roe != null && result.fundamental.latest.roe > 0.12}
                  />
                  {beginnerMode && result?.fundamental?.latest?.roe != null && (() => {
                    const roe = result.fundamental.latest.roe * 100;
                    const cls = roe >= 15 ? "good" : roe >= 10 ? "warn" : "danger";
                    const msg = roe >= 15 ? `✅ ROE ${roe.toFixed(1)}% — perusahaan sangat efisien menggunakan modal` : roe >= 10 ? `⚠️ ROE ${roe.toFixed(1)}% — cukup baik, di atas rata-rata minimal` : `🔴 ROE ${roe.toFixed(1)}% — efisiensi modal perlu diperhatikan`;
                    return <div className={`beginner-hint ${cls}`}>{msg}</div>;
                  })()}
                </div>
              </div>

              {/* ── Row 2: Chart (kiri) + Panel Proyeksi Terpadu (kanan) ── */}
              <div className="grid-2-1">
                {/* Chart */}
                <div className="card">
                  <div className="card-header-flex">
                    <div className="card-title-section">
                      <h3>Price Trend</h3>
                      <p>{dashboardForecastResult ? `Proyeksi hingga ${dashboardForecastPrice?.date || ""}` : `Historis + Proyeksi ${result?.arima?.model?.horizon || 30} Hari ke Depan`}</p>
                    </div>
                    <span className="card-badge-live">LIVE</span>
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
                          <YAxis domain={dashboardYDomain} tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                          <RechartsTooltip contentStyle={{ backgroundColor: "#1e293b", borderRadius: 8, border: "1px solid var(--border-color)", fontSize: 12, color: "#f8fafc" }} formatter={(val, name) => [val != null ? formatRupiah(val) : "-", name]} />
                          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                          <Area type="monotone" dataKey="actual" stroke="#0047b3" strokeWidth={2} fill="url(#dashActual)" name="Harga Aktual" dot={false} connectNulls={false} />
                          <Area type="monotone" dataKey="forecast" stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" fill="url(#dashForecast)" name="Proyeksi" dot={false} connectNulls={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>Belum ada data visualisasi</div>
                    )}
                  </div>
                </div>

                {/* Panel Proyeksi Terpadu */}
                <div className="arima-panel-dark">
                  <div className="arima-dark-header"><h3>ARIMA Prediction</h3></div>

                  {/* Target price — default atau hasil proyeksi */}
                  <div className="arima-dark-target">
                    <span>{dashboardForecastPrice ? `Proyeksi per ${dashboardForecastPrice.date}` : `Proyeksi ${result?.arima?.model?.horizon || 30} Hari ke Depan`}</span>
                    <div className="arima-dark-price">
                      {dashboardForecastPrice ? formatRupiah(dashboardForecastPrice.value) : (targetPrice != null ? formatRupiah(targetPrice) : "-")}
                    </div>
                    <div className="arima-dark-growth">
                      {dashboardForecastPrice ? `Estimasi harga pada ${dashboardForecastPrice.date}` : `Hari terakhir: ${result?.arima?.forecast?.slice(-1)[0]?.date || "-"}`}
                    </div>
                    {beginnerMode && (
                      <div className="beginner-hint" style={{ marginTop: 8 }}>
                        💡 Ini perkiraan harga saham TLKM berdasarkan pola historis. Bukan kepastian — gunakan sebagai referensi awal.
                      </div>
                    )}
                  </div>

                  {/* Stats model */}
                  <div className="arima-dark-stats">
                    {(() => {
                      const activeArima = dashboardForecastResult || result?.arima;
                      const lastFc = activeArima?.forecast?.slice(-1)[0];
                      const displayPrice = dashboardForecastPrice?.value ?? targetPrice;
                      const mapeVal = result?.arima?.metrics?.mape;
                      const rows = [
                        {
                          label: "Akurasi", val: accuracy || "-",
                          tip: "Dihitung dari data testing historis (100% - MAPE). Tidak berubah saat ganti tanggal proyeksi.",
                          hint: beginnerMode ? "Seberapa sering prediksi mendekati harga nyata. Makin tinggi makin baik." : null,
                        },
                        {
                          label: "MAPE", val: mapeVal != null ? `${mapeVal.toFixed(2)}% (${mapeVal < 10 ? "Sangat Baik" : mapeVal < 20 ? "Baik" : "Cukup"})` : "-",
                          tip: "Mean Absolute Percentage Error — rata-rata persentase kesalahan. < 10% sangat baik, 10–20% baik, > 20% cukup/perlu perhatian.",
                          hint: beginnerMode && mapeVal != null ? `Rata-rata prediksi meleset ±${mapeVal.toFixed(1)}% dari harga asli. ${mapeVal < 20 ? "Masih dalam batas wajar." : "Gunakan rentang CI sebagai acuan."}` : null,
                        },
                        {
                          label: "MAE", val: result?.arima?.metrics?.mae != null ? formatRupiah(result.arima.metrics.mae) : "-",
                          tip: "Mean Absolute Error — rata-rata selisih nominal antara prediksi dan aktual saat testing.",
                          hint: beginnerMode && result?.arima?.metrics?.mae != null ? `Rata-rata prediksi meleset sebesar ${formatRupiah(result.arima.metrics.mae)} per lembar saham.` : null,
                        },
                        {
                          label: "RMSE", val: result?.arima?.metrics?.rmse != null ? formatRupiah(result.arima.metrics.rmse) : "-",
                          tip: "Root Mean Square Error — lebih sensitif terhadap error besar dibanding MAE. Semakin kecil semakin baik.",
                          hint: beginnerMode ? "Ukuran kesalahan prediksi yang lebih ketat — makin kecil makin baik." : null,
                        },
                        {
                          label: "Batas Bawah (95% CI)", val: lastFc?.lower != null ? formatRupiah(lastFc.lower) : (displayPrice != null ? formatRupiah(displayPrice * 0.98) : "-"),
                          tip: "Confidence Interval 95% — batas bawah rentang harga yang diperkirakan. Makin jauh tanggal target, makin lebar rentang ini.",
                          hint: beginnerMode ? "Harga terendah yang kemungkinan terjadi (95% kemungkinan harga di atas ini)." : null,
                        },
                        {
                          label: "Batas Atas (95% CI)", val: lastFc?.upper != null ? formatRupiah(lastFc.upper) : (displayPrice != null ? formatRupiah(displayPrice * 1.02) : "-"),
                          tip: "Confidence Interval 95% — batas atas rentang harga yang diperkirakan. Makin jauh tanggal target, makin lebar rentang ini.",
                          hint: beginnerMode ? "Harga tertinggi yang kemungkinan terjadi (95% kemungkinan harga di bawah ini)." : null,
                        },
                      ];
                      return rows;
                    })().map(({ label, val, tip, hint }) => (
                      <div key={label}>
                        <div className="arima-dark-stat-row">
                          <span className="arima-dark-stat-label" style={{ display: "flex", alignItems: "center" }}>
                            {label}
                            <Tooltip text={tip}><InfoIcon /></Tooltip>
                          </span>
                          <span className="arima-dark-stat-val">{val}</span>
                        </div>
                        {hint && <div className="beginner-hint" style={{ marginTop: 4, marginBottom: 4 }}>{hint}</div>}
                      </div>
                    ))}
                  </div>

                  {/* Date picker proyeksi */}
                  <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                    <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>Proyeksi ke Tanggal</span>
                    <input
                      type="date"
                      value={dashboardTargetDate}
                      onChange={(e) => { setDashboardTargetDate(e.target.value); setDashboardForecastResult(null); }}
                      style={{ padding: "9px 12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.06)", color: "white", fontSize: 13, outline: "none", colorScheme: "dark", width: "100%" }}
                    />
                    <button
                      onClick={handleDashboardForecast}
                      disabled={isDashboardLoading || !dashboardTargetDate}
                      className="arima-dark-btn"
                      style={{ background: isDashboardLoading || !dashboardTargetDate ? "rgba(255,255,255,0.05)" : "rgba(0,71,179,0.7)", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}
                    >
                      <RefreshCw size={13} className={isDashboardLoading ? "spin" : ""} />
                      {isDashboardLoading ? "Menghitung..." : "Hitung Proyeksi"}
                    </button>
                  </div>

                  <button className="arima-dark-btn" onClick={() => setCurrentView("arima")}>DETAIL PROYEKSI LENGKAP</button>
                </div>
              </div>

              {/* ── Row 3: Financial Status + Rekomendasi ── */}
              <div className="grid-2">
                {/* Financial Status */}
                <div className="card">
                  <div className="card-header-flex">
                    <div className="card-title-section">
                      <h3>Financial Status</h3>
                      <p>Periode {result?.fundamental?.latest_year || "-"} · PT Telkom Indonesia</p>
                    </div>
                    <button className="btn-secondary" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => setCurrentView("fundamental")}>DETAILS</button>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {[
                      { label: "P/E Ratio", value: result?.fundamental?.latest?.per != null ? `${result.fundamental.latest.per.toFixed(2)}x` : "-", hint: result?.fundamental?.latest?.per != null ? (result.fundamental.latest.per < 10 ? { msg: "Murah — investor bayar rendah per unit laba", cls: "good" } : result.fundamental.latest.per < 20 ? { msg: "Wajar — harga setimpal dengan laba perusahaan", cls: "warn" } : { msg: "Mahal — investor bayar premium tinggi per unit laba", cls: "danger" }) : null },
                      { label: "ROE", value: result?.fundamental?.latest?.roe != null ? `${(result.fundamental.latest.roe * 100).toFixed(2)}%` : "-", hint: result?.fundamental?.latest?.roe != null ? (result.fundamental.latest.roe * 100 >= 15 ? { msg: "Sangat efisien — perusahaan menghasilkan laba tinggi dari modal", cls: "good" } : result.fundamental.latest.roe * 100 >= 10 ? { msg: "Cukup efisien — penggunaan modal cukup baik", cls: "warn" } : { msg: "Kurang efisien — perlu perhatian lebih", cls: "danger" }) : null },
                      { label: "DER", value: result?.fundamental?.latest?.der != null ? `${result.fundamental.latest.der.toFixed(2)}x` : "-", hint: result?.fundamental?.latest?.der != null ? (result.fundamental.latest.der < 1 ? { msg: "Aman — hutang lebih kecil dari modal sendiri", cls: "good" } : result.fundamental.latest.der < 2 ? { msg: "Wajar — hutang terkendali untuk sektor ini", cls: "warn" } : { msg: "Tinggi — perusahaan cukup banyak berhutang", cls: "danger" }) : null },
                      { label: "ROA", value: result?.fundamental?.latest?.roa != null ? `${(result.fundamental.latest.roa * 100).toFixed(2)}%` : "-", hint: result?.fundamental?.latest?.roa != null ? (result.fundamental.latest.roa * 100 >= 5 ? { msg: "Baik — aset digunakan secara produktif", cls: "good" } : { msg: "Cukup — produktivitas aset masih bisa ditingkatkan", cls: "warn" }) : null },
                    ].map(({ label, value, hint }) => (
                      <div key={label}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border-color)" }}>
                          <span style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600 }}>{label}</span>
                          <strong style={{ fontSize: 14, color: "var(--text-main)" }}>{value}</strong>
                        </div>
                        {beginnerMode && hint && <div className={`beginner-hint ${hint.cls}`}>{hint.msg}</div>}
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

                {/* Rekomendasi */}
                <div className="card">
                  <div className="card-header-flex">
                    <div className="card-title-section">
                      <h3>Rekomendasi Analisis</h3>
                      <p>Berdasarkan ARIMA + Fundamental</p>
                    </div>
                    {result?.fundamental?.status && (
                      <span className={`status-indicator ${result.fundamental.status === "undervalued" ? "success" : result.fundamental.status === "overvalued" ? "danger" : "warning"}`}
                        style={{ fontSize: 11, padding: "4px 10px", textTransform: "uppercase" }}>
                        {result.fundamental.status}
                      </span>
                    )}
                  </div>
                  {result?.recommendation ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 16, fontSize: 14, lineHeight: 1.7 }}>
                      <div style={{ padding: "14px 16px", background: "rgba(255,255,255,0.05)", borderRadius: 10, borderLeft: "3px solid var(--accent-blue)" }}>
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-main)", marginBottom: 6 }}>Kesimpulan</p>
                        <p style={{ color: "var(--text-muted)", fontSize: 13 }}>{result.recommendation.summary}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Jangka Pendek</p>
                        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{result.recommendation.short_term}</p>
                      </div>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>Jangka Menengah-Panjang</p>
                        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>{result.recommendation.medium_long_term}</p>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>
                      Upload data harga <strong>dan</strong> laporan keuangan untuk melihat rekomendasi.
                    </div>
                  )}
                </div>
              </div>

            </>)}
          </>
        )}

        {/* ── VIEW: ARIMA ── */}
        {currentView === "arima" && (
          <>
            <div className="arima-view-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
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

            {/* ── Panel Upload ARIMA (admin only) ── */}
            {role === "admin" && (
              <div className="card">
                <div className="card-header-flex">
                  <div className="card-title-section">
                    <h3>Upload Data Harga Saham</h3>
                    <p>Upload CSV harga historis untuk menjalankan analisis ARIMA</p>
                  </div>
                  {result?.arima && (
                    <span className="status-indicator success" style={{ fontSize: 11 }}>Data aktif: {result.arima.preprocessing?.end_date || "-"}</span>
                  )}
                </div>
                <form onSubmit={handleUploadArima} className="upload-panel">
                  <div className="dropzone" style={{ padding: "24px 20px" }}>
                    <FileUp className="dropzone-icon" size={30} />
                    <div className="dropzone-text">
                      {priceFile ? `Terpilih: ${priceFile.name}` : "Klik atau seret file CSV Harga Saham di sini"}
                    </div>
                    <div className="dropzone-sub">Kolom yang dibutuhkan: date, close · Format .CSV (Maks. 25MB)</div>
                    <input id="csv-price-picker" type="file" accept=".csv" className="hidden-file-input"
                      onChange={(e) => { const f = e.target.files?.[0]; setPriceFile(f || null); }} />
                    <button type="button" className="file-select-btn" onClick={() => document.getElementById("csv-price-picker").click()}>Pilih File</button>
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                    <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={isUploading || isAnalyzing || !priceFile}>
                      {isUploading ? "Mengunggah..." : isAnalyzing ? "Menganalisis..." : "Unggah dan Analisis"}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => { setPriceFile(null); setUploadedPreview(null); const i = document.getElementById("csv-price-picker"); if(i) i.value=""; }}>Reset</button>
                  </div>
                </form>
                {uploadedPreview && currentView === "arima" && (
                  <div style={{ marginTop: 16, borderTop: "1px solid var(--border-color)", paddingTop: 14 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Pratinjau: {uploadedPreview.filename} — {uploadedPreview.rowsTotal} baris</p>
                    <div className="table-responsive" style={{ maxHeight: 200, overflow: "auto" }}>
                      <table className="custom-table" style={{ fontSize: 12 }}>
                        <thead><tr>{uploadedPreview.columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
                        <tbody>{uploadedPreview.data.slice(0, 5).map((row, ri) => (
                          <tr key={ri}>{uploadedPreview.columns.map((c, ci) => <td key={ci}>{row[c] ?? "-"}</td>)}</tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Empty state jika belum ada data ARIMA */}
            {!result?.arima && (
              <div className="card" style={{ textAlign: "center", padding: "40px 24px", color: "var(--text-muted)" }}>
                <Activity size={40} style={{ margin: "0 auto 16px", opacity: 0.4 }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "var(--text-main)" }}>Belum Ada Data ARIMA</h3>
                <p style={{ fontSize: 14 }}>{role === "admin" ? "Upload file CSV harga saham di panel atas untuk memulai analisis." : "Admin belum mengunggah data harga saham."}</p>
              </div>
            )}

            {/* Date Picker ARIMA */}
            <div className="card arima-datepicker-card" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)", color: "white" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, color: "white" }}>🔮 Proyeksi Harga Berkelanjutan</h3>
                  <p style={{ fontSize: 13, color: "#94a3b8", margin: 0 }}>Pilih tanggal target untuk melihat semua prediksi harga hingga tanggal tersebut</p>
                </div>
                <div className="arima-datepicker-inner" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
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
                        <RechartsTooltip contentStyle={{ backgroundColor: "#1e293b", borderRadius: 8, border: "1px solid var(--border-color)", fontSize: 12, color: "#f8fafc" }}
                          formatter={(val, name) => [val != null ? formatRupiah(val) : "-", name]}
                        />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                        <Area type="monotone" dataKey="actual" stroke="var(--accent-blue)" strokeWidth={2} fillOpacity={1} fill="url(#colorActual)" name="Harga Aktual" dot={false} />
                        <Area type="monotone" dataKey="forecast" stroke="var(--accent-red)" strokeWidth={2} strokeDasharray="5 5" fillOpacity={1} fill="url(#colorForecast)" name="Proyeksi Forecast" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div style={{ display: "flex", height: "100%", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>Belum ada data visualisasi</div>
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
                    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 6, marginTop: 2, borderTop: "1px solid var(--border-color)" }}>
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontStyle: "italic" }}>Interpretasi MAPE</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: arimaActiveForecast?.metrics?.mape != null ? (arimaActiveForecast.metrics.mape < 10 ? "var(--accent-green)" : arimaActiveForecast.metrics.mape < 20 ? "#f59e0b" : "var(--accent-red)") : "var(--text-muted)" }}>
                        {arimaActiveForecast?.metrics?.mape != null ? (arimaActiveForecast.metrics.mape < 10 ? "Sangat Baik" : arimaActiveForecast.metrics.mape < 20 ? "Baik" : "Cukup") : "-"}
                      </span>
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

            {/* ── Zoom Chart Proyeksi — skala ketat, CI band ── */}
            {arimaForecastOnlyData.length > 1 && (
              <div className="card">
                <div className="card-header-flex">
                  <div className="card-title-section">
                    <h3>Detail Pergerakan Proyeksi</h3>
                    <p>Skala diperbesar — hanya menampilkan titik proyeksi dengan 95% Confidence Interval</p>
                  </div>
                </div>
                <div style={{ height: 280, width: "100%" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={arimaForecastOnlyData} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="ciArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0047b3" stopOpacity={0.12} />
                          <stop offset="95%" stopColor="#0047b3" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "#94a3b8" }} minTickGap={20} />
                      <YAxis domain={arimaForecastYDomain} tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "#94a3b8" }} />
                      <RechartsTooltip
                        contentStyle={{ backgroundColor: "#1e293b", borderRadius: 8, border: "1px solid var(--border-color)", fontSize: 12, color: "#f8fafc" }}
                        formatter={(val, name) => [val != null ? formatRupiah(val) : "-", name]}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                      {/* CI upper sebagai area atas */}
                      <Area type="monotone" dataKey="upper" stroke="none" fill="#dbeafe" fillOpacity={0.5} name="Batas Atas CI" dot={false} legendType="none" />
                      {/* CI lower sebagai area bawah (fill ke upper membentuk band) */}
                      <Area type="monotone" dataKey="lower" stroke="none" fill="#0f172a" fillOpacity={1} name="Batas Bawah CI" dot={false} legendType="none" />
                      {/* Garis proyeksi utama */}
                      <Area type="monotone" dataKey="forecast" stroke="#0047b3" strokeWidth={2.5} fill="url(#ciArea)" name="Harga Proyeksi" dot={{ r: 3, fill: "#0047b3", strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: "flex", gap: 24, marginTop: 12, padding: "12px 0 0", borderTop: "1px solid var(--border-color)" }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    <span style={{ display: "inline-block", width: 12, height: 3, background: "#0047b3", borderRadius: 2, marginRight: 6, verticalAlign: "middle" }} />
                    Harga proyeksi (titik tengah estimasi)
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    <span style={{ display: "inline-block", width: 12, height: 8, background: "#dbeafe", borderRadius: 2, marginRight: 6, verticalAlign: "middle" }} />
                    Area 95% CI — rentang kemungkinan harga aktual
                  </div>
                </div>
              </div>
            )}

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
                        <th>Batas Bawah (95% CI)</th>
                        <th>Batas Atas (95% CI)</th>
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
                            <td style={{ color: "var(--text-muted)" }}>{item.lower != null ? formatRupiah(item.lower) : formatRupiah(item.value * 0.98)}</td>
                            <td style={{ color: "var(--text-muted)" }}>{item.upper != null ? formatRupiah(item.upper) : formatRupiah(item.value * 1.02)}</td>
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
              {beginnerMode && (
                <div style={{ marginTop: 16, padding: "12px 16px", background: "rgba(59,130,246,0.08)", borderRadius: 10, borderLeft: "3px solid rgba(59,130,246,0.4)" }}>
                  <p style={{ fontSize: 13, color: "#93c5fd", fontWeight: 600, marginBottom: 8 }}>💡 Analogi Sederhana</p>
                  <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
                    Bayangkan ARIMA seperti cuaca. Kita tidak bisa 100% pasti, tapi dengan melihat pola 
                    cuaca minggu lalu (AutoRegressive), perubahan suhu kemarin (Integrated), dan 
                    gangguan mendadak seperti hujan deras (Moving Average) — kita bisa memperkirakan 
                    cuaca besok dengan cukup baik.
                  </p>
                </div>
              )}
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

            {/* ── Panel Upload Fundamental (admin only) ── */}
            {role === "admin" && (
              <div className="card">
                <div className="card-header-flex">
                  <div className="card-title-section">
                    <h3>Upload Laporan Keuangan</h3>
                    <p>Upload CSV laporan keuangan tahunan untuk menjalankan analisis fundamental</p>
                  </div>
                  {result?.fundamental && (
                    <span className="status-indicator success" style={{ fontSize: 11 }}>Data aktif: periode {result.fundamental.latest_year || "-"}</span>
                  )}
                </div>
                <form onSubmit={handleUploadFundamental} className="upload-panel">
                  <div className="dropzone" style={{ padding: "24px 20px" }}>
                    <FileUp className="dropzone-icon" size={30} />
                    <div className="dropzone-text">
                      {financialFile ? `Terpilih: ${financialFile.name}` : "Klik atau seret file CSV Laporan Keuangan di sini"}
                    </div>
                    <div className="dropzone-sub">Kolom: year, net_income, total_equity, total_assets, total_liabilities, shares_outstanding, market_price · Format .CSV (Maks. 25MB)</div>
                    <input id="csv-financial-picker" type="file" accept=".csv" className="hidden-file-input"
                      onChange={(e) => { const f = e.target.files?.[0]; setFinancialFile(f || null); }} />
                    <button type="button" className="file-select-btn" onClick={() => document.getElementById("csv-financial-picker").click()}>Pilih File</button>
                  </div>
                  <div style={{ display: "flex", gap: 12, marginTop: 12 }}>
                    <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={isUploading || isAnalyzing || !financialFile}>
                      {isUploading ? "Mengunggah..." : isAnalyzing ? "Menganalisis..." : "Unggah dan Analisis"}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => { setFinancialFile(null); setUploadedPreview(null); const i = document.getElementById("csv-financial-picker"); if(i) i.value=""; }}>Reset</button>
                  </div>
                </form>
                {uploadedPreview && currentView === "fundamental" && (
                  <div style={{ marginTop: 16, borderTop: "1px solid var(--border-color)", paddingTop: 14 }}>
                    <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Pratinjau: {uploadedPreview.filename} — {uploadedPreview.rowsTotal} baris</p>
                    <div className="table-responsive" style={{ maxHeight: 200, overflow: "auto" }}>
                      <table className="custom-table" style={{ fontSize: 12 }}>
                        <thead><tr>{uploadedPreview.columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
                        <tbody>{uploadedPreview.data.slice(0, 5).map((row, ri) => (
                          <tr key={ri}>{uploadedPreview.columns.map((c, ci) => <td key={ci}>{row[c] ?? "-"}</td>)}</tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {!latestFund && (
              <div className="card" style={{ textAlign: "center", padding: "40px 24px", color: "var(--text-muted)" }}>
                <BarChart3 size={40} style={{ margin: "0 auto 16px", opacity: 0.4 }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: "var(--text-main)" }}>Belum Ada Data Fundamental</h3>
                <p style={{ fontSize: 14 }}>{role === "admin" ? "Upload file CSV laporan keuangan di panel atas untuk memulai analisis." : "Admin belum mengunggah data laporan keuangan."}</p>
              </div>
            )}
            {latestFund && (<>
              {/* Banner mode pemula di fundamental */}
              {beginnerMode && (
                <div className="beginner-hint" style={{ padding: "12px 16px", borderRadius: 10, borderLeft: "3px solid rgba(251,191,36,0.5)", background: "rgba(251,191,36,0.07)", color: "#fde68a", fontSize: 13 }}>
                  🎓 <strong>Mode Pemula aktif</strong> — Setiap indikator di bawah ini dilengkapi penjelasan singkat. Klik tombol <strong>📚 Panduan</strong> untuk penjelasan lengkap.
                </div>
              )}
              <div className="card">
                <div className="card-header-flex">
                  <div className="card-title-section">
                    <h3>Ringkasan Metrik Keuangan</h3>
                    <p>Data terbaru — Periode {result?.fundamental?.latest_year || "-"}</p>
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="custom-table">
                    <thead><tr><th>Indikator</th><th>Nilai</th><th>Keterangan{beginnerMode && " & Interpretasi"}</th></tr></thead>
                    <tbody>
                      {[
                        {
                          label: "EPS — Earnings Per Share",
                          value: latestFund.eps != null ? `IDR ${latestFund.eps.toLocaleString("id-ID", { maximumFractionDigits: 2 })}` : "-",
                          desc: "Laba bersih per lembar saham",
                          hint: latestFund.eps != null ? (latestFund.eps > 0 ? `✅ EPS positif — perusahaan menghasilkan laba ${latestFund.eps.toLocaleString("id-ID", { maximumFractionDigits: 0 })} per lembar saham` : "🔴 EPS negatif — perusahaan merugi, perlu perhatian") : null,
                          hintCls: latestFund.eps != null && latestFund.eps > 0 ? "good" : "danger",
                        },
                        {
                          label: "PER — Price to Earnings Ratio",
                          value: latestFund.per != null ? `${latestFund.per.toFixed(2)}x` : "-",
                          desc: "Harga saham dibagi EPS",
                          hint: latestFund.per != null ? (latestFund.per < 10 ? `✅ PER ${latestFund.per.toFixed(1)}x — saham relatif murah dibanding labanya` : latestFund.per < 20 ? `⚖️ PER ${latestFund.per.toFixed(1)}x — harga wajar, setimpal dengan laba` : `⚠️ PER ${latestFund.per.toFixed(1)}x — investor membayar premium tinggi`) : null,
                          hintCls: latestFund.per != null ? (latestFund.per < 10 ? "good" : latestFund.per < 20 ? "warn" : "warn") : null,
                        },
                        {
                          label: "ROE — Return on Equity",
                          value: latestFund.roe != null ? `${(latestFund.roe * 100).toFixed(2)}%` : "-",
                          desc: "Efisiensi penggunaan modal sendiri",
                          hint: latestFund.roe != null ? (latestFund.roe * 100 >= 15 ? `✅ ROE ${(latestFund.roe*100).toFixed(1)}% — perusahaan sangat efisien menggunakan modal` : latestFund.roe * 100 >= 10 ? `⚖️ ROE ${(latestFund.roe*100).toFixed(1)}% — efisiensi modal cukup baik` : `⚠️ ROE ${(latestFund.roe*100).toFixed(1)}% — efisiensi modal perlu diperhatikan`) : null,
                          hintCls: latestFund.roe != null ? (latestFund.roe * 100 >= 15 ? "good" : latestFund.roe * 100 >= 10 ? "warn" : "danger") : null,
                        },
                        {
                          label: "DER — Debt to Equity Ratio",
                          value: latestFund.der != null ? `${latestFund.der.toFixed(2)}x` : "-",
                          desc: "Rasio hutang terhadap ekuitas",
                          hint: latestFund.der != null ? (latestFund.der < 1 ? `✅ DER ${latestFund.der.toFixed(2)}x — hutang terkendali, di bawah modal sendiri` : latestFund.der < 2 ? `⚖️ DER ${latestFund.der.toFixed(2)}x — hutang wajar untuk sektor telekomunikasi` : `⚠️ DER ${latestFund.der.toFixed(2)}x — hutang cukup tinggi, perhatikan kemampuan bayar`) : null,
                          hintCls: latestFund.der != null ? (latestFund.der < 1 ? "good" : latestFund.der < 2 ? "warn" : "danger") : null,
                        },
                        {
                          label: "BVPS — Book Value Per Share",
                          value: latestFund.bvps != null ? `IDR ${latestFund.bvps.toLocaleString("id-ID", { maximumFractionDigits: 2 })}` : "-",
                          desc: "Nilai buku per lembar saham",
                          hint: beginnerMode ? "Nilai aset bersih perusahaan dibagi jumlah lembar saham. Dibandingkan dengan harga pasar untuk menilai valuasi." : null,
                          hintCls: "warn",
                        },
                        {
                          label: "PBV — Price to Book Value",
                          value: latestFund.pbv != null ? `${latestFund.pbv.toFixed(2)}x` : "-",
                          desc: "Harga saham dibagi nilai buku",
                          hint: latestFund.pbv != null ? (latestFund.pbv < 1 ? `✅ PBV ${latestFund.pbv.toFixed(2)}x — saham dijual di bawah nilai aset bersihnya` : latestFund.pbv < 3 ? `⚖️ PBV ${latestFund.pbv.toFixed(2)}x — valuasi wajar` : `⚠️ PBV ${latestFund.pbv.toFixed(2)}x — harga jauh di atas nilai buku`) : null,
                          hintCls: latestFund.pbv != null ? (latestFund.pbv < 1 ? "good" : latestFund.pbv < 3 ? "warn" : "danger") : null,
                        },
                        {
                          label: "Harga Pasar",
                          value: latestFund.market_price != null ? formatRupiah(latestFund.market_price) : "-",
                          desc: "Harga penutupan terakhir di dataset",
                          hint: null,
                          hintCls: null,
                        },
                      ].map(({ label, value, desc, hint, hintCls }) => (
                        <tr key={label}>
                          <td><strong>{label}</strong></td>
                          <td><strong>{value}</strong></td>
                          <td>
                            {desc}
                            {beginnerMode && hint && (
                              <div className={`beginner-hint ${hintCls}`} style={{ marginTop: 4 }}>{hint}</div>
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td><strong>Nilai Intrinsik</strong></td>
                        <td>
                          <strong style={{ color: latestFund.intrinsic_value != null && latestFund.market_price != null ? (latestFund.intrinsic_value > latestFund.market_price ? "var(--accent-green)" : "var(--accent-red)") : "inherit" }}>
                            {latestFund.intrinsic_value != null ? formatRupiah(latestFund.intrinsic_value) : "-"}
                          </strong>
                        </td>
                        <td>
                          EPS × PER Wajar ({params.per_wajar}x) — {latestFund.intrinsic_value != null && latestFund.market_price != null ? (latestFund.intrinsic_value > latestFund.market_price ? "Saham undervalued ✓" : "Saham overvalued ✗") : "-"}
                          {beginnerMode && latestFund.intrinsic_value != null && latestFund.market_price != null && (
                            <div className={`beginner-hint ${latestFund.intrinsic_value > latestFund.market_price ? "good" : "danger"}`} style={{ marginTop: 4 }}>
                              {latestFund.intrinsic_value > latestFund.market_price
                                ? `✅ Nilai wajar ${formatRupiah(latestFund.intrinsic_value)} > harga pasar ${formatRupiah(latestFund.market_price)} — saham relatif murah (undervalued)`
                                : `🔴 Nilai wajar ${formatRupiah(latestFund.intrinsic_value)} < harga pasar ${formatRupiah(latestFund.market_price)} — saham relatif mahal (overvalued)`}
                            </div>
                          )}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="grid-3">
                <div>
                  <MetricCard label="Harga Pasar" value={latestFund.market_price != null ? formatRupiah(latestFund.market_price) : "-"} subtext="Harga saham terakhir" />
                  {beginnerMode && <div className="beginner-hint">Harga yang saat ini diperdagangkan di bursa saham.</div>}
                </div>
                <div>
                  <MetricCard label="Nilai Intrinsik" value={latestFund.intrinsic_value != null ? formatRupiah(latestFund.intrinsic_value) : "-"} subtext={`Berdasarkan PER Wajar ${params.per_wajar}x`} />
                  {beginnerMode && <div className="beginner-hint">Nilai "sebenarnya" saham berdasarkan kinerja keuangan perusahaan.</div>}
                </div>
                <div>
                  <MetricCard label="Selisih Valuasi" value={latestFund.valuation_gap != null ? formatRupiah(Math.abs(latestFund.valuation_gap)) : "-"}
                    subtext={latestFund.valuation_gap != null ? (latestFund.valuation_gap > 0 ? "Di bawah nilai wajar (Undervalued)" : "Di atas nilai wajar (Overvalued)") : "-"}
                    isTrendUp={latestFund.valuation_gap > 0} />
                  {beginnerMode && latestFund.valuation_gap != null && (
                    <div className={`beginner-hint ${latestFund.valuation_gap > 0 ? "good" : "danger"}`}>
                      {latestFund.valuation_gap > 0
                        ? `✅ Saham diskon ${formatRupiah(Math.abs(latestFund.valuation_gap))} dari nilai wajarnya — potensi peluang`
                        : `⚠️ Saham premium ${formatRupiah(Math.abs(latestFund.valuation_gap))} di atas nilai wajarnya — pertimbangkan risiko`}
                    </div>
                  )}
                </div>
              </div>
              <div className="card">
                <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>Kesimpulan Analisis</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7 }}>
                  <p>{result?.fundamental?.summary || "-"}</p>
                  {result?.fundamental?.interpretation?.map((line, i) => <p key={i}>• {line}</p>)}
                </div>
              </div>
              {result?.fundamental?.rows?.length > 1 && (
                <>
                  {/* Chart Tren Fundamental per Tahun */}
                  <div className="card">
                    <div className="card-header-flex">
                      <div className="card-title-section">
                        <h3>Tren Rasio Keuangan per Tahun</h3>
                        <p>Visualisasi pergerakan indikator fundamental dari tahun ke tahun</p>
                      </div>
                    </div>
                    <div className="grid-2" style={{ gap: 24 }}>
                      {/* Chart ROE & ROA */}
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>ROE & ROA (%)</p>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={result.fundamental.rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="year" tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "#94a3b8" }} />
                            <YAxis tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} />
                            <RechartsTooltip contentStyle={{ backgroundColor: "#1e293b", borderRadius: 8, border: "1px solid var(--border-color)", fontSize: 12, color: "#f8fafc" }}
                              formatter={(val, name) => [`${(val * 100).toFixed(2)}%`, name]} />
                            <Legend wrapperStyle={{ fontSize: 12 }} />
                            <Bar dataKey="roe" name="ROE" fill="#0047b3" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="roa" name="ROA" fill="#38bdf8" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Chart EPS */}
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>EPS (Rupiah per Lembar)</p>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={result.fundamental.rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="year" tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "#94a3b8" }} />
                            <YAxis tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
                            <RechartsTooltip contentStyle={{ backgroundColor: "#1e293b", borderRadius: 8, border: "1px solid var(--border-color)", fontSize: 12, color: "#f8fafc" }}
                              formatter={(val) => [formatRupiah(val), "EPS"]} />
                            <Bar dataKey="eps" name="EPS" radius={[4, 4, 0, 0]}>
                              {result.fundamental.rows.map((_, i) => (
                                <Cell key={i} fill={_ .eps > 0 ? "#10b981" : "#ef4444"} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Chart PER */}
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>P/E Ratio (×)</p>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={result.fundamental.rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="year" tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "#94a3b8" }} />
                            <YAxis tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => `${v.toFixed(0)}x`} />
                            <RechartsTooltip contentStyle={{ backgroundColor: "#1e293b", borderRadius: 8, border: "1px solid var(--border-color)", fontSize: 12, color: "#f8fafc" }}
                              formatter={(val) => [`${val.toFixed(2)}x`, "PER"]} />
                            <Bar dataKey="per" name="PER" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Chart DER */}
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 12 }}>DER — Debt to Equity Ratio (×)</p>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={result.fundamental.rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="year" tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "#94a3b8" }} />
                            <YAxis tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={(v) => `${v.toFixed(1)}x`} />
                            <RechartsTooltip contentStyle={{ backgroundColor: "#1e293b", borderRadius: 8, border: "1px solid var(--border-color)", fontSize: 12, color: "#f8fafc" }}
                              formatter={(val) => [`${val.toFixed(2)}x`, "DER"]} />
                            <Bar dataKey="der" name="DER" radius={[4, 4, 0, 0]}>
                              {result.fundamental.rows.map((row, i) => (
                                <Cell key={i} fill={row.der <= 1.5 ? "#10b981" : row.der <= 2.5 ? "#f59e0b" : "#ef4444"} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  {/* Tabel Riwayat Per Tahun */}
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
                </>
              )}
            </>)}
          </>
        )}

        {/* ── Riwayat Analisis (Footer) ── */}
        {currentView !== "profile" && currentView !== "admin_mgmt" && (
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

        {/* ── VIEW: MANAJEMEN ADMIN ── */}
        {currentView === "admin_mgmt" && role === "admin" && (
          <div className="card" style={{ maxWidth: 600, margin: "0 auto" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>Tambah Akun Admin Baru</h3>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.target);
              const payload = Object.fromEntries(fd.entries());
              payload.role = "admin";
              try {
                setStatus("Membuat akun admin...");
                await postJson("/auth/register", payload);
                setStatus("Akun admin berhasil dibuat.");
                e.target.reset();
              } catch (err) {
                setStatus(`Gagal membuat akun: ${err.message}`);
              }
            }} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div className="grid-2" style={{ gap: 16 }}>
                <div>
                  <label className="input-label" style={{display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)'}}>Nama Depan</label>
                  <input type="text" name="first_name" style={{width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', outline: 'none'}} placeholder="Nama depan" required />
                </div>
                <div>
                  <label className="input-label" style={{display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)'}}>Nama Belakang</label>
                  <input type="text" name="last_name" style={{width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', outline: 'none'}} placeholder="Nama belakang" required />
                </div>
              </div>
              <div className="grid-2" style={{ gap: 16 }}>
                <div>
                  <label className="input-label" style={{display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)'}}>Email</label>
                  <input type="email" name="email" style={{width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', outline: 'none'}} placeholder="admin@example.com" required />
                </div>
                <div>
                  <label className="input-label" style={{display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)'}}>No Telp</label>
                  <input type="text" name="phone" style={{width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', outline: 'none'}} placeholder="081234567890" required />
                </div>
              </div>
              <div>
                <label className="input-label" style={{display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)'}}>Username</label>
                <input type="text" name="username" style={{width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', outline: 'none'}} placeholder="adminbaru" required minLength="3" />
              </div>
              <div>
                <label className="input-label" style={{display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-muted)'}}>Password</label>
                <input type="password" name="password" style={{width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border-color)', outline: 'none'}} placeholder="Minimal 6 karakter" required minLength="6" />
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: 16 }}>Buat Akun Admin</button>
            </form>
          </div>
        )}

      </section>
    </main>
  );
}

export default App;

