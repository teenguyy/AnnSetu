from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class Model(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class RoleIn(Model):
    role: Literal["donor", "ngo"]


class CreateRequestIn(Model):
    listing_id: UUID
    qty: Decimal = Field(ge=1, le=100000, decimal_places=2)
    rep_id: UUID
    note: str | None = Field(default=None, max_length=500)


class RespondIn(Model):
    accept: bool
    note: str | None = Field(default=None, max_length=500)


class ReassignIn(Model):
    rep_id: UUID


class ConfirmIn(Model):
    code: str = Field(pattern=r"^[0-9]{4}$")


class RepStatusIn(Model):
    status: Literal["on_the_way", "arrived", "delivered"]
    eta: datetime | None = None

    @field_validator("eta")
    @classmethod
    def eta_has_timezone(cls, v: datetime | None) -> datetime | None:
        if v is not None and v.tzinfo is None:
            raise ValueError("eta must include a timezone offset")
        return v


class LocationIn(Model):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    accuracy_m: float | None = Field(default=None, ge=0, le=10000)


class ReasonIn(Model):
    reason: str = Field(min_length=5, max_length=500)


class ReviewIn(Model):
    approve: bool
    note: str | None = Field(default=None, max_length=1000)


class WithdrawIn(Model):
    reason: str | None = Field(default=None, max_length=300)


class ContactIn(Model):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    subject: str = Field(min_length=3, max_length=160)
    body: str = Field(min_length=10, max_length=4000)


class OkOut(BaseModel):
    ok: bool = True


class IdOut(BaseModel):
    id: UUID


class ConfirmOut(BaseModel):
    ok: bool
    reason: str | None = None
    attempts_left: int | None = None


class OtpOut(BaseModel):
    code: str | None


class PreviewItem(BaseModel):
    id: UUID
    title: str
    category: str
    qty_available: Decimal
    unit: str
    pickup_by: datetime
    donor_name: str
    city: str | None


class ListingCard(BaseModel):
    id: UUID
    title: str
    category: str
    qty_total: Decimal
    qty_available: Decimal
    unit: str
    pickup_by: datetime
    prepared_at: datetime | None
    photos: list[str]
    diet: str
    allergens: list[str]
    safety_notes: str | None
    donor_org_id: UUID
    donor_name: str
    donor_city: str | None
    distance_km: Decimal | None
    created_at: datetime


class Page[T](BaseModel):
    items: list[T]
    next_cursor: str | None = None


class CertificateOut(BaseModel):
    serial: str
    org_name: str
    milestone: str
    issued_at: datetime
    valid: bool
