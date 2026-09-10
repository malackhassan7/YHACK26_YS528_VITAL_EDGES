import Dexie, { type Table } from "dexie";
import type { LocalDraftLot, QueuedMutation } from "../collector/lot-types";

export class VitalEdgesLocalDb extends Dexie {
  drafts!: Table<LocalDraftLot, string>;
  mutations!: Table<QueuedMutation, string>;

  constructor() {
    super("vital_edges_local");
    this.version(1).stores({
      drafts: "localId, serverId, collectorId, lotStatus, syncStatus, updatedAt",
      mutations: "mutationId, entityLocalId, operation, status, createdAt",
    });
  }
}

export const localDb = new VitalEdgesLocalDb();