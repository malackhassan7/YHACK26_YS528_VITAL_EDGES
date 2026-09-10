import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Filter,
  Package,
  QrCode,
  Scale,
  Store,
  Tag,
  Truck,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import {
  confirmReceipt,
  getMarketplaceLots,
  getMaterials,
  getRecyclerOffers,
  getRecyclerTransactions,
  markInTransit,
  verifyPhysicalWeight,
  withdrawOffer,
} from "../api/client";
import type {
  MarketplaceLotSummary,
  MaterialCategory,
  OfferRecord,
  TransactionRecord,
} from "../collector/lot-types";
import { RecyclerHandoverModal } from "../components/RecyclerHandoverModal";

type Tab = "available" | "offers" | "handovers" | "receipt" | "weight";

export function RecyclerMarketplacePage() {
  const { token, user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("available");

  // Data states
  const [lots, setLots] = useState<MarketplaceLotSummary[]>([]);
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [materials, setMaterials] = useState<MaterialCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filters
  const [selectedMaterial, setSelectedMaterial] = useState<string>("");

  // Handover modal
  const [isHandoverModalOpen, setIsHandoverModalOpen] = useState(false);
  const [handoverTxId, setHandoverTxId] = useState<string | undefined>();

  // Scale weight form states
  const [weightInputs, setWeightInputs] = useState<Record<string, string>>({});
  const [weightReason, setWeightReason] = useState<Record<string, string>>({});
  const [submittingWeight, setSubmittingWeight] = useState<string | null>(null);
  const [weightSuccessMsg, setWeightSuccessMsg] = useState<string | null>(null);

  async function loadData() {
    if (!token) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [lotsData, offersData, txData, matsData] = await Promise.all([
        getMarketplaceLots(token, { material: selectedMaterial || undefined }),
        getRecyclerOffers(token),
        getRecyclerTransactions(token),
        getMaterials(token).catch(() => []),
      ]);
      setLots(lotsData);
      setOffers(offersData);
      setTransactions(txData);
      setMaterials(matsData);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to load marketplace data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [token, selectedMaterial]);

  async function handleWithdraw(offerId: string) {
    if (!token) return;
    try {
      await withdrawOffer(token, offerId);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not withdraw offer.");
    }
  }

  async function handleTransit(txId: string) {
    if (!token) return;
    try {
      await markInTransit(token, txId);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update transit status.");
    }
  }

  async function handleReceive(txId: string) {
    if (!token) return;
    try {
      await confirmReceipt(token, txId, "Received at sorting facility.");
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to confirm facility receipt.");
    }
  }

  async function handleVerifyWeightSubmit(txId: string) {
    if (!token) return;
    const val = parseFloat(weightInputs[txId] ?? "0");
    if (isNaN(val) || val <= 0) {
      alert("Please enter a valid scale weight greater than 0 kg.");
      return;
    }
    setSubmittingWeight(txId);
    try {
      const res = await verifyPhysicalWeight(token, txId, {
        verifiedWeightKg: val,
        varianceReason: weightReason[txId],
      });
      setWeightSuccessMsg(`Scale weight verified! Final amount: ₹${(res.finalAmount ?? res.final_amount ?? 0).toLocaleString("en-IN")}`);
      await loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to record verified scale weight.");
    } finally {
      setSubmittingWeight(null);
    }
  }

  // Filter transaction subsets
  const handoverScheduled = transactions.filter((t) => t.status === "HANDOVER_SCHEDULED");
  const inTransitOrPickedUp = transactions.filter((t) => t.status === "PICKED_UP" || t.status === "IN_TRANSIT");
  const receivedAwaitingWeight = transactions.filter((t) => t.status === "RECEIVED");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-800">
              <Store size={20} />
            </span>
            <div>
              <h1 className="text-2xl font-black text-slate-900">
                Recycler dashboard
              </h1>
              <p className="text-xs text-slate-500">
                Marketplace & Operations · Logged in as{" "}<strong className="text-slate-700">{user?.displayName}</strong> · Verified Recycler (Demo)
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setHandoverTxId(undefined);
            setIsHandoverModalOpen(true);
          }}
          id="btn-open-handover-modal"
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 font-bold text-sm text-white hover:bg-emerald-800 transition shadow-sm"
        >
          <QrCode size={16} /> Scan / Enter QR Handover
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto gap-1">
        <button
          onClick={() => setActiveTab("available")}
          className={`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition ${
            activeTab === "available"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Available Lots ({lots.length})
        </button>
        <button
          onClick={() => setActiveTab("offers")}
          className={`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition ${
            activeTab === "offers"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          My Offers ({offers.length})
        </button>
        <button
          onClick={() => setActiveTab("handovers")}
          className={`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition ${
            activeTab === "handovers"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Handovers / Pickups ({handoverScheduled.length})
        </button>
        <button
          onClick={() => setActiveTab("receipt")}
          className={`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition ${
            activeTab === "receipt"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Awaiting Receipt ({inTransitOrPickedUp.length})
        </button>
        <button
          onClick={() => setActiveTab("weight")}
          className={`px-4 py-3 text-sm font-bold border-b-2 whitespace-nowrap transition ${
            activeTab === "weight"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Weight Verification ({receivedAwaitingWeight.length})
        </button>
      </div>

      {weightSuccessMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 font-medium">
          <CheckCircle2 size={18} className="text-emerald-600" />
          <p>{weightSuccessMsg}</p>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          {errorMsg}
        </div>
      )}

      {/* TAB 1: AVAILABLE LOTS */}
      {activeTab === "available" && (
        <div className="space-y-4">
          {/* Material Filter */}
          <div className="flex flex-wrap items-center gap-3 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
              <Filter size={14} /> Filter Material:
            </span>
            <button
              onClick={() => setSelectedMaterial("")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                selectedMaterial === ""
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Materials
            </button>
            {materials.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMaterial(m.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  selectedMaterial === m.id
                    ? "bg-emerald-700 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {m.name}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="p-8 text-center text-slate-500">Loading marketplace lots…</p>
          ) : lots.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm space-y-2">
              <Package size={40} className="mx-auto text-slate-300" />
              <h3 className="font-bold text-slate-700 text-base">No active lots match your criteria</h3>
              <p className="text-sm text-slate-400">Lots listed by collectors will appear here for commercial offers.</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {lots.map((lot) => (
                <article
                  key={lot.id}
                  className="flex flex-col justify-between rounded-2xl bg-white p-5 shadow-sm border border-slate-100 space-y-4 hover:shadow-md transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-emerald-700 tracking-wide uppercase">
                          {lot.humanId}
                        </span>
                        <h2 className="font-black text-slate-900 text-lg leading-tight mt-0.5">{lot.title}</h2>
                      </div>
                      {lot.matchScore !== null && lot.matchScore !== undefined && (
                        <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-2.5 py-1 text-center shrink-0">
                          <p className="text-[10px] uppercase font-bold text-emerald-700">Match</p>
                          <p className="text-sm font-black text-emerald-800">{lot.matchScore}%</p>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                      <div>
                        <span className="text-slate-400 block">Est. Weight</span>
                        <strong className="text-slate-800">{lot.estimatedWeightKg} kg</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Condition</span>
                        <strong className="text-slate-800">{lot.condition ?? "Mixed"}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Location</span>
                        <strong className="text-slate-800 truncate block">{lot.cityArea ?? "Coimbatore"}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Trust Score</span>
                        <strong className="text-emerald-700">{lot.trustScore ?? "--"}/100</strong>
                      </div>
                    </div>

                    {lot.fairMid && (
                      <div className="text-xs text-slate-500 bg-amber-50/60 border border-amber-100 p-2 rounded-lg">
                        Fair Value Ref: <strong>₹{lot.fairLow?.toFixed(0)} - ₹{lot.fairHigh?.toFixed(0)}</strong> (Mid: ₹{lot.fairMid?.toFixed(0)})
                      </div>
                    )}
                  </div>

                  <Link
                    to={`/recycler/lots/${lot.id}`}
                    id={`btn-review-${lot.id}`}
                    className="inline-flex items-center justify-between w-full rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 transition"
                  >
                    Review & Make Offer <ChevronRight size={16} />
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: MY OFFERS */}
      {activeTab === "offers" && (
        <div className="space-y-4">
          {offers.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm space-y-2">
              <Tag size={40} className="mx-auto text-slate-300" />
              <h3 className="font-bold text-slate-700 text-base">No offers submitted yet</h3>
              <p className="text-sm text-slate-400">Browse available lots to submit your commercial offers.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-slate-800 text-lg">
                        ₹{(offer.pricePerKg ?? offer.price_per_kg ?? 0).toFixed(2)}/kg
                      </span>
                      <span className="text-sm text-slate-500">
                        (Est. ₹{(offer.estimatedTotal ?? offer.estimated_total ?? 0).toLocaleString("en-IN")})
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          offer.status === "ACCEPTED"
                            ? "bg-emerald-100 text-emerald-800"
                            : offer.status === "PENDING"
                            ? "bg-blue-100 text-blue-800"
                            : offer.status === "REJECTED"
                            ? "bg-slate-100 text-slate-600"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {offer.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      Lot: <strong className="text-slate-700">{offer.lotId ?? offer.lot_id}</strong> · Submitted:{" "}
                      {new Date(offer.createdAt ?? offer.created_at ?? Date.now()).toLocaleDateString()}
                    </p>
                    {offer.note && <p className="text-xs italic text-slate-600">"{offer.note}"</p>}
                  </div>

                  <div className="flex items-center gap-2">
                    {offer.status === "PENDING" && (
                      <button
                        onClick={() => handleWithdraw(offer.id)}
                        className="rounded-xl border border-red-200 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-50"
                      >
                        Withdraw Offer
                      </button>
                    )}
                    {offer.status === "ACCEPTED" && (
                      <Link
                        to={`/transactions/${offer.lotId}`}
                        className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800"
                      >
                        View Handover
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: HANDOVERS / PICKUPS */}
      {activeTab === "handovers" && (
        <div className="space-y-4">
          {handoverScheduled.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm space-y-2">
              <Calendar size={40} className="mx-auto text-slate-300" />
              <h3 className="font-bold text-slate-700 text-base">No scheduled handovers</h3>
              <p className="text-sm text-slate-400">Accepted offers awaiting pickup coordination will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {handoverScheduled.map((tx) => (
                <div
                  key={tx.id}
                  className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">Tx: {tx.id}</span>
                      <span className="rounded-full bg-amber-50 border border-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                        Handover Scheduled
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Lot: <strong>{tx.lotId}</strong> · Agreed: <strong>₹{tx.agreedPricePerKg}/kg</strong> · Declared:{" "}
                      <strong>{tx.declaredWeightSnapshot} kg</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setHandoverTxId(tx.id);
                      setIsHandoverModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800"
                  >
                    <QrCode size={14} /> Enter QR / Manual Code
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: AWAITING RECEIPT */}
      {activeTab === "receipt" && (
        <div className="space-y-4">
          {inTransitOrPickedUp.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm space-y-2">
              <Truck size={40} className="mx-auto text-slate-300" />
              <h3 className="font-bold text-slate-700 text-base">No lots currently in transit</h3>
              <p className="text-sm text-slate-400">Lots picked up from collectors will appear here as they move to the facility.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {inTransitOrPickedUp.map((tx) => (
                <div
                  key={tx.id}
                  className="rounded-2xl bg-white p-5 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">Tx: {tx.id}</span>
                      <span className="rounded-full bg-blue-50 border border-blue-100 px-2 py-0.5 text-xs font-bold text-blue-800">
                        {tx.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Lot: <strong>{tx.lotId}</strong> · Declared Weight: <strong>{tx.declaredWeightSnapshot} kg</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {tx.status === "PICKED_UP" && (
                      <button
                        onClick={() => handleTransit(tx.id)}
                        className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        Mark In-Transit
                      </button>
                    )}
                    <button
                      onClick={() => handleReceive(tx.id)}
                      className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800"
                    >
                      Confirm Facility Receipt
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: WEIGHT VERIFICATION */}
      {activeTab === "weight" && (
        <div className="space-y-4">
          {receivedAwaitingWeight.length === 0 ? (
            <div className="rounded-2xl bg-white p-12 text-center shadow-sm space-y-2">
              <Scale size={40} className="mx-auto text-slate-300" />
              <h3 className="font-bold text-slate-700 text-base">No lots awaiting physical scale weight</h3>
              <p className="text-sm text-slate-400">Lots received at your facility will appear here for certified weight recording.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {receivedAwaitingWeight.map((tx) => {
                const declared = tx.declaredWeightSnapshot ?? tx.declared_weight_snapshot ?? 1;
                const agreedPrice = tx.agreedPricePerKg ?? tx.agreed_price_per_kg ?? 0;
                const provisional = tx.provisionalEstimatedTotal ?? tx.provisional_amount ?? 0;
                const entered = parseFloat(weightInputs[tx.id] || "0");
                const diff = entered ? entered - declared : 0;
                const diffPct = entered && declared ? (diff / declared) * 100 : 0;
                const finalAmt = entered ? entered * agreedPrice : 0;

                return (
                  <div
                    key={tx.id}
                    className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 space-y-4"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-xs font-bold text-emerald-700 uppercase">Tx: {tx.id}</span>
                        <h3 className="font-black text-slate-900 text-lg">Lot {tx.lotId ?? tx.lot_id}</h3>
                      </div>
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                        Received · Awaiting Weight
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl text-xs">
                      <div>
                        <span className="text-slate-400 block">Declared Weight</span>
                        <strong className="text-slate-800 text-sm">{declared} kg</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Agreed Price</span>
                        <strong className="text-slate-800 text-sm">₹{agreedPrice}/kg</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Provisional Total</span>
                        <strong className="text-slate-800 text-sm">₹{provisional.toLocaleString("en-IN")}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Computed Final</span>
                        <strong className="text-emerald-700 text-sm">
                          {finalAmt > 0 ? `₹${finalAmt.toLocaleString("en-IN")}` : "--"}
                        </strong>
                      </div>
                    </div>

                    {/* Scale Weight Input Form */}
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label htmlFor={`scale-weight-${tx.id}`} className="text-xs font-bold text-slate-700 uppercase">
                          Certified Scale Weight (kg) *
                        </label>
                        <input
                          id={`scale-weight-${tx.id}`}
                          type="number"
                          step="0.1"
                          min="0.1"
                          placeholder="e.g. 9.6"
                          value={weightInputs[tx.id] || ""}
                          onChange={(e) =>
                            setWeightInputs((prev) => ({ ...prev, [tx.id]: e.target.value }))
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                        />
                        {entered > 0 && (
                          <p className={`text-xs ${Math.abs(diffPct) > 20 ? "text-amber-700 font-bold" : "text-slate-500"}`}>
                            Variance: {diff > 0 ? `+${diff.toFixed(2)}` : diff.toFixed(2)} kg ({diffPct > 0 ? `+${diffPct.toFixed(1)}` : diffPct.toFixed(1)}%)
                            {Math.abs(diffPct) > 20 && " — Warning: >20% variance"}
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <label htmlFor={`variance-reason-${tx.id}`} className="text-xs font-bold text-slate-700 uppercase">
                          Scale / Variance Notes (Optional)
                        </label>
                        <input
                          id={`variance-reason-${tx.id}`}
                          type="text"
                          placeholder="e.g. Minor dust loss / certified calibrated scale"
                          value={weightReason[tx.id] || ""}
                          onChange={(e) =>
                            setWeightReason((prev) => ({ ...prev, [tx.id]: e.target.value }))
                          }
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => handleVerifyWeightSubmit(tx.id)}
                      disabled={submittingWeight === tx.id || !weightInputs[tx.id]}
                      id={`btn-verify-weight-${tx.id}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
                    >
                      <Scale size={16} /> Record Verified Scale Weight
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* QR Handover Modal */}
      <RecyclerHandoverModal
        token={token || ""}
        isOpen={isHandoverModalOpen}
        onClose={() => setIsHandoverModalOpen(false)}
        transactionId={handoverTxId}
        onSuccess={async () => {
          await loadData();
          setActiveTab("receipt");
        }}
      />
    </div>
  );
}
