import { syncMutations } from "../api/client";
import type { LocalDraftLot } from "../collector/lot-types";
import { localDb } from "./db";
import { pendingMutations } from "./draftRepository";

export async function runSync(token: string): Promise<{ synced: number; failed: number }> {
  const mutations = await pendingMutations();
  if (mutations.length === 0) {
    return { synced: 0, failed: 0 };
  }

  for (const mutation of mutations) {
    await localDb.mutations.update(mutation.mutationId, { status: "SYNCING", attemptCount: mutation.attemptCount + 1 });
    await localDb.drafts.update(mutation.entityLocalId, { syncStatus: "SYNCING", lastError: undefined });
  }

  try {
    const response = await syncMutations(token, mutations);
    let synced = 0;
    let failed = 0;
    for (const result of response.results) {
      const mutation = mutations.find((candidate) => candidate.mutationId === result.mutationId);
      if (!mutation) continue;
      if (result.status === "COMPLETE" && result.lot) {
        const draft = await localDb.drafts.get(mutation.entityLocalId);
        const updates: Partial<LocalDraftLot> = {
          serverId: result.lot.id,
          lotStatus: result.lot.status,
          syncStatus: "SYNCED",
          lastError: undefined,
          updatedAt: result.lot.updatedAt,
        };
        if (draft) await localDb.drafts.update(draft.localId, updates);
        await localDb.mutations.update(mutation.mutationId, { status: "COMPLETE", lastError: undefined });
        synced += 1;
      } else {
        const message = result.error ?? "Sync failed. Try again.";
        await localDb.mutations.update(mutation.mutationId, { status: "FAILED", lastError: message });
        await localDb.drafts.update(mutation.entityLocalId, { syncStatus: "FAILED", lastError: message });
        failed += 1;
      }
    }
    return { synced, failed };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Sync failed. Try again.";
    for (const mutation of mutations) {
      await localDb.mutations.update(mutation.mutationId, { status: "FAILED", lastError: message });
      await localDb.drafts.update(mutation.entityLocalId, { syncStatus: "FAILED", lastError: message });
    }
    return { synced: 0, failed: mutations.length };
  }
}