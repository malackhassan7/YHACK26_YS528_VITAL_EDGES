"""
ImageClassificationAdapter — replaceable interface for e-waste classification.

The DemoClassificationAdapter provides deterministic results that are
clearly labeled as demo data. It must never block the golden path.

The AIClassificationAdapter is a stub that reads VITAL_EDGES_AI_API_KEY.
It is intentionally NOT implemented in Sprint A to keep the golden path
stable; the demo adapter handles all classification.
"""

from abc import ABC, abstractmethod

from app.domain.lot_models import ClassificationResult

# Deterministic demo classification data keyed by material category id.
# Source: docs/verification-engine.md and demo-script.md
_DEMO_CLASSIFICATIONS: dict[str, dict] = {
    "mat-mobile": {
        "eWasteProbability": 0.93,
        "suggestedCategoryName": "Mobile Phones",
        "categoryConfidence": 0.90,
    },
    "mat-laptop": {
        "eWasteProbability": 0.95,
        "suggestedCategoryName": "Laptops / Computers",
        "categoryConfidence": 0.88,
    },
    "mat-pcb": {
        "eWasteProbability": 0.96,
        "suggestedCategoryName": "Circuit Boards / PCB",
        "categoryConfidence": 0.92,
    },
    "mat-cables": {
        "eWasteProbability": 0.85,
        "suggestedCategoryName": "Cables / Wires",
        "categoryConfidence": 0.80,
    },
    "mat-battery": {
        "eWasteProbability": 0.97,
        "suggestedCategoryName": "Batteries",
        "categoryConfidence": 0.94,
    },
    "mat-charger": {
        "eWasteProbability": 0.82,
        "suggestedCategoryName": "Chargers / Adapters",
        "categoryConfidence": 0.78,
    },
    "mat-display": {
        "eWasteProbability": 0.91,
        "suggestedCategoryName": "Displays / Monitors",
        "categoryConfidence": 0.86,
    },
    "mat-mixed": {
        "eWasteProbability": 0.80,
        "suggestedCategoryName": "Mixed Electronics",
        "categoryConfidence": 0.72,
    },
}

_DEFAULT_CLASSIFICATION = {
    "eWasteProbability": 0.75,
    "suggestedCategoryName": "Mixed Electronics",
    "categoryConfidence": 0.65,
}


class ImageClassificationAdapter(ABC):
    """
    Replaceable adapter for image classification.
    Implementations must be graceful — never raise unhandled exceptions
    into the verification pipeline. Catch and return None to trigger fallback.
    """

    @abstractmethod
    def classify(
        self,
        material_category_id: str | None,
        image_count: int,
        angle_labels: list[str],
    ) -> ClassificationResult | None:
        """
        Returns a ClassificationResult or None if classification fails.
        None causes the verification service to request manual confirmation.
        """


class DemoClassificationAdapter(ImageClassificationAdapter):
    """
    Deterministic demo classifier. Uses seeded reference data per material
    category. Clearly labeled source='demo'. Never claims to run a real AI model.
    """

    def classify(
        self,
        material_category_id: str | None,
        image_count: int,
        angle_labels: list[str],
    ) -> ClassificationResult | None:
        seed = _DEMO_CLASSIFICATIONS.get(
            material_category_id or "mat-mixed", _DEFAULT_CLASSIFICATION
        )
        # Slight confidence reduction if we have no category hint
        if material_category_id is None:
            confidence = seed["categoryConfidence"] * 0.80
        else:
            confidence = seed["categoryConfidence"]

        return ClassificationResult(
            eWasteProbability=seed["eWasteProbability"],
            suggestedCategoryId=material_category_id,
            suggestedCategoryName=seed["suggestedCategoryName"],
            categoryConfidence=round(confidence, 3),
            source="demo",
            isDemo=True,
        )


class AIClassificationAdapter(ImageClassificationAdapter):
    """
    Stub for an optional external AI classification service.
    Fails gracefully when not configured so the demo adapter takes over.
    AI failure must NEVER block the golden path (docs/verification-engine.md).
    """

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    def classify(
        self,
        material_category_id: str | None,
        image_count: int,
        angle_labels: list[str],
    ) -> ClassificationResult | None:
        # Sprint A: full AI integration is out of scope per AGENTS.md.
        # Return None so the pipeline requests manual confirmation.
        return None


def get_classification_adapter(ai_enabled: bool, api_key: str) -> ImageClassificationAdapter:
    """Factory. Returns AI adapter when configured, else demo adapter."""
    if ai_enabled and api_key:
        return AIClassificationAdapter(api_key)
    return DemoClassificationAdapter()
