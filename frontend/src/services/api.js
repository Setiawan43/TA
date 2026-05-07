const API_BASE = "http://127.0.0.1:8000";

export async function uploadCsv(endpoint, file) {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}${endpoint}`, { method: "POST", body: form });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Upload gagal");
  return data;
}

export async function postJson(endpoint, body) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Request gagal");
  return data;
}

export async function getHistory() {
  const res = await fetch(`${API_BASE}/history`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Gagal mengambil riwayat");
  return data.items || [];
}
