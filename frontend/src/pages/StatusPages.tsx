import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function LandingPage() {
  const { user, status } = useAuth();
  const target = user?.role === "COLLECTOR" ? "/collector" : user?.role === "RECYCLER" ? "/recycler" : user?.role === "ADMIN" ? "/admin" : "/login";

  return (
    <section className="rounded-lg bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Foundation build</p>
      <h1 className="mt-2 text-3xl font-bold">Vital Edges</h1>
      <p className="mt-3 max-w-2xl text-slate-600">A formal e-waste lot workflow for proof, price, match, handover, payout, and recycling evidence. Phase 1 establishes routing, auth, backend health, and data foundations.</p>
      <Link className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-emerald-700 px-5 font-semibold text-white" to={target}>{status === "authenticated" ? "Go to dashboard" : "Sign in"}</Link>
    </section>
  );
}

export function UnauthorizedPage() {
  const { user } = useAuth();
  return (
    <section className="rounded-lg bg-white p-6 shadow-sm" role="alert">
      <h1 className="text-2xl font-bold">You do not have access to this area.</h1>
      <p className="mt-3 text-slate-600">Your current role is {user?.role ?? "not signed in"}. Use the correct demo account for this dashboard.</p>
      <Link className="mt-6 inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 font-medium" to="/login">Return to login</Link>
    </section>
  );
}

export function NotFoundPage() {
  return (
    <section className="rounded-lg bg-white p-6 shadow-sm" role="alert">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-3 text-slate-600">This route is not part of the Phase 1 foundation.</p>
      <Link className="mt-6 inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 font-medium" to="/">Go home</Link>
    </section>
  );
}

export function AuthLoadingPage() {
  return <section className="rounded-lg bg-white p-6 shadow-sm" role="status">Loading your session...</section>;
}

export function AuthFailurePage() {
  const { error, reloadSession, signOut } = useAuth();
  const location = useLocation();
  return (
    <section className="rounded-lg bg-white p-6 shadow-sm" role="alert">
      <h1 className="text-2xl font-bold">Session could not be loaded</h1>
      <p className="mt-3 text-red-700">{error}</p>
      <p className="mt-2 text-sm text-slate-600">Route: {location.pathname}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <button className="min-h-11 rounded-lg bg-emerald-700 px-4 font-medium text-white" onClick={() => void reloadSession()} type="button">Retry</button>
        <button className="min-h-11 rounded-lg border border-slate-300 px-4 font-medium" onClick={signOut} type="button">Clear session</button>
      </div>
    </section>
  );
}