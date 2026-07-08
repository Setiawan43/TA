from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field, EmailStr


class UploadResponse(BaseModel):
    file_path: str
    rows: int
    columns: list[str]
    preview_data: Optional[list[dict]] = None


class ArimaRequest(BaseModel):
    price_csv_path: str
    horizon: int = Field(14, ge=1, le=365)
    train_ratio: float = Field(0.8, ge=0.5, le=0.95)
    p: Optional[int] = Field(None, ge=0, le=5)
    d: Optional[int] = Field(None, ge=0, le=2)
    q: Optional[int] = Field(None, ge=0, le=5)


class FundamentalRequest(BaseModel):
    financial_csv_path: str
    per_wajar: float = Field(8.0, gt=0)


class CompareRequest(BaseModel):
    price_csv_path: str
    financial_csv_path: str
    horizon: int = Field(14, ge=1, le=365)
    train_ratio: float = Field(0.8, ge=0.5, le=0.95)
    per_wajar: float = Field(8.0, gt=0)
    p: Optional[int] = Field(None, ge=0, le=5)
    d: Optional[int] = Field(None, ge=0, le=2)
    q: Optional[int] = Field(None, ge=0, le=5)


# ─── Auth Schemas ─────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str = Field(...)
    password: str = Field(..., min_length=6)
    role: str = Field("visitor", pattern="^(admin|visitor)$")


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str


class UserProfileUpdate(BaseModel):
    id: int
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    email: Optional[str] = None
    password: Optional[str] = Field(None, min_length=6)
