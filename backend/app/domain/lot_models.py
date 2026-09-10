from enum import StrEnum
from pydantic import BaseModel, Field

from app.domain.lot_status import LotStatus


class Condition(StrEnum):
    WORKING = "WORKING"
    PARTIALLY_WORKING = "PARTIALLY_WORKING"
    NOT_WORKING = "NOT_WORKING"
    DAMAGED = "DAMAGED"
    SCRAP = "SCRAP"
    UNKNOWN = "UNKNOWN"


class PickupPreference(StrEnum):
    RECYCLER_PICKUP = "RECYCLER_PICKUP"
    COLLECTOR_DROPOFF = "COLLECTOR_DROPOFF"
    EITHER = "EITHER"


class ConfidenceLevel(StrEnum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class CheckStatus(StrEnum):
    PASS = "PASS"
    WARNING = "WARNING"
    FAIL = "FAIL"


class OfferAnomalyLevel(StrEnum):
    NORMAL = "NORMAL"
    LOW = "LOW"
    VERY_LOW = "VERY_LOW"
    HIGH = "HIGH"
    VERY_HIGH = "VERY_HIGH"


class MaterialCategory(BaseModel):
    id: str
    code: str
    name: str
    hazardLevel: str
    handlingNotes: str
    isDemo: bool = True


class LotItem(BaseModel):
    materialCategoryId: str
    quantity: float = Field(gt=0, le=10000)
    quantityUnit: str = "pieces"
    estimatedWeightKg: float = Field(gt=0, le=10000)
    condition: Condition


class PickupInfo(BaseModel):
    cityArea: str = Field(min_length=2, max_length=120)
    pinCode: str = Field(min_length=3, max_length=12)
    preference: PickupPreference


class EvidenceMetadata(BaseModel):
    localId: str
    filename: str
    mimeType: str
    sizeBytes: int = Field(gt=0, le=5_000_000)
    angleLabel: str = Field(min_length=2, max_length=40)
    previewDataUrl: str | None = None


class LotRecord(BaseModel):
    id: str
    humanId: str
    collectorId: str
    clientDraftId: str
    title: str
    status: LotStatus
    item: LotItem | None = None
    pickup: PickupInfo | None = None
    evidence: list[EvidenceMetadata] = []
    # Sprint A: added by verification + pricing
    trustScore: int | None = None
    confidenceLevel: ConfidenceLevel | None = None
    fairLow: float | None = None
    fairMid: float | None = None
    fairHigh: float | None = None
    currency: str = "INR"
    listedAt: str | None = None
    # Sprint B: physical weight verification + final commercial settlement
    verifiedWeightKg: float | None = None
    finalAmount: float | None = None
    createdAt: str
    updatedAt: str


class TraceEvent(BaseModel):
    id: str
    lotId: str
    actorProfileId: str
    eventType: str
    fromStatus: LotStatus | None = None
    toStatus: LotStatus | None = None
    message: str
    occurredAt: str
    idempotencyKey: str | None = None


# ─── Sprint A: Verification ────────────────────────────────────────────────────

class VerificationCheck(BaseModel):
    id: str
    lotId: str
    checkType: str
    status: CheckStatus
    scoreDelta: int  # positive = bonus, negative = penalty
    reason: str
    provider: str = "deterministic"  # "deterministic" | "ai" | "fallback" | "demo"
    isFallback: bool = False
    resultJson: dict | None = None


class ClassificationResult(BaseModel):
    eWasteProbability: float  # 0.0–1.0
    suggestedCategoryId: str | None = None
    suggestedCategoryName: str | None = None
    categoryConfidence: float  # 0.0–1.0
    source: str  # "demo" | "ai" | "manual"
    isDemo: bool = True


class VerificationResult(BaseModel):
    lotId: str
    trustScore: int  # 0–100
    confidenceLevel: ConfidenceLevel
    checks: list[VerificationCheck]
    classificationResult: ClassificationResult | None = None
    isDemoClassification: bool = True
    requiresManualCategoryConfirmation: bool = False
    message: str


# ─── Sprint A: Pricing ────────────────────────────────────────────────────────

class PriceAdjustment(BaseModel):
    label: str
    factor: float  # e.g. 0.85 means -15%
    percentDisplay: str  # e.g. "-15%" or "+5%"
    reason: str


class PricingResult(BaseModel):
    lotId: str
    materialCode: str
    materialName: str
    referencePrice: float  # per kg
    estimatedWeightKg: float
    conditionGrade: str
    pricePerKgLow: float
    pricePerKgMid: float
    pricePerKgHigh: float
    lotValueLow: float
    lotValueMid: float
    lotValueHigh: float
    currency: str = "INR"
    adjustments: list[PriceAdjustment]
    disclaimer: str = "Reference/demo pricing — not a live market quote."
    isDemo: bool = True


class OfferAnomalyResult(BaseModel):
    fairMid: float
    offerAmount: float
    deviationPercent: float
    anomalyLevel: OfferAnomalyLevel
    message: str


# ─── Sprint A: Matching ───────────────────────────────────────────────────────

class RecyclerMatch(BaseModel):
    recyclerId: str
    name: str
    orgName: str
    matchScore: int  # 0–100
    matchReasons: list[str]
    pickupAvailable: bool
    serviceRegions: list[str]
    authorizationStatus: str  # "demo_authorized" | "pending"
    contactInfo: str  # demo only
    isDemo: bool = True


# ─── Sprint B: Offers ─────────────────────────────────────────────────────────

class OfferStatus(StrEnum):
    PENDING = "PENDING"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    WITHDRAWN = "WITHDRAWN"
    EXPIRED = "EXPIRED"


class OfferRecord(BaseModel):
    id: str
    lotId: str
    recyclerId: str
    recyclerName: str = "Authorized Recycler"
    pricePerKg: float
    estimatedTotal: float
    currency: str = "INR"
    pickupOption: str = "RECYCLER_PICKUP"
    note: str | None = None
    status: OfferStatus = OfferStatus.PENDING
    anomalyLevel: OfferAnomalyLevel = OfferAnomalyLevel.NORMAL
    anomalyMessage: str = "Offer is within expected demo fair-value range."
    deviationPercent: float = 0.0
    createdAt: str
    expiresAt: str | None = None
    isDemo: bool = True


# ─── Sprint B: Transactions & Handover ────────────────────────────────────────

class TransactionStatus(StrEnum):
    CREATED = "CREATED"
    HANDOVER_SCHEDULED = "HANDOVER_SCHEDULED"
    PICKED_UP = "PICKED_UP"
    IN_TRANSIT = "IN_TRANSIT"
    RECEIVED = "RECEIVED"
    WEIGHT_VERIFIED = "WEIGHT_VERIFIED"
    PAYMENT_CONFIRMED = "PAYMENT_CONFIRMED"
    PROCESSING = "PROCESSING"
    RECYCLING_EVIDENCE_ADDED = "RECYCLING_EVIDENCE_ADDED"
    CLOSED = "CLOSED"
    DISPUTED = "DISPUTED"
    CANCELLED = "CANCELLED"


class TransactionRecord(BaseModel):
    id: str
    lotId: str
    collectorId: str
    recyclerId: str
    recyclerName: str = "Authorized Recycler"
    offerId: str
    agreedPricePerKg: float
    declaredWeightSnapshot: float
    provisionalEstimatedTotal: float
    verifiedWeightKg: float | None = None
    finalAmount: float | None = None
    currency: str = "INR"
    status: TransactionStatus = TransactionStatus.CREATED
    acceptedAt: str
    isDemo: bool = True
    createdAt: str
    updatedAt: str


class HandoverRecord(BaseModel):
    id: str
    transactionId: str
    lotId: str
    scheduledAt: str
    pickupAddress: str
    pickupWindow: str = "09:00 - 18:00"
    method: str = "RECYCLER_PICKUP"
    qrToken: str
    qrTokenHash: str
    pickupConfirmedAt: str | None = None
    receivedAt: str | None = None
    status: str = "SCHEDULED"
    createdAt: str


class WeightVerificationResult(BaseModel):
    transactionId: str
    lotId: str
    declaredWeightKg: float
    verifiedWeightKg: float
    diffKg: float
    diffPercent: float
    agreedPricePerKg: float
    finalAmount: float
    currency: str = "INR"
    isAnomalous: bool = False
    varianceReason: str | None = None


# ─── Sprint C: Payments, Processing & Evidence ────────────────────────────────

class PaymentRecord(BaseModel):
    id: str
    transactionId: str
    lotId: str
    collectorId: str
    recyclerId: str
    amount: float
    currency: str = "INR"
    method: str = "SIMULATED_DIRECT_PAYMENT"
    referenceId: str
    status: str = "CONFIRMED"
    confirmedAt: str
    isDemo: bool = True


class ProcessingRecord(BaseModel):
    id: str
    lotId: str
    transactionId: str
    recyclerId: str
    facilityName: str
    method: str
    startedAt: str
    notes: str | None = None


class MaterialRecoveryItem(BaseModel):
    materialName: str
    percentage: float
    recoveredWeightKg: float


class RecyclingEvidenceRecord(BaseModel):
    id: str
    lotId: str
    transactionId: str
    recyclerId: str
    facilityName: str
    recoveryBreakdown: list[MaterialRecoveryItem]
    residualPercentage: float
    certificateNumber: str
    documentUrl: str | None = None
    notes: str | None = None
    createdAt: str
    isDemo: bool = True


class CollectorEarningsSummary(BaseModel):
    collectorId: str
    totalEarnings: float
    completedPayoutsCount: int
    pendingPayoutsCount: int
    pendingAmount: float
    transactions: list[TransactionRecord]
    currency: str = "INR"