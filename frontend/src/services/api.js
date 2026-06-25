const API_BASE = "";

function getHeaders(extraHeaders = {}) {
  const role = localStorage.getItem("role") || "visitor";
  return {
    "X-Role": role,
    ...extraHeaders,
  };
}

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

