import type { LotStatus } from "../domain/lot-status";

export const conditionOptions = [
  { value: "WORKING", label: "Working" },
  { value: "PARTIALLY_WORKING", label: "Partially working" },
  { value: "NOT_WORKING", label: "Not working" },
  { value: "DAMAGED", label: "Damaged" },
  { value: "SCRAP", label: "Scrap / dismantled" },
  { value: "UNKNOWN", label: "Unknown" },
] as const;

export type LotCondition = (typeof conditionOptions)[number]["value"];

export const pickupPreferenceOptions = [
  { value: "RECYCLER_PICKUP", label: "Recycler pickup" },
  { value: "COLLECTOR_DROPOFF", label: "I can deliver" },
  { value: "EITHER", label: "Either" },
] as const;

export type PickupPreference = (typeof pickupPreferenceOptions)[number]["value"];

export type SyncStatus = "LOCAL_ONLY" | "PENDING" | "SYNCING" | "SYNCED" | "FAILED";
export type SyncMutationStatus = "PENDING" | "SYNCING" | "COMPLETE" | "FAILED";
export type SyncOperation = "CREATE_DRAFT" | "UPDATE_DRAFT" | "ADD_EVIDENCE" | "CAPTURE_LOT";

export type MaterialCategory = {
  id: string;
  code: string;
  name: string;
  hazardLevel: string;
  handlingNotes: string;
  isDemo: boolean;
};

export type DraftEvidence = {
  localId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  angleLabel: string;
  previewDataUrl: string;
};

export type LocalDraftLot = {
  localId: string;
  serverId?: string;
  collectorId: string;
  title: string;
  materialCategoryId?: string;
  condition?: LotCondition;
  quantity?: number;
  quantityUnit: "pieces";
  estimatedWeightKg?: number;
  pickupCityArea?: string;
  pickupPinCode?: string;
  pickupPreference?: PickupPreference;
  evidence: DraftEvidence[];
  lotStatus: LotStatus;
  syncStatus: SyncStatus;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

export type QueuedMutation = {
  mutationId: string;
  idempotencyKey: string;
  entityLocalId: string;
  operation: SyncOperation;
  payload: LocalDraftLot;
  createdAt: string;
  attemptCount: number;
  lastError?: string;
  status: SyncMutationStatus;
};

export type ServerLot = {
  id: string;
  humanId: string;
  collectorId: string;
  clientDraftId: string;
  title: string;
  status: LotStatus;
  item: null | {
    materialCategoryId: string;
    quantity: number;
    quantityUnit: string;
    estimatedWeightKg: number;
    condition: LotCondition;
  };
  pickup: null | {
    cityArea: string;
    pinCode: string;
    preference: PickupPreference;
  };
  evidence: DraftEvidence[];
  // Sprint A: verification + pricing fields
  trustScore: number | null;
  confidenceLevel: "HIGH" | "MEDIUM" | "LOW" | null;
  fairLow: number | null;
  fairMid: number | null;
  fairHigh: number | null;
  currency: string;
  listedAt: string | null;
  // Sprint B: Physical weight & settlement
  verifiedWeightKg?: number | null;
  finalAmount?: number | null;
  category?: string;
  deviceType?: string;
  unitCount?: number;
  estimatedWeightKg?: number;
  brand?: string;
  model?: string;
  photoUrl?: string;
  condition?: LotCondition;
  declared_item_count?: number;
  approximate_weight_kg?: number;
  pickup_address?: { city?: string; postal_code?: string };
  preferred_pickup_window?: string;
  verification_confidence?: number | null;
  photos?: Array<{ url?: string; previewDataUrl?: string }>;
  createdAt: string;
  updatedAt: string;
};

// ─── Sprint A: Verification ────────────────────────────────────────────────────

export type CheckStatus = "PASS" | "WARNING" | "FAIL";
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export type VerificationCheck = {
  id: string;
  lotId: string;
  checkType: string;
  status: CheckStatus;
  scoreDelta: number;
  reason: string;
  provider: string;
  isFallback: boolean;
  resultJson: Record<string, unknown> | null;
};

export type ClassificationResult = {
  eWasteProbability: number;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
  categoryConfidence: number;
  source: string;
  isDemo: boolean;
};

export type VerificationResult = {
  lotId: string;
  trustScore: number;
  confidenceLevel: ConfidenceLevel;
  checks: VerificationCheck[];
  classificationResult: ClassificationResult | null;
  isDemoClassification: boolean;
  requiresManualCategoryConfirmation: boolean;
  message: string;
};

// ─── Sprint A: Pricing ────────────────────────────────────────────────────────

export type PriceAdjustment = {
  label: string;
  factor: number;
  percentDisplay: string;
  reason: string;
};

export type PricingResult = {
  lotId: string;
  materialCode: string;
  materialName: string;
  referencePrice: number;
  estimatedWeightKg: number;
  conditionGrade: string;
  pricePerKgLow: number;
  pricePerKgMid: number;
  pricePerKgHigh: number;
  lotValueLow: number;
  lotValueMid: number;
  lotValueHigh: number;
  currency: string;
  adjustments: PriceAdjustment[];
  disclaimer: string;
  isDemo: boolean;
  fair_range?: PriceRange;
  fairRange?: PriceRange;
  estimated_total_fair_value?: number;
};

// ─── Sprint A: Matching ────────────────────────────────────────────────────────

export type RecyclerMatch = {
  recyclerId: string;
  recycler_id?: string;
  name: string;
  recycler_name?: string;
  orgName: string;
  matchScore: number;
  compatibilityScore?: number;
  compatibility_score?: number;
  matchReasons: string[];
  match_reasons?: string[];
  pickupAvailable: boolean;
  serviceRegions: string[];
  authorizationStatus: string;
  contactInfo: string;
  isDemo: boolean;
};

// ─── Sprint B: Offers ─────────────────────────────────────────────────────────

export type OfferStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "WITHDRAWN" | "EXPIRED";
export type OfferAnomalyLevel = "NORMAL" | "LOW" | "VERY_LOW" | "HIGH" | "VERY_HIGH";

export type OfferRecord = {
  id: string;
  lotId?: string;
  lot_id?: string;
  collectorId?: string;
  collector_id?: string;
  recyclerId?: string;
  recycler_id?: string;
  recyclerName?: string;
  recycler_name?: string;
  pricePerKg?: number;
  price_per_kg?: number;
  estimatedTotal?: number;
  estimated_total?: number;
  currency?: string;
  pickupOption?: string;
  pickup_option?: string;
  note?: string | null;
  notes?: string | null;
  status: OfferStatus;
  anomalyLevel?: OfferAnomalyLevel;
  fairness_classification?: string;
  anomalyMessage?: string;
  fairness_explanation?: string;
  deviationPercent?: number;
  fairness_deviation?: number;
  createdAt?: string;
  created_at?: string;
  expiresAt?: string | null;
  expires_at?: string | null;
  isDemo?: boolean;
  is_demo?: boolean;
};

export type PriceRange = {
  low_per_kg: number;
  mid_per_kg: number;
  high_per_kg: number;
};

export type PriceFairnessAnalysis = {
  classification: "VERY_LOW" | "LOW" | "NORMAL" | "HIGH" | "VERY_HIGH";
  percentage_deviation: number;
  human_explanation: string;
  fair_range?: PriceRange;
};

// ─── Sprint B: Transactions & Handover ────────────────────────────────────────

export type TransactionStatus =
  | "CREATED"
  | "OFFER_ACCEPTED"
  | "HANDOVER_SCHEDULED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "RECEIVED"
  | "WEIGHT_VERIFIED"
  | "CLOSED"
  | "DISPUTED"
  | "CANCELLED";

export type TransactionRecord = {
  id: string;
  transaction_id?: string;
  lotId?: string;
  lot_id?: string;
  lot_human_id?: string;
  material_type?: string;
  collectorId?: string;
  collector_id?: string;
  recyclerId?: string;
  recycler_id?: string;
  recyclerName?: string;
  recycler_name?: string;
  offerId?: string;
  offer_id?: string;
  agreedPricePerKg?: number;
  agreed_price_per_kg?: number;
  declaredWeightSnapshot?: number;
  declared_weight_snapshot?: number;
  provisionalEstimatedTotal?: number;
  provisional_amount?: number;
  verifiedWeightKg?: number | null;
  verified_weight_kg?: number | null;
  finalAmount?: number | null;
  final_amount?: number | null;
  weight_difference_kg?: number | null;
  weight_difference_percent?: number | null;
  currency?: string;
  status: string;
  scheduled_date?: string | null;
  scheduledAt?: string | null;
  time_window?: string | null;
  pickupWindow?: string | null;
  location_area?: string | null;
  pickupAddress?: string | null;
  acceptedAt?: string;
  accepted_at?: string;
  completed_at?: string;
  isDemo?: boolean;
  is_demo?: boolean;
  createdAt?: string;
  created_at?: string;
  updatedAt?: string;
  updated_at?: string;
};

export type HandoverRecord = {
  id: string;
  transactionId?: string;
  transaction_id?: string;
  lotId?: string;
  lot_id?: string;
  collector_id?: string;
  recycler_id?: string;
  scheduledAt?: string;
  scheduled_date?: string;
  pickupAddress?: string;
  location_area?: string;
  pickupWindow?: string;
  time_window?: string;
  method?: string;
  pickup_option?: string;
  qrToken?: string;
  token?: string;
  manualCode?: string;
  manual_code?: string;
  pickupConfirmedAt?: string | null;
  receivedAt?: string | null;
  status: string;
  createdAt?: string;
  created_at?: string;
};

export type WeightVerificationResult = {
  transactionId?: string;
  transaction_id?: string;
  lotId?: string;
  lot_id?: string;
  declaredWeightKg?: number;
  declared_weight_snapshot?: number;
  verifiedWeightKg?: number;
  verified_weight_kg?: number;
  diffKg?: number;
  weight_difference_kg?: number;
  diffPercent?: number;
  weight_difference_percent?: number;
  agreedPricePerKg?: number;
  agreed_price_per_kg?: number;
  finalAmount?: number;
  final_amount?: number;
  currency?: string;
  isAnomalous?: boolean;
  varianceReason?: string | null;
};

export type MarketplaceLotSummary = {
  id: string;
  humanId: string;
  title: string;
  materialCategoryId?: string | null;
  condition?: string | null;
  estimatedWeightKg: number;
  cityArea?: string | null;
  pinCode?: string | null;
  pickupPreference?: string | null;
  evidenceCount: number;
  trustScore?: number | null;
  confidenceLevel?: string | null;
  fairLow?: number | null;
  fairMid?: number | null;
  fairHigh?: number | null;
  currency: string;
  status: LotStatus;
  listedAt?: string | null;
  isDemo: boolean;
  matchScore?: number | null;
};

export type MarketplaceLotReview = {
  lot: ServerLot;
  verification: VerificationResult | null;
  pricing: PricingResult | null;
  matchInfo: RecyclerMatch | null;
  isDemo: boolean;
};

// ─── Sprint C: Payments, Processing & Recycling Evidence ───────────────────────

export type PaymentRecord = {
  id: string;
  transactionId?: string;
  transaction_id?: string;
  lotId?: string;
  lot_id?: string;
  collectorId?: string;
  collector_id?: string;
  recyclerId?: string;
  recycler_id?: string;
  amount: number;
  currency: string;
  method: string;
  referenceId?: string;
  reference_id?: string;
  status: string;
  confirmedAt?: string;
  confirmed_at?: string;
  isDemo?: boolean;
  is_demo?: boolean;
};

export type ProcessingRecord = {
  id: string;
  lotId?: string;
  lot_id?: string;
  transactionId?: string;
  transaction_id?: string;
  recyclerId?: string;
  recycler_id?: string;
  facilityName?: string;
  facility_name?: string;
  method: string;
  startedAt?: string;
  started_at?: string;
  notes?: string | null;
};

export type MaterialRecoveryItem = {
  materialName?: string;
  material_name?: string;
  percentage?: number;
  recovery_percentage?: number;
  recoveredWeightKg?: number;
  weight_kg?: number;
  destination?: string;
};

export type RecyclingEvidenceRecord = {
  id: string;
  lotId?: string;
  lot_id?: string;
  transactionId?: string;
  transaction_id?: string;
  recyclerId?: string;
  recycler_id?: string;
  facilityName?: string;
  facility_name?: string;
  recycling_facility_name?: string;
  recoveryBreakdown?: MaterialRecoveryItem[];
  recovery_breakdown?: MaterialRecoveryItem[];
  material_outputs?: MaterialRecoveryItem[];
  recoveryRatePercent?: number;
  recovery_rate_percent?: number;
  residualPercentage?: number;
  residual_percentage?: number;
  certificateNumber?: string;
  certificate_number?: string;
  documentUrl?: string | null;
  document_url?: string | null;
  notes?: string | null;
  createdAt?: string;
  created_at?: string;
  isDemo?: boolean;
  is_demo?: boolean;
};

export type CollectorEarningsSummary = {
  collectorId?: string;
  collector_id?: string;
  totalEarnings?: number;
  total_completed_earnings?: number;
  completedPayoutsCount?: number;
  total_lots_recycled?: number;
  total_physical_weight_kg?: number;
  pendingPayoutsCount?: number;
  pending_lots_count?: number;
  pendingAmount?: number;
  pending_settlement_amount?: number;
  transactions?: TransactionRecord[];
  currency?: string;
};