from __future__ import annotations

import warnings
from typing import Any, Dict, Optional

import numpy as np
import pandas as pd
from fastapi import HTTPException
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.stattools import adfuller

from .preprocessing_service import prepare_price_data

warnings.filterwarnings("ignore")


def mae(y_true, y_pred) -> float:
    return float(np.mean(np.abs(np.asarray(y_true) - np.asarray(y_pred))))


def mse(y_true, y_pred) -> float:
    return float(np.mean((np.asarray(y_true) - np.asarray(y_pred)) ** 2))


def rmse(y_true, y_pred) -> float:
    return float(np.sqrt(mse(y_true, y_pred)))


def mape(y_true, y_pred) -> float:
    actual = np.asarray(y_true, dtype=float)
    pred = np.asarray(y_pred, dtype=float)
    denom = np.where(np.abs(actual) < 1e-9, 1e-9, np.abs(actual))
    return float(np.mean(np.abs((actual - pred) / denom)) * 100.0)


def detect_d(series: np.ndarray) -> int:
    """Deteksi nilai d optimal dengan ADF test pada differencing bertahap."""
    for d_val in range(0, 3):
        s = np.diff(series, n=d_val) if d_val > 0 else series
        try:
            p = adfuller(s, autolag="AIC")[1]
            if p < 0.05:
                return d_val
        except Exception:
            pass
    return 1


def auto_select_order(
    train: np.ndarray,
    p_range=(0, 1, 2, 3),
    q_range=(0, 1, 2, 3),
    forced_p: Optional[int] = None,
    forced_d: Optional[int] = None,
    forced_q: Optional[int] = None,
) -> tuple[int, int, int]:
    """
    Pilih order ARIMA(p, d, q) terbaik menggunakan AIC.
    Jika p/d/q sudah ditentukan user, gunakan nilai tersebut.
    """
    best_d = forced_d if forced_d is not None else detect_d(train)

    # Jika user paksa semua parameter, langsung kembalikan
    if forced_p is not None and forced_d is not None and forced_q is not None:
        return (forced_p, forced_d, forced_q)

    best_aic = np.inf
    best_order = (1, best_d, 1)

    candidates_p = [forced_p] if forced_p is not None else p_range
    candidates_q = [forced_q] if forced_q is not None else q_range

    # Differenced series untuk fitting internal saat d diketahui
    for p in candidates_p:
        for q in candidates_q:
            if p == 0 and q == 0:
                continue  # ARIMA(0,d,0) biasanya tidak informatif
            try:
                trend = "t" if best_d > 0 else "c"
                model = ARIMA(train, order=(p, best_d, q), trend=trend)
                res = model.fit()
                if res.aic < best_aic:
                    best_aic = res.aic
                    best_order = (p, best_d, q)
            except Exception:
                continue

    return best_order


def run_arima(
    df: pd.DataFrame,
    horizon: int = 14,
    train_ratio: float = 0.8,
    p: Optional[int] = None,
    d: Optional[int] = None,
    q: Optional[int] = None,
) -> Dict[str, Any]:
    data, preprocessing = prepare_price_data(df)
    values = data["close"].astype(float).to_numpy()
    dates = pd.to_datetime(data["date"])
    train_size = int(len(values) * train_ratio)
    if train_size < 30 or len(values) - train_size < 5:
        raise HTTPException(
            status_code=400,
            detail="Rasio training/testing tidak valid untuk jumlah data yang tersedia.",
        )

    train = values[:train_size]
    test = values[train_size:]
    test_dates = dates.iloc[train_size:]

    # Auto-select order terbaik berdasarkan AIC pada training data
    order = auto_select_order(train, forced_p=p, forced_d=d, forced_q=q)
    trend = "t" if order[1] > 0 else "c"  # Gunakan linear trend 't' jika d > 0, dan constant 'c' jika d == 0

    try:
        fitted_train = ARIMA(train, order=order, trend=trend).fit()
        test_pred = fitted_train.forecast(steps=len(test))

        fitted_full = ARIMA(values, order=order, trend=trend).fit()
        future_pred = fitted_full.forecast(steps=horizon)
        aic_score = float(fitted_full.aic)
    except Exception as exc:
        raise HTTPException(
            status_code=400,
            detail=f"Model ARIMA{order} gagal diproses: {exc}",
        ) from exc

    metrics = {
        "mae": mae(test, test_pred),
        "mse": mse(test, test_pred),
        "rmse": rmse(test, test_pred),
        "mape": mape(test, test_pred),
        "aic": aic_score,
    }

    last_date = dates.iloc[-1]
    future_dates = pd.date_range(last_date, periods=horizon + 1, freq="B")[1:]

    actual = [
        {"date": dt.strftime("%Y-%m-%d"), "value": float(val)}
        for dt, val in zip(dates, values)
    ]
    prediction_test = [
        {"date": dt.strftime("%Y-%m-%d"), "actual": float(a), "predicted": float(pv)}
        for dt, a, pv in zip(test_dates, test, test_pred)
    ]
    forecast = [
        {"date": dt.strftime("%Y-%m-%d"), "value": float(val)}
        for dt, val in zip(future_dates, future_pred)
    ]

    return {
        "preprocessing": {**preprocessing, "price_csv_path": preprocessing.get("price_csv_path", "")},
        "model": {
            "order": list(order),
            "train_ratio": train_ratio,
            "train_size": int(len(train)),
            "test_size": int(len(test)),
            "horizon": int(horizon),
        },
        "metrics": metrics,
        "actual_tail": actual[-160:],
        "prediction_test": prediction_test,
        "forecast": forecast,
        "summary": f"ARIMA{order} menghasilkan MAPE {metrics['mape']:.2f}% pada data testing.",
    }


def evaluate_scenarios(
    df: pd.DataFrame, ratios=(0.7, 0.8, 0.9), horizon: int = 14
) -> list[Dict[str, Any]]:
    results = []
    for ratio in ratios:
        try:
            out = run_arima(df, horizon=horizon, train_ratio=ratio)
            results.append(
                {"train_ratio": ratio, "order": out["model"]["order"], **out["metrics"]}
            )
        except Exception as exc:
            results.append({"train_ratio": ratio, "error": str(exc)})
    return results
