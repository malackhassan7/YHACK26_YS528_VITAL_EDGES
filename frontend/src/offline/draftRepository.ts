import { localDb } from "./db";
import type { DraftEvidence, LocalDraftLot, QueuedMutation, SyncOperation } from "../collector/lot-types";

export function newLocalId(prefix = "local-lot"): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function createEmptyDraft(collectorId: string): Promise<LocalDraftLot> {
  const timestamp = nowIso();
  const draft: LocalDraftLot = {
    localId: newLocalId(),
    collectorId,
    title: "Digital E-Waste Lot",
    quantityUnit: "pieces",
    evidence: [],
    lotStatus: "DRAFT",
    syncStatus: "LOCAL_ONLY",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await localDb.drafts.put(draft);
  return draft;
}

export async function getDraft(localId: string): Promise<LocalDraftLot | undefined> {
  return localDb.drafts.get(localId);
}

export async function listDrafts(collectorId: string): Promise<LocalDraftLot[]> {
  const drafts = await localDb.drafts.where("collectorId").equals(collectorId).toArray();
  return drafts.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveDraft(draft: LocalDraftLot): Promise<LocalDraftLot> {
  const updated = { ...draft, updatedAt: nowIso(), syncStatus: draft.lotStatus === "CAPTURED" ? draft.syncStatus : "PENDING" } satisfies LocalDraftLot;
  await localDb.drafts.put(updated);
  await queueMutation(updated.serverId ? "UPDATE_DRAFT" : "CREATE_DRAFT", updated);
  return updated;
}

export async function saveEvidence(draft: LocalDraftLot, evidence: DraftEvidence[]): Promise<LocalDraftLot> {
  const updated = { ...draft, evidence: evidence.slice(0, 5), updatedAt: nowIso(), syncStatus: "PENDING" } satisfies LocalDraftLot;
  await localDb.drafts.put(updated);
  await queueMutation(updated.serverId ? "ADD_EVIDENCE" : "CREATE_DRAFT", updated);
  return updated;
}

export async function markCaptured(draft: LocalDraftLot): Promise<LocalDraftLot> {
  const updated = { ...draft, lotStatus: "CAPTURED", syncStatus: "PENDING", updatedAt: nowIso() } satisfies LocalDraftLot;
  await localDb.drafts.put(updated);
  await queueMutation("CAPTURE_LOT", updated);
  return updated;
}

export async function deleteLocalDraft(localId: string): Promise<void> {
  await localDb.transaction("rw", localDb.drafts, localDb.mutations, async () => {
    await localDb.drafts.delete(localId);
    await localDb.mutations.where("entityLocalId").equals(localId).delete();
  });
}

export async function queueMutation(operation: SyncOperation, draft: LocalDraftLot): Promise<void> {
  const existing = await localDb.mutations.where("entityLocalId").equals(draft.localId).and((mutation) => mutation.operation === operation && mutation.status !== "COMPLETE").first();
  const mutation: QueuedMutation = existing ?? {
    mutationId: newLocalId("mutation"),
    idempotencyKey: `${operation.toLowerCase()}-${draft.localId}`,
    entityLocalId: draft.localId,
    operation,
    payload: draft,
    createdAt: nowIso(),
    attemptCount: 0,
    status: "PENDING",
  };
  await localDb.mutations.put({ ...mutation, payload: draft, status: "PENDING" });
}

export async function pendingMutations(): Promise<QueuedMutation[]> {
  const mutations = await localDb.mutations.where("status").anyOf("PENDING", "FAILED").toArray();
  return mutations.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getSyncSummary(collectorId: string): Promise<{ pending: number; failed: number; drafts: LocalDraftLot[] }> {
  const [drafts, mutations] = await Promise.all([listDrafts(collectorId), localDb.mutations.toArray()]);
  return {
    drafts,
    pending: mutations.filter((mutation) => mutation.status === "PENDING" || mutation.status === "SYNCING").length,
    failed: mutations.filter((mutation) => mutation.status === "FAILED").length,
  };
}