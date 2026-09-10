import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Building2,
  ChevronRight
} from "lucide-react";
import { fetchLotById, fetchOffersByLot, acceptOffer } from "../api/client";
import type { OfferRecord } from "../collector/lot-types";

export function CollectorOffersPage() {
  const { lotId } = useParams<{ lotId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const safeLotId = lotId ?? "";

  // Queries
  const { data: lotData, isLoading: lotLoading } = useQuery({
    queryKey: ["lot", safeLotId],
    queryFn: () => fetchLotById(safeLotId),
    enabled: Boolean(lotId),
  });

  const { data: offersData, isLoading: offersLoading } = useQuery({
    queryKey: ["lotOffers", safeLotId],
    queryFn: () => fetchOffersByLot(safeLotId),
    enabled: Boolean(lotId),
  });

  const lot = lotData?.lot;
  const offers: OfferRecord[] = offersData?.offers ?? [];

  // Accept offer mutation
  const acceptOfferMutation = useMutation({
    mutationFn: (offerId: string) => acceptOffer(offerId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["lot", safeLotId] });
      queryClient.invalidateQueries({ queryKey: ["lotOffers", safeLotId] });
      navigate(`/collector/lots/${safeLotId}/transaction`, {
        state: { transaction: data.transaction, message: "Offer accepted! Schedule handover now." },
      });
    },
    onError: (err: unknown) => {
      setErrorMsg(err instanceof Error ? err.message : "Failed to accept offer");
    },
  });

  if (lotLoading || offersLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (!lot) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg">
          Lot not found.
        </div>
        <Link to="/collector/lots" className="mt-4 inline-flex items-center text-emerald-700 hover:underline">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to My Lots
        </Link>
      </div>
    );
  }

  const isAccepted = lot.status !== "LISTED" && lot.status !== "OFFERS_RECEIVED";

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Navigation header */}
      <div className="flex items-center justify-between">
        <Link
          to={`/collector/lots/${lot.id}`}
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-950 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Lot Details
        </Link>
        <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-700 rounded font-medium border border-slate-200">
          Lot: {lot.id}
        </span>
      </div>

      {/* Page Title Card */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Commercial Offers</h1>
            <p className="text-sm text-slate-600 mt-1">
              Review and compare proposals from authorized recyclers for your{" "}
              <strong>{lot.category ?? lot.item?.materialCategoryId ?? "E-Waste"}</strong> lot (~{lot.approximate_weight_kg ?? lot.item?.estimatedWeightKg ?? 1} kg).
            </p>
          </div>
          <div className="shrink-0">
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                lot.status === "OFFERS_RECEIVED"
                  ? "bg-purple-100 text-purple-900 border border-purple-200"
                  : isAccepted
                  ? "bg-emerald-100 text-emerald-900 border border-emerald-200"
                  : "bg-slate-100 text-slate-800 border border-slate-200"
              }`}
            >
              Status: {lot.status}
            </span>
          </div>
        </div>

        {isAccepted && (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-emerald-900 text-sm font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>An offer has been accepted for this lot.</span>
            </div>
            <Link
              to={`/collector/lots/${lot.id}/transaction`}
              className="inline-flex items-center text-xs font-bold text-emerald-800 bg-emerald-200 hover:bg-emerald-300 px-3 py-1.5 rounded-lg transition-colors"
            >
              View Transaction & QR <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Link>
          </div>
        )}
      </div>

      {/* Error alert */}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-xl text-sm">
          {errorMsg}
        </div>
      )}

      {/* Offers Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <span>Received Offers ({offers.length})</span>
        </h2>

        {offers.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <DollarSign className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-800 font-semibold">No offers received yet</p>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              Your lot is listed in the recycler marketplace. Compatible authorized recyclers can view your material and submit commercial proposals.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {offers.map((offer) => {
              const isAbnormalLow =
                offer.fairness_classification === "LOW" ||
                offer.fairness_classification === "VERY_LOW";
              const isNormal = offer.fairness_classification === "NORMAL";
              const isThisAccepted = offer.status === "ACCEPTED";

              return (
                <div
                  key={offer.id}
                  className={`bg-white rounded-xl shadow-sm border transition-all p-5 sm:p-6 ${
                    isThisAccepted
                      ? "border-emerald-500 ring-2 ring-emerald-500 bg-emerald-50/20"
                      : isAbnormalLow
                      ? "border-amber-300 bg-amber-50/10"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  {/* Top Bar: Recycler Info + Status */}
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800 font-bold shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-base">
                            {(offer.recycler_id ?? offer.recyclerId ?? "recycler").replace("rec-", "Recycler ").toUpperCase()}
                          </h3>
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200">
                            DEMO AUTHORIZED
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                          <span>{new Date(offer.created_at ?? offer.createdAt ?? Date.now()).toLocaleDateString()}</span>
                          <span>•</span>
                          <span className="capitalize">{(offer.pickup_option ?? offer.pickupOption ?? "RECYCLER_PICKUP").replace("_", " ").toLowerCase()}</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-2xl font-bold text-slate-900">
                        ₹{offer.price_per_kg ?? offer.pricePerKg}{" "}
                        <span className="text-xs font-normal text-slate-500">/ kg</span>
                      </p>
                      <p className="text-xs font-semibold text-slate-700">
                        Est. Total: ₹{(offer.estimated_total ?? offer.estimatedTotal ?? 0).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {/* Fairness Classification Banner */}
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div
                      className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 ${
                        isNormal
                          ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                          : isAbnormalLow
                          ? "bg-amber-50 border-amber-300 text-amber-900"
                          : "bg-blue-50 border-blue-200 text-blue-900"
                      }`}
                    >
                      {isNormal ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">Fairness: {offer.fairness_classification}</span>
                          {offer.fairness_deviation != null && (
                            <span className="opacity-80">
                              ({offer.fairness_deviation > 0 ? "+" : ""}
                              {offer.fairness_deviation.toFixed(1)}% vs fair midpoint)
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5">{offer.fairness_explanation}</p>
                      </div>
                    </div>
                  </div>

                  {/* Optional Note */}
                  {offer.notes && (
                    <p className="mt-3 text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      "{offer.notes}"
                    </p>
                  )}

                  {/* Action Bar */}
                  <div className="mt-4 pt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-500">
                      * Final payout calculated strictly on recycler-verified scale weight.
                    </p>

                    <div>
                      {isThisAccepted ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1.5 rounded-lg">
                          <CheckCircle2 className="w-4 h-4" /> Accepted Offer
                        </span>
                      ) : isAccepted ? (
                        <span className="text-xs text-slate-400 font-medium">
                          {offer.status === "REJECTED" ? "Rejected" : "Inactive"}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => acceptOfferMutation.mutate(offer.id)}
                          disabled={acceptOfferMutation.isPending}
                          className="min-h-11 px-5 py-2 rounded-lg font-bold text-xs text-white bg-emerald-700 hover:bg-emerald-800 transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                        >
                          {acceptOfferMutation.isPending ? "Accepting..." : "Accept Offer"}
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
