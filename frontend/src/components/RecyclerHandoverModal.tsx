import React, { useState } from "react";
import { CheckCircle2, QrCode, X, AlertTriangle } from "lucide-react";
import { confirmPickup } from "../api/client";

interface RecyclerHandoverModalProps {
  token: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (lotId: string) => void;
  defaultCode?: string;
  transactionId?: string;
}

export function RecyclerHandoverModal({
  token,
  isOpen,
  onClose,
  onSuccess,
  defaultCode = "",
  transactionId,
}: RecyclerHandoverModalProps) {
  const [code, setCode] = useState(defaultCode);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleConfirm() {
    if (!code.trim()) {
      setErrorMsg("Please enter the QR token or manual handover code.");
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await confirmPickup(token, code.trim(), transactionId);
      onSuccess(res.lotId);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Invalid or unrecognized handover code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-100 text-emerald-800">
              <QrCode size={20} />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-lg">Confirm QR Handover</h2>
              <p className="text-xs text-slate-500">Scan or enter the collector's handover code</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-800" role="alert">
            <AlertTriangle size={16} className="mt-0.5 shrink-0 text-red-600" />
            <p>{errorMsg}</p>
          </div>
        )}

        <div className="space-y-2">
          <label htmlFor="handover-code-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
            Handover Token / Manual Code
          </label>
          <input
            id="handover-code-input"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="e.g. ho_ab12cd34ef56"
            className="w-full rounded-xl border border-slate-300 px-4 py-3 font-mono text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            autoFocus
          />
          <p className="text-xs text-slate-400">
            Collector displays this token on their device screen under the QR code.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !code.trim()}
            id="btn-confirm-pickup-modal"
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {loading ? "Validating…" : (
              <>
                <CheckCircle2 size={16} /> Confirm Pickup
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
