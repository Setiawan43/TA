from __future__ import annotations

from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from .database import init_db, list_history, save_history
from .schemas import ArimaRequest, CompareRequest, FundamentalRequest, UploadResponse
from .services.arima_service import evaluate_scenarios, run_arima
from .services.comparison_service import build_recommendation
from .services.fundamental_service import analyze_fundamental as run_fundamental
from .services.preprocessing_service import load_csv, save_upload

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


@app.on_event("startup")
def startup() -> None:
    init_db()


@app.get("/health")
def health():
    return {"ok": True, "name": APP_NAME}


@app.post("/upload/price", response_model=UploadResponse)
def upload_price(file: UploadFile = File(...)):
    path, meta = save_upload(file, "price")
    return {"file_path": path, **meta}


@app.post("/upload/financial", response_model=UploadResponse)
def upload_financial(file: UploadFile = File(...)):
    path, meta = save_upload(file, "financial")
    return {"file_path": path, **meta}


@app.post("/analyze/arima")
def analyze_arima(req: ArimaRequest):
    df = load_csv(req.price_csv_path)
    result = run_arima(df, req.horizon, req.train_ratio, req.p, req.d, req.q)
    result["scenarios"] = evaluate_scenarios(df, horizon=req.horizon)
    save_history("ARIMA", result, price_file=req.price_csv_path)
    return result


@app.post("/analyze/fundamental")
def analyze_fundamental(req: FundamentalRequest):
    df = load_csv(req.financial_csv_path)
    result = run_fundamental(df, req.per_wajar)
    save_history("FUNDAMENTAL", result, financial_file=req.financial_csv_path)
    return result


@app.post("/analyze/compare")
def analyze_compare(req: CompareRequest):
    price_df = load_csv(req.price_csv_path)
    financial_df = load_csv(req.financial_csv_path)
    arima = run_arima(price_df, req.horizon, req.train_ratio, req.p, req.d, req.q)
    fundamental = run_fundamental(financial_df, req.per_wajar)
    recommendation = build_recommendation(arima, fundamental)
    result = {"arima": arima, "fundamental": fundamental, "recommendation": recommendation}
    save_history("COMPARE", result, price_file=req.price_csv_path, financial_file=req.financial_csv_path)
    return result


@app.get("/history")
def history(limit: int = 20):
    return {"items": list_history(limit)}


# Catch-all route untuk melayani frontend (React)
@app.get("/{path_name:path}")
def serve_frontend(path_name: str):
    # Jika request bukan untuk API, kirimkan index.html
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"error": "Frontend build not found. Please run 'npm run build' in the frontend directory."}
