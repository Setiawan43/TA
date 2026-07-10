/**
 * Bug Condition Exploration Test — Task 1
 *
 * Validates: Requirements 1.1, 1.2, 1.3
 *
 * TUJUAN: Membuktikan bug ada pada kode UNFIXED.
 * Test ini HARUS GAGAL pada kode unfixed — kegagalan mengkonfirmasi bug ada.
 *
 * Bug yang diuji:
 *   isBugCondition(uploadEvent) = upload sukses (server mengembalikan { file_path, rows })
 *   TETAPI handleAnalyze (postJson "/analyze/compare") TIDAK dipanggil secara otomatis.
 *
 * Counterexample yang diharapkan:
 *   "handleUpload sukses tapi postJson('/analyze/compare') tidak pernah dipanggil"
 */

import React from "react";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// ── Mock seluruh modul API sebelum import App ─────────────────────────────────
vi.mock("../services/api", () => ({
  uploadCsv: vi.fn(),
  postJson: vi.fn(),
  getLatestAnalysis: vi.fn(),
  getHistory: vi.fn(),
  getFiles: vi.fn(),
  deleteFile: vi.fn(),
  loginUser: vi.fn(),
  registerUser: vi.fn(),
  updateProfile: vi.fn(),
}));

// ── Mock react-dom/client agar createRoot di main.jsx tidak error saat import ──
vi.mock("react-dom/client", () => ({
  createRoot: vi.fn(() => ({
    render: vi.fn(),
  })),
}));

// ── Mock CSS import ────────────────────────────────────────────────────────────
vi.mock("../styles/style.css", () => ({}));

// Import mocks dan komponen setelah vi.mock
import * as api from "../services/api";
import { App } from "../main.jsx";

// ── Helper: render App sebagai admin ─────────────────────────────────────────
async function renderAsAdmin() {
  const mockUser = { id: 1, username: "admin", role: "admin" };
  const onLogout = vi.fn();
  const onUpdateUser = vi.fn();

  let component;
  await act(async () => {
    component = render(
      <App currentUser={mockUser} onLogout={onLogout} onUpdateUser={onUpdateUser} />
    );
  });

  return component;
}

// ── Setup ─────────────────────────────────────────────────────────────────────
beforeEach(async () => {
  // Reset semua mock sebelum setiap test
  vi.clearAllMocks();

  // Mock getLatestAnalysis: kembalikan data analisis lama (stale state)
  api.getLatestAnalysis.mockResolvedValue({
    arima: {
      actual_tail: [
        { date: "2024-01-01", value: 3800 },
        { date: "2024-01-02", value: 3820 },
        { date: "2024-01-03", value: 3850 }, // data lama
      ],
      forecast: [{ date: "2024-01-10", value: 3900 }],
      model: { order: [2, 1, 2], horizon: 14, train_ratio: 0.8 },
      metrics: { mape: 5.8 },
      preprocessing: {
        price_csv_path: "dataset/sample_price_tlkm.csv",
        end_date: "2024-01-03",
      },
    },
    fundamental: {
      financial_csv_path: "dataset/sample_financial_tlkm.csv",
      latest: { per: 14.8, roe: 0.185 },
    },
  });

  // Mock getHistory: kembalikan array kosong
  api.getHistory.mockResolvedValue([]);

  // Mock getFiles: kembalikan array kosong
  api.getFiles.mockResolvedValue([]);

  // Mock deleteFile: sukses
  api.deleteFile.mockResolvedValue({ success: true });

  // Mock uploadCsv: upload SUKSES — mengembalikan file_path dan rows
  api.uploadCsv.mockResolvedValue({
    file_path: "uploads/test.csv",
    rows: 100,
    columns: ["date", "close"],
    preview_data: null,
  });

  // Mock postJson untuk /analyze/compare — spy untuk verifikasi pemanggilan
  api.postJson.mockResolvedValue({
    arima: {
      actual_tail: [
        { date: "2024-06-01", value: 4100 }, // data baru dari analisis
      ],
      forecast: [{ date: "2024-06-10", value: 4200 }],
      model: { order: [2, 1, 2], horizon: 14, train_ratio: 0.8 },
      metrics: { mape: 4.5 },
      preprocessing: {
        price_csv_path: "uploads/test.csv",
        end_date: "2024-06-01",
      },
    },
    fundamental: {
      financial_csv_path: "dataset/sample_financial_tlkm.csv",
      latest: { per: 13.2, roe: 0.190 },
    },
  });

  // Import App secara dinamis agar mock sudah aktif
  // (App sudah diimport secara statis di atas — baris ini tidak diperlukan)
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Helper: navigasi ke halaman Admin Upload ──────────────────────────────────
async function navigateToAdminUpload() {
  // Tunggu komponen selesai mount dan useEffect selesai
  await waitFor(() => {
    expect(api.getLatestAnalysis).toHaveBeenCalled();
  });

  // Klik tombol "Admin Upload" di sidebar
  const adminBtn = screen.getByRole("button", { name: /upload data/i });
  await act(async () => {
    fireEvent.click(adminBtn);
  });
}

// ── Helper: buat File CSV palsu ───────────────────────────────────────────────
function createFakeCsvFile(name = "test.csv") {
  return new File(["date,close\n2024-01-01,3800\n"], name, {
    type: "text/csv",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE: Bug Condition Exploration
// Validates: Requirements 1.1, 1.2, 1.3
// ─────────────────────────────────────────────────────────────────────────────

describe("Bug Condition Exploration — Upload CSV Sukses Tidak Memicu Analisis Otomatis", () => {
  /**
   * Test 1 — Price Upload
   *
   * Validates: Requirements 1.1
   *
   * Property: Setelah upload price CSV SUKSES, postJson("/analyze/compare", ...)
   * TIDAK pernah dipanggil pada kode unfixed.
   *
   * EXPECTED pada kode UNFIXED: Test GAGAL karena postJson tidak dipanggil
   * (yang berarti assert toHaveBeenCalledWith akan FAIL → mengkonfirmasi bug)
   *
   * Counterexample: "uploadCsv('/upload/price') sukses dengan file_path='uploads/test.csv'
   * tetapi postJson('/analyze/compare', ...) tidak pernah dipanggil."
   */
  it("Test 1 — Price Upload: postJson('/analyze/compare') harus dipanggil setelah upload price CSV sukses", async () => {
    await renderAsAdmin();
    await navigateToAdminUpload();

    // Pastikan uploadCategory = "price_historical" (default)
    // dan set file price CSV
    const fileInput = document.querySelector('input[type="file"]');
    const csvFile = createFakeCsvFile("price_test.csv");

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [csvFile] } });
    });

    // Submit form upload
    const uploadForm = document.querySelector("form");
    await act(async () => {
      fireEvent.submit(uploadForm);
    });

    // Tunggu uploadCsv selesai
    await waitFor(() => {
      expect(api.uploadCsv).toHaveBeenCalledWith("/upload/price", csvFile);
    });

    // ★ ASSERTION UTAMA: postJson("/analyze/compare") HARUS dipanggil
    // Pada kode UNFIXED ini akan GAGAL — membuktikan bug ada
    await waitFor(() => {
      expect(api.postJson).toHaveBeenCalledWith(
        "/analyze/compare",
        expect.objectContaining({
          price_csv_path: "uploads/test.csv",
        })
      );
    });
  });

  /**
   * Test 2 — Financial Upload
   *
   * Validates: Requirements 1.2
   *
   * Property: Setelah upload financial CSV SUKSES, postJson("/analyze/compare", ...)
   * TIDAK pernah dipanggil pada kode unfixed.
   *
   * EXPECTED pada kode UNFIXED: Test GAGAL karena postJson tidak dipanggil
   *
   * Counterexample: "uploadCsv('/upload/financial') sukses dengan file_path='uploads/test.csv'
   * tetapi postJson('/analyze/compare', ...) tidak pernah dipanggil."
   */
  it("Test 2 — Financial Upload: postJson('/analyze/compare') harus dipanggil setelah upload financial CSV sukses", async () => {
    await renderAsAdmin();
    await navigateToAdminUpload();

    // Ganti uploadCategory ke "financial"
    const categorySelect = screen.queryByRole("combobox") ??
      document.querySelector("select");

    if (categorySelect) {
      await act(async () => {
        fireEvent.change(categorySelect, { target: { value: "financial" } });
      });
    }

    // Set file financial CSV
    const fileInput = document.querySelector('input[type="file"]');
    const csvFile = createFakeCsvFile("financial_test.csv");

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [csvFile] } });
    });

    // Submit form upload
    const uploadForm = document.querySelector("form");
    await act(async () => {
      fireEvent.submit(uploadForm);
    });

    // Tunggu uploadCsv selesai
    await waitFor(() => {
      expect(api.uploadCsv).toHaveBeenCalledWith("/upload/financial", csvFile);
    });

    // ★ ASSERTION UTAMA: postJson("/analyze/compare") HARUS dipanggil
    // Pada kode UNFIXED ini akan GAGAL — membuktikan bug ada
    await waitFor(() => {
      expect(api.postJson).toHaveBeenCalledWith(
        "/analyze/compare",
        expect.objectContaining({
          financial_csv_path: "uploads/test.csv",
        })
      );
    });
  });

  /**
   * Test 3 — State Stale
   *
   * Validates: Requirements 1.3
   *
   * Property: Setelah upload price CSV sukses pada kode UNFIXED,
   * result.arima.actual_tail MASIH mengandung data lama (bukan data dari analisis baru).
   * Ini menunjukkan bahwa analisis TIDAK berjalan otomatis.
   *
   * EXPECTED pada kode UNFIXED: Test LULUS (data lama tetap ada = bug terkonfirmasi)
   * EXPECTED pada kode FIXED: Test GAGAL (data baru dari postJson menggantikan data lama)
   *
   * Catatan: Test ini bersifat negasi — pada kode unfixed ia lulus,
   * tapi kegagalan Test 1 dan Test 2 sudah cukup mengkonfirmasi bug.
   * Test ini sebagai observasi tambahan bahwa state tidak diperbarui.
   */
  it("Test 3 — State Stale: setelah upload sukses, result.arima.actual_tail SEHARUSNYA berisi data baru (analisis berjalan otomatis)", async () => {
    // Untuk test ini kita cek secara tidak langsung:
    // postJson DIPANGGIL = analisis berjalan = state diperbarui dengan data baru

    await renderAsAdmin();
    await navigateToAdminUpload();

    // Set file price CSV
    const fileInput = document.querySelector('input[type="file"]');
    const csvFile = createFakeCsvFile("stale_test.csv");

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [csvFile] } });
    });

    // Submit form upload
    const uploadForm = document.querySelector("form");
    await act(async () => {
      fireEvent.submit(uploadForm);
    });

    // Tunggu uploadCsv selesai
    await waitFor(() => {
      expect(api.uploadCsv).toHaveBeenCalled();
    });

    // ★ ASSERTION UTAMA: pada kode FIXED, postJson HARUS dipanggil
    // Ini membuktikan state diperbarui dengan data baru (analisis berjalan otomatis)
    // Pada kode UNFIXED ini akan GAGAL (postJson tidak dipanggil = bug)
    // Pada kode FIXED ini LULUS (postJson dipanggil, state diperbarui)
    await waitFor(() => {
      expect(api.postJson).toHaveBeenCalledWith(
        "/analyze/compare",
        expect.anything()
      );
    });
  });
});


// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE: Preservation Tests — Perilaku Non-Bug-Condition Tidak Berubah
// Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
//
// TUJUAN: Konfirmasi baseline behavior yang HARUS DIPRESERVASI setelah fix.
// Semua test ini HARUS LULUS pada kode UNFIXED.
// Scope: semua input ¬C(X) — bukan upload CSV yang berhasil.
// ─────────────────────────────────────────────────────────────────────────────

describe("Preservation Tests — Perilaku Non-Bug-Condition Tidak Berubah", () => {
  /**
   * Test 1 — Upload Gagal Tidak Mengubah State
   *
   * **Validates: Requirements 3.3, 3.4**
   *
   * Property: Untuk SEMUA skenario upload gagal (network error, format tidak valid,
   * file kosong), `result` state tidak berubah dan `postJson("/analyze/compare")`
   * tidak pernah dipanggil.
   *
   * Input ¬C(X): upload TIDAK sukses → bukan bug condition.
   * EXPECTED pada kode UNFIXED: LULUS — baseline behavior terkonfirmasi.
   */
  it("Test 1 — Upload Gagal Tidak Mengubah State: result state tidak berubah dan postJson tidak dipanggil", async () => {
    // Skenario-skenario gagal yang diuji
    const failureScenarios = [
      { errorMsg: "Network error", label: "network error" },
      { errorMsg: "Format file tidak valid", label: "format tidak valid" },
      { errorMsg: "File kosong", label: "file kosong" },
      { errorMsg: "Ukuran file terlalu besar", label: "file terlalu besar" },
      { errorMsg: "Server error 500", label: "server error" },
    ];

    for (const scenario of failureScenarios) {
      // Cleanup DOM dari iterasi sebelumnya
      cleanup();
      // Reset mock setiap iterasi
      vi.clearAllMocks();

      // getLatestAnalysis tetap mengembalikan data lama
      api.getLatestAnalysis.mockResolvedValue({
        arima: {
          actual_tail: [
            { date: "2024-01-01", value: 3800 },
            { date: "2024-01-02", value: 3820 },
            { date: "2024-01-03", value: 3850 },
          ],
          forecast: [{ date: "2024-01-10", value: 3900 }],
          model: { order: [2, 1, 2], horizon: 14, train_ratio: 0.8 },
          metrics: { mape: 5.8 },
          preprocessing: {
            price_csv_path: "dataset/sample_price_tlkm.csv",
            end_date: "2024-01-03",
          },
        },
        fundamental: {
          financial_csv_path: "dataset/sample_financial_tlkm.csv",
          latest: { per: 14.8, roe: 0.185 },
        },
      });
      api.getHistory.mockResolvedValue([]);

      // ★ Mock uploadCsv GAGAL untuk skenario ini
      api.uploadCsv.mockRejectedValue(new Error(scenario.errorMsg));

      // postJson tidak boleh dipanggil
      api.postJson.mockResolvedValue({});

      await renderAsAdmin();

      await waitFor(() => {
        expect(api.getLatestAnalysis).toHaveBeenCalled();
      });

      // Navigasi ke Admin Upload — ambil semua tombol dengan nama itu,
      // gunakan yang pertama (dalam satu render hanya ada satu)
      const adminBtns = screen.getAllByRole("button", { name: /upload data/i });
      await act(async () => {
        fireEvent.click(adminBtns[0]);
      });

      // Set file CSV
      const fileInput = document.querySelector('input[type="file"]');
      const csvFile = createFakeCsvFile("test.csv");
      await act(async () => {
        fireEvent.change(fileInput, { target: { files: [csvFile] } });
      });

      // Submit form upload (yang ada di dalam konten admin)
      const uploadForms = document.querySelectorAll("form");
      // Gunakan form pertama yang ada (upload form di halaman admin)
      const uploadForm = uploadForms[0];
      await act(async () => {
        fireEvent.submit(uploadForm);
      });

      // Tunggu uploadCsv dipanggil dan gagal
      await waitFor(() => {
        expect(api.uploadCsv).toHaveBeenCalled();
      });

      // Beri waktu untuk async error handling selesai
      await new Promise((r) => setTimeout(r, 50));

      // ★ ASSERTION UTAMA: postJson("/analyze/compare") TIDAK boleh dipanggil
      // ketika upload gagal — skenario: ${scenario.label}
      expect(api.postJson).not.toHaveBeenCalledWith(
        "/analyze/compare",
        expect.anything()
      );
    }
  }, 30000);

  /**
   * Test 2 — Manual Analyze Tetap Berfungsi
   *
   * **Validates: Requirements 3.1**
   *
   * Property: Ketika `handleArimaForecast` dipanggil manual (via tombol "Jalankan Prediksi"
   * di ARIMA view), fungsi HARUS menggunakan path dari `result/pendingPricePath` state.
   *
   * Input ¬C(X): tidak ada upload sebelumnya → bukan bug condition.
   * EXPECTED: LULUS — baseline behavior terkonfirmasi.
   */
  it("Test 2 — Manual Analyze Tetap Berfungsi: handleArimaForecast menggunakan path dari result state", async () => {
    // postJson berhasil mengembalikan data analisis baru
    api.postJson.mockResolvedValue({
      actual_tail: [{ date: "2024-06-01", value: 4100 }],
      forecast: [{ date: "2024-06-10", value: 4200 }],
      model: { order: [2, 1, 2], horizon: 14, train_ratio: 0.8 },
      metrics: { mape: 4.5, mae: 50, rmse: 60, aic: 1200 },
      preprocessing: {
        price_csv_path: "dataset/sample_price_tlkm.csv",
        end_date: "2024-06-01",
      },
    });
    api.getHistory.mockResolvedValue([]);

    await renderAsAdmin();

    // Tunggu data lama dimuat dari getLatestAnalysis
    await waitFor(() => {
      expect(api.getLatestAnalysis).toHaveBeenCalled();
    });

    // Navigasi ke halaman ARIMA
    const arimaBtn = screen.getByRole("button", { name: /prediksi arima/i });
    await act(async () => {
      fireEvent.click(arimaBtn);
    });

    // Set tanggal target agar tombol "Jalankan Prediksi" aktif
    const dateInput = document.querySelector('input[type="date"]');
    await act(async () => {
      fireEvent.change(dateInput, { target: { value: "2024-06-10" } });
    });

    // Klik tombol "Jalankan Prediksi"
    const forecastBtn = screen.getByRole("button", { name: /jalankan prediksi/i });
    await act(async () => {
      fireEvent.click(forecastBtn);
    });

    // Tunggu postJson dipanggil
    await waitFor(() => {
      expect(api.postJson).toHaveBeenCalled();
    });

    // ★ ASSERTION UTAMA: postJson dipanggil dengan path dari result state
    expect(api.postJson).toHaveBeenCalledWith(
      "/analyze/arima",
      expect.objectContaining({
        price_csv_path: "dataset/sample_price_tlkm.csv",
      })
    );
  });

  /**
   * Test 3 — Initial Load on Mount
   *
   * **Validates: Requirements 3.2, 3.5**
   *
   * Property: Ketika komponen App di-mount, `getLatestAnalysis` dan `getHistory`
   * HARUS dipanggil di `useEffect` — baik untuk role admin maupun visitor.
   *
   * Input ¬C(X): mount komponen saja (tidak ada upload) → bukan bug condition.
   * EXPECTED pada kode UNFIXED: LULUS — baseline behavior terkonfirmasi.
   */
  it("Test 3 — Initial Load on Mount: getLatestAnalysis dan getHistory dipanggil saat mount", async () => {
    api.getHistory.mockResolvedValue([
      { id: 1, created_at: "2024-01-01", analysis_type: "COMPARE", summary: "OK" },
    ]);

    // Mount sebagai admin
    await renderAsAdmin();

    // ★ ASSERTION UTAMA: kedua fungsi data loader harus dipanggil di useEffect
    await waitFor(() => {
      expect(api.getLatestAnalysis).toHaveBeenCalledTimes(1);
      expect(api.getHistory).toHaveBeenCalledTimes(1);
    });

    // Verifikasi bahwa ini terjadi tanpa interaksi user apapun
    // (tidak ada klik tombol, tidak ada upload)
    expect(api.uploadCsv).not.toHaveBeenCalled();
    expect(api.postJson).not.toHaveBeenCalled();
  });

  /**
   * Test 4 — Visitor Role Tidak Terpengaruh
   *
   * **Validates: Requirements 3.2**
   *
   * Property: Ketika komponen di-render dengan role = "visitor":
   * 1. Tombol Admin Upload tidak ada di sidebar (early return pada handleUpload)
   * 2. Data dari `getLatestAnalysis` tetap ditampilkan di dashboard
   * 3. `uploadCsv` dan `postJson` tidak pernah dipanggil
   *
   * Input ¬C(X): visitor tidak bisa upload → bukan bug condition.
   * EXPECTED pada kode UNFIXED: LULUS — baseline behavior terkonfirmasi.
   */
  it("Test 4 — Visitor Role Tidak Terpengaruh: visitor tidak bisa upload, data tetap dari state", async () => {
    const visitorUser = { id: 2, username: "visitor_user", role: "visitor" };

    // Render sebagai visitor
    await act(async () => {
      render(
        <App
          currentUser={visitorUser}
          onLogout={vi.fn()}
          onUpdateUser={vi.fn()}
        />
      );
    });

    // Tunggu data dimuat
    await waitFor(() => {
      expect(api.getLatestAnalysis).toHaveBeenCalledTimes(1);
    });

    // ★ ASSERTION 1: Tombol "Admin Upload" tidak ada di sidebar untuk visitor
    const adminUploadBtn = screen.queryByRole("button", { name: /upload data/i });
    expect(adminUploadBtn).toBeNull();

    // ★ ASSERTION 2: uploadCsv dan postJson tidak dipanggil sama sekali
    expect(api.uploadCsv).not.toHaveBeenCalled();
    expect(api.postJson).not.toHaveBeenCalled();

    // ★ ASSERTION 3: Data dari state (getLatestAnalysis) tetap ditampilkan
    // Verifikasi halaman dashboard menampilkan konten (tidak error/kosong)
    // Cek teks yang dirender dari data mock
    await waitFor(() => {
      // Verifikasi dashboard terender — cek elemen yang ada di dashboard baru
      expect(screen.getByText(/harga penutupan/i)).toBeTruthy();
    });
  });

  /**
   * Tambahan — Single File Upload (Price Only)
   *
   * **Validates: Requirements 3.6**
   *
   * Property: Ketika hanya price CSV yang diupload (uploadCategory = "price_historical"),
   * `postJson("/analyze/compare")` HARUS dipanggil dengan `financial_csv_path` yang
   * menggunakan path LAMA dari state (bukan null/undefined).
   *
   * Ini memverifikasi bahwa fix tidak merusak kasus single-file upload:
   * financial path dari state dipreservasi dan diteruskan ke analisis.
   *
   * Setup: getLatestAnalysis mengembalikan result dengan financial_csv_path = "dataset/old_financial.csv"
   * Action: Upload hanya price CSV (uploadCategory = "price_historical")
   * Expected: postJson dipanggil dengan financial_csv_path = "dataset/old_financial.csv"
   *
   * EXPECTED pada kode FIXED: LULUS — path lama dari state digunakan untuk financial.
   */
  it("Tambahan — Single File Upload: financial_csv_path menggunakan path lama dari state saat upload price saja", async () => {
    // Override getLatestAnalysis untuk test ini: financial_csv_path = "dataset/old_financial.csv"
    vi.clearAllMocks();
    api.getLatestAnalysis.mockResolvedValue({
      arima: {
        actual_tail: [
          { date: "2024-01-01", value: 3800 },
          { date: "2024-01-02", value: 3820 },
          { date: "2024-01-03", value: 3850 },
        ],
        forecast: [{ date: "2024-01-10", value: 3900 }],
        model: { order: [2, 1, 2], horizon: 14, train_ratio: 0.8 },
        metrics: { mape: 5.8 },
        preprocessing: {
          price_csv_path: "dataset/sample_price_tlkm.csv",
          end_date: "2024-01-03",
        },
      },
      fundamental: {
        // Path lama financial yang harus dipreservasi saat upload price saja
        financial_csv_path: "dataset/old_financial.csv",
        latest: { per: 14.8, roe: 0.185 },
      },
    });
    api.getHistory.mockResolvedValue([]);

    // uploadCsv sukses — price CSV baru
    api.uploadCsv.mockResolvedValue({
      file_path: "uploads/new_price.csv",
      rows: 150,
      columns: ["date", "close"],
      preview_data: null,
    });

    // postJson /analyze/compare sukses
    api.postJson.mockResolvedValue({
      arima: {
        actual_tail: [{ date: "2024-06-01", value: 4200 }],
        forecast: [{ date: "2024-06-10", value: 4300 }],
        model: { order: [2, 1, 2], horizon: 14, train_ratio: 0.8 },
        metrics: { mape: 4.0 },
        preprocessing: {
          price_csv_path: "uploads/new_price.csv",
          end_date: "2024-06-01",
        },
      },
      fundamental: {
        financial_csv_path: "dataset/old_financial.csv",
        latest: { per: 13.0, roe: 0.20 },
      },
    });

    await renderAsAdmin();

    // Tunggu data lama dimuat dari getLatestAnalysis
    await waitFor(() => {
      expect(api.getLatestAnalysis).toHaveBeenCalled();
    });

    // Navigasi ke Admin Upload
    const adminBtn = screen.getByRole("button", { name: /upload data/i });
    await act(async () => {
      fireEvent.click(adminBtn);
    });

    // Pastikan uploadCategory tetap "price_historical" (default)
    // dan set file price CSV
    const fileInput = document.querySelector('input[type="file"]');
    const priceCsvFile = createFakeCsvFile("new_price.csv");

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [priceCsvFile] } });
    });

    // Submit form upload
    const uploadForm = document.querySelector("form");
    await act(async () => {
      fireEvent.submit(uploadForm);
    });

    // Tunggu uploadCsv dipanggil dengan endpoint price
    await waitFor(() => {
      expect(api.uploadCsv).toHaveBeenCalledWith("/upload/price", priceCsvFile);
    });

    // ★ ASSERTION UTAMA: postJson HARUS dipanggil dengan:
    // - price_csv_path = path baru dari upload ("uploads/new_price.csv")
    // - financial_csv_path = path LAMA dari state ("dataset/old_financial.csv") — BUKAN null/undefined
    await waitFor(() => {
      expect(api.postJson).toHaveBeenCalledWith(
        "/analyze/compare",
        expect.objectContaining({
          price_csv_path: "uploads/new_price.csv",
          financial_csv_path: "dataset/old_financial.csv",
        })
      );
    });
  });
});
