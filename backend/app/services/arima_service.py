from __future__ import annotations

from typing import Any, Dict, Optional

import numpy as np
import pandas as pd
from fastapi import HTTPException
from statsmodels.tsa.arima.model import ARIMA

from .preprocessing_service import prepare_price_data


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


def resolve_order(p: Optional[int], d: Optional[int], q: Optional[int], is_stationary: bool) -> tuple[int, int, int]:
    auto_d = 0 if is_stationary else 1
    return (1 if p is None else p, auto_d if d is None else d, 1 if q is None else q)


def run_arima(df: pd.DataFrame, horizon: int = 14, train_ratio: float = 0.8, p: Optional[int] = None, d: Optional[int] = None, q: Optional[int] = None) -> Dict[str, Any]:
    data, preprocessing = prepare_price_data(df)
    values = data["close"].astype(float).to_numpy()
    dates = pd.to_datetime(data["date"])
    train_size = int(len(values) * train_ratio)
    if train_size < 30 or len(values) - train_size < 5:
        raise HTTPException(status_code=400, detail="Rasio training/testing tidak valid untuk jumlah data yang tersedia.")

    order = resolve_order(p, d, q, preprocessing["adf"].get("is_stationary", False))
    train = values[:train_size]
    test = values[train_size:]
    test_dates = dates.iloc[train_size:]

    try:
        fitted = ARIMA(train, order=order).fit()
        test_pred = fitted.forecast(steps=len(test))
        fitted_full = ARIMA(values, order=order).fit()
        future_pred = fitted_full.forecast(steps=horizon)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Model ARIMA{order} gagal diproses: {exc}") from exc

    metrics = {"mae": mae(test, test_pred), "mse": mse(test, test_pred), "rmse": rmse(test, test_pred), "mape": mape(test, test_pred)}
    last_date = dates.iloc[-1]
    future_dates = pd.date_range(last_date, periods=horizon + 1, freq="B")[1:]

    actual = [{"date": dt.strftime("%Y-%m-%d"), "value": float(val)} for dt, val in zip(dates, values)]
    prediction_test = [{"date": dt.strftime("%Y-%m-%d"), "actual": float(a), "predicted": float(pv)} for dt, a, pv in zip(test_dates, test, test_pred)]
    forecast = [{"date": dt.strftime("%Y-%m-%d"), "value": float(val)} for dt, val in zip(future_dates, future_pred)]

    return {
        "preprocessing": preprocessing,
        "model": {"order": list(order), "train_ratio": train_ratio, "train_size": int(len(train)), "test_size": int(len(test)), "horizon": int(horizon)},
        "metrics": metrics,
        "actual_tail": actual[-160:],
        "prediction_test": prediction_test,
        "forecast": forecast,
        "summary": f"ARIMA{order} menghasilkan MAPE {metrics['mape']:.2f}% pada data testing.",
    }


def evaluate_scenarios(df: pd.DataFrame, ratios=(0.7, 0.8, 0.9), horizon: int = 14) -> list[Dict[str, Any]]:
    results = []
    for ratio in ratios:
        try:
            out = run_arima(df, horizon=horizon, train_ratio=ratio)
            results.append({"train_ratio": ratio, "order": out["model"]["order"], **out["metrics"]})
        except Exception as exc:
            results.append({"train_ratio": ratio, "error": str(exc)})
    return results
