const API_BASE = "";

function getHeaders(extraHeaders = {}) {
  const role = localStorage.getItem("role") || "visitor";
  return {
    "X-Role": role,
    ...extraHeaders,
  };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function loginUser(username, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Login gagal");
  return data; // { success: true, user: { id, username, email, role } }
}

export async function registerUser(username, email, password, role = "visitor") {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password, role }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Registrasi gagal");
  return data; // UserResponse
}

export async function updateProfile(id, profileData) {
  const res = await fetch(`${API_BASE}/auth/profile`, {
    method: "PUT",
    headers: getHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ id, ...profileData }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Update profil gagal");
  return data; // UserResponse
}

// ─── Upload & Analysis ────────────────────────────────────────────────────────

export async function uploadCsv(endpoint, file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: getHeaders(),
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Upload gagal");
  return data;
}

export async function postJson(endpoint, body) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: getHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Request gagal");
  return data;
}

export async function getLatestAnalysis() {
  const res = await fetch(`${API_BASE}/analysis/latest`, {
    headers: getHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Gagal mengambil data analisis terbaru");
  return data;
}

export async function getHistory() {
  const res = await fetch(`${API_BASE}/history`, {
    headers: getHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Gagal mengambil riwayat");
  return data.items || [];
}

export async function getFiles() {
  const res = await fetch(`${API_BASE}/data/files`, {
    headers: getHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Gagal mengambil daftar file");
  return data.files || [];
}

export async function deleteFile(filename) {
  const res = await fetch(`${API_BASE}/data/files/${filename}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Gagal menghapus file");
  return data;
}
