import React, { useState } from "react";
import { AlertCircle, CheckCircle, User, Shield } from "lucide-react";
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
      setSuccess(`Akun '${form.username}' berhasil dibuat. Silakan login.`);
      setForm({ username: "", email: "", password: "", confirmPassword: "", role: "visitor" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-form-panel" style={{ maxWidth: 460 }}>
        <div className="auth-form-card">

          {/* ── Dark branding section ── */}
          <div className="auth-card-brand">
            <div className="auth-card-brand-name">TLKM PREDICT</div>
            <div className="auth-card-brand-sub">Professional Analytics</div>
            <div className="auth-card-tagline">
              Bergabung dan <span className="highlight">Mulai Analisis</span><br />
              Saham TLKM
            </div>
            <p className="auth-card-desc">
              Buat akun untuk mengakses seluruh fitur prediksi dan analisis fundamental.
            </p>
          </div>

          {/* ── White form section ── */}
          <div className="auth-form-body">
            <div className="auth-form-header">
              <h2>Buat Akun</h2>
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
                <input className="auth-form-input" type="text" placeholder="Minimal 3 karakter" value={form.username} onChange={set("username")} />
              </div>
              <div className="auth-form-group">
                <label>Email</label>
                <input className="auth-form-input" type="email" placeholder="nama@contoh.com" value={form.email} onChange={set("email")} />
              </div>
              <div className="auth-form-group">
                <label>Password</label>
                <input className="auth-form-input" type="password" placeholder="Minimal 6 karakter" value={form.password} onChange={set("password")} />
              </div>
              <div className="auth-form-group">
                <label>Konfirmasi Password</label>
                <input className="auth-form-input" type="password" placeholder="Ulangi password" value={form.confirmPassword} onChange={set("confirmPassword")} />
              </div>

              <div className="auth-form-group">
                <label>Tipe Akun</label>
                <div className="auth-role-grid">
                  <button
                    type="button"
                    className={`auth-role-btn ${form.role === "visitor" ? "selected" : ""}`}
                    onClick={() => setForm({ ...form, role: "visitor" })}
                  >
                    <div className="auth-role-icon">
                      <User size={15} color={form.role === "visitor" ? "#0047b3" : "#64748b"} />
                    </div>
                    Pengunjung
                  </button>
                  <button
                    type="button"
                    className={`auth-role-btn ${form.role === "admin" ? "selected-admin" : ""}`}
                    onClick={() => setForm({ ...form, role: "admin" })}
                  >
                    <div className="auth-role-icon">
                      <Shield size={15} color={form.role === "admin" ? "#0f172a" : "#64748b"} />
                    </div>
                    Admin
                  </button>
                </div>
              </div>

              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? "Mendaftarkan..." : "Buat Akun"}
              </button>
            </form>

            <div className="auth-switch-link" style={{ marginTop: 20 }}>
              <p>Sudah punya akun?
                <button onClick={onGoLogin}>Masuk sekarang</button>
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
