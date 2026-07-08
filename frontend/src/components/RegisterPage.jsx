import React, { useState } from "react";
import { User, Shield, Database, TrendingUp, AlertCircle, CheckCircle } from "lucide-react";
import { registerUser } from "../services/api";

function RegisterPage({ onGoLogin }) {
  const [form, setForm] = useState({ username: "", email: "", password: "", confirmPassword: "", role: "visitor" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.username || !form.email || !form.password) { setError("Semua kolom wajib diisi."); return; }
    if (form.password.length < 6) { setError("Password minimal 6 karakter."); return; }
    if (form.password !== form.confirmPassword) { setError("Password dan konfirmasi password tidak cocok."); return; }
    try {
      setLoading(true);
      await registerUser(form.username, form.email, form.password, form.role);
      setSuccess(`Akun '${form.username}' berhasil dibuat! Silakan login.`);
      setForm({ username: "", email: "", password: "", confirmPassword: "", role: "visitor" });
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
          Bergabung &amp;<br />
          <span className="highlight">Mulai Analisis</span><br />
          Saham TLKM
        </div>
        <p className="auth-branding-desc">
          Buat akun untuk mengakses seluruh fitur prediksi dan analisis fundamental. Admin dapat mengunggah dataset dan menjalankan model ARIMA.
        </p>
        <div className="auth-branding-features">
          <div className="auth-feature-item">
            <div className="auth-feature-icon"><User size={16} color="#38bdf8" /></div>
            Pengunjung — akses baca laporan &amp; grafik
          </div>
          <div className="auth-feature-item">
            <div className="auth-feature-icon"><Shield size={16} color="#a78bfa" /></div>
            Admin — unggah data &amp; jalankan analisis
          </div>
          <div className="auth-feature-item">
            <div className="auth-feature-icon"><Database size={16} color="#10b981" /></div>
            Data tersimpan aman di SQLite lokal
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="auth-form-panel">
        <div className="auth-form-card">
          <div className="auth-form-header">
            <h2>Buat Akun Baru</h2>
            <p>Isi data di bawah untuk mendaftar</p>
          </div>

          {error && (
            <div className="auth-error-msg" style={{ marginBottom: 16 }}>
              <AlertCircle size={15} />
              {error}
            </div>
          )}
          {success && (
            <div className="auth-success-msg" style={{ marginBottom: 16 }}>
              <CheckCircle size={15} />
              {success}
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-form-group">
              <label>Username</label>
              <input className="auth-form-input" type="text" placeholder="min. 3 karakter" value={form.username} onChange={set("username")} />
            </div>
            <div className="auth-form-group">
              <label>Email</label>
              <input className="auth-form-input" type="email" placeholder="email@contoh.com" value={form.email} onChange={set("email")} />
            </div>
            <div className="auth-form-group">
              <label>Password</label>
              <input className="auth-form-input" type="password" placeholder="min. 6 karakter" value={form.password} onChange={set("password")} />
            </div>
            <div className="auth-form-group">
              <label>Konfirmasi Password</label>
              <input className="auth-form-input" type="password" placeholder="Ulangi password" value={form.confirmPassword} onChange={set("confirmPassword")} />
            </div>

            <div className="auth-form-group">
              <label>Role Akun</label>
              <div className="auth-role-grid">
                <button
                  type="button"
                  className={`auth-role-btn ${form.role === "visitor" ? "selected" : ""}`}
                  onClick={() => setForm({ ...form, role: "visitor" })}
                >
                  <div className="auth-role-icon" style={{ background: form.role === "visitor" ? "var(--accent-blue-light)" : "#f1f5f9" }}>
                    <User size={18} color={form.role === "visitor" ? "var(--accent-blue)" : "#64748b"} />
                  </div>
                  Pengunjung
                </button>
                <button
                  type="button"
                  className={`auth-role-btn ${form.role === "admin" ? "selected-admin" : ""}`}
                  onClick={() => setForm({ ...form, role: "admin" })}
                >
                  <div className="auth-role-icon" style={{ background: form.role === "admin" ? "#e2e8f0" : "#f1f5f9" }}>
                    <Shield size={18} color={form.role === "admin" ? "#0f172a" : "#64748b"} />
                  </div>
                  Admin
                </button>
              </div>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? "Mendaftarkan..." : "Buat Akun"}
            </button>
          </form>

          <div className="auth-switch-link" style={{ marginTop: 16 }}>
            <p>Sudah punya akun?
              <button onClick={onGoLogin}>Masuk sekarang</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
