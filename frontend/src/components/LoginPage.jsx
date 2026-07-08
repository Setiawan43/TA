import React, { useState } from "react";
import { Activity, BarChart3, Shield, TrendingUp, AlertCircle } from "lucide-react";
import { loginUser } from "../services/api";

function LoginPage({ onLogin, onGoRegister }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) { setError("Username dan password wajib diisi."); return; }
    try {
      setLoading(true);
      setError("");
      const res = await loginUser(username, password);
      onLogin(res.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      {/* Left branding */}
      <div className="auth-branding">
        <div className="auth-branding-logo">
          <div className="auth-branding-logo-icon">
            <TrendingUp size={24} color="white" />
          </div>
          <div>
            <div className="auth-branding-logo-text">TLKM PREDICT</div>
            <div className="auth-branding-logo-sub">Professional Analytics</div>
          </div>
        </div>
        <div className="auth-branding-tagline">
          Prediksi Saham<br />
          <span className="highlight">Berbasis Data</span><br />
          &amp; Fundamental
        </div>
        <p className="auth-branding-desc">
          Sistem analisis prediktif ARIMA dan evaluasi fundamental PT Telkom Indonesia yang akurat dan mudah digunakan untuk mendukung keputusan investasi.
        </p>
        <div className="auth-branding-features">
          <div className="auth-feature-item">
            <div className="auth-feature-icon"><Activity size={16} color="#38bdf8" /></div>
            Model ARIMA dengan akurasi prediksi tinggi
          </div>
          <div className="auth-feature-item">
            <div className="auth-feature-icon"><BarChart3 size={16} color="#10b981" /></div>
            Analisis fundamental laporan keuangan TLKM
          </div>
          <div className="auth-feature-item">
            <div className="auth-feature-icon"><Shield size={16} color="#a78bfa" /></div>
            Sistem peran Admin &amp; Pengunjung yang aman
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="auth-form-panel">
        <div className="auth-form-card">
          <div className="auth-form-header">
            <h2>Selamat Datang 👋</h2>
            <p>Masuk ke akun Anda untuk melanjutkan</p>
          </div>

          {error && (
            <div className="auth-error-msg" style={{ marginBottom: 16 }}>
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-form-group">
              <label>Username</label>
              <input
                className="auth-form-input"
                type="text"
                placeholder="Masukkan username Anda"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
              />
            </div>
            <div className="auth-form-group">
              <label>Password</label>
              <input
                className="auth-form-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? "Memverifikasi..." : "Masuk ke Dashboard"}
            </button>
          </form>

          <div className="auth-divider" style={{ marginTop: 20 }}>
            <div className="auth-divider-line" />
            <span className="auth-divider-text">atau</span>
            <div className="auth-divider-line" />
          </div>

          <div className="auth-switch-link" style={{ marginTop: 12 }}>
            <p>Belum punya akun?
              <button onClick={onGoRegister}>Daftar sekarang</button>
            </p>
          </div>

          <div style={{ marginTop: 20, padding: "12px 14px", background: "#f8fafc", borderRadius: 10, border: "1px solid var(--border-color)" }}>
            <p style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, fontWeight: 700 }}>AKUN DEFAULT</p>
            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0 }}>Username: <strong>admin</strong> &nbsp;|&nbsp; Password: <strong>admin123</strong></p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
