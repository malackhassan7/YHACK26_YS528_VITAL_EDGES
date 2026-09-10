import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ShieldCheck, TrendingUp, Users, Edit, AlertTriangle, Clock } from "lucide-react";
import { fallbackMaterials, materialName } from "../collector/materials";
import type { LocalDraftLot, ServerLot } from "../collector/lot-types";
import { SyncStatusBadge } from "../components/SyncStatusBadge";
import { getDraft } from "../offline/draftRepository";
import { getServerLot } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type StatusConfig = {
  color: string;
  bg: string;
  label: string;
};

const STATUS_CONFIG: Record<string, StatusConfig> = {
  DRAFT: { color: "text-slate-600", bg: "bg-slate-100", label: "Draft" },
  CAPTURED: { color: "text-blue-700", bg: "bg-blue-50", label: "Captured" },
  VERIFYING: { color: "text-amber-700", bg: "bg-amber-50", label: "Verifying…" },
  VERIFIED: { color: "text-emerald-700", bg: "bg-emerald-50", label: "Verified" },
  LISTED: { color: "text-emerald-700", bg: "bg-emerald-100", label: "Listed" },
  OFFERS_RECEIVED: { color: "text-purple-700", bg: "bg-purple-50", label: "Offers Received" },
  OFFER_ACCEPTED: { color: "text-emerald-700", bg: "bg-emerald-50", label: "Offer Accepted" },
  HANDOVER_SCHEDULED: { color: "text-blue-700", bg: "bg-blue-50", label: "Handover Scheduled" },
  PICKED_UP: { color: "text-blue-700", bg: "bg-blue-50", label: "Picked Up" },
  IN_TRANSIT: { color: "text-amber-700", bg: "bg-amber-50", label: "In Transit" },
  RECEIVED: { color: "text-indigo-700", bg: "bg-indigo-50", label: "Received" },
  WEIGHT_VERIFIED: { color: "text-emerald-800", bg: "bg-emerald-100", label: "Weight Verified" },
  FLAGGED: { color: "text-orange-700", bg: "bg-orange-50", label: "Flagged" },
  REJECTED: { color: "text-red-700", bg: "bg-red-50", label: "Rejected" },
  CANCELLED: { color: "text-slate-600", bg: "bg-slate-100", label: "Cancelled" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { color: "text-slate-600", bg: "bg-slate-100", label: status };
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-bold ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function StatusCTA({ lotId, status, serverId }: { lotId: string; status: string; serverId: string | undefined }) {
  const id = serverId ?? lotId;

  if (status === "DRAFT") {
    return (
      <Link
        id="btn-continue-editing"
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white"
        to={`/collector/lots/${lotId}/edit`}
      >
        <Edit size={16} /> Continue Editing
      </Link>
    );
  }

  if (status === "CAPTURED") {
    return (
      <div className="space-y-2">
        <p className="rounded-xl bg-blue-50 p-3 text-sm text-blue-800 font-medium">
          Evidence captured. Verification is the next step.
        </p>
        <Link
          id="btn-verify-evidence"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white"
          to={`/collector/lots/${id}/verify`}
        >
          <ShieldCheck size={16} /> Verify Evidence
        </Link>
      </div>
    );
  }

  if (status === "VERIFYING") {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-3">
        <Clock size={18} className="animate-pulse text-amber-600" />
        <p className="text-sm font-medium text-amber-800">Verification in progress…</p>
      </div>
    );
  }

  if (status === "VERIFIED") {
    return (
      <div className="space-y-2">
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 font-medium">
          ✓ Lot verified. Calculate a fair value to list for recycler offers.
        </p>
        <Link
          id="btn-calculate-price"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white"
          to={`/collector/lots/${id}/price`}
        >
          <TrendingUp size={16} /> Calculate Fair Value
        </Link>
      </div>
    );
  }

  if (status === "FLAGGED") {
    return (
      <div className="space-y-2">
        <div className="flex items-start gap-2 rounded-xl bg-orange-50 p-3">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-orange-600" />
          <p className="text-sm text-orange-800">
            <strong>Verification flagged.</strong> Low-confidence evidence. You can still calculate a price and list — the trust score is advisory.
          </p>
        </div>
        <Link
          id="btn-calculate-price-flagged"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 font-bold text-white"
          to={`/collector/lots/${id}/price`}
        >
          <TrendingUp size={16} /> Calculate Fair Value Anyway
        </Link>
      </div>
    );
  }

  if (status === "LISTED") {
    return (
      <div className="space-y-2">
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 font-medium">
          ✓ Lot is listed. Recyclers can now find and make offers on your lot.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            id="btn-view-matches"
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white"
            to={`/collector/lots/${id}/matches`}
          >
            <Users size={16} /> View Recycler Matches
          </Link>
          <Link
            id="btn-view-offers"
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 font-bold text-slate-800 hover:bg-slate-50"
            to={`/collector/lots/${id}/offers`}
          >
            Check Offers
          </Link>
        </div>
      </div>
    );
  }

  if (status === "OFFERS_RECEIVED") {
    return (
      <div className="space-y-2">
        <p className="rounded-xl bg-purple-50 p-3 text-sm text-purple-900 font-medium">
          Commercial offers received from authorized recyclers!
        </p>
        <Link
          id="btn-compare-offers"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 font-bold text-white"
          to={`/collector/lots/${id}/offers`}
        >
          <Users size={16} /> Review & Compare Offers
        </Link>
      </div>
    );
  }

  if (
    status === "OFFER_ACCEPTED" ||
    status === "HANDOVER_SCHEDULED" ||
    status === "PICKED_UP" ||
    status === "IN_TRANSIT" ||
    status === "RECEIVED" ||
    status === "WEIGHT_VERIFIED"
  ) {
    return (
      <div className="space-y-2">
        <p className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 font-medium">
          {status === "WEIGHT_VERIFIED"
            ? "Scale weight verified by recycler. Ready for payment settlement."
            : "Commercial transaction active. View handover details and QR code."}
        </p>
        <Link
          id="btn-view-transaction"
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 font-bold text-white"
          to={`/collector/lots/${id}/transaction`}
        >
          View Transaction & Handover
        </Link>
      </div>
    );
  }

  return null;
}

export function LotDetailsPage() {
  const { lotId } = useParams();
  const { token } = useAuth();
  const [draft, setDraft] = useState<LocalDraftLot | null>(null);
  const [serverLot, setServerLot] = useState<ServerLot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!lotId) return;
      setLoading(true);
      const found = await getDraft(lotId);
      setDraft(found ?? null);

      // For post-capture lots, fetch fresh server state
      if (found?.serverId && token) {
        try {
          const { lot } = await getServerLot(token, found.serverId);
          setServerLot(lot as unknown as ServerLot);
        } catch {
          // Fall back to local draft data — non-fatal
        }
      }

      if (!found) setError("Lot was not found on this device.");
      setLoading(false);
    }
    void load();
  }, [lotId, token]);

  if (loading) return <p role="status" className="p-6 text-slate-500">Loading lot…</p>;
  if (error || !draft) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-sm" role="alert">
        <p className="text-slate-600">{error ?? "Lot not found."}</p>
        <Link to="/collector/lots" className="mt-3 inline-block text-sm font-semibold text-emerald-700">
          ← Back to My Lots
        </Link>
      </section>
    );
  }

  // Use server state when available (more recent status)
  const effectiveStatus = serverLot?.status ?? draft.lotStatus;
  const matName = materialName(fallbackMaterials, draft.materialCategoryId);
  const displayId = draft.serverId ?? draft.localId;

  return (
    <section className="mx-auto max-w-xl space-y-4 px-4 py-2">
      {/* Hero header */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">{displayId}</p>
            <h1 className="mt-0.5 text-2xl font-black truncate">{matName}</h1>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <StatusBadge status={effectiveStatus} />
            <SyncStatusBadge status={draft.syncStatus} />
          </div>
        </div>

        {/* Trust score if available */}
        {serverLot?.trustScore != null && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
            <ShieldCheck size={16} className={serverLot.confidenceLevel === "HIGH" ? "text-emerald-600" : serverLot.confidenceLevel === "MEDIUM" ? "text-amber-500" : "text-red-500"} />
            <span className="text-sm font-bold text-slate-700">Trust Score: {serverLot.trustScore}/100</span>
            <span className="text-xs text-slate-500">({serverLot.confidenceLevel})</span>
          </div>
        )}

        {/* Fair value if available */}
        {serverLot?.fairMid != null && (
          <div className="mt-2 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2">
            <TrendingUp size={16} className="text-emerald-600" />
            <span className="text-sm font-bold text-emerald-700">
              Fair value: ₹{serverLot.fairLow?.toLocaleString("en-IN")} – ₹{serverLot.fairHigh?.toLocaleString("en-IN")}
            </span>
          </div>
        )}
      </div>

      {/* Status CTA */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <StatusCTA lotId={draft.localId} status={effectiveStatus} serverId={draft.serverId} />
      </div>

      {/* Lot details */}
      <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
        <h2 className="font-bold text-slate-700">Lot Details</h2>
        <dl className="grid grid-cols-2 gap-3">
          <div><dt className="text-xs text-slate-500">Condition</dt><dd className="mt-0.5 font-semibold text-sm">{draft.condition ?? "—"}</dd></div>
          <div><dt className="text-xs text-slate-500">Quantity</dt><dd className="mt-0.5 font-semibold text-sm">{draft.quantity ?? "—"} {draft.quantityUnit}</dd></div>
          <div><dt className="text-xs text-slate-500">Approx. weight</dt><dd className="mt-0.5 font-semibold text-sm">{draft.estimatedWeightKg ?? "—"} kg</dd></div>
          <div><dt className="text-xs text-slate-500">Pickup</dt><dd className="mt-0.5 font-semibold text-sm">{draft.pickupCityArea ?? "—"}</dd></div>
        </dl>
      </div>

      {/* Evidence photos */}
      {draft.evidence.length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-700 mb-3">Photo Evidence</h2>
          <p className="text-xs text-slate-400 mb-3">{draft.evidence.length} photo{draft.evidence.length > 1 ? "s" : ""}</p>
          <div className="grid grid-cols-3 gap-2">
            {draft.evidence.map((photo) => (
              <img
                key={photo.localId}
                alt={photo.angleLabel}
                className="aspect-square rounded-xl object-cover"
                src={photo.previewDataUrl}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}