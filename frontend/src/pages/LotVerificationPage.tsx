import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ShieldCheck, ShieldAlert, ShieldX, CheckCircle, AlertTriangle, XCircle, ChevronRight, RotateCcw } from "lucide-react";
import { verifyLot, confirmCategory, getMaterials } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { VerificationResult, MaterialCategory } from "../collector/lot-types";
import { fallbackMaterials } from "../collector/materials";

type Phase = "idle" | "running" | "done" | "error";

const PIPELINE_STEPS = [
  "Checking image evidence…",
  "Duplicate analysis…",
  "Material classification…",
  "Evidence consistency…",
  "Calculating trust score…",
];

function TrustRing({ score, level }: { score: number; level: string }) {
  const color = level === "HIGH" ? "#10b981" : level === "MEDIUM" ? "#f59e0b" : "#ef4444";
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative flex items-center justify-center">
      <svg width={104} height={104} className="-rotate-90">
        <circle cx={52} cy={52} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={10} />
        <circle
          cx={52} cy={52} r={radius} fill="none"
          stroke={color} strokeWidth={10}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-black" style={{ color }}>{score}</span>
        <span className="text-xs font-semibold text-slate-500">/ 100</span>
      </div>
    </div>
  );
}

function CheckIcon({ status }: { status: string }) {
  if (status === "PASS") return <CheckCircle size={18} className="shrink-0 text-emerald-600" />;
  if (status === "WARNING") return <AlertTriangle size={18} className="shrink-0 text-amber-500" />;
  return <XCircle size={18} className="shrink-0 text-red-500" />;
}

export function LotVerificationPage() {
  const { lotId } = useParams<{ lotId: string }>();
  const { token } = useAuth();

  const [phase, setPhase] = useState<Phase>("idle");
  const [pipelineStep, setPipelineStep] = useState(0);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [materials, setMaterials] = useState<MaterialCategory[]>(fallbackMaterials as unknown as MaterialCategory[]);
  const [confirmingCategory, setConfirmingCategory] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);

  useEffect(() => {
    if (token) {
      getMaterials(token).then(setMaterials).catch(() => setMaterials(fallbackMaterials as unknown as MaterialCategory[]));
    }
  }, [token]);

  async function runVerification() {
    if (!token || !lotId) return;
    setPhase("running");
    setErrorMsg(null);
    setPipelineStep(0);

    // Animate steps client-side while backend processes
    let step = 0;
    const interval = setInterval(() => {
      step = Math.min(step + 1, PIPELINE_STEPS.length - 1);
      setPipelineStep(step);
    }, 600);

    try {
      const res = await verifyLot(token, lotId);
      clearInterval(interval);
      setPipelineStep(PIPELINE_STEPS.length - 1);
      setResult(res);
      setPhase("done");
    } catch (err) {
      clearInterval(interval);
      setErrorMsg(err instanceof Error ? err.message : "Verification failed. Please try again.");
      setPhase("error");
    }
  }

  async function handleConfirmCategory(categoryId: string) {
    if (!token || !lotId) return;
    setConfirmBusy(true);
    try {
      const updated = await confirmCategory(token, lotId, categoryId);
      setResult(updated);
      setConfirmingCategory(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not confirm category.");
    } finally {
      setConfirmBusy(false);
    }
  }

  return (
    <section className="mx-auto max-w-xl space-y-4 px-4 py-2">
      {/* Header */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-emerald-700">Lot {lotId}</p>
        <h1 className="mt-1 text-2xl font-black">Verify Evidence</h1>
        <p className="mt-1 text-sm text-slate-500">
          We'll analyse your photos and calculate a trust score to strengthen your lot.
        </p>
      </div>

      {/* Idle state */}
      {phase === "idle" && (
        <div className="rounded-2xl bg-white p-5 shadow-sm space-y-4">
          <p className="text-slate-600 text-sm">Evidence verification checks:</p>
          <ul className="space-y-2 text-sm text-slate-700">
            {["Duplicate image detection (SHA-256 & perceptual)", "Image quality & format", "Material classification", "Quantity plausibility", "Multi-angle evidence"].map((item) => (
              <li key={item} className="flex items-center gap-2"><CheckCircle size={16} className="text-emerald-600" />{item}</li>
            ))}
          </ul>
          <button
            id="btn-start-verification"
            className="mt-2 w-full min-h-12 rounded-xl bg-emerald-600 font-bold text-white active:scale-95 transition-transform"
            onClick={() => void runVerification()}
          >
            Start Verification
          </button>
        </div>
      )}

      {/* Running state */}
      {phase === "running" && (
        <div className="rounded-2xl bg-white p-6 shadow-sm flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          <p className="text-center font-semibold text-slate-700">{PIPELINE_STEPS[pipelineStep]}</p>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className="h-2 rounded-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${((pipelineStep + 1) / PIPELINE_STEPS.length) * 100}%` }}
            />
          </div>
          <p className="text-xs text-slate-400">Step {pipelineStep + 1} of {PIPELINE_STEPS.length}</p>
        </div>
      )}

      {/* Error state */}
      {phase === "error" && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldX size={20} className="text-red-600" />
            <p className="font-bold text-red-800">Verification failed</p>
          </div>
          <p className="text-sm text-red-700">{errorMsg}</p>
          <button
            className="flex items-center gap-2 rounded-xl border border-red-300 px-4 py-2 text-sm font-semibold text-red-700"
            onClick={() => void runVerification()}
          >
            <RotateCcw size={14} /> Retry
          </button>
        </div>
      )}

      {/* Results */}
      {phase === "done" && result && (
        <>
          {/* Trust score card */}
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-black text-lg">Trust Score</h2>
                <p className="text-sm text-slate-500 mt-0.5">
                  {result.confidenceLevel === "HIGH" ? "Strong evidence" :
                   result.confidenceLevel === "MEDIUM" ? "Acceptable evidence" : "Weak evidence — add more photos"}
                </p>
              </div>
              <TrustRing score={result.trustScore} level={result.confidenceLevel} />
            </div>
            <div className="mt-3 flex items-center gap-2">
              {result.confidenceLevel === "HIGH" ? <ShieldCheck size={18} className="text-emerald-600" /> :
               result.confidenceLevel === "MEDIUM" ? <ShieldAlert size={18} className="text-amber-500" /> :
               <ShieldX size={18} className="text-red-500" />}
              <span className={`text-sm font-bold ${result.confidenceLevel === "HIGH" ? "text-emerald-700" : result.confidenceLevel === "MEDIUM" ? "text-amber-600" : "text-red-600"}`}>
                {result.confidenceLevel} CONFIDENCE
              </span>
            </div>
          </div>

          {/* Classification result */}
          {result.classificationResult && (
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-slate-700">Material Classification</p>
                {result.isDemoClassification && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">Demo adapter</span>
                )}
              </div>
              <p className="text-sm text-slate-600">
                E-waste probability: <strong>{(result.classificationResult.eWasteProbability * 100).toFixed(0)}%</strong>
              </p>
              {result.classificationResult.suggestedCategoryName && (
                <p className="text-sm text-slate-600">
                  Suggested: <strong>{result.classificationResult.suggestedCategoryName}</strong>
                  {" "}({(result.classificationResult.categoryConfidence * 100).toFixed(0)}% confidence)
                </p>
              )}
            </div>
          )}

          {/* Manual category confirmation */}
          {result.requiresManualCategoryConfirmation && !confirmingCategory && (
            <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-2">
              <p className="text-sm font-bold text-amber-800">Confirm material category</p>
              <p className="text-xs text-amber-700">Automatic classification is unavailable. Please confirm what type of e-waste this is.</p>
              <button
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white"
                onClick={() => setConfirmingCategory(true)}
              >
                Choose category
              </button>
            </div>
          )}

          {confirmingCategory && (
            <div className="rounded-2xl bg-white p-4 shadow-sm space-y-3">
              <h2 className="font-bold">Select your material</h2>
              <div className="grid grid-cols-2 gap-2">
                {materials.map((mat) => (
                  <button
                    key={mat.id}
                    disabled={confirmBusy}
                    className="min-h-12 rounded-xl border border-slate-200 px-3 py-2 text-left text-sm font-semibold hover:border-emerald-600 hover:bg-emerald-50 transition-colors"
                    onClick={() => void handleConfirmCategory(mat.id)}
                  >
                    {mat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Check list */}
          <div className="rounded-2xl bg-white p-4 shadow-sm space-y-2">
            <h2 className="font-bold text-sm text-slate-700">Verification Checks</h2>
            {result.checks.map((check) => (
              <div key={check.id} className="flex items-start gap-3 py-1.5 border-b border-slate-50 last:border-0">
                <CheckIcon status={check.status} />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-700">{check.checkType.replace(/_/g, " ")}</p>
                  <p className="text-xs text-slate-500 leading-snug">{check.reason}</p>
                  {check.scoreDelta !== 0 && (
                    <span className={`text-xs font-semibold ${check.scoreDelta > 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {check.scoreDelta > 0 ? `+${check.scoreDelta}` : check.scoreDelta} pts
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <Link
              to={`/collector/lots/${lotId}/price`}
              id="btn-go-to-price"
              className="flex items-center justify-between w-full min-h-12 rounded-xl bg-emerald-600 px-4 font-bold text-white"
            >
              Calculate Fair Value <ChevronRight size={18} />
            </Link>
            <Link to={`/collector/lots/${lotId}`} className="mt-2 flex w-full justify-center py-2 text-sm text-slate-500">
              Back to lot
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
