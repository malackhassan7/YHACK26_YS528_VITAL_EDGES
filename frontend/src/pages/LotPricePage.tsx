import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { TrendingUp, ChevronRight, Info, AlertCircle } from "lucide-react";
import { priceLot, listLot } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { PricingResult } from "../collector/lot-types";

type Phase = "idle" | "loading" | "done" | "listing" | "error";

const CURRENCY_SYMBOL: Record<string, string> = { INR: "₹" };
function fmt(currency: string, value: number) {
  const sym = CURRENCY_SYMBOL[currency] ?? currency;
  return `${sym}${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function ConditionBadge({ grade }: { grade: string }) {
  const colors: Record<string, string> = {
    WORKING: "bg-emerald-100 text-emerald-700",
    PARTIALLY_WORKING: "bg-amber-100 text-amber-700",
    NOT_WORKING: "bg-orange-100 text-orange-700",
    DAMAGED: "bg-red-100 text-red-700",
    SCRAP: "bg-red-100 text-red-700",
    UNKNOWN: "bg-slate-100 text-slate-600",
  };
  const labels: Record<string, string> = {
    WORKING: "Working",
    PARTIALLY_WORKING: "Partially working",
    NOT_WORKING: "Not working",
    DAMAGED: "Damaged",
    SCRAP: "Scrap",
    UNKNOWN: "Unknown",
  };
  const cls = colors[grade] ?? "bg-slate-100 text-slate-600";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{labels[grade] ?? grade}</span>;
}

export function LotPricePage() {
  const { lotId } = useParams<{ lotId: string }>();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState<Phase>("idle");
  const [pricing, setPricing] = useState<PricingResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function calculate() {
    if (!token || !lotId) return;
    setPhase("loading");
    setErrorMsg(null);
    try {
      const result = await priceLot(token, lotId);
      setPricing(result);
      setPhase("done");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not calculate price. Please try again.");
      setPhase("error");
    }
  }

  async function handleListLot() {
    if (!token || !lotId) return;
    setPhase("listing");
    try {
      await listLot(token, lotId);
      navigate(`/collector/lots/${lotId}/matches`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not list lot. Please try again.");
      setPhase("done");
    }
  }

  return (
    <section className="mx-auto max-w-xl space-y-4 px-4 py-2">
      {/* Header */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-emerald-700">Lot {lotId}</p>
        <h1 className="mt-1 text-2xl font-black">Fair Value</h1>
        <p className="mt-1 text-sm text-slate-500">
          Deterministic fair-value estimate based on material type, condition, and quantity.
        </p>
      </div>

      {/* Disclaimer banner — always visible */}
      <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
        <Info size={16} className="mt-0.5 shrink-0 text-amber-600" />
        <p className="text-xs text-amber-700">
          <strong>Demo pricing</strong> — Reference/demo data only. Not a live market quote. Final commercial price is determined by verified recycler weight at handover.
        </p>
      </div>

      {/* Idle / Calculate */}
      {phase === "idle" && (
        <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
          <p className="text-slate-600 text-sm">
            Pricing uses material reference prices, condition grade, quantity bands, and regional factors — all deterministic and reproducible.
          </p>
          <button
            id="btn-calculate-price"
            className="w-full min-h-12 rounded-xl bg-emerald-600 font-bold text-white active:scale-95 transition-transform"
            onClick={() => void calculate()}
          >
            Calculate Fair Value
          </button>
        </div>
      )}

      {/* Loading */}
      {phase === "loading" && (
        <div className="rounded-2xl bg-white p-8 shadow-sm flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          <p className="text-sm font-semibold text-slate-600">Calculating fair-value range…</p>
        </div>
      )}

      {/* Error */}
      {phase === "error" && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-red-600" />
            <p className="font-bold text-red-800 text-sm">Pricing failed</p>
          </div>
          <p className="text-sm text-red-700">{errorMsg}</p>
          <button className="text-sm font-semibold text-red-700 underline" onClick={() => void calculate()}>
            Try again
          </button>
        </div>
      )}

      {/* Results */}
      {pricing && (phase === "done" || phase === "listing") && (
        <>
          {/* Material + condition */}
          <div className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">Material</p>
                <p className="font-bold text-slate-800">{pricing.materialName}</p>
              </div>
              <ConditionBadge grade={pricing.conditionGrade} />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Reference price</p>
              <p className="font-bold">{fmt(pricing.currency, pricing.referencePrice)}/kg</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Estimated weight</p>
              <p className="font-bold">{pricing.estimatedWeightKg} kg</p>
            </div>
          </div>

          {/* Adjustments */}
          {pricing.adjustments.length > 0 && (
            <div className="rounded-2xl bg-white p-4 shadow-sm space-y-2">
              <h2 className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <TrendingUp size={14} /> Price Adjustments
              </h2>
              {pricing.adjustments.map((adj, i) => (
                <div key={i} className="flex items-center justify-between py-1 border-b border-slate-50 last:border-0">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{adj.label}</p>
                    <p className="text-xs text-slate-500">{adj.reason}</p>
                  </div>
                  <span className={`text-xs font-bold ${adj.factor >= 1 ? "text-emerald-600" : "text-red-500"}`}>
                    {adj.percentDisplay}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Fair value range — hero card */}
          <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-5 shadow-md text-white">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-200">Estimated Lot Value</p>
            <div className="mt-3 flex items-end gap-3">
              <div className="text-center">
                <p className="text-xs text-emerald-200">Low</p>
                <p className="text-lg font-black">{fmt(pricing.currency, pricing.lotValueLow)}</p>
              </div>
              <div className="flex-1 text-center">
                <p className="text-xs text-emerald-200">Mid (fair)</p>
                <p className="text-3xl font-black">{fmt(pricing.currency, pricing.lotValueMid)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-emerald-200">High</p>
                <p className="text-lg font-black">{fmt(pricing.currency, pricing.lotValueHigh)}</p>
              </div>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-emerald-800">
              <div className="h-1.5 rounded-full bg-white/40" style={{ width: "100%" }} />
              <div className="relative -mt-1.5 flex justify-center">
                <div className="h-3 w-1.5 rounded-full bg-white" style={{ marginLeft: "50%" }} />
              </div>
            </div>
            <p className="mt-2 text-xs text-emerald-200">Per kg: {fmt(pricing.currency, pricing.pricePerKgLow)} – {fmt(pricing.currency, pricing.pricePerKgHigh)}</p>
          </div>

          {/* List CTA */}
          <div className="rounded-2xl bg-white p-4 shadow-sm space-y-2">
            <button
              id="btn-list-lot"
              disabled={phase === "listing"}
              className="flex items-center justify-between w-full min-h-12 rounded-xl bg-emerald-600 px-4 font-bold text-white disabled:opacity-60 active:scale-95 transition-transform"
              onClick={() => void handleListLot()}
            >
              {phase === "listing" ? "Listing…" : "List Lot for Offers"}
              <ChevronRight size={18} />
            </button>
            <Link
              to={`/collector/lots/${lotId}`}
              className="flex w-full justify-center py-2 text-sm text-slate-500"
            >
              Back to lot
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
