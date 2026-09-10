import { config } from "./config";
import type { UserRole } from "../domain/roles";

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

export type HealthResponse = {
  status: "ok";
  service: string;
  authMode: string;
};

export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isDemo: boolean;
};

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
  }
}

async function parseError(response: Response): Promise<ApiClientError> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return new ApiClientError(response.status, body.error.code, body.error.message);
  } catch {
    return new ApiClientError(response.status, "UNEXPECTED_RESPONSE", "The backend returned an unreadable error response.");
  }
}

export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return (await response.json()) as T;
}

export function getHealth(): Promise<HealthResponse> {
  return apiRequest<HealthResponse>("/health");
}

export function getCurrentUser(token: string): Promise<AuthUser> {
  return apiRequest<AuthUser>("/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
}
import type {
  CollectorEarningsSummary,
  HandoverRecord,
  MarketplaceLotReview,
  MarketplaceLotSummary,
  MaterialCategory,
  MaterialRecoveryItem,
  OfferRecord,
  PaymentRecord,
  PriceFairnessAnalysis,
  ProcessingRecord,
  QueuedMutation,
  RecyclingEvidenceRecord,
  ServerLot,
  TransactionRecord,
  WeightVerificationResult,
} from "../collector/lot-types";

type SyncMutationRequest = {
  mutationId: string;
  idempotencyKey: string;
  operation: QueuedMutation["operation"];
  payload: {
    clientDraftId: string;
    serverId?: string;
    title: string;
    item: null | {
      materialCategoryId: string;
      quantity: number;
      quantityUnit: string;
      estimatedWeightKg: number;
      condition: string;
    };
    pickup: null | {
      cityArea: string;
      pinCode: string;
      preference: string;
    };
    evidence: Array<{
      localId: string;
      filename: string;
      mimeType: string;
      sizeBytes: number;
      angleLabel: string;
      previewDataUrl?: string;
    }>;
  };
};

export type SyncResponse = {
  results: Array<{ mutationId: string; status: "COMPLETE" | "FAILED"; lot: ServerLot | null; error: string | null }>;
};

export function getMaterials(token: string): Promise<MaterialCategory[]> {
  return apiRequest<MaterialCategory[]>("/materials", { headers: { Authorization: `Bearer ${token}` } });
}

export function listServerLots(token: string): Promise<ServerLot[]> {
  return apiRequest<ServerLot[]>("/lots", { headers: { Authorization: `Bearer ${token}` } });
}

export function getServerLot(token: string, lotId: string): Promise<{ lot: ServerLot; traceEvents: unknown[] }> {
  return apiRequest<{ lot: ServerLot; traceEvents: unknown[] }>(`/lots/${lotId}`, { headers: { Authorization: `Bearer ${token}` } });
}

export function syncMutations(token: string, mutations: QueuedMutation[]): Promise<SyncResponse> {
  const body = {
    mutations: mutations.map(toSyncMutationRequest),
  };
  return apiRequest<SyncResponse>("/sync/mutations", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Idempotency-Key": mutations[0]?.idempotencyKey ?? "empty-sync" },
    body: JSON.stringify(body),
  });
}

function toSyncMutationRequest(mutation: QueuedMutation): SyncMutationRequest {
  const draft = mutation.payload;
  return {
    mutationId: mutation.mutationId,
    idempotencyKey: mutation.idempotencyKey,
    operation: mutation.operation,
    payload: {
      clientDraftId: draft.localId,
      serverId: draft.serverId,
      title: draft.title,
      item: draft.materialCategoryId && draft.quantity && draft.estimatedWeightKg && draft.condition ? {
        materialCategoryId: draft.materialCategoryId,
        quantity: draft.quantity,
        quantityUnit: draft.quantityUnit,
        estimatedWeightKg: draft.estimatedWeightKg,
        condition: draft.condition,
      } : null,
      pickup: draft.pickupCityArea && draft.pickupPinCode && draft.pickupPreference ? {
        cityArea: draft.pickupCityArea,
        pinCode: draft.pickupPinCode,
        preference: draft.pickupPreference,
      } : null,
      evidence: draft.evidence,
    },
  };
}

// ─── Sprint A: Verification ───────────────────────────────────────────────────
import type { VerificationResult, PricingResult, RecyclerMatch } from "../collector/lot-types";

export function verifyLot(token: string, lotId: string): Promise<VerificationResult> {
  return apiRequest<VerificationResult>(`/lots/${lotId}/verify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getVerification(token: string, lotId: string): Promise<VerificationResult> {
  return apiRequest<VerificationResult>(`/lots/${lotId}/verification`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function confirmCategory(token: string, lotId: string, confirmedCategoryId: string): Promise<VerificationResult> {
  return apiRequest<VerificationResult>(`/lots/${lotId}/verify/confirm-category`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ confirmedCategoryId }),
  });
}

// ─── Sprint A: Pricing ────────────────────────────────────────────────────────

export function priceLot(token: string, lotId: string): Promise<PricingResult> {
  return apiRequest<PricingResult>(`/lots/${lotId}/price`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getPriceExplanation(token: string, lotId: string): Promise<PricingResult> {
  return apiRequest<PricingResult>(`/lots/${lotId}/price-explanation`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Sprint A: Matching ────────────────────────────────────────────────────────

export function getLotMatches(token: string, lotId: string): Promise<RecyclerMatch[]> {
  return apiRequest<RecyclerMatch[]>(`/lots/${lotId}/matches`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function listLot(token: string, lotId: string): Promise<ServerLot> {
  return apiRequest<ServerLot>(`/lots/${lotId}/list`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Sprint B: Marketplace ───────────────────────────────────────────────────

export function getMarketplaceLots(
  token: string,
  filters?: { material?: string; minWeight?: number; maxWeight?: number },
): Promise<MarketplaceLotSummary[]> {
  const params = new URLSearchParams();
  if (filters?.material) params.set("material", filters.material);
  if (filters?.minWeight !== undefined) params.set("minWeight", String(filters.minWeight));
  if (filters?.maxWeight !== undefined) params.set("maxWeight", String(filters.maxWeight));
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<MarketplaceLotSummary[]>(`/marketplace/lots${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getMarketplaceLotReview(token: string, lotId: string): Promise<MarketplaceLotReview> {
  return apiRequest<MarketplaceLotReview>(`/marketplace/lots/${lotId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Sprint B: Offers ─────────────────────────────────────────────────────────

export function submitOffer(
  token: string,
  lotId: string,
  payload: { pricePerKg: number; pickupOption?: string; note?: string },
): Promise<OfferRecord> {
  return apiRequest<OfferRecord>(`/lots/${lotId}/offers`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function getLotOffers(token: string, lotId: string): Promise<OfferRecord[]> {
  return apiRequest<OfferRecord[]>(`/lots/${lotId}/offers`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function acceptOffer(
  tokenOrOfferId: string,
  maybeOfferId?: string,
): Promise<{ transaction: TransactionRecord; lot: ServerLot; message: string }> {
  const token = maybeOfferId ? tokenOrOfferId : getAuthToken();
  const offerId = maybeOfferId ?? tokenOrOfferId;
  return apiRequest<{ transaction: TransactionRecord; lot: ServerLot; message: string }>(`/offers/${offerId}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function withdrawOffer(token: string, offerId: string): Promise<OfferRecord> {
  return apiRequest<OfferRecord>(`/offers/${offerId}/withdraw`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getRecyclerOffers(token: string): Promise<OfferRecord[]> {
  return apiRequest<OfferRecord[]>("/recycler/offers", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

// ─── Sprint B: Transactions & Handover ────────────────────────────────────────

export function getTransaction(token: string, transactionId: string): Promise<TransactionRecord> {
  return apiRequest<TransactionRecord>(`/transactions/${transactionId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getLotTransaction(token: string, lotId: string): Promise<TransactionRecord | null> {
  return apiRequest<TransactionRecord | null>(`/lots/${lotId}/transaction`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getCollectorTransactions(token: string): Promise<TransactionRecord[]> {
  return apiRequest<TransactionRecord[]>("/collector/transactions", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function getRecyclerTransactions(token: string): Promise<TransactionRecord[]> {
  return apiRequest<TransactionRecord[]>("/recycler/transactions", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export type HandoverSchedulePayload = {
  scheduledAt?: string;
  scheduled_date?: string;
  pickupAddress?: string;
  location_area?: string;
  pickupWindow?: string;
  time_window?: string;
  method?: string;
  notes?: string;
};

export function scheduleHandover(
  tokenOrTxId: string,
  txIdOrPayload: string | HandoverSchedulePayload,
  maybePayload?: HandoverSchedulePayload,
): Promise<HandoverRecord> {
  const token = maybePayload ? tokenOrTxId : getAuthToken();
  const transactionId = typeof txIdOrPayload === "string" ? txIdOrPayload : tokenOrTxId;
  const payload = maybePayload ?? txIdOrPayload;
  return apiRequest<HandoverRecord>(`/transactions/${transactionId}/handover/schedule`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

export function getHandoverQr(
  token: string,
  transactionId: string,
): Promise<{
  transactionId: string;
  lotId: string;
  qrToken: string;
  manualCode: string;
  scheduledAt: string;
  pickupAddress: string;
  pickupWindow: string;
  status: string;
  isDemo: boolean;
}> {
  return apiRequest(`/transactions/${transactionId}/handover/qr`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function confirmPickup(
  token: string,
  qrToken: string,
  transactionId?: string,
): Promise<{ status: string; lotId: string; transactionId: string; message: string }> {
  const path = transactionId
    ? `/transactions/${transactionId}/handover/confirm-pickup`
    : "/transactions/handover/confirm-pickup";
  return apiRequest(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ qrToken }),
  });
}

export function markInTransit(token: string, transactionId: string): Promise<ServerLot> {
  return apiRequest<ServerLot>(`/transactions/${transactionId}/handover/in-transit`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
}

export function confirmReceipt(token: string, transactionId: string, facilityNote?: string): Promise<ServerLot> {
  return apiRequest<ServerLot>(`/transactions/${transactionId}/receive`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ facilityNote }),
  });
}

export function verifyPhysicalWeight(
  token: string,
  transactionId: string,
  payload: { verifiedWeightKg: number; varianceReason?: string },
): Promise<WeightVerificationResult> {
  return apiRequest<WeightVerificationResult>(`/transactions/${transactionId}/verify-weight`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
}

// ─── Convenience Wrappers for Sprint B Pages & Tests ─────────────────────────

function getAuthToken(): string {
  return localStorage.getItem("vital_edges_demo_token") || "demo-token";
}

export function fetchLotById(lotId: string) {
  return getServerLot(getAuthToken(), lotId);
}

export function fetchPriceEstimate(lotId: string) {
  return priceLot(getAuthToken(), lotId);
}

export function fetchRecyclerMatches(lotId: string) {
  return apiRequest<{ matches: RecyclerMatch[] }>(`/lots/${lotId}/matches`, {
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });
}

export function fetchOffersByLot(lotId: string) {
  return apiRequest<{ offers: OfferRecord[] }>(`/lots/${lotId}/offers`, {
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });
}

export function createOffer(lotId: string, payload: { price_per_kg: number; pickup_option?: string; notes?: string }) {
  return apiRequest<OfferRecord>(`/lots/${lotId}/offers`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getAuthToken()}` },
    body: JSON.stringify({
      pricePerKg: payload.price_per_kg,
      pickupOption: payload.pickup_option,
      note: payload.notes,
    }),
  });
}

export function checkPriceFairness(lotId: string, pricePerKg: number) {
  return apiRequest<PriceFairnessAnalysis>(`/lots/${lotId}/fairness-check`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getAuthToken()}` },
    body: JSON.stringify({ price_per_kg: pricePerKg }),
  });
}

export function fetchTransactionByLot(lotId: string) {
  return getLotTransaction(getAuthToken(), lotId);
}

export function fetchTransactionById(transactionId: string) {
  return getTransaction(getAuthToken(), transactionId);
}

export function fetchHandoverQR(transactionId: string) {
  return getHandoverQr(getAuthToken(), transactionId);
}

export function validateHandoverToken(tokenOrCode: string) {
  return apiRequest<{ transaction: TransactionRecord; status: string; message: string }>("/handover/validate-token", {
    method: "POST",
    headers: { Authorization: `Bearer ${getAuthToken()}` },
    body: JSON.stringify({ token: tokenOrCode }),
  });
}

export function verifyWeight(transactionId: string, verifiedWeightKg: number) {
  return verifyPhysicalWeight(getAuthToken(), transactionId, { verifiedWeightKg });
}

// ─── Sprint C: Payments, Processing & Recycling Evidence ─────────────────────

export function confirmPayment(
  transactionId: string,
  payload?: { payment_method?: string; demo_account_reference?: string; notes?: string }
) {
  return apiRequest<{ payment: PaymentRecord; transaction: TransactionRecord; lot: ServerLot; message: string }>(
    `/transactions/${transactionId}/payment/confirm`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${getAuthToken()}` },
      body: payload ? JSON.stringify(payload) : undefined,
    }
  );
}

export function startProcessing(
  transactionId: string,
  payload?: {
    process_type?: string;
    method?: string;
    facilityName?: string;
    safety_precautions_checked?: boolean;
    facility_notes?: string;
    notes?: string;
  }
) {
  return apiRequest<{ processing: ProcessingRecord; transaction: TransactionRecord; lot: ServerLot; message: string }>(
    `/transactions/${transactionId}/processing/start`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${getAuthToken()}` },
      body: payload ? JSON.stringify(payload) : undefined,
    }
  );
}

export function addRecyclingEvidence(
  transactionId: string,
  payload: {
    facilityName?: string;
    recycling_facility_name?: string;
    recoveryBreakdown?: MaterialRecoveryItem[];
    material_outputs?: MaterialRecoveryItem[];
    recovery_rate_percent?: number;
    residualPercentage?: number;
    certificateNumber?: string;
    certificate_number?: string;
    documentUrl?: string;
    notes?: string;
  }
) {
  return apiRequest<{ evidence: RecyclingEvidenceRecord; transaction: TransactionRecord; lot: ServerLot; message: string }>(
    `/transactions/${transactionId}/recycling-evidence`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${getAuthToken()}` },
      body: JSON.stringify(payload),
    }
  );
}

export function closeLot(
  transactionId: string,
  payload?: { notes?: string }
) {
  return apiRequest<{ transaction: TransactionRecord; lot: ServerLot; message: string }>(
    `/transactions/${transactionId}/close`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${getAuthToken()}` },
      body: payload ? JSON.stringify(payload) : undefined,
    }
  );
}

export function fetchCollectorEarnings(): Promise<CollectorEarningsSummary> {
  return apiRequest<CollectorEarningsSummary>("/collector/earnings", {
    headers: { Authorization: `Bearer ${getAuthToken()}` },
  });
}

export function fetchRecyclingEvidence(transactionId: string): Promise<{ evidence?: RecyclingEvidenceRecord } | RecyclingEvidenceRecord | null> {
  return apiRequest<{ evidence?: RecyclingEvidenceRecord } | RecyclingEvidenceRecord | null>(
    `/transactions/${transactionId}/recycling-evidence`,
    {
      headers: { Authorization: `Bearer ${getAuthToken()}` },
    }
  );
}



