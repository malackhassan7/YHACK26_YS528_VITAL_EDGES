import { Link, NavLink, Outlet } from "react-router-dom";
import { LogOut, Recycle } from "lucide-react";
import { HealthBadge } from "../components/HealthBadge";
import { useAuth } from "../auth/AuthContext";

const navByRole = {
  COLLECTOR: [{ to: "/collector", label: "Collector home" }],
  RECYCLER: [{ to: "/recycler", label: "Recycler home" }],
  ADMIN: [{ to: "/admin", label: "Admin home" }],
} as const;

export function AppLayout() {
  const { user, signOut } = useAuth();
  const navItems = user ? navByRole[user.role] : [];

  return (
    <div className="min-h-screen bg-[#f7faf7] text-slate-950">
      <header className="border-b border-emerald-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="flex items-center gap-3 text-lg font-semibold">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-700 text-white">
              <Recycle aria-hidden="true" size={22} />
            </span>
            Vital Edges
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <HealthBadge />
            {user ? <span className="text-sm text-slate-600">{user.displayName} · {user.role}</span> : null}
            {user ? (
              <button className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium" onClick={signOut} type="button">
                <LogOut aria-hidden="true" size={16} /> Logout
              </button>
            ) : null}
          </div>
        </div>
        {navItems.length > 0 ? (
          <nav className="mx-auto flex max-w-6xl gap-2 px-4 pb-4" aria-label="Primary">
            {navItems.map((item) => (
              <NavLink key={item.to} to={item.to} className={({ isActive }) => `rounded-lg px-4 py-2 text-sm font-medium ${isActive ? "bg-emerald-700 text-white" : "bg-emerald-50 text-emerald-900"}`}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        ) : null}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}