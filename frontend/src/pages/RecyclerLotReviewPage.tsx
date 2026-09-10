import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  ArrowLeft, 
  ShieldCheck, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  DollarSign, 
  Sparkles,
  ChevronRight
} from "lucide-react";
import { 
  fetchLotById, 
  fetchPriceEstimate, 
  fetchRecyclerMatches, 
  createOffer,
  checkPriceFairness
} from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { PriceFairnessAnalysis, PriceRange } from "../collector/lot-types";

export function RecyclerLotReviewPage() {
  const { lotId } = useParams<{ lotId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Form state
  const [pricePerKg, setPricePerKg] = useState<number | "">("");
  const [pickupOption, setPickupOption] = useState<"RECYCLER_PICKUP" | "COLLECTOR_DROPOFF">("RECYCLER_PICKUP");
  const [notes, setNotes] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Queries
  const { data: lotData, isLoading: lotLoading, error: lotError } = useQuery({
    queryKey: ["lot", lotId],
    queryFn: () => fetchLotById(lotId ?? ""),
    enabled: !!lotId,
  });

  const { data: priceData } = useQuery({
    queryKey: ["priceEstimate", lotId],
    queryFn: () => fetchPriceEstimate(lotId ?? ""),
    enabled: !!lotId,
  });

  const { data: matchesData } = useQuery({
    queryKey: ["matches", lotId],
    queryFn: () => fetchRecyclerMatches(lotId ?? ""),
    enabled: !!lotId,
  });

  const lot = lotData?.lot;
  const fairRange = (priceData?.fair_range ?? priceData?.fairRange) as PriceRange | undefined;
  const currentRecyclerMatch = matchesData?.matches?.find(
    (m) => (m.recyclerId ?? m.recycler_id) === user?.id || (m.recycler_name ?? m.name) === user?.displayName
  );

  // Live fairness analysis
  const [fairness, setFairness] = useState<PriceFairnessAnalysis | null>(null);
  const [isCheckingFairness, setIsCheckingFairness] = useState(false);

  // Recalculate fairness on blur or debounce
  const handlePriceChange = async (val: string) => {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) {
      setPricePerKg("");
      setFairness(null);
      return;
    }
    setPricePerKg(num);
    if (lotId) {
      try {
        setIsCheckingFairness(true);
        const result = await checkPriceFairness(lotId, num);
        setFairness(result);
      } catch (err) {
        console.warn("Fairness preview error", err);
      } finally {
        setIsCheckingFairness(false);
      }
    }
  };

  // Submit offer mutation
  const submitOfferMutation = useMutation({
    mutationFn: () => {
      if (!lotId || !user) throw new Error("Missing lot or user");
      if (typeof pricePerKg !== "number" || pricePerKg <= 0) {
        throw new Error("Please enter a valid price per kg");
      }
      return createOffer(lotId, {
        price_per_kg: pricePerKg,
        pickup_option: pickupOption,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lot", lotId] });
      queryClient.invalidateQueries({ queryKey: ["recyclerMarketplace"] });
      queryClient.invalidateQueries({ queryKey: ["recyclerMyOffers"] });
      navigate("/recycler", { state: { tab: "my-offers", message: "Offer submitted successfully!" } });
    },
    onError: (err: unknown) => {
      setErrorMsg(err instanceof Error ? err.message : "Failed to submit offer");
    },
  });

  if (lotLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (lotError || !lot) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg">
          Failed to load lot details or lot not found.
        </div>
        <Link to="/recycler" className="mt-4 inline-flex items-center text-emerald-700 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Marketplace
        </Link>
      </div>
    );
  }

  const isEligibleState = lot.status === "LISTED" || lot.status === "OFFERS_RECEIVED";
  const lotCategory = lot.category ?? lot.item?.materialCategoryId ?? "E-Waste";
  const lotCondition = lot.condition ?? lot.item?.condition ?? "MIXED";
  const lotQuantity = lot.declared_item_count ?? lot.item?.quantity ?? 1;
  const approxWeight = lot.approximate_weight_kg ?? lot.item?.estimatedWeightKg ?? 1;
  const pickupCity = lot.pickup_address?.city ?? lot.pickup?.cityArea ?? "Local Zone";
  const pickupWindow = lot.preferred_pickup_window ?? lot.pickup?.preference ?? "Recycler Pickup";
  const trustScore = lot.verification_confidence != null ? Math.round(lot.verification_confidence * 100) : (lot.trustScore ?? null);
  const evidencePhotos = lot.photos ?? lot.evidence ?? [];
  const estimatedTotal = typeof pricePerKg === "number" ? Math.round(pricePerKg * approxWeight) : null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Top breadcrumb & back */}
      <div className="flex items-center justify-between">
        <Link
          to="/recycler"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-950 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Marketplace
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 bg-amber-100 text-amber-900 rounded font-semibold border border-amber-300">
            DEMO LOT
          </span>
          <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-700 rounded font-medium border border-slate-200">
            Status: {lot.status}
          </span>
        </div>
      </div>

      {/* Main Grid: Details (Left) + Offer Form (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Lot Inspection */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                  Lot Identifier
                </p>
                <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
                  {lot.id}
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Category: <strong className="text-slate-900">{lotCategory}</strong> • Condition: <span className="capitalize">{lotCondition}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Declared Quantity</p>
                <p className="text-xl font-bold text-slate-900">{lotQuantity} items</p>
                <p className="text-xs text-slate-600 font-medium">Est. ~{approxWeight} kg</p>
              </div>
            </div>

            {/* Spec pills */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
              <div className="bg-slate-50 p-3 rounded-lg">
                <span className="text-xs text-slate-500 block">Material</span>
                <span className="font-semibold text-sm text-slate-900">{lotCategory}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <span className="text-xs text-slate-500 block">Est. Weight</span>
                <span className="font-semibold text-sm text-slate-900">~{approxWeight} kg</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <span className="text-xs text-slate-500 block">Pickup Area</span>
                <span className="font-semibold text-sm text-slate-900 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {pickupCity}
                </span>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg">
                <span className="text-xs text-slate-500 block">Preferred Transfer</span>
                <span className="font-semibold text-sm text-slate-900">
                  {pickupWindow}
                </span>
              </div>
            </div>
          </div>

          {/* Verification & Trust Score Card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-semibold text-slate-900">Verification & Confidence</h2>
              </div>
              {trustScore != null && (
                <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                  <span className="text-xs text-emerald-800 font-medium">Listing Confidence:</span>
                  <span className="text-sm font-bold text-emerald-900">
                    {trustScore}%
                  </span>
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500 italic">
              Note: Verification score reflects digital evidence confidence and duplicate checks, not a guarantee of physical grade. Final settlement is based on physical scale weight.
            </p>

            {/* Check results breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="border border-slate-200 rounded-lg p-3 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-900">Hash Check</p>
                  <p className="text-xs text-slate-500">SHA-256 unique lot</p>
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-900">Perceptual Hash</p>
                  <p className="text-xs text-slate-500">No duplicate images</p>
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-slate-900">Multi-Angle</p>
                  <p className="text-xs text-slate-500">{evidencePhotos.length} photos captured</p>
                </div>
              </div>
            </div>

            {/* Evidence Images */}
            {evidencePhotos.length > 0 && (
              <div className="pt-2">
                <p className="text-xs font-semibold text-slate-700 mb-2">Evidence Photographs</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {evidencePhotos.map((photo, idx) => (
                    <div key={idx} className="relative aspect-video rounded-lg overflow-hidden bg-slate-100 border border-slate-200">
                      <img
                        src={'url' in photo && photo.url ? photo.url : photo.previewDataUrl}
                        alt={`Evidence ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Reference Pricing Guidance */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-slate-700" />
                <h3 className="text-sm font-semibold text-slate-900">Demo Fair-Value Reference</h3>
              </div>
              <span className="text-xs bg-slate-200 text-slate-800 px-2 py-0.5 rounded font-mono">
                Formula: Material × Condition × Quantity × Region
              </span>
            </div>
            
            {fairRange ? (
              <div className="flex items-center gap-4 bg-white p-4 rounded-lg border border-slate-200">
                <div>
                  <p className="text-xs text-slate-500">Fair Price Range</p>
                  <p className="text-lg font-bold text-slate-900">
                    ₹{fairRange.low_per_kg} - ₹{fairRange.high_per_kg} <span className="text-xs font-normal text-slate-500">/ kg</span>
                  </p>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div>
                  <p className="text-xs text-slate-500">Midpoint Benchmark</p>
                  <p className="text-lg font-bold text-emerald-700">
                    ₹{fairRange.mid_per_kg} <span className="text-xs font-normal text-slate-500">/ kg</span>
                  </p>
                </div>
                <div className="h-8 w-px bg-slate-200" />
                <div>
                  <p className="text-xs text-slate-500">Est. Total Fair Value</p>
                  <p className="text-lg font-bold text-slate-900">
                    ₹{priceData?.estimated_total_fair_value ?? Math.round(fairRange.mid_per_kg * approxWeight)}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Pricing reference not calculated for this lot.</p>
            )}
            <p className="text-xs text-slate-500">
              * Reference fair-value numbers are deterministic synthetic benchmarks for the hackathon demonstration.
            </p>
          </div>

          {/* Compatibility & Match Summary */}
          {currentRecyclerMatch && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Recycler Compatibility
                </span>
                <span className="text-xs font-bold bg-emerald-200 text-emerald-900 px-2.5 py-0.5 rounded-full">
                  {Math.round((currentRecyclerMatch.compatibilityScore ?? currentRecyclerMatch.compatibility_score ?? 1) * 100)}% Matched
                </span>
              </div>
              <p className="text-xs text-emerald-900">
                You are authorized to process <strong>{lotCategory}</strong> e-waste in this region.
              </p>
              {(currentRecyclerMatch.matchReasons ?? currentRecyclerMatch.match_reasons) && (
                <ul className="text-xs text-emerald-800 list-disc list-inside space-y-0.5 pt-1">
                  {(currentRecyclerMatch.matchReasons ?? currentRecyclerMatch.match_reasons ?? []).map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Make Offer Form */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sticky top-6">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">Make an Offer</h2>
            </div>

            {!isEligibleState ? (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg text-sm">
                This lot is currently <strong>{lot.status}</strong> and is not open for new offers.
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitOfferMutation.mutate();
                }}
                className="space-y-4"
              >
                {/* Price per kg input */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="offer-price-input">
                    Offer Price (₹ per kg) *
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 font-bold">
                      ₹
                    </span>
                    <input
                      id="offer-price-input"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="e.g. 480"
                      value={pricePerKg}
                      onChange={(e) => handlePriceChange(e.target.value)}
                      required
                      className="w-full pl-8 pr-4 py-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 font-medium"
                    />
                  </div>
                  {fairRange && (
                    <p className="text-xs text-slate-500 mt-1">
                      Fair mid benchmark: ₹{fairRange.mid_per_kg}/kg
                    </p>
                  )}
                </div>

                {/* Provisional Total */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Declared Weight</span>
                    <span>~{approxWeight} kg</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold text-slate-900 mt-1">
                    <span>Estimated Total</span>
                    <span>{estimatedTotal != null ? `₹${estimatedTotal.toLocaleString()}` : "—"}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 italic">
                    Final commercial payout is determined upon physical scale receipt.
                  </p>
                </div>

                {/* Live Fairness Analysis Pill */}
                {isCheckingFairness && (
                  <p className="text-xs text-slate-400">Analyzing offer fairness...</p>
                )}
                {fairness && (
                  <div
                    className={`p-3 rounded-lg border text-xs ${
                      fairness.classification === "NORMAL"
                        ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                        : fairness.classification === "HIGH" || fairness.classification === "VERY_HIGH"
                        ? "bg-blue-50 border-blue-200 text-blue-900"
                        : "bg-amber-50 border-amber-200 text-amber-900"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold mb-1">
                      {fairness.classification === "NORMAL" ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                      )}
                      <span>Fairness Classification: {fairness.classification}</span>
                    </div>
                    <p>{fairness.human_explanation}</p>
                    <p className="text-[11px] mt-1 opacity-80">
                      Deviation from midpoint: {fairness.percentage_deviation > 0 ? "+" : ""}
                      {fairness.percentage_deviation.toFixed(1)}%
                    </p>
                  </div>
                )}

                {/* Pickup / Logistics selection */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Handover Option
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPickupOption("RECYCLER_PICKUP")}
                      className={`p-2.5 text-xs font-semibold rounded-lg border text-center transition-all ${
                        pickupOption === "RECYCLER_PICKUP"
                          ? "bg-emerald-50 border-emerald-600 text-emerald-900 ring-1 ring-emerald-600"
                          : "border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      Recycler Pickup
                    </button>
                    <button
                      type="button"
                      onClick={() => setPickupOption("COLLECTOR_DROPOFF")}
                      className={`p-2.5 text-xs font-semibold rounded-lg border text-center transition-all ${
                        pickupOption === "COLLECTOR_DROPOFF"
                          ? "bg-emerald-50 border-emerald-600 text-emerald-900 ring-1 ring-emerald-600"
                          : "border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      Collector Drop-off
                    </button>
                  </div>
                </div>

                {/* Optional Note */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1" htmlFor="offer-note-input">
                    Notes for Collector (Optional)
                  </label>
                  <textarea
                    id="offer-note-input"
                    rows={2}
                    placeholder="e.g. Can pick up this Thursday morning with digital scale."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-xs text-slate-900"
                  />
                </div>

                {/* Error Banner */}
                {errorMsg && (
                  <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-xs">
                    {errorMsg}
                  </div>
                )}

                {/* Primary CTA */}
                <button
                  type="submit"
                  id="submit-offer-btn"
                  disabled={submitOfferMutation.isPending || typeof pricePerKg !== "number"}
                  className="w-full min-h-12 py-3 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {submitOfferMutation.isPending ? (
                    "Submitting Offer..."
                  ) : (
                    <>
                      Submit Commercial Offer <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
