export const lotStatuses = [
  "DRAFT",
  "CAPTURED",
  "VERIFYING",
  "VERIFIED",
  "LISTED",
  "OFFERS_RECEIVED",
  "OFFER_ACCEPTED",
  "HANDOVER_SCHEDULED",
  "PICKED_UP",
  "IN_TRANSIT",
  "RECEIVED",
  "WEIGHT_VERIFIED",
  "PAYMENT_CONFIRMED",
  "PROCESSING",
  "RECYCLING_EVIDENCE_ADDED",
  "CLOSED",
  "FLAGGED",
  "REJECTED",
  "CANCELLED",
  "DISPUTED",
] as const;

export type LotStatus = (typeof lotStatuses)[number];