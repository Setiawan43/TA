import React, { useState } from "react";
import { AlertCircle, CheckCircle } from "lucide-react";
import { updateProfile } from "../services/api";

function ProfileSettingsView({ currentUser, onUpdateUser }) {
  const [form, setForm] = useState({ username: currentUser.username, email: currentUser.email || "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    try {
      setLoading(true);
      const data = {};
      if (form.username && form.username !== currentUser.username) data.username = form.username;
      if (form.email && form.email !== currentUser.email) data.email = form.email;
      if (form.password) {
        if (form.password.length < 6) throw new Error("Password minimal 6 karakter.");
        data.password = form.password;
      }
      if (Object.keys(data).length === 0) {
        setSuccess("Tidak ada perubahan yang disimpan.");
        return;
      }
      const res = await updateProfile(currentUser.id, data);
      onUpdateUser(res);
      setSuccess("Profil berhasil diperbarui!");
      setForm({ ...form, password: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card" style={{ maxWidth: 600, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 24, fontSize: 18, fontWeight: 700 }}>Pengaturan Profil Akun</h2>

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
          <input className="auth-form-input" type="text" value={form.username} onChange={set("username")} />
        </div>
        <div className="auth-form-group">
          <label>Email</label>
          <input className="auth-form-input" type="email" placeholder="Belum ada email" value={form.email} onChange={set("email")} />
        </div>
        <div className="auth-form-group">
          <label>Password Baru (Opsional)</label>
          <input className="auth-form-input" type="password" placeholder="Biarkan kosong jika tidak ingin mengubah" value={form.password} onChange={set("password")} />
        </div>
        <button type="submit" className="auth-submit-btn" style={{ marginTop: 12 }} disabled={loading}>
          {loading ? "Menyimpan..." : "Simpan Perubahan"}
        </button>
      </form>
    </div>
  );
}

export default ProfileSettingsView;
