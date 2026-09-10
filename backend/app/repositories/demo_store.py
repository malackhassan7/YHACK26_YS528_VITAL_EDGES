"""
demo_store.py — In-memory demo data store for Sprint A.

All data structures are application-lifetime in-process state.
Reset with reset_demo_store() between tests.

Sprint A additions:
- IMAGE_SHA256S: sha256 → (lot_id, local_id) for exact duplicate detection
- IMAGE_PHASHES: phash_str → (lot_id, local_id) for perceptual duplicate detection
- VERIFICATION_RESULTS: lot_id → VerificationResult
- VERIFICATION_CHECKS: append-only list (per database-schema.md)
- PRICING_RESULTS: lot_id → PricingResult
- RECYCLER_MATCHES: lot_id → list[RecyclerMatch]
"""

from datetime import UTC, datetime
from uuid import uuid4

from app.core.auth import AuthenticatedUser
from app.core.errors import ApiError
from app.domain.lot_models import (
    Condition,
    ConfidenceLevel,
    EvidenceMetadata,
    HandoverRecord,
    LotItem,
    LotRecord,
    LotStatus,
    MaterialCategory,
    MaterialRecoveryItem,
    OfferAnomalyLevel,
    OfferRecord,
    OfferStatus,
    PaymentRecord,
    PickupInfo,
    PickupPreference,
    PricingResult,
    ProcessingRecord,
    RecyclerMatch,
    RecyclingEvidenceRecord,
    TraceEvent,
    TransactionRecord,
    TransactionStatus,
    VerificationCheck,
    VerificationResult,
)


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


MATERIALS: list[MaterialCategory] = [
    MaterialCategory(id="mat-mobile",  code="MOBILE_PHONES",     name="Mobile Phones",        hazardLevel="medium", handlingNotes="Keep swollen batteries separate."),
    MaterialCategory(id="mat-laptop",  code="LAPTOPS_COMPUTERS", name="Laptops / Computers",  hazardLevel="medium", handlingNotes="Avoid crushing screens or batteries."),
    MaterialCategory(id="mat-pcb",     code="CIRCUIT_BOARDS",    name="Circuit Boards / PCB", hazardLevel="medium", handlingNotes="Use gloves around sharp boards."),
    MaterialCategory(id="mat-cables",  code="CABLES_WIRES",      name="Cables / Wires",       hazardLevel="low",    handlingNotes="Bundle cables before pickup."),
    MaterialCategory(id="mat-battery", code="BATTERIES",         name="Batteries",            hazardLevel="high",   handlingNotes="Do not puncture or heat batteries."),
    MaterialCategory(id="mat-charger", code="CHARGERS_ADAPTERS", name="Chargers / Adapters",  hazardLevel="low",    handlingNotes="Keep plugs covered if damaged."),
    MaterialCategory(id="mat-display", code="DISPLAYS_MONITORS", name="Displays / Monitors",  hazardLevel="medium", handlingNotes="Handle broken glass carefully."),
    MaterialCategory(id="mat-mixed",   code="MIXED_ELECTRONICS", name="Mixed Electronics",    hazardLevel="medium", handlingNotes="Separate leaking or sharp items."),
]

# ── Core lot stores (Phase 1/2) ────────────────────────────────────────────────
LOTS: dict[str, LotRecord] = {}
TRACE_EVENTS: list[TraceEvent] = []
SYNC_RESULTS: dict[tuple[str, str], dict] = {}

# ── Sprint A: Verification ────────────────────────────────────────────────────
IMAGE_SHA256S: dict[str, tuple[str, str]] = {}
IMAGE_PHASHES: dict[str, tuple[str, str]] = {}
VERIFICATION_CHECKS: list[VerificationCheck] = []
VERIFICATION_RESULTS: dict[str, VerificationResult] = {}

# ── Sprint A: Pricing ─────────────────────────────────────────────────────────
PRICING_RESULTS: dict[str, PricingResult] = {}

# ── Sprint A: Matching ────────────────────────────────────────────────────────
RECYCLER_MATCHES: dict[str, list[RecyclerMatch]] = {}

# ── Sprint B: Offers, Transactions & Handover ─────────────────────────────────
OFFERS: dict[str, OfferRecord] = {}
TRANSACTIONS: dict[str, TransactionRecord] = {}
HANDOVER_RECORDS: dict[str, HandoverRecord] = {}

# ── Sprint C: Payments, Processing & Recycling Evidence ───────────────────────
PAYMENTS: dict[str, PaymentRecord] = {}
PROCESSING_RECORDS: dict[str, ProcessingRecord] = {}
RECYCLING_EVIDENCE_RECORDS: dict[str, RecyclingEvidenceRecord] = {}


def reset_demo_store() -> None:
    LOTS.clear()
    TRACE_EVENTS.clear()
    SYNC_RESULTS.clear()
    IMAGE_SHA256S.clear()
    IMAGE_PHASHES.clear()
    VERIFICATION_CHECKS.clear()
    VERIFICATION_RESULTS.clear()
    PRICING_RESULTS.clear()
    RECYCLER_MATCHES.clear()
    OFFERS.clear()
    TRANSACTIONS.clear()
    HANDOVER_RECORDS.clear()
    PAYMENTS.clear()
    PROCESSING_RECORDS.clear()
    RECYCLING_EVIDENCE_RECORDS.clear()


# ── Material helpers ───────────────────────────────────────────────────────────

def get_material(material_id: str) -> MaterialCategory:
    for material in MATERIALS:
        if material.id == material_id:
            return material
    raise ApiError(status_code=400, code="INVALID_MATERIAL", message="Selected material category is not available.")


# ── Ownership helpers ──────────────────────────────────────────────────────────

def assert_collector_owns(lot: LotRecord, user: AuthenticatedUser) -> None:
    if lot.collectorId != user.id:
        raise ApiError(status_code=403, code="FORBIDDEN", message="Collector cannot access another collector's lot.")


# ── Lot CRUD ───────────────────────────────────────────────────────────────────

def create_lot(user: AuthenticatedUser, client_draft_id: str, title: str, item: LotItem | None, pickup, idempotency_key: str | None = None) -> LotRecord:
    for lot in LOTS.values():
        if lot.collectorId == user.id and lot.clientDraftId == client_draft_id:
            return lot
    if item:
        get_material(item.materialCategoryId)
    lot_id = f"lot-{len(LOTS) + 1:04d}"
    timestamp = now_iso()
    lot = LotRecord(
        id=lot_id,
        humanId=f"EW-{len(LOTS) + 1:04d}",
        collectorId=user.id,
        clientDraftId=client_draft_id,
        title=title or "Digital E-Waste Lot",
        status=LotStatus.DRAFT,
        item=item,
        pickup=pickup,
        createdAt=timestamp,
        updatedAt=timestamp,
    )
    LOTS[lot.id] = lot
    append_trace(lot.id, user.id, "LOT_DRAFT_CREATED", None, LotStatus.DRAFT, "Draft lot created.", idempotency_key)
    return lot


def update_lot(lot: LotRecord, user: AuthenticatedUser, title: str, item: LotItem | None, pickup, idempotency_key: str | None = None) -> LotRecord:
    assert_collector_owns(lot, user)
    if lot.status != LotStatus.DRAFT:
        raise ApiError(status_code=409, code="INVALID_LOT_STATE", message="Only DRAFT lots can be edited.")
    if item:
        get_material(item.materialCategoryId)
    lot.title = title or lot.title
    lot.item = item
    lot.pickup = pickup
    lot.updatedAt = now_iso()
    append_trace(lot.id, user.id, "LOT_DRAFT_UPDATED", LotStatus.DRAFT, LotStatus.DRAFT, "Draft lot updated.", idempotency_key)
    return lot


def add_evidence(lot: LotRecord, user: AuthenticatedUser, evidence: EvidenceMetadata, idempotency_key: str | None = None) -> LotRecord:
    assert_collector_owns(lot, user)
    if lot.status not in {LotStatus.DRAFT, LotStatus.CAPTURED}:
        raise ApiError(status_code=409, code="INVALID_LOT_STATE", message="Evidence can only be attached to DRAFT or CAPTURED lots in Phase 2.")
    if len(lot.evidence) >= 5 and all(existing.localId != evidence.localId for existing in lot.evidence):
        raise ApiError(status_code=400, code="TOO_MANY_IMAGES", message="A Phase 2 lot can contain at most 5 evidence photos.")
    if evidence.mimeType not in {"image/jpeg", "image/png", "image/webp"}:
        raise ApiError(status_code=415, code="UNSUPPORTED_IMAGE_TYPE", message="Use JPEG, PNG, or WebP evidence images.")
    lot.evidence = [existing for existing in lot.evidence if existing.localId != evidence.localId] + [evidence]
    lot.updatedAt = now_iso()
    append_trace(lot.id, user.id, "LOT_EVIDENCE_ATTACHED", lot.status, lot.status, "Evidence metadata attached.", idempotency_key)
    return lot


def get_lot_for_collector(lot_id: str, user: AuthenticatedUser) -> LotRecord:
    lot = LOTS.get(lot_id)
    if lot is None:
        raise ApiError(status_code=404, code="NOT_FOUND", message="Lot was not found.")
    assert_collector_owns(lot, user)
    return lot


def get_lot_any(lot_id: str) -> LotRecord:
    """Get a lot without ownership check — for verification service internals."""
    lot = LOTS.get(lot_id)
    if lot is None:
        raise ApiError(status_code=404, code="NOT_FOUND", message="Lot was not found.")
    return lot


get_lot = get_lot_any


def save_lot(lot: LotRecord) -> None:
    LOTS[lot.id] = lot


# ── Trace events ───────────────────────────────────────────────────────────────

def append_trace(lot_id: str, actor_id: str, event_type: str, from_status: LotStatus | None, to_status: LotStatus | None, message: str, idempotency_key: str | None = None) -> TraceEvent:
    event = TraceEvent(
        id=str(uuid4()),
        lotId=lot_id,
        actorProfileId=actor_id,
        eventType=event_type,
        fromStatus=from_status,
        toStatus=to_status,
        message=message,
        occurredAt=now_iso(),
        idempotencyKey=idempotency_key,
    )
    TRACE_EVENTS.append(event)
    return event


# ── Sprint A: Verification store helpers ───────────────────────────────────────

def store_verification_result(result: VerificationResult) -> None:
    VERIFICATION_RESULTS[result.lotId] = result
    for check in result.checks:
        # Stamp the lot_id on each check before storing
        check.lotId = result.lotId
        VERIFICATION_CHECKS.append(check)


def store_image_hashes(lot_id: str, sha256: str, phash: str | None, local_id: str) -> None:
    IMAGE_SHA256S[sha256] = (lot_id, local_id)
    if phash:
        IMAGE_PHASHES[phash] = (lot_id, local_id)


def get_verification_result(lot_id: str) -> VerificationResult | None:
    return VERIFICATION_RESULTS.get(lot_id)


# ── Sprint A: Pricing store helpers ───────────────────────────────────────────

def store_pricing_result(result: PricingResult) -> None:
    PRICING_RESULTS[result.lotId] = result


def get_pricing_result(lot_id: str) -> PricingResult | None:
    return PRICING_RESULTS.get(lot_id)


# ── Sprint A: Matching store helpers ──────────────────────────────────────────

def store_matches(lot_id: str, matches: list[RecyclerMatch]) -> None:
    RECYCLER_MATCHES[lot_id] = matches


def get_matches(lot_id: str) -> list[RecyclerMatch] | None:
    return RECYCLER_MATCHES.get(lot_id)


# ── Sprint B: Offers helpers ──────────────────────────────────────────────────

def save_offer(offer: OfferRecord) -> None:
    OFFERS[offer.id] = offer


def get_offer(offer_id: str) -> OfferRecord | None:
    return OFFERS.get(offer_id)


def list_offers_for_lot(lot_id: str) -> list[OfferRecord]:
    return [o for o in OFFERS.values() if o.lotId == lot_id]


def list_offers_for_recycler(recycler_id: str) -> list[OfferRecord]:
    return [o for o in OFFERS.values() if o.recyclerId == recycler_id]


# ── Sprint B: Transaction helpers ─────────────────────────────────────────────

def save_transaction(tx: TransactionRecord) -> None:
    TRANSACTIONS[tx.id] = tx


def get_transaction(tx_id: str) -> TransactionRecord | None:
    return TRANSACTIONS.get(tx_id)


def get_transaction_by_lot(lot_id: str) -> TransactionRecord | None:
    for tx in TRANSACTIONS.values():
        if tx.lotId == lot_id:
            return tx
    return None


def list_transactions_for_collector(collector_id: str) -> list[TransactionRecord]:
    return [tx for tx in TRANSACTIONS.values() if tx.collectorId == collector_id]


def list_transactions_for_recycler(recycler_id: str) -> list[TransactionRecord]:
    return [tx for tx in TRANSACTIONS.values() if tx.recyclerId == recycler_id]


# ── Sprint B: Handover helpers ────────────────────────────────────────────────

def save_handover(handover: HandoverRecord) -> None:
    HANDOVER_RECORDS[handover.transactionId] = handover


def get_handover(tx_id: str) -> HandoverRecord | None:
    return HANDOVER_RECORDS.get(tx_id)


def get_handover_by_token(token: str) -> HandoverRecord | None:
    clean = token.strip()
    for h in HANDOVER_RECORDS.values():
        if h.qrToken == clean:
            return h
    return None


# ── Sprint B: Seeded demonstration scenario ───────────────────────────────────

def seed_demo_pcb_scenario() -> LotRecord:
    """
    Seeds a deterministic Circuit Boards lot (EW-PCB-DEMO) with:
    - Status: OFFERS_RECEIVED
    - One NORMAL offer (AllElec Recyclers at ₹480/kg, +2.1% vs mid ₹470)
    - One VERY_LOW offer (EcoScrap Traders at ₹250/kg, -46.8% vs mid ₹470)
    Ensures fairness UI and collector comparison is immediately demonstrable.
    """
    lot_id = "lot-demo-pcb-1"
    now = now_iso()

    lot = LotRecord(
        id=lot_id,
        humanId="EW-PCB-DEMO",
        collectorId="collector-profile",
        clientDraftId="client-pcb-demo",
        title="Commercial Circuit Boards Lot",
        status=LotStatus.OFFERS_RECEIVED,
        item=LotItem(
            materialCategoryId="mat-pcb",
            quantity=25,
            quantityUnit="pieces",
            estimatedWeightKg=12.0,
            condition=Condition.WORKING,
        ),
        pickup=PickupInfo(
            cityArea="Gandhipuram, Coimbatore",
            pinCode="641012",
            preference=PickupPreference.RECYCLER_PICKUP,
        ),
        evidence=[
            EvidenceMetadata(
                localId="img-pcb-1",
                filename="pcb_front.jpg",
                mimeType="image/jpeg",
                sizeBytes=142000,
                angleLabel="Top overview",
                previewDataUrl="",
            )
        ],
        trustScore=85,
        confidenceLevel=ConfidenceLevel.HIGH,
        fairLow=4794.0,
        fairMid=5640.0,
        fairHigh=6486.0,
        currency="INR",
        listedAt=now,
        createdAt=now,
        updatedAt=now,
    )
    LOTS[lot_id] = lot

    offer_normal = OfferRecord(
        id="offer-pcb-normal",
        lotId=lot_id,
        recyclerId="rec-005",
        recyclerName="AllElec Recyclers Pvt Ltd",
        pricePerKg=480.0,
        estimatedTotal=5760.0,
        currency="INR",
        pickupOption="RECYCLER_PICKUP",
        note="Certified e-waste handler with digital scale and immediate receipt.",
        status=OfferStatus.PENDING,
        anomalyLevel=OfferAnomalyLevel.NORMAL,
        anomalyMessage="Within the expected demo/reference fair-value range (+2.1% vs mid).",
        deviationPercent=2.1,
        createdAt=now,
        isDemo=True,
    )
    OFFERS[offer_normal.id] = offer_normal

    offer_low = OfferRecord(
        id="offer-pcb-low",
        lotId=lot_id,
        recyclerId="rec-scrap-traders",
        recyclerName="EcoScrap Traders",
        pricePerKg=250.0,
        estimatedTotal=3000.0,
        currency="INR",
        pickupOption="RECYCLER_PICKUP",
        note="Fast bulk collection, cash on spot.",
        status=OfferStatus.PENDING,
        anomalyLevel=OfferAnomalyLevel.VERY_LOW,
        anomalyMessage="Unusually low compared with the demo/reference fair-value range (-46.8% vs mid).",
        deviationPercent=-46.8,
        createdAt=now,
        isDemo=True,
    )
    OFFERS[offer_low.id] = offer_low

    append_trace(lot_id, "collector-profile", "LOT_CAPTURED", LotStatus.DRAFT, LotStatus.CAPTURED, "Evidence captured.")
    append_trace(lot_id, "collector-profile", "LOT_VERIFIED", LotStatus.VERIFYING, LotStatus.VERIFIED, "Verification passed with HIGH confidence (85/100).")
    append_trace(lot_id, "collector-profile", "LOT_LISTED", LotStatus.VERIFIED, LotStatus.LISTED, "Lot listed for recycler offers.")
    append_trace(lot_id, "rec-005", "OFFER_RECEIVED", LotStatus.LISTED, LotStatus.OFFERS_RECEIVED, "Offer received from AllElec Recyclers at ₹480/kg.")
    append_trace(lot_id, "rec-scrap-traders", "OFFER_RECEIVED", LotStatus.OFFERS_RECEIVED, LotStatus.OFFERS_RECEIVED, "Offer received from EcoScrap Traders at ₹250/kg.")

    return lot


def ensure_demo_pcb_lot() -> LotRecord:
    if "lot-demo-pcb-1" not in LOTS:
        return seed_demo_pcb_scenario()
    return LOTS["lot-demo-pcb-1"]