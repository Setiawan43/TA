import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Activity, BarChart3, Database, FileUp, LineChart, RefreshCw } from "lucide-react";
import { CartesianGrid, Legend, Line, LineChart as ReLineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getHistory, postJson, uploadCsv } from "./services/api";
import "./styles/style.css";

function Metric({ label, value }) {
  return <div className="metric"><span>{label}</span><strong>{value ?? "-"}</strong></div>;
}

function App() {
  const [priceFile, setPriceFile] = useState(null);
  const [financialFile, setFinancialFile] = useState(null);
  const [pricePath, setPricePath] = useState("");
  const [financialPath, setFinancialPath] = useState("");
  const [status, setStatus] = useState("Siap memproses data TLKM");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [params, setParams] = useState({ horizon: 14, train_ratio: 0.8, per_wajar: 8, p: "", d: "", q: "" });

  const chartData = useMemo(() => {
    const arima = result?.arima || result;
    if (!arima?.actual_tail) return [];
    const rows = arima.actual_tail.map((x) => ({ date: x.date, actual: x.value }));
    const forecast = arima.forecast || [];
    return rows.concat(forecast.map((x) => ({ date: x.date, forecast: x.value })));
  }, [result]);

  const latestFund = result?.fundamental?.latest || result?.latest;
  const metrics = result?.arima?.metrics || result?.metrics;
  const recommendation = result?.recommendation;

  function cleanParams(extra) {
    return {
      ...extra,
      horizon: Number(params.horizon),
      train_ratio: Number(params.train_ratio),
      per_wajar: Number(params.per_wajar),
      p: params.p === "" ? null : Number(params.p),
      d: params.d === "" ? null : Number(params.d),
      q: params.q === "" ? null : Number(params.q),
    };
  }

  async function uploadFiles() {
    try {
      setStatus("Mengupload dataset...");
      if (priceFile) setPricePath((await uploadCsv("/upload/price", priceFile)).file_path);
      if (financialFile) setFinancialPath((await uploadCsv("/upload/financial", financialFile)).file_path);
      setStatus("Upload selesai. Data siap dianalisis.");
    } catch (error) { setStatus(error.message); }
  }

  async function runCompare() {
    try {
      setStatus("Menjalankan ARIMA dan analisis fundamental...");
      const data = await postJson("/analyze/compare", cleanParams({ price_csv_path: pricePath, financial_csv_path: financialPath }));
      setResult(data);
      setStatus("Analisis selesai.");
    } catch (error) { setStatus(error.message); }
  }

  async function loadHistory() {
    try { setHistory(await getHistory()); } catch (error) { setStatus(error.message); }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><LineChart size={24} /> TLKM Analysis</div>
        <button><FileUp size={18} /> Upload Data</button>
        <button><Activity size={18} /> ARIMA</button>
        <button><BarChart3 size={18} /> Fundamental</button>
        <button onClick={loadHistory}><Database size={18} /> Riwayat</button>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <h1>Dashboard Prediksi Saham TLKM</h1>
            <p>ARIMA untuk prediksi jangka pendek dan fundamental untuk membaca kewajaran harga saham.</p>
          </div>
          <button className="ghost" onClick={loadHistory}><RefreshCw size={18} /> Muat Riwayat</button>
        </header>

        <div className="status">{status}</div>

        <section className="grid two">
          <div className="panel">
            <h2>Upload Dataset</h2>
            <label>CSV Harga Saham</label>
            <input type="file" accept=".csv" onChange={(e) => setPriceFile(e.target.files?.[0])} />
            <label>CSV Laporan Keuangan</label>
            <input type="file" accept=".csv" onChange={(e) => setFinancialFile(e.target.files?.[0])} />
            <button className="primary" onClick={uploadFiles}>Upload</button>
          </div>

          <div className="panel">
            <h2>Parameter Analisis</h2>
            <div className="form-grid">
              <label>Horizon<input type="number" value={params.horizon} onChange={(e) => setParams({ ...params, horizon: e.target.value })} /></label>
              <label>Train Ratio<input type="number" step="0.1" value={params.train_ratio} onChange={(e) => setParams({ ...params, train_ratio: e.target.value })} /></label>
              <label>PER Wajar<input type="number" value={params.per_wajar} onChange={(e) => setParams({ ...params, per_wajar: e.target.value })} /></label>
              <label>p<input type="number" placeholder="auto" value={params.p} onChange={(e) => setParams({ ...params, p: e.target.value })} /></label>
              <label>d<input type="number" placeholder="auto" value={params.d} onChange={(e) => setParams({ ...params, d: e.target.value })} /></label>
              <label>q<input type="number" placeholder="auto" value={params.q} onChange={(e) => setParams({ ...params, q: e.target.value })} /></label>
            </div>
            <button className="primary" disabled={!pricePath || !financialPath} onClick={runCompare}>Jalankan Perbandingan</button>
          </div>
        </section>

        <section className="grid four">
          <Metric label="MAE" value={metrics?.mae?.toFixed?.(2)} />
          <Metric label="MSE" value={metrics?.mse?.toFixed?.(2)} />
          <Metric label="RMSE" value={metrics?.rmse?.toFixed?.(2)} />
          <Metric label="MAPE" value={metrics?.mape ? `${metrics.mape.toFixed(2)}%` : "-"} />
        </section>

        <section className="panel chart-panel">
          <h2>Grafik Aktual dan Prediksi ARIMA</h2>
          <ResponsiveContainer width="100%" height={360}>
            <ReLineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" minTickGap={28} />
              <YAxis domain={["auto", "auto"]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="actual" stroke="#2563eb" dot={false} name="Aktual" />
              <Line type="monotone" dataKey="forecast" stroke="#dc2626" dot={false} name="Forecast" />
            </ReLineChart>
          </ResponsiveContainer>
        </section>

        <section className="grid two">
          <div className="panel">
            <h2>Fundamental Terakhir</h2>
            <table><tbody>
              <tr><th>Tahun</th><td>{latestFund?.year || "-"}</td></tr>
              <tr><th>EPS</th><td>{latestFund?.eps?.toFixed?.(2) || "-"}</td></tr>
              <tr><th>PER</th><td>{latestFund?.per?.toFixed?.(2) || "-"}</td></tr>
              <tr><th>ROE</th><td>{latestFund?.roe ? `${(latestFund.roe * 100).toFixed(2)}%` : "-"}</td></tr>
              <tr><th>ROA</th><td>{latestFund?.roa ? `${(latestFund.roa * 100).toFixed(2)}%` : "-"}</td></tr>
              <tr><th>DER</th><td>{latestFund?.der?.toFixed?.(2) || "-"}</td></tr>
              <tr><th>PBV</th><td>{latestFund?.pbv?.toFixed?.(2) || "-"}</td></tr>
              <tr><th>Nilai Intrinsik</th><td>{latestFund?.intrinsic_value?.toFixed?.(2) || "-"}</td></tr>
            </tbody></table>
          </div>

          <div className="panel recommendation">
            <h2>Rekomendasi Akhir</h2>
            <strong>{recommendation?.summary || "Belum ada hasil analisis."}</strong>
            <p>{recommendation?.short_term}</p>
            <p>{recommendation?.medium_long_term}</p>
            <p>{recommendation?.context_note}</p>
          </div>
        </section>

        <section className="panel">
          <h2>Riwayat Analisis</h2>
          <table><thead><tr><th>Waktu</th><th>Jenis</th><th>Ringkasan</th></tr></thead><tbody>
            {history.map((item) => <tr key={item.id}><td>{item.created_at}</td><td>{item.analysis_type}</td><td>{item.summary}</td></tr>)}
          </tbody></table>
        </section>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
