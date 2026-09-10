import { ShieldCheck, Store, Truck } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

function ShellCard({ title, body, icon }: { title: string; body: string; icon: React.ReactNode }) {
  return (
    <section className="rounded-lg bg-white p-6 shadow-sm">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-lg bg-emerald-100 text-emerald-800">{icon}</div>
      <h1 className="text-2xl font-bold text-slate-950">{title}</h1>
      <p className="mt-3 max-w-2xl text-slate-600">{body}</p>
    </section>
  );
}

export function CollectorDashboard() {
  const { user } = useAuth();
  return (
    <div className="grid gap-4 sm:grid-cols-[1.3fr_0.7fr]">
      <ShellCard title="Collector dashboard" body="Phase 1 foundation is ready. The next phase will add offline draft lots, evidence capture, and sync status without changing this protected shell." icon={<Truck aria-hidden="true" />} />
      <aside className="rounded-lg bg-emerald-50 p-5 text-emerald-950">
        <p className="text-sm font-semibold">Current role</p>
        <p className="mt-2 text-xl font-bold">{user?.role}</p>
        <p className="mt-4 text-sm">Future lot workflow entry point: create a Digital E-Waste Lot.</p>
      </aside>
    </div>
  );
}

export function RecyclerDashboard() {
  const { user } = useAuth();
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <ShellCard title="Recycler dashboard" body="Marketplace, offers, receipt, weight verification, and recycling evidence will be added in later phases after the domain foundation remains stable." icon={<Store aria-hidden="true" />} />
      <aside className="rounded-lg bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-600">Current role</p>
        <p className="mt-2 text-xl font-bold">{user?.role}</p>
        <p className="mt-4 text-slate-600">Future marketplace entry point: review listed lots and submit explicit offers.</p>
      </aside>
    </div>
  );
}

export function AdminDashboard() {
  const { user } = useAuth();
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <ShellCard title="Admin dashboard" body="Oversight tools for recycler authorization, anomaly review, and audit timelines will be implemented only after the golden-path foundations are in place." icon={<ShieldCheck aria-hidden="true" />} />
      <aside className="rounded-lg bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-slate-600">Current role</p>
        <p className="mt-2 text-xl font-bold">{user?.role}</p>
        <p className="mt-4 text-slate-600">Future oversight entry point: review authorizations, anomalies, lots, and transactions.</p>
      </aside>
    </div>
  );
}