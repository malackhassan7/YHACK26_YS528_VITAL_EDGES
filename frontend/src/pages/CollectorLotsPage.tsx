import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { fallbackMaterials, materialName } from "../collector/materials";
import type { LocalDraftLot } from "../collector/lot-types";
import { SyncStatusBadge } from "../components/SyncStatusBadge";
import { deleteLocalDraft, getSyncSummary } from "../offline/draftRepository";
import { runSync } from "../offline/syncService";

export function CollectorLotsPage() {
  const { user, token } = useAuth();
  const [drafts, setDrafts] = useState<LocalDraftLot[]>([]);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  async function load() {
    if (!user) return;
    setLoading(true);
    try {
      const summary = await getSyncSummary(user.id);
      setDrafts(summary.drafts);
      setPending(summary.pending);
      setFailed(summary.failed);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Could not load local lots.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [user?.id]);

  async function handleSync() {
    if (!token) return;
    setSyncing(true);
    const result = await runSync(token);
    setMessage(result.failed > 0 ? "Sync failed - Retry" : `Synchronized ${result.synced} change${result.synced === 1 ? "" : "s"}.`);
    setSyncing(false);
    await load();
  }

  async function handleDelete(localId: string) {
    await deleteLocalDraft(localId);
    setMessage("Local draft deleted.");
    await load();
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">My E-Waste Lots</h1>
          <p className="text-sm text-slate-600">Online status: {navigator.onLine ? "Online" : "Offline - changes saved on this device"}</p>
          <p className="text-sm text-slate-600">{pending} changes waiting to sync. {failed > 0 ? `${failed} failed.` : ""}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-4 font-medium" disabled={syncing} onClick={handleSync} type="button"><RefreshCw size={16} /> {syncing ? "Syncing" : "Retry sync"}</button>
          <Link className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-emerald-700 px-4 font-semibold text-white" to="/collector/lots/new"><Plus size={18} /> Create E-Waste Lot</Link>
        </div>
      </div>
      {message ? <p className="rounded-lg bg-slate-100 p-3 text-sm" role="status">{message}</p> : null}
      {loading ? <p role="status">Loading lots...</p> : null}
      {!loading && drafts.length === 0 ? <p className="rounded-lg bg-white p-5 text-slate-600">No lots yet. Create your first Digital E-Waste Lot.</p> : null}
      <div className="grid gap-3">
        {drafts.map((draft) => (
          <article className="rounded-lg bg-white p-4 shadow-sm" key={draft.localId}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-emerald-700">{draft.serverId ?? draft.localId.slice(0, 18)}</p>
                <h2 className="mt-1 text-lg font-bold">{materialName(fallbackMaterials, draft.materialCategoryId)}</h2>
                <p className="text-sm text-slate-600">{draft.estimatedWeightKg ? `${draft.estimatedWeightKg} kg` : "Weight not entered"} � updated {new Date(draft.updatedAt).toLocaleString()}</p>
                <div className="mt-2 flex flex-wrap gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{draft.lotStatus}</span><SyncStatusBadge status={draft.syncStatus} /></div>
              </div>
              <div className="flex flex-wrap gap-2">
                {draft.lotStatus === "DRAFT" ? <Link className="min-h-11 rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white" to={`/collector/lots/${draft.localId}/edit`}>Continue Editing</Link> : <Link className="min-h-11 rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white" to={`/collector/lots/${draft.localId}`}>View Lot</Link>}
                {draft.lotStatus === "DRAFT" ? <button aria-label="Delete draft" className="min-h-11 rounded-lg border border-slate-300 px-3" onClick={() => void handleDelete(draft.localId)} type="button"><Trash2 size={18} /></button> : null}
              </div>
            </div>
            {draft.lastError ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{draft.lastError}</p> : null}
          </article>
        ))}
      </div>
    </section>
  );
}