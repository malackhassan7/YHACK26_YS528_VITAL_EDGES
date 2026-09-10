import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  ChevronRight,
  Building2,
  Scale
} from "lucide-react";
import { fetchCollectorEarnings } from "../api/client";
import { useLanguage } from "../i18n/LanguageContext";
import type { CollectorEarningsSummary } from "../collector/lot-types";

export function CollectorEarningsPage() {
  const { language } = useLanguage();

  const { data, isLoading, error } = useQuery<CollectorEarningsSummary>({
    queryKey: ["collectorEarnings"],
    queryFn: fetchCollectorEarnings,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
      </div>
    );
  }

  const raw = data as Record<string, unknown> | undefined;
  const totalCompletedEarnings = Number(
    raw?.total_completed_earnings ?? raw?.totalEarnings ?? 0
  );
  const completedCount = Number(
    raw?.total_lots_recycled ?? raw?.completedPayoutsCount ?? 0
  );
  const pendingAmount = Number(
    raw?.pending_settlement_amount ?? raw?.pendingAmount ?? 0
  );
  const pendingCount = Number(
    raw?.pending_lots_count ?? raw?.pendingPayoutsCount ?? 0
  );
  const totalPhysicalWeight = Number(raw?.total_physical_weight_kg ?? 0);

  const rawTransactions = (raw?.transactions as Array<Record<string, unknown>>) ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          to="/collector"
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-950 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> {language === "hi" ? "कलेक्टर होम" : "Collector Home"}
        </Link>
        <span className="text-xs px-2.5 py-1 bg-amber-100 text-amber-900 rounded font-semibold border border-amber-300">
          {language === "hi" ? "डेमो वित्तीय खाता" : "Simulated Financial Ledger"}
        </span>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-sm">
          Failed to fetch real-time earnings ledger. Showing cached offline data if available.
        </div>
      )}

      {/* Main Title Banner */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {language === "hi"
                ? "कलेक्टर कमाई एवं लेन-देन इतिहास"
                : "Collector Earnings & Payout Ledger"}
            </h1>
            <p className="text-sm text-slate-600 mt-1 max-w-3xl">
              {language === "hi"
                ? "सत्यापित भौतिक वजन और अधिकृत रीसाइक्लर्स के साथ वाणिज्यिक समझौतों पर आधारित पारदर्शी खाता।"
                : "Authoritative settlement history. Every payout is verified against digital scale weights and certified by authorized recyclers."}
            </p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center shrink-0">
            <DollarSign className="w-6 h-6 text-emerald-700 mx-auto mb-1" />
            <span className="text-[11px] font-bold text-emerald-900 block">
              {language === "hi" ? "सत्यापित लेन-देन" : "Verified Ledger"}
            </span>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Earnings */}
        <div className="bg-white rounded-xl shadow-sm border border-emerald-200 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {language === "hi" ? "कुल सत्यापित कमाई" : "Total Verified Earnings"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-800 mt-2">
            ₹{totalCompletedEarnings.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {language === "hi"
              ? `${completedCount} सफल भुगतान पूर्ण`
              : `${completedCount} completed payout(s)`}
          </p>
        </div>

        {/* Completed Payouts Count */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {language === "hi" ? "सफल लेन-देन" : "Completed Payouts"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
            {completedCount}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {language === "hi" ? "अधिकृत रीसाइक्लर्स द्वारा प्रदत्त" : "Settled via authorized recyclers"}
          </p>
        </div>

        {/* Pending Payouts */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              {language === "hi" ? "प्रक्रियाधीन भुगतान" : "Pending Settlements"}
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-amber-900 mt-2">
            ₹{pendingAmount.toLocaleString()}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            {language === "hi"
              ? `${pendingCount} लॉट वजन सत्यापन/भुगतान की प्रतीक्षा में`
              : `${pendingCount} lot(s) pending physical scale / payment`}
          </p>
        </div>
      </div>

      {/* Recycled Weight & Invariant Note */}
      {totalPhysicalWeight > 0 && (
        <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs text-emerald-950">
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4 text-emerald-700" />
            <span>
              Cumulative formal recycling contribution: <strong>{totalPhysicalWeight.toFixed(2)} kg</strong> of certified e-waste diverted from unscientific dumping.
            </span>
          </div>
        </div>
      )}

      {/* Transactions Table / List */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              {language === "hi" ? "लेन-देन विवरण" : "Transaction Details"}
            </h2>
            <p className="text-xs text-slate-500">
              {language === "hi"
                ? "प्रत्येक ई-कचरा लॉट का निपटान विवरण और रसीद"
                : "Individual lot settlements and certified scale receipts"}
            </p>
          </div>
        </div>

        {rawTransactions.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-slate-500">
              {language === "hi"
                ? "अभी तक कोई पूर्ण लेन-देन उपलब्ध नहीं है। अपना पहला ई-कचरा लॉट बनाएं।"
                : "No transactions found yet. Create and list your first digital e-waste lot."}
            </p>
            <div className="mt-4">
              <Link
                to="/collector/lots/new"
                className="inline-flex items-center px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-lg transition-colors"
              >
                {language === "hi" ? "+ नया लॉट बनाएं" : "+ Create New Lot"}
              </Link>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {rawTransactions.map((tx, idx) => {
              const txId = String(tx.transaction_id ?? tx.id ?? `tx-${idx}`);
              const lotId = String(tx.lot_id ?? tx.lotId ?? "");
              const lotHumanId = String(tx.lot_human_id ?? tx.humanId ?? lotId);
              const materialType = String(tx.material_type ?? tx.deviceType ?? "E-Waste");
              const verifiedWeight = Number(tx.verified_weight_kg ?? tx.verifiedWeightKg ?? 0);
              const agreedPrice = Number(tx.agreed_price_per_kg ?? tx.agreedPricePerKg ?? 0);
              const finalAmt = Number(tx.final_amount ?? tx.finalAmount ?? 0);
              const status = String(tx.status ?? "COMPLETED");
              const recyclerName = String(tx.recycler_name ?? tx.recyclerId ?? "Authorized Recycler");
              const dateStr = String(tx.completed_at ?? tx.created_at ?? new Date().toISOString());

              return (
                <div
                  key={txId}
                  className="p-5 hover:bg-slate-50/80 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {txId}
                      </span>
                      <span className="text-xs text-slate-500">•</span>
                      <span className="text-xs font-semibold text-emerald-800">
                        Lot: {lotHumanId} ({materialType})
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-slate-400" />
                        {recyclerName}
                      </span>
                      <span>•</span>
                      <span>
                        Verified Weight: <strong>{verifiedWeight > 0 ? `${verifiedWeight} kg` : "Pending scale"}</strong>
                      </span>
                      <span>•</span>
                      <span>Rate: ₹{agreedPrice} / kg</span>
                      <span>•</span>
                      <span>{new Date(dateStr).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-4 shrink-0">
                    <div className="text-right">
                      <span className="text-xs text-slate-400 block font-medium">Final Settlement</span>
                      <span className="text-lg font-bold text-emerald-800">
                        {finalAmt > 0 ? `₹${finalAmt.toLocaleString()}` : "Pending"}
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                        status === "CLOSED" || status === "PAYMENT_CONFIRMED" || status === "PROCESSING" || status === "RECYCLING_EVIDENCE_ADDED"
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : "bg-amber-100 text-amber-800 border border-amber-200"
                      }`}
                    >
                      {status}
                    </span>

                    <Link
                      to={`/transactions/${txId}`}
                      className="p-2 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="View Transaction Details"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </Link>
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
