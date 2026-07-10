import React, { useState } from "react";
import { AlertCircle } from "lucide-react";
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
      <div className="auth-form-panel">
        <div className="auth-form-card">

          {/* ── Dark branding section ── */}
          <div className="auth-card-brand">
            <div className="auth-card-brand-name">TLKM PREDICT</div>
            <div className="auth-card-brand-sub">Professional Analytics</div>
            <div className="auth-card-tagline">
              Prediksi Saham <span className="highlight">Berbasis Data</span><br />
              dan Fundamental
            </div>
            <p className="auth-card-desc">
              Sistem analisis prediktif ARIMA dan evaluasi fundamental
              PT Telkom Indonesia untuk mendukung keputusan investasi berbasis data.
            </p>
          </div>

          {/* ── White form section ── */}
          <div className="auth-form-body">
            <div className="auth-form-header">
              <h2>Masuk</h2>
              <p>Gunakan akun Anda untuk melanjutkan</p>
            </div>

            {error && (
              <div className="auth-error-msg" style={{ marginBottom: 20 }}>
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
                  placeholder="Masukkan username"
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
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? "Memverifikasi..." : "Masuk ke Dashboard"}
              </button>
            </form>

            <div className="auth-divider" style={{ marginTop: 24 }}>
              <div className="auth-divider-line" />
              <span className="auth-divider-text">atau</span>
              <div className="auth-divider-line" />
            </div>

            <div className="auth-switch-link" style={{ marginTop: 16 }}>
              <p>Belum punya akun?
                <button onClick={onGoRegister}>Daftar sekarang</button>
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default LoginPage;
