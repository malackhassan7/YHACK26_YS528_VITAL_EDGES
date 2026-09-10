import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { Truck, MapPin, Building2, Star, ChevronRight, RefreshCw, AlertCircle } from "lucide-react";
import { getLotMatches } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { RecyclerMatch } from "../collector/lot-types";

function MatchScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? "#10b981" : score >= 60 ? "#f59e0b" : "#94a3b8";
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative flex items-center justify-center shrink-0">
      <svg width={56} height={56} className="-rotate-90">
        <circle cx={28} cy={28} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={5} />
        <circle
          cx={28} cy={28} r={radius} fill="none"
          stroke={color} strokeWidth={5}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center leading-none">
        <span className="text-sm font-black" style={{ color }}>{score}</span>
      </div>
    </div>
  );
}

function RecyclerCard({ match, rank }: { match: RecyclerMatch; rank: number }) {
  return (
    <article className="rounded-2xl bg-white p-4 shadow-sm border border-slate-100 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">#{rank}</span>
            {match.authorizationStatus === "demo_authorized" && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                Demo-authorized
              </span>
            )}
          </div>
          <h2 className="mt-1 font-black text-slate-800 leading-snug">{match.name}</h2>
          <p className="text-xs text-slate-500">{match.orgName}</p>
        </div>
        <MatchScoreRing score={match.matchScore} />
      </div>

      {/* Match reason chips */}
      <div className="flex flex-wrap gap-1.5">
        {match.matchReasons.slice(0, 4).map((reason) => (
          <span key={reason} className="rounded-lg bg-slate-50 border border-slate-100 px-2 py-0.5 text-xs text-slate-600">
            {reason}
          </span>
        ))}
      </div>

      {/* Pickup + service region */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Truck size={12} />
          {match.pickupAvailable ? "Pickup available" : "Drop-off only"}
        </span>
        <span className="flex items-center gap-1">
          <MapPin size={12} />
          {match.serviceRegions.slice(0, 2).join(", ")}
          {match.serviceRegions.length > 2 && ` +${match.serviceRegions.length - 2}`}
        </span>
      </div>

      {/* Demo label + contact */}
      <div className="flex items-center justify-between border-t border-slate-50 pt-2">
        <div className="flex items-center gap-1 text-xs text-slate-400">
          <Building2 size={11} /> <span>{match.contactInfo}</span>
        </div>
        {match.isDemo && (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-600">Demo data</span>
        )}
      </div>

      {/* Sprint B placeholder — CTA will be wired in Sprint B */}
      <button
        disabled
        className="w-full min-h-10 rounded-xl border-2 border-dashed border-slate-200 text-xs font-semibold text-slate-400 cursor-not-allowed"
        title="Offer submission available in Sprint B"
      >
        View Offer (Sprint B)
      </button>
    </article>
  );
}

export function LotMatchesPage() {
  const { lotId } = useParams<{ lotId: string }>();
  const { token } = useAuth();

  const [matches, setMatches] = useState<RecyclerMatch[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function load() {
    if (!token || !lotId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const result = await getLotMatches(token, lotId);
      setMatches(result);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not load matches.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, [token, lotId]);

  return (
    <section className="mx-auto max-w-xl space-y-4 px-4 py-2">
      {/* Header */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-sm font-semibold text-emerald-700">Lot {lotId}</p>
        <h1 className="mt-1 text-2xl font-black">Recycler Matches</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ranked recyclers compatible with your lot's material and location.
        </p>
      </div>

      {/* Demo banner */}
      <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-100 px-3 py-2">
        <Star size={14} className="mt-0.5 shrink-0 text-amber-500" />
        <p className="text-xs text-amber-700">
          <strong>Demo recycler data</strong> — These recyclers are seeded for demonstration. Scores and contact information are not real.
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-2xl bg-white p-8 shadow-sm flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-200 border-t-emerald-600" />
          <p className="text-sm font-semibold text-slate-600">Finding compatible recyclers…</p>
        </div>
      )}

      {/* Error */}
      {!loading && errorMsg && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle size={18} className="text-red-600" />
            <p className="font-bold text-red-800 text-sm">Could not load matches</p>
          </div>
          <p className="text-sm text-red-700">{errorMsg}</p>
          <button
            className="flex items-center gap-2 text-sm font-semibold text-red-700"
            onClick={() => void load()}
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !errorMsg && matches && matches.length === 0 && (
        <div className="rounded-2xl bg-white p-8 shadow-sm text-center space-y-2">
          <p className="text-2xl">🔍</p>
          <p className="font-bold text-slate-700">No compatible recyclers found</p>
          <p className="text-sm text-slate-500">No registered recyclers currently match your material and location.</p>
        </div>
      )}

      {/* Match list */}
      {!loading && matches && matches.length > 0 && (
        <>
          <p className="px-1 text-xs text-slate-500">{matches.length} compatible recycler{matches.length > 1 ? "s" : ""} found</p>
          {matches.map((match, i) => (
            <RecyclerCard key={match.recyclerId} match={match} rank={i + 1} />
          ))}
        </>
      )}

      {/* Navigation */}
      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <Link
          to={`/collector/lots/${lotId}`}
          id="btn-back-to-lot"
          className="flex items-center justify-between w-full min-h-12 rounded-xl border border-slate-200 px-4 font-bold text-slate-700"
        >
          View Full Lot Details <ChevronRight size={18} />
        </Link>
      </div>
    </section>
  );
}
