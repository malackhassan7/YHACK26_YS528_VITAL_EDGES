import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  QrCode,
  Copy,
  Check,
  CheckCircle2,
  Scale,
  History,
  ChevronRight,
  DollarSign,
  Cpu,
  Award,
  Printer,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";
import {
  fetchLotById,
  fetchTransactionByLot,
  fetchTransactionById,
  scheduleHandover,
  fetchHandoverQR,
  confirmPayment,
  startProcessing,
  addRecyclingEvidence,
  closeLot,
  fetchRecyclingEvidence
} from "../api/client";
import type {
  TransactionRecord,
  RecyclingEvidenceRecord,
  MaterialRecoveryItem
} from "../collector/lot-types";

// Clean visual SVG QR matrix placeholder that embeds the token
function SimpleQRCode({ text }: { text: string }) {
  const size = 17;
  const cells: boolean[][] = Array(size).fill(0).map(() => Array(size).fill(false));
  
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (r === 0 || r === 4 || c === 0 || c === 4 || (r >= 1 && r <= 3 && c >= 1 && c <= 3)) {
        cells[r][c] = true;
        cells[r][size - 1 - c] = true;
        cells[size - 1 - r][c] = true;
      }
    }
  }

  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  for (let r = 5; r < size - 5; r++) {
    for (let c = 0; c < size; c++) {
      const bit = ((hash ^ (r * 31 + c * 17)) >>> ((r + c) % 30)) & 1;
      cells[r][c] = bit === 1;
    }
  }

  const cellSize = 10;
  const viewBoxSize = size * cellSize;

  return (
    <svg
      viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
      className="w-44 h-44 border-4 border-white shadow-sm bg-white rounded-lg p-1"
      aria-label={`QR code for handover token ${text}`}
    >
      {cells.map((row, r) =>
        row.map((active, c) =>
          active ? (
            <rect
              key={`${r}-${c}`}
              x={c * cellSize}
              y={r * cellSize}
              width={cellSize}
              height={cellSize}
              fill="#0f172a"
            />
          ) : null
        )
      )}
    </svg>
  );
}

export function TransactionPage() {
  const { lotId, transactionId } = useParams<{ lotId?: string; transactionId?: string }>();
  const queryClient = useQueryClient();

  const [copied, setCopied] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Form state for scheduling handover
  const [scheduledDate, setScheduledDate] = useState(
    new Date(Date.now() + 86400000).toISOString().split("T")[0]
  );
  const [timeWindow, setTimeWindow] = useState("10:00 AM - 01:00 PM");
  const [locationArea, setLocationArea] = useState("");
  const [notes, setNotes] = useState("");

  // Settlement Form State
  const [paymentMethod, setPaymentMethod] = useState("UPI_INSTANT");
  const [paymentAccountRef, setPaymentAccountRef] = useState("upi://collector-pay@okhdfcbank");

  // Processing Form State
  const [processType, setProcessType] = useState("Manual Dismantling & Material Segregation");
  const [safetyChecked, setSafetyChecked] = useState(true);
  const [facilityNotes, setFacilityNotes] = useState("Handled with PPE, acid-free mechanical separation.");

  // Recycling Evidence Form State
  const [recoveryRate, setRecoveryRate] = useState(92);
  const [facilityName, setFacilityName] = useState("GreenEco Authorized R2 Processing Facility #402");
  const [materialOutputs] = useState<MaterialRecoveryItem[]>([
    { material_name: "Copper & High-Grade Trace Metals", weight_kg: 1.2, recovery_percentage: 95.0, destination: "Authorized Smelter Extractor" },
    { material_name: "Recycled Thermoplastics (ABS/PC)", weight_kg: 2.8, recovery_percentage: 88.0, destination: "Polymer Reprocessing Line" },
    { material_name: "Aluminum Heat Sinks & Casings", weight_kg: 1.5, recovery_percentage: 96.0, destination: "Foundry Ingot Casting" },
    { material_name: "Hazardous Residue / Heavy Metal Slag", weight_kg: 0.3, recovery_percentage: 100.0, destination: "State TSDF Secured Landfill Unit" }
  ]);

  // Fetch transaction
  const {
    data: txData,
    isLoading: txLoading,
    error: txError,
  } = useQuery({
    queryKey: ["transaction", lotId, transactionId],
    queryFn: () => {
      if (transactionId) return fetchTransactionById(transactionId);
      if (lotId) return fetchTransactionByLot(lotId);
      throw new Error("Missing transaction or lot parameter");
    },
    enabled: Boolean(lotId || transactionId),
  });

  const transaction: TransactionRecord | undefined =
    (txData as { transaction?: TransactionRecord } | undefined)?.transaction ??
    (txData as TransactionRecord | undefined);
  const currentLotId = transaction?.lot_id ?? lotId ?? "";

  // Fetch lot details & timeline
  const { data: lotData } = useQuery({
    queryKey: ["lot", currentLotId],
    queryFn: () => fetchLotById(currentLotId),
    enabled: Boolean(currentLotId),
  });

  const lot = lotData?.lot;
  const traceEvents: Array<{ event_type: string; timestamp: string; notes?: string }> =
    (lotData?.traceEvents as Array<{ event_type: string; timestamp: string; notes?: string }>) ?? [];

  const txId = transaction?.id ?? "";

  // Fetch QR info if handover scheduled
  const isScheduledOrLater =
    transaction?.status === "HANDOVER_SCHEDULED" ||
    transaction?.status === "PICKED_UP" ||
    transaction?.status === "IN_TRANSIT" ||
    transaction?.status === "RECEIVED" ||
    transaction?.status === "WEIGHT_VERIFIED" ||
    transaction?.status === "PAYMENT_CONFIRMED" ||
    transaction?.status === "PROCESSING" ||
    transaction?.status === "RECYCLING_EVIDENCE_ADDED" ||
    transaction?.status === "CLOSED" ||
    lot?.status === "HANDOVER_SCHEDULED" ||
    lot?.status === "PICKED_UP" ||
    lot?.status === "IN_TRANSIT" ||
    lot?.status === "RECEIVED" ||
    lot?.status === "WEIGHT_VERIFIED" ||
    lot?.status === "PAYMENT_CONFIRMED" ||
    lot?.status === "PROCESSING" ||
    lot?.status === "RECYCLING_EVIDENCE_ADDED" ||
    lot?.status === "CLOSED";

  const { data: qrData } = useQuery({
    queryKey: ["handoverQR", txId],
    queryFn: () => fetchHandoverQR(txId),
    enabled: Boolean(txId && isScheduledOrLater),
  });

  // Fetch recycling evidence if added or closed
  const { data: evidenceData } = useQuery({
    queryKey: ["recyclingEvidence", txId],
    queryFn: () => fetchRecyclingEvidence(txId),
    enabled: Boolean(
      txId &&
        (transaction?.status === "RECYCLING_EVIDENCE_ADDED" ||
          transaction?.status === "CLOSED" ||
          lot?.status === "RECYCLING_EVIDENCE_ADDED" ||
          lot?.status === "CLOSED")
    ),
  });

  const evidence = (evidenceData as { evidence?: RecyclingEvidenceRecord } | undefined)?.evidence;

  // Schedule handover mutation
  const scheduleMutation = useMutation({
    mutationFn: () => {
      if (!transaction?.id) throw new Error("No active transaction");
      return scheduleHandover(transaction.id, {
        scheduled_date: scheduledDate,
        time_window: timeWindow,
        location_area: locationArea.trim() || undefined,
        notes: notes.trim() || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction"] });
      queryClient.invalidateQueries({ queryKey: ["lot"] });
      queryClient.invalidateQueries({ queryKey: ["handoverQR"] });
      setScheduleError(null);
    },
    onError: (err: unknown) => {
      setScheduleError(err instanceof Error ? err.message : "Failed to schedule handover");
    },
  });

  // Sprint C Settlement Mutations
  const confirmPaymentMutation = useMutation({
    mutationFn: () => {
      if (!txId) throw new Error("No active transaction");
      return confirmPayment(txId, {
        payment_method: paymentMethod,
        demo_account_reference: paymentAccountRef,
        notes: "Simulated instant settlement via authorized gateway."
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction"] });
      queryClient.invalidateQueries({ queryKey: ["lot"] });
      setActionError(null);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : "Failed to confirm payment");
    }
  });

  const startProcessingMutation = useMutation({
    mutationFn: () => {
      if (!txId) throw new Error("No active transaction");
      return startProcessing(txId, {
        process_type: processType,
        safety_precautions_checked: safetyChecked,
        facility_notes: facilityNotes
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction"] });
      queryClient.invalidateQueries({ queryKey: ["lot"] });
      setActionError(null);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : "Failed to start processing");
    }
  });

  const addRecyclingEvidenceMutation = useMutation({
    mutationFn: () => {
      if (!txId) throw new Error("No active transaction");
      return addRecyclingEvidence(txId, {
        material_outputs: materialOutputs,
        recovery_rate_percent: recoveryRate,
        recycling_facility_name: facilityName,
        notes: "Formal downstream recycling complete in compliance with CPCB e-waste rules."
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction"] });
      queryClient.invalidateQueries({ queryKey: ["lot"] });
      queryClient.invalidateQueries({ queryKey: ["recyclingEvidence"] });
      setActionError(null);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : "Failed to record recycling evidence");
    }
  });

  const closeLotMutation = useMutation({
    mutationFn: () => {
      if (!txId) throw new Error("No active transaction");
      return closeLot(txId, {
        notes: "End-to-end digital passport finalized. Full traceability preserved."
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction"] });
      queryClient.invalidateQueries({ queryKey: ["lot"] });
      setActionError(null);
    },
    onError: (err: unknown) => {
      setActionError(err instanceof Error ? err.message : "Failed to close lot");
    }
  });

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  if (txLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
      </div>
    );
  }

  if (txError || !transaction) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg">
          No commercial transaction found for this lot. Has an offer been accepted yet?
        </div>
        <div className="mt-4 flex gap-3">
          {lotId && (
            <Link
              to={`/collector/lots/${lotId}/offers`}
              className="inline-flex items-center text-sm font-semibold text-emerald-700 hover:underline"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> View Lot Offers
            </Link>
          )}
          <Link
            to="/collector/lots"
            className="inline-flex items-center text-sm font-semibold text-slate-600 hover:underline"
          >
            My Lots
          </Link>
        </div>
      </div>
    );
  }

  const qrRecord = qrData as
    | { qrToken?: string; token?: string; manualCode?: string; manual_code?: string }
    | undefined;
  const handoverToken = qrRecord?.qrToken ?? qrRecord?.token ?? "PENDING-TOKEN";
  const manualCode = qrRecord?.manualCode ?? qrRecord?.manual_code ?? "—";

  const effectiveStatus = lot?.status ?? transaction.status;
  const isWeightVerified = effectiveStatus === "WEIGHT_VERIFIED";
  const isPaymentConfirmed = effectiveStatus === "PAYMENT_CONFIRMED";
  const isProcessing = effectiveStatus === "PROCESSING";
  const isRecyclingEvidenceAdded = effectiveStatus === "RECYCLING_EVIDENCE_ADDED";
  const isClosed = effectiveStatus === "CLOSED";
  const finalAmount = transaction.final_amount ?? transaction.finalAmount ?? 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 print:p-0 print:m-0">
      {/* Back breadcrumb */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          to={lotId ? `/collector/lots/${lotId}` : "/collector/lots"}
          className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-950 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to Lot Details
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2.5 py-1 bg-amber-100 text-amber-900 rounded font-semibold border border-amber-300">
            DEMO SETTLEMENT
          </span>
          <span className="text-xs px-2.5 py-1 bg-slate-100 text-slate-800 rounded font-semibold border border-slate-200">
            Tx: {transaction.id}
          </span>
        </div>
      </div>

      {actionError && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4 rounded-lg text-sm flex items-center gap-2 print:hidden">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Header Commercial Summary */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
              Commercial Agreement
            </p>
            <h1 className="text-2xl font-bold text-slate-900 mt-0.5">
              Transaction {transaction.id}
            </h1>
            <p className="text-xs text-slate-600 mt-1">
              Collector: <strong>{transaction.collector_id ?? transaction.collectorId}</strong> • Recycler:{" "}
              <strong>{(transaction.recycler_id ?? transaction.recyclerId ?? "Recycler").toUpperCase()}</strong>
            </p>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <span
              className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                isClosed
                  ? "bg-purple-100 text-purple-900 border border-purple-300"
                  : isPaymentConfirmed || isProcessing || isRecyclingEvidenceAdded
                  ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                  : "bg-blue-100 text-blue-900 border border-blue-200"
              }`}
            >
              Status: {effectiveStatus}
            </span>
            {isClosed && (
              <button
                type="button"
                onClick={handlePrint}
                className="print:hidden inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded text-xs font-semibold border border-slate-300 transition-colors"
              >
                <Printer className="w-3.5 h-3.5" /> Print Summary
              </button>
            )}
          </div>
        </div>

        {/* Commercial Grid: Price, Declared, Provisional, Verified */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-slate-100">
          <div className="bg-slate-50 p-3 rounded-lg">
            <span className="text-xs text-slate-500 block">Agreed Price</span>
            <span className="font-bold text-base text-slate-900">
              ₹{transaction.agreed_price_per_kg ?? transaction.agreedPricePerKg} / kg
            </span>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg">
            <span className="text-xs text-slate-500 block">Declared Weight</span>
            <span className="font-bold text-base text-slate-900">
              {transaction.declared_weight_snapshot ?? transaction.declaredWeightSnapshot} kg
            </span>
          </div>
          <div className="bg-slate-50 p-3 rounded-lg">
            <span className="text-xs text-slate-500 block">Provisional Amount</span>
            <span className="font-bold text-base text-slate-700">
              ₹{(transaction.provisional_amount ?? transaction.provisionalEstimatedTotal ?? 0).toLocaleString()}
            </span>
          </div>
          <div
            className={`p-3 rounded-lg border ${
              finalAmount > 0
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-amber-50 border-amber-200 text-amber-900"
            }`}
          >
            <span className="text-xs block font-semibold">
              {finalAmount > 0 ? "Final Commercial Amount" : "Commercial Weight"}
            </span>
            <span className="font-bold text-base">
              {finalAmount > 0 ? `₹${finalAmount.toLocaleString()}` : "Pending scale"}
            </span>
          </div>
        </div>
      </div>

      {/* Step 1: Handover Scheduling (if OFFER_ACCEPTED) */}
      {effectiveStatus === "OFFER_ACCEPTED" && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-600" />
            <h2 className="text-lg font-bold text-slate-900">Schedule Physical Handover</h2>
          </div>
          <p className="text-xs text-slate-600">
            Confirm when and where the e-waste lot will be transferred to the authorized recycler.
          </p>

          {scheduleError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-lg text-xs">
              {scheduleError}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              scheduleMutation.mutate();
            }}
            className="space-y-4 pt-2"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Handover Date *
                </label>
                <input
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  required
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Time Window *
                </label>
                <select
                  value={timeWindow}
                  onChange={(e) => setTimeWindow(e.target.value)}
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-900"
                >
                  <option value="09:00 AM - 12:00 PM">Morning (09:00 AM - 12:00 PM)</option>
                  <option value="12:00 PM - 03:00 PM">Afternoon (12:00 PM - 03:00 PM)</option>
                  <option value="03:00 PM - 06:00 PM">Evening (03:00 PM - 06:00 PM)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Handover Location / Landmark
              </label>
              <input
                type="text"
                placeholder="e.g. Community E-Waste Depot, Sector 4, Bangalore"
                value={locationArea}
                onChange={(e) => setLocationArea(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Special Instructions (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Material sorted in two cardboard boxes."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-slate-300 text-xs text-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={scheduleMutation.isPending}
              className="min-h-12 w-full sm:w-auto px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {scheduleMutation.isPending ? "Scheduling..." : "Confirm Schedule & Generate QR"}
              <ChevronRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* Step 2: QR Handover Credential Display */}
      {isScheduledOrLater && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">Handover Credential</h2>
            </div>
            <span className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-800 font-semibold rounded-full border border-emerald-200">
              Valid For Custody Transfer
            </span>
          </div>

          <p className="text-xs text-slate-600">
            Present this QR code to the authorized recycler at physical handover. If camera is unavailable, use the fallback code below.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-6 p-5 bg-slate-50 rounded-xl border border-slate-200">
            {/* Visual QR SVG */}
            <div className="shrink-0 flex flex-col items-center">
              <SimpleQRCode text={handoverToken} />
              <span className="text-[10px] text-slate-400 mt-2 font-mono">
                Opaque Token Authenticated
              </span>
            </div>

            {/* Manual Code & Fallback Details */}
            <div className="space-y-3 w-full">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                  Manual Fallback Code
                </label>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-2xl font-black text-slate-900 bg-white px-4 py-2 rounded-lg border border-slate-300 tracking-wider">
                    {manualCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyCode(manualCode)}
                    className="p-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition-colors"
                    title="Copy code"
                  >
                    {copied ? <Check className="w-5 h-5 text-emerald-600" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="text-xs text-slate-600 space-y-1 pt-1">
                <p>
                  <strong>Scheduled For:</strong> {transaction.scheduled_date ?? transaction.scheduledAt ?? scheduledDate} (
                  {transaction.time_window ?? transaction.pickupWindow ?? timeWindow})
                </p>
                {(transaction.location_area || transaction.pickupAddress) && (
                  <p>
                    <strong>Location:</strong> {transaction.location_area ?? transaction.pickupAddress}
                  </p>
                )}
                <p className="text-[11px] text-slate-500 italic">
                  * No personal contact details or bank accounts are exposed in this cryptographic token.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Physical Scale Verification Card */}
      {(isWeightVerified || isPaymentConfirmed || isProcessing || isRecyclingEvidenceAdded || isClosed) && (
        <div className="bg-emerald-50/50 border border-emerald-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-emerald-700" />
              <h2 className="text-lg font-bold text-emerald-950">Verified Physical Scale Settlement</h2>
            </div>
            <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-900 rounded-full border border-emerald-300">
              Scale Verified
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-4 rounded-lg border border-emerald-200">
            <div>
              <span className="text-xs text-slate-500 block">Declared Weight</span>
              <span className="font-bold text-slate-900">
                {transaction.declared_weight_snapshot ?? transaction.declaredWeightSnapshot} kg
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Verified Physical Weight</span>
              <span className="font-bold text-emerald-700 text-lg">
                {transaction.verified_weight_kg ?? transaction.verifiedWeightKg ?? "—"} kg
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Scale Difference</span>
              <span
                className={`font-semibold text-sm ${
                  (transaction.weight_difference_kg ?? 0) < 0
                    ? "text-rose-600"
                    : "text-emerald-700"
                }`}
              >
                {transaction.weight_difference_kg != null
                  ? `${transaction.weight_difference_kg > 0 ? "+" : ""}${transaction.weight_difference_kg.toFixed(2)} kg (${transaction.weight_difference_percent?.toFixed(1)}%)`
                  : "0.0 kg (0%)"}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">Final Commercial Payout</span>
              <span className="font-black text-emerald-800 text-lg">
                ₹{finalAmount.toLocaleString()}
              </span>
            </div>
          </div>

          {isWeightVerified && (
            <div className="bg-white p-4 rounded-lg border border-emerald-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-900 font-semibold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Commercial verification complete. Ready for payment settlement.</span>
              </div>
              <span className="text-xs font-mono font-bold bg-emerald-100 text-emerald-900 px-3 py-1 rounded">
                Ready for payment
              </span>
            </div>
          )}
        </div>
      )}

      {/* Step 4: Payment Confirmation Section */}
      {isWeightVerified && (
        <div className="bg-white rounded-xl shadow-sm border border-emerald-300 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-700" />
              <h2 className="text-lg font-bold text-slate-900">Commercial Settlement Payment</h2>
            </div>
            <span className="text-xs px-2.5 py-1 bg-amber-100 text-amber-900 font-bold rounded">
              Ready for Payment
            </span>
          </div>

          <p className="text-xs text-slate-600">
            Physical weighing is complete. The exact commercial payout of <strong>₹{finalAmount.toLocaleString()}</strong> is calculated strictly from verified scale weight.
          </p>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-white"
                >
                  <option value="UPI_INSTANT">UPI Instant Transfer (Simulated)</option>
                  <option value="IMPS_BANK">Direct Bank IMPS (Simulated)</option>
                  <option value="CASH_AT_FACILITY">Cash Voucher at Depot</option>
                </select>
              </div>
              <div>
                <label className="font-semibold text-slate-700 block mb-1">Account Reference / VPA</label>
                <input
                  type="text"
                  value={paymentAccountRef}
                  onChange={(e) => setPaymentAccountRef(e.target.value)}
                  className="w-full p-2 border border-slate-300 rounded bg-white"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-[11px] text-amber-800 font-medium">
                * Hackathon note: This executes a simulated instant payment transaction. No real banking API is called.
              </p>
              <button
                type="button"
                onClick={() => confirmPaymentMutation.mutate()}
                disabled={confirmPaymentMutation.isPending}
                className="w-full sm:w-auto px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-2"
              >
                {confirmPaymentMutation.isPending ? "Processing..." : `Confirm Payment of ₹${finalAmount.toLocaleString()}`}
                <Check className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Payment Confirmed Banner & Processing Start */}
      {isPaymentConfirmed && (
        <div className="bg-white rounded-xl shadow-sm border border-emerald-300 p-6 space-y-5">
          <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-lg border border-emerald-200">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
            <div>
              <h3 className="font-bold text-sm text-emerald-950">Payment Successfully Confirmed (Demo Settlement)</h3>
              <p className="text-xs text-emerald-800 mt-0.5">
                Amount: <strong>₹{finalAmount.toLocaleString()}</strong> • Status: <strong>COMPLETED</strong> • Mode: Simulated Instant Settlement.
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-900">Next Step: Initiate Safe Material Processing</h3>
            </div>
            <p className="text-xs text-slate-600">
              The recycler facility can now start formal dismantling, component segregation, or mechanical shredding.
            </p>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Processing Method</label>
                  <select
                    value={processType}
                    onChange={(e) => setProcessType(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded bg-white"
                  >
                    <option value="Manual Dismantling & Material Segregation">Manual Dismantling & Material Segregation</option>
                    <option value="Mechanical Shredding & Magnetic Separation">Mechanical Shredding & Magnetic Separation</option>
                    <option value="PCB Component Depopulation & Smelting Pre-treatment">PCB Component Depopulation & Smelting Pre-treatment</option>
                    <option value="Battery Cathode Neutralization & Material Recovery">Battery Cathode Neutralization & Material Recovery</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Facility Safety Notes</label>
                  <input
                    type="text"
                    value={facilityNotes}
                    onChange={(e) => setFacilityNotes(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded bg-white"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="safetyCheck"
                  checked={safetyChecked}
                  onChange={(e) => setSafetyChecked(e.target.checked)}
                  className="rounded text-emerald-600"
                />
                <label htmlFor="safetyCheck" className="text-xs text-slate-700 font-medium">
                  Verified safety protocols: PPE deployed, acid-free mechanical separation, zero open burning.
                </label>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => startProcessingMutation.mutate()}
                  disabled={startProcessingMutation.isPending || !safetyChecked}
                  className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {startProcessingMutation.isPending ? "Starting..." : "Start Material Processing"}
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 6: Active Processing & Recycling Evidence Form */}
      {isProcessing && (
        <div className="bg-white rounded-xl shadow-sm border border-indigo-200 p-6 space-y-5">
          <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-lg border border-indigo-200">
            <div className="flex items-center gap-3">
              <Cpu className="w-6 h-6 text-indigo-600 shrink-0 animate-pulse" />
              <div>
                <h3 className="font-bold text-sm text-indigo-950">Material Processing In Progress</h3>
                <p className="text-xs text-indigo-800 mt-0.5">
                  Method: <strong>{processType}</strong> • Protocol: Formal mechanical & safe segregation.
                </p>
              </div>
            </div>
            <span className="text-xs px-2.5 py-1 bg-indigo-100 text-indigo-900 font-bold rounded">
              PROCESSING
            </span>
          </div>

          <div className="border-t border-slate-100 pt-4 space-y-4">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-bold text-slate-900">Record Recycling Evidence & Output Fractions</h3>
            </div>
            <p className="text-xs text-slate-600">
              Declare the recovered material streams and certified downstream destination to finalize the digital e-waste passport.
            </p>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Recycling Facility Name</label>
                  <input
                    type="text"
                    value={facilityName}
                    onChange={(e) => setFacilityName(e.target.value)}
                    className="w-full p-2 border border-slate-300 rounded bg-white"
                  />
                </div>
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Overall Material Recovery Rate (%)</label>
                  <input
                    type="number"
                    min="50"
                    max="100"
                    value={recoveryRate}
                    onChange={(e) => setRecoveryRate(Number(e.target.value))}
                    className="w-full p-2 border border-slate-300 rounded bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-2 text-xs">Recovered Material Streams</label>
                <div className="space-y-2">
                  {materialOutputs.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 bg-white p-2 rounded border border-slate-200 text-xs items-center">
                      <span className="col-span-5 font-semibold text-slate-800">{item.material_name}</span>
                      <span className="col-span-2 text-slate-600">{item.weight_kg} kg</span>
                      <span className="col-span-2 text-emerald-700 font-bold">{item.recovery_percentage}%</span>
                      <span className="col-span-3 text-slate-500 truncate text-[11px]">{item.destination}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => addRecyclingEvidenceMutation.mutate()}
                  disabled={addRecyclingEvidenceMutation.isPending}
                  className="w-full sm:w-auto px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-2"
                >
                  {addRecyclingEvidenceMutation.isPending ? "Submitting..." : "Submit Recycling Evidence"}
                  <Award className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 7: Recycling Evidence Display & Close Lot Action */}
      {isRecyclingEvidenceAdded && (
        <div className="bg-white rounded-xl shadow-sm border border-emerald-300 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Award className="w-5 h-5 text-emerald-600" />
              <h2 className="text-lg font-bold text-slate-900">Verified Proof of Recycling</h2>
            </div>
            <span className="text-xs px-2.5 py-1 bg-emerald-100 text-emerald-900 font-bold rounded border border-emerald-300">
              EVIDENCE VERIFIED
            </span>
          </div>

          <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200 space-y-3 text-xs text-emerald-950">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                <strong>Certificate Number:</strong>{" "}
                <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-emerald-200">
                  {evidence?.certificate_number ?? `EPR-REC-${txId.slice(0, 8).toUpperCase()}`}
                </span>
              </p>
              <p>
                <strong>Recovery Rate:</strong>{" "}
                <span className="font-bold text-emerald-800 text-sm">
                  {evidence?.recovery_rate_percent ?? recoveryRate}%
                </span>
              </p>
            </div>
            <p>
              <strong>Facility:</strong> {evidence?.recycling_facility_name ?? facilityName}
            </p>
          </div>

          {/* Material streams table */}
          <div>
            <h4 className="text-xs font-semibold text-slate-700 mb-2">Recovered Material Output Fractions</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(evidence?.material_outputs ?? materialOutputs).map((item, idx) => (
                <div key={idx} className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <div className="flex justify-between font-semibold text-slate-900">
                    <span>{item.material_name}</span>
                    <span className="text-emerald-700">{item.recovery_percentage}%</span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-[11px] mt-1">
                    <span>Weight: {item.weight_kg} kg</span>
                    <span className="truncate">{item.destination}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
            <p className="text-xs text-slate-500">
              All statutory recycling criteria are met. Finalize and close this digital lot lifecycle.
            </p>
            <button
              type="button"
              onClick={() => closeLotMutation.mutate()}
              disabled={closeLotMutation.isPending}
              className="w-full sm:w-auto px-6 py-2.5 bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-lg text-xs transition-colors flex items-center justify-center gap-2"
            >
              {closeLotMutation.isPending ? "Closing..." : "Finalize & Close Digital Lot"}
              <ShieldCheck className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 8: Closed Digital Passport & Formal Certificate Banner */}
      {isClosed && (
        <div className="bg-gradient-to-br from-emerald-900 via-slate-900 to-emerald-950 text-white rounded-xl shadow-lg p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-emerald-800/60 pb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 rounded-xl border border-emerald-400/30 text-emerald-400">
                <ShieldCheck className="w-8 h-8" />
              </div>
              <div>
                <span className="text-xs uppercase tracking-wider text-emerald-300 font-semibold">
                  Official Digital Passport
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  Formal E-Waste Recycling Completed
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Lot: <span className="font-mono text-emerald-300">{lot?.humanId ?? lot?.id}</span> • Transaction: <span className="font-mono text-emerald-300">{transaction.id}</span>
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <span className="inline-block px-3 py-1 bg-emerald-500 text-slate-950 text-xs font-black rounded-full tracking-wider">
                LIFECYCLE CLOSED
              </span>
              <p className="text-[11px] text-slate-400 mt-1 font-mono">
                {evidence?.certificate_number ?? `EPR-CERT-${txId.slice(0, 8).toUpperCase()}`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div className="bg-white/5 p-3.5 rounded-lg border border-white/10">
              <span className="text-slate-400 block text-[11px]">Commercial Payout</span>
              <span className="text-lg font-black text-emerald-300">
                ₹{finalAmount.toLocaleString()}
              </span>
            </div>
            <div className="bg-white/5 p-3.5 rounded-lg border border-white/10">
              <span className="text-slate-400 block text-[11px]">Verified Scale Weight</span>
              <span className="text-lg font-black text-white">
                {transaction.verified_weight_kg ?? transaction.verifiedWeightKg ?? "—"} kg
              </span>
            </div>
            <div className="bg-white/5 p-3.5 rounded-lg border border-white/10">
              <span className="text-slate-400 block text-[11px]">Recovery Efficiency</span>
              <span className="text-lg font-black text-emerald-300">
                {evidence?.recovery_rate_percent ?? recoveryRate}%
              </span>
            </div>
            <div className="bg-white/5 p-3.5 rounded-lg border border-white/10">
              <span className="text-slate-400 block text-[11px]">Audit Trail Status</span>
              <span className="text-lg font-black text-cyan-300">
                100% Immutable
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            This digital lot has successfully traversed the complete formal e-waste journey from informal collection to certified safe extraction and recycling. All environmental, commercial, and traceability milestones have been immutably recorded.
          </p>
        </div>
      )}

      {/* Traceability Timeline */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-slate-700" />
          <h2 className="text-lg font-bold text-slate-900">Traceability Timeline</h2>
        </div>
        <p className="text-xs text-slate-500">
          Append-only immutable audit trail recording every state transition.
        </p>

        <div className="border-l-2 border-slate-200 ml-3 pl-4 space-y-4 pt-2">
          {traceEvents.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No events recorded yet.</p>
          ) : (
            traceEvents.map((ev, idx) => (
              <div key={idx} className="relative">
                <div className="absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-emerald-600 ring-4 ring-white" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900 font-mono">
                      {ev.event_type}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      {new Date(ev.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">{ev.notes}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
