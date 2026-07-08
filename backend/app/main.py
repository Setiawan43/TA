from fastapi import FastAPI, File, UploadFile, Depends, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from .database import (
    init_db, list_history, save_history, get_latest_analysis,
    authenticate_user, create_user, list_users, update_user
)
from .schemas import (
    ArimaRequest, CompareRequest, FundamentalRequest, UploadResponse,
    UserRegister, UserLogin, UserResponse, UserProfileUpdate
)
from .services.arima_service import evaluate_scenarios, run_arima
from .services.comparison_service import build_recommendation
from .services.fundamental_service import analyze_fundamental as run_fundamental
from .services.preprocessing_service import load_csv, save_upload, list_files as get_uploaded_files, delete_file as remove_uploaded_file

APP_NAME = "TLKM ARIMA Fundamental Web"

app = FastAPI(title=APP_NAME, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Tentukan path folder frontend/dist
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")

# Mount folder assets jika folder dist sudah ada
if os.path.exists(os.path.join(FRONTEND_DIR, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIR, "assets")), name="assets")


def verify_admin(x_role: str = Header(None)):
    if x_role != "admin":
        raise HTTPException(
            status_code=403,
            detail="Akses ditolak: Hanya Admin yang dapat mengunggah atau memproses data.",
        )


def check_and_populate_default_data():
    pass  # Data dummy dihapus — dashboard akan kosong sampai admin mengupload CSV.


@app.on_event("startup")
def startup() -> None:
    init_db()
    check_and_populate_default_data()


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"ok": True, "name": APP_NAME}


# ─── Auth Endpoints ───────────────────────────────────────────────────────────

@app.post("/auth/register", response_model=UserResponse)
def register(req: UserRegister):
    try:
        user = create_user(
            username=req.username,
            email=req.email,
            password=req.password,
            role=req.role,
        )
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/auth/login")
def login(req: UserLogin):
    user = authenticate_user(req.username, req.password)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Username atau password salah. Silakan coba lagi.",
        )
    return {"success": True, "user": user}


@app.get("/auth/users", dependencies=[Depends(verify_admin)])
def get_users():
    return {"users": list_users()}


@app.put("/auth/profile", response_model=UserResponse)
def update_profile(req: UserProfileUpdate):
    try:
        user = update_user(
            user_id=req.id,
            username=req.username,
            email=req.email,
            password=req.password
        )
        if not user:
            raise HTTPException(status_code=404, detail="User tidak ditemukan.")
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ─── Analysis Data ────────────────────────────────────────────────────────────

@app.get("/analysis/latest")
def latest_analysis():
    data = get_latest_analysis()
    if not data:
        raise HTTPException(
            status_code=404,
            detail="Belum ada riwayat analisis. Silakan jalankan analisis sebagai Admin.",
        )
    return data


# ─── Upload Endpoints (Admin only) ───────────────────────────────────────────

@app.post("/upload/price", response_model=UploadResponse, dependencies=[Depends(verify_admin)])
def upload_price(file: UploadFile = File(...)):
    path, meta = save_upload(file, "price")
    return {"file_path": path, **meta}


@app.post("/upload/financial", response_model=UploadResponse, dependencies=[Depends(verify_admin)])
def upload_financial(file: UploadFile = File(...)):
    path, meta = save_upload(file, "financial")
    return {"file_path": path, **meta}


@app.get("/data/files", dependencies=[Depends(verify_admin)])
def list_files_endpoint():
    return {"files": get_uploaded_files()}


@app.delete("/data/files/{filename}", dependencies=[Depends(verify_admin)])
def delete_file_endpoint(filename: str):
    remove_uploaded_file(filename)
    return {"success": True, "message": f"File {filename} berhasil dihapus."}


# ─── Analysis Endpoints (Admin only) ─────────────────────────────────────────

@app.post("/analyze/arima")
def analyze_arima(req: ArimaRequest):
    df = load_csv(req.price_csv_path)
    result = run_arima(df, req.horizon, req.train_ratio, req.p, req.d, req.q)
    result["scenarios"] = evaluate_scenarios(df, horizon=req.horizon)
    result["preprocessing"]["price_csv_path"] = req.price_csv_path
    save_history("ARIMA", result, price_file=req.price_csv_path)
    return result


@app.post("/analyze/fundamental")
def analyze_fundamental(req: FundamentalRequest):
    df = load_csv(req.financial_csv_path)
    result = run_fundamental(df, req.per_wajar)
    result["financial_csv_path"] = req.financial_csv_path
    save_history("FUNDAMENTAL", result, financial_file=req.financial_csv_path)
    return result


@app.post("/analyze/compare")
def analyze_compare(req: CompareRequest):
    price_df = load_csv(req.price_csv_path)
    financial_df = load_csv(req.financial_csv_path)
    arima = run_arima(price_df, req.horizon, req.train_ratio, req.p, req.d, req.q)
    arima["preprocessing"]["price_csv_path"] = req.price_csv_path
    fundamental = run_fundamental(financial_df, req.per_wajar)
    fundamental["financial_csv_path"] = req.financial_csv_path
    recommendation = build_recommendation(arima, fundamental)
    result = {"arima": arima, "fundamental": fundamental, "recommendation": recommendation}
    save_history("COMPARE", result, price_file=req.price_csv_path, financial_file=req.financial_csv_path)
    return result


@app.get("/history")
def history(limit: int = 20):
    return {"items": list_history(limit)}


# ─── Frontend Catch-all ───────────────────────────────────────────────────────

@app.get("/{path_name:path}")
def serve_frontend(path_name: str):
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"error": "Frontend build not found. Please run 'npm run build' in the frontend directory."}
