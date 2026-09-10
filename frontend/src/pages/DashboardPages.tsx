import type React from "react";
import { Link } from "react-router-dom";
import {
  Plus,
  ShieldCheck,
  Store,
  Truck,
  DollarSign,
  BookOpen,
  Volume2,
  Package,
  ArrowRight
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useLanguage } from "../i18n/LanguageContext";

function ShellCard({
  title,
  body,
  icon,
}: {
  title: string;
  body: string;
  icon: React.ReactNode;
}) {
  return (
    <section className="rounded-xl bg-white p-6 shadow-sm border border-slate-200">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg bg-emerald-100 text-emerald-800">
        {icon}
      </div>
      <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
      <p className="mt-3 max-w-2xl text-slate-600 leading-relaxed text-sm">{body}</p>
    </section>
  );
}

export function CollectorDashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-800 to-emerald-950 text-white rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-700/80 text-emerald-200 text-xs font-semibold border border-emerald-500/30">
                {t("collector_portal")}
              </span>
              <span className="text-xs text-emerald-300">
                {user?.displayName ?? "Collector"}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              {t("collector_dashboard_title")}
            </h1>
            <p className="mt-2 text-emerald-100/90 text-sm max-w-2xl leading-relaxed">
              {t("collector_dashboard_subtitle")}
            </p>
          </div>

          <Link
            to="/collector/lots/new"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 font-bold text-emerald-900 shadow hover:bg-emerald-50 transition-colors shrink-0 text-sm"
          >
            <Plus size={18} className="text-emerald-700" />
            {t("create_lot")}
          </Link>
        </div>
      </div>

      {/* 5 Core Feature Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Create Lot */}
        <Link
          to="/collector/lots/new"
          className="group p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-emerald-500 hover:shadow-md transition-all flex flex-col justify-between min-h-[160px]"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-800">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-emerald-700 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                Start Draft <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <h2 className="font-bold text-base text-slate-900 mt-3">
              Digital Lot Creation
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {t("create_lot_desc")}
            </p>
          </div>
        </Link>

        {/* Card 2: Price Catalog */}
        <Link
          to="/collector/prices"
          className="group p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-emerald-500 hover:shadow-md transition-all flex flex-col justify-between min-h-[160px]"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-lg bg-blue-100 text-blue-800">
                <BookOpen className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-blue-700 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                {t("action_view")} <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <h2 className="font-bold text-base text-slate-900 mt-3">
              {t("price_catalog_title")}
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {t("price_catalog_desc")}
            </p>
          </div>
        </Link>

        {/* Card 3: My Lots */}
        <Link
          to="/collector/lots"
          className="group p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-emerald-500 hover:shadow-md transition-all flex flex-col justify-between min-h-[160px]"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-lg bg-amber-100 text-amber-800">
                <Package className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-amber-700 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                {t("action_manage")} <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <h2 className="font-bold text-base text-slate-900 mt-3">
              {t("my_lots_title")}
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {t("my_lots_desc")}
            </p>
          </div>
        </Link>

        {/* Card 4: Earnings Ledger */}
        <Link
          to="/collector/earnings"
          className="group p-5 bg-white rounded-xl border border-slate-200 shadow-sm hover:border-emerald-500 hover:shadow-md transition-all flex flex-col justify-between min-h-[160px]"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-800">
                <DollarSign className="w-5 h-5" />
              </div>
              <span className="text-xs font-bold text-emerald-700 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                {t("action_view")} <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <h2 className="font-bold text-base text-slate-900 mt-3">
              {t("earnings_title")}
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {t("earnings_desc")}
            </p>
          </div>
        </Link>

        {/* Card 5: Safety Center with Audio */}
        <Link
          to="/collector/safety"
          className="group p-5 bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl border border-amber-300 shadow-sm hover:border-orange-500 hover:shadow-md transition-all flex flex-col justify-between min-h-[160px] sm:col-span-2 lg:col-span-2"
        >
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2.5 rounded-lg bg-orange-500 text-white">
                  <Volume2 className="w-5 h-5" />
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-200 text-orange-950 font-bold">
                  {t("audio_pictorial_badge")}
                </span>
              </div>
              <span className="text-xs font-bold text-orange-800 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                {t("listen_read")} <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
            <h2 className="font-bold text-base text-slate-900 mt-3">
              {t("safety_center_title")}
            </h2>
            <p className="text-xs text-slate-700 mt-1 leading-relaxed">
              {t("safety_center_desc")}
            </p>
          </div>
        </Link>
      </div>

      {/* Role & Offline Helper Footer */}
      <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>
            {t("offline_draft_notice")}
          </span>
        </div>
        <span className="font-mono text-[11px] bg-white px-2.5 py-1 rounded border border-emerald-300 text-emerald-900 font-bold shrink-0">
          Role: COLLECTOR (ID: {user?.id ?? "collector_1"})
        </span>
      </div>
    </div>
  );
}

export function RecyclerDashboard() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
        <ShellCard
          title="Recycler dashboard"
          body="Review listed e-waste lots, evaluate confidence scores and fair price ranges, submit commercial purchase offers, schedule physical custody handover, verify weights on digital scales, and issue recycling certificates."
          icon={<Store aria-hidden="true" />}
        />
        <aside className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Authorized Organization
            </p>
            <p className="mt-1 text-xl font-bold text-slate-900">{user?.displayName}</p>
            <p className="text-xs text-slate-600 mt-0.5">Role: <span className="font-bold text-emerald-700">{user?.role}</span></p>
          </div>
          <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
            <Link
              to="/recycler/marketplace"
              className="inline-flex items-center justify-center min-h-11 px-4 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs transition-colors"
            >
              Browse Open E-Waste Lots
            </Link>
            <Link
              to="/prices"
              className="inline-flex items-center justify-center min-h-11 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg text-xs transition-colors"
            >
              Reference Price Guide
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}

export function AdminDashboard() {
  const { user } = useAuth();
  return (
    <div className="grid gap-4 lg:grid-cols-[1.3fr_0.7fr]">
      <ShellCard
        title="Admin dashboard"
        body="Monitor e-waste flows across informal collection hubs, authorized recyclers, and statutory CPCB/EPR compliance metrics. Review flagged lots, high-severity hazards, anomaly detection, and audit timelines."
        icon={<ShieldCheck aria-hidden="true" />}
      />
      <aside className="rounded-xl bg-white p-6 shadow-sm border border-slate-200 space-y-3">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Governance Account
        </p>
        <p className="text-lg font-bold text-slate-900">{user?.displayName}</p>
        <p className="text-xs text-slate-600">State: <span className="font-bold text-indigo-700">Audit Active</span></p>
        <div className="pt-3 border-t border-slate-100">
          <Link
            to="/prices"
            className="inline-flex items-center justify-center w-full min-h-10 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg text-xs"
          >
            Review Reference Catalog
          </Link>
        </div>
      </aside>
    </div>
  );
}