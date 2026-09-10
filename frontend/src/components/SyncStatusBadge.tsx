import type { SyncStatus } from "../collector/lot-types";

const labels: Record<SyncStatus, string> = {
  LOCAL_ONLY: "Saved on this device",
  PENDING: "Waiting to sync",
  SYNCING: "Syncing",
  SYNCED: "Synced",
  FAILED: "Sync failed",
};

const styles: Record<SyncStatus, string> = {
  LOCAL_ONLY: "bg-amber-50 text-amber-800",
  PENDING: "bg-blue-50 text-blue-800",
  SYNCING: "bg-blue-50 text-blue-800",
  SYNCED: "bg-emerald-50 text-emerald-800",
  FAILED: "bg-red-50 text-red-800",
};

export function SyncStatusBadge({ status }: { status: SyncStatus }) {
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}>{labels[status]}</span>;
}