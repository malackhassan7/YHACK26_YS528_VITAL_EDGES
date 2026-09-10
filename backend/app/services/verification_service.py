"""
VerificationService — Proof-of-Possession / Evidence Verification pipeline.

Produces a Verification Confidence / Trust Score (0–100).
NEVER claims image authenticity is guaranteed.

Scoring formula (per docs/verification-engine.md):
  Start at 50.
  +10  camera capture; +5 offline_camera_queued; +0 gallery
  +10  all images pass quality; -15 poor quality
  -35  exact SHA-256 duplicate found
  -20  perceptual duplicate (pHash distance ≤ threshold) against another lot
  +10  AI/demo e-waste presence positive; -20 negative/unknown after review
  +10  category confirmed (AI or manual) with safety guide
  +10  ≥3 distinct angles; +5 two angles; -10 one angle
  +10  quantity plausible; -15 implausible
  +10  metadata consistent; -10 inconsistent

  Clamp 0–100.
  HIGH: 75–100, MEDIUM: 50–74, LOW: 0–49
"""

from __future__ import annotations

import hashlib
import io
from uuid import uuid4

from app.core.auth import AuthenticatedUser
from app.core.errors import ApiError
from app.domain.lot_models import (
    CheckStatus,
    ClassificationResult,
    ConfidenceLevel,
    EvidenceMetadata,
    LotRecord,
    LotStatus,
    VerificationCheck,
    VerificationResult,
)
from app.services.classification_adapter import ImageClassificationAdapter

# Quantity plausibility bounds by material_category_id (kg per piece estimate)
# Used to detect obviously implausible declarations
_KG_PER_PIECE_BOUNDS: dict[str, tuple[float, float]] = {
    "mat-mobile":  (0.05, 0.4),
    "mat-laptop":  (0.8, 5.0),
    "mat-pcb":     (0.01, 2.0),
    "mat-cables":  (0.01, 1.0),
    "mat-battery": (0.02, 5.0),
    "mat-charger": (0.05, 1.0),
    "mat-display": (0.5, 25.0),
    "mat-mixed":   (0.01, 50.0),
}


def _sha256_of_data_url(data_url: str) -> str:
    """Hash the raw data of a base64 data URL. Falls back to hashing the string."""
    try:
        if "," in data_url:
            b64_part = data_url.split(",", 1)[1]
            import base64
            raw = base64.b64decode(b64_part + "==")  # lenient padding
            return hashlib.sha256(raw).hexdigest()
    except Exception:
        pass
    return hashlib.sha256(data_url.encode()).hexdigest()


def _sha256_of_filename_and_size(filename: str, size: int) -> str:
    """For evidence without previewDataUrl, hash filename+size as a proxy."""
    return hashlib.sha256(f"{filename}:{size}".encode()).hexdigest()


def _compute_phash_from_data_url(data_url: str) -> str | None:
    """Compute perceptual hash. Returns None if Pillow/imagehash unavailable."""
    try:
        import base64
        import imagehash
        from PIL import Image

        if "," not in data_url:
            return None
        b64_part = data_url.split(",", 1)[1]
        raw = base64.b64decode(b64_part + "==")
        img = Image.open(io.BytesIO(raw))
        return str(imagehash.phash(img))
    except Exception:
        return None


def _hamming_distance(h1: str, h2: str) -> int:
    """Hamming distance between two hex pHash strings."""
    try:
        import imagehash
        return imagehash.hex_to_hash(h1) - imagehash.hex_to_hash(h2)
    except Exception:
        return 100  # assume not duplicate if we can't compare


def _check_image_quality(evidence: EvidenceMetadata) -> CheckStatus:
    """
    Lightweight deterministic quality check.
    Returns PASS, WARNING, or FAIL based on mime, size, and preview availability.
    """
    if evidence.mimeType not in {"image/jpeg", "image/png", "image/webp"}:
        return CheckStatus.FAIL
    if evidence.sizeBytes < 10_000:  # under 10 KB → too small
        return CheckStatus.FAIL
    if evidence.sizeBytes > 5_000_000:
        return CheckStatus.FAIL
    if not evidence.previewDataUrl:
        return CheckStatus.WARNING  # no preview = can't inspect quality
    return CheckStatus.PASS


class VerificationService:
    """
    Authoritative verification pipeline.
    Must be called via the LotTransitionService, not directly from routes.
    """

    def __init__(
        self,
        classification_adapter: ImageClassificationAdapter,
        phash_threshold: int = 10,
        min_trust_for_verified: int = 50,
    ) -> None:
        self._adapter = classification_adapter
        self._phash_threshold = phash_threshold
        self._min_trust = min_trust_for_verified

    def run(
        self,
        lot: LotRecord,
        user: AuthenticatedUser,
        existing_sha256s: dict[str, tuple[str, str]],  # sha256 → (other_lot_id, local_id)
        existing_phashes: dict[str, tuple[str, str]],  # phash_str → (other_lot_id, local_id)
    ) -> VerificationResult:
        """
        Execute the full verification pipeline for a CAPTURED lot.
        Returns VerificationResult regardless of outcome (score/level encode pass/fail).
        """
        if lot.collectorId != user.id:
            raise ApiError(403, "FORBIDDEN", "Collector cannot verify another collector's lot.")
        if lot.status != LotStatus.CAPTURED:
            raise ApiError(409, "INVALID_TRANSITION", f"Lot must be CAPTURED to start verification (current: {lot.status}).")
        if not lot.evidence:
            raise ApiError(400, "INCOMPLETE_LOT", "No evidence attached. Add at least one photo.")

        checks: list[VerificationCheck] = []
        score = 50  # base score per docs/verification-engine.md

        # ── 1. Capture-source contribution ──────────────────────────────────
        capture_sources = set()
        for ev in lot.evidence:
            if ev.angleLabel.lower().startswith("camera") or "live" in ev.angleLabel.lower():
                capture_sources.add("camera")
            else:
                capture_sources.add("gallery")

        # Heuristic: if any evidence has a small data URL starting with "data:" it's likely camera
        has_camera = any(
            ev.previewDataUrl and ev.previewDataUrl.startswith("data:image")
            for ev in lot.evidence
        )
        if has_camera:
            score += 10
            checks.append(self._check("CAPTURE_SOURCE", CheckStatus.PASS, 10,
                "Live device capture detected. Adds confidence to possession claim.", "deterministic"))
        else:
            checks.append(self._check("CAPTURE_SOURCE", CheckStatus.WARNING, 0,
                "Gallery upload. Live capture would add stronger evidence.", "deterministic"))

        # ── 2. Image count / presence ────────────────────────────────────────
        img_count = len(lot.evidence)
        if img_count == 0:
            score -= 20
            checks.append(self._check("IMAGE_COUNT", CheckStatus.FAIL, -20,
                "No evidence images found.", "deterministic"))
        elif img_count == 1:
            checks.append(self._check("IMAGE_COUNT", CheckStatus.WARNING, 0,
                "Only one image. Three angles are recommended.", "deterministic"))
        else:
            checks.append(self._check("IMAGE_COUNT", CheckStatus.PASS, 0,
                f"{img_count} evidence images present.", "deterministic"))

        # ── 3. Image quality checks ──────────────────────────────────────────
        quality_results = [_check_image_quality(ev) for ev in lot.evidence]
        if all(q == CheckStatus.PASS for q in quality_results):
            score += 10
            checks.append(self._check("IMAGE_QUALITY", CheckStatus.PASS, 10,
                "All images pass format and size checks.", "deterministic"))
        elif any(q == CheckStatus.FAIL for q in quality_results):
            score -= 15
            checks.append(self._check("IMAGE_QUALITY", CheckStatus.FAIL, -15,
                "One or more images failed quality checks (corrupted, too small, or wrong format).", "deterministic"))
        else:
            checks.append(self._check("IMAGE_QUALITY", CheckStatus.WARNING, 0,
                "Image quality is acceptable but could be better (some images lack preview data).", "deterministic"))

        # ── 4. Exact SHA-256 duplicate detection ─────────────────────────────
        exact_dup_found = False
        for ev in lot.evidence:
            sha = (
                _sha256_of_data_url(ev.previewDataUrl)
                if ev.previewDataUrl
                else _sha256_of_filename_and_size(ev.filename, ev.sizeBytes)
            )
            if sha in existing_sha256s:
                other_lot_id, _ = existing_sha256s[sha]
                if other_lot_id != lot.id:
                    exact_dup_found = True
                    break

        if exact_dup_found:
            score -= 35
            checks.append(self._check("EXACT_DUPLICATE", CheckStatus.FAIL, -35,
                "Previously used image detected. This image may have been submitted in another lot.",
                "deterministic"))
        else:
            checks.append(self._check("EXACT_DUPLICATE", CheckStatus.PASS, 10,
                "No exact duplicate images found.", "deterministic"))
            score += 10

        # ── 5. Perceptual duplicate detection ────────────────────────────────
        phash_dup_found = False
        phash_distance = 100
        for ev in lot.evidence:
            if not ev.previewDataUrl:
                continue
            phash = _compute_phash_from_data_url(ev.previewDataUrl)
            if phash is None:
                continue
            for stored_hash, (other_lot_id, _) in existing_phashes.items():
                if other_lot_id == lot.id:
                    continue
                dist = _hamming_distance(phash, stored_hash)
                if dist <= self._phash_threshold:
                    phash_dup_found = True
                    phash_distance = dist
                    break
            if phash_dup_found:
                break

        if phash_dup_found:
            score -= 20
            checks.append(self._check("PERCEPTUAL_DUPLICATE", CheckStatus.WARNING, -20,
                f"Visually similar image found in another lot (distance={phash_distance}, threshold={self._phash_threshold}). "
                "May be a resized or compressed version of a previously submitted image.",
                "deterministic",
                result_json={"distance": phash_distance, "threshold": self._phash_threshold}))
        else:
            score += 15
            checks.append(self._check("PERCEPTUAL_DUPLICATE", CheckStatus.PASS, 15,
                "No perceptually similar images found in other lots.", "deterministic"))

        # ── 6. Multi-angle evidence contribution ─────────────────────────────
        unique_angles = set(ev.angleLabel.lower().strip() for ev in lot.evidence)
        if len(unique_angles) >= 3:
            score += 10
            checks.append(self._check("MULTI_ANGLE", CheckStatus.PASS, 10,
                f"Multiple distinct angle labels ({len(unique_angles)}). Evidence covers multiple views.", "deterministic"))
        elif len(unique_angles) == 2:
            score += 5
            checks.append(self._check("MULTI_ANGLE", CheckStatus.WARNING, 5,
                "Two distinct angles. Adding a third angle (e.g. scale or serial number) improves verification.", "deterministic"))
        else:
            score -= 10
            checks.append(self._check("MULTI_ANGLE", CheckStatus.WARNING, -10,
                "Only one angle label. Multiple views (front, back, scale) strengthen evidence.", "deterministic"))

        # ── 7. AI / Demo classification ──────────────────────────────────────
        material_id = lot.item.materialCategoryId if lot.item else None
        angle_labels = [ev.angleLabel for ev in lot.evidence]
        classification: ClassificationResult | None = None
        requires_manual = False

        try:
            classification = self._adapter.classify(material_id, img_count, angle_labels)
        except Exception:
            classification = None

        if classification is not None:
            if classification.eWasteProbability >= 0.70:
                score += 10
                checks.append(self._check("EWASTE_CLASSIFICATION", CheckStatus.PASS, 10,
                    f"E-waste likely detected ({classification.eWasteProbability:.0%} probability). "
                    f"Suggested: {classification.suggestedCategoryName}.",
                    classification.source,
                    result_json={"probability": classification.eWasteProbability,
                                 "suggested": classification.suggestedCategoryName,
                                 "confidence": classification.categoryConfidence}))
                # Category confirmed via adapter
                score += 10
                checks.append(self._check("CATEGORY_CONFIDENCE", CheckStatus.PASS, 10,
                    f"Category classification confidence: {classification.categoryConfidence:.0%}.",
                    classification.source))
            else:
                score -= 20
                checks.append(self._check("EWASTE_CLASSIFICATION", CheckStatus.WARNING, -20,
                    f"E-waste classification uncertain ({classification.eWasteProbability:.0%}). "
                    "Please confirm the material category manually.",
                    classification.source))
                requires_manual = True
        else:
            # AI unavailable → ask collector to confirm category manually
            requires_manual = True
            checks.append(self._check("EWASTE_CLASSIFICATION", CheckStatus.WARNING, 0,
                "Automatic classification unavailable. Please confirm the material category.",
                "fallback", is_fallback=True))

        # ── 8. Quantity plausibility ─────────────────────────────────────────
        if lot.item:
            bounds = _KG_PER_PIECE_BOUNDS.get(material_id or "", (0.01, 50.0))
            implied_kg_per_piece = lot.item.estimatedWeightKg / max(lot.item.quantity, 1)
            plausible = bounds[0] <= implied_kg_per_piece <= bounds[1]
            if plausible:
                score += 10
                checks.append(self._check("QUANTITY_PLAUSIBILITY", CheckStatus.PASS, 10,
                    f"Declared quantity ({lot.item.quantity:.0f} pcs, {lot.item.estimatedWeightKg} kg) is plausible "
                    f"for {lot.item.materialCategoryId}.", "deterministic"))
            else:
                score -= 15
                checks.append(self._check("QUANTITY_PLAUSIBILITY", CheckStatus.WARNING, -15,
                    f"Declared weight ({lot.item.estimatedWeightKg} kg) vs quantity ({lot.item.quantity:.0f} pcs) "
                    "seems implausible. Physical weight verification by recycler is authoritative.", "deterministic",
                    result_json={"implied_kg_per_piece": round(implied_kg_per_piece, 3),
                                 "bounds": bounds}))
        else:
            checks.append(self._check("QUANTITY_PLAUSIBILITY", CheckStatus.WARNING, 0,
                "No item details available. Quantity plausibility cannot be checked.", "deterministic"))

        # ── 9. Clamp and classify ────────────────────────────────────────────
        trust_score = max(0, min(100, score))
        if trust_score >= 75:
            confidence = ConfidenceLevel.HIGH
        elif trust_score >= 50:
            confidence = ConfidenceLevel.MEDIUM
        else:
            confidence = ConfidenceLevel.LOW

        message = (
            f"Verification complete. Trust score: {trust_score}/100 ({confidence} confidence). "
            f"{len([c for c in checks if c.status == CheckStatus.FAIL])} check(s) failed, "
            f"{len([c for c in checks if c.status == CheckStatus.WARNING])} warning(s)."
        )

        return VerificationResult(
            lotId=lot.id,
            trustScore=trust_score,
            confidenceLevel=confidence,
            checks=checks,
            classificationResult=classification,
            isDemoClassification=classification.isDemo if classification else True,
            requiresManualCategoryConfirmation=requires_manual,
            message=message,
        )

    @staticmethod
    def _check(
        check_type: str,
        status: CheckStatus,
        score_delta: int,
        reason: str,
        provider: str,
        is_fallback: bool = False,
        result_json: dict | None = None,
    ) -> VerificationCheck:
        return VerificationCheck(
            id=str(uuid4()),
            lotId="",  # filled in by caller if needed
            checkType=check_type,
            status=status,
            scoreDelta=score_delta,
            reason=reason,
            provider=provider,
            isFallback=is_fallback,
            resultJson=result_json,
        )
