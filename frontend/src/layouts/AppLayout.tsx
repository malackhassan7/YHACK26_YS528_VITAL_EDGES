import { useEffect, useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { LogOut, Recycle, WifiOff } from "lucide-react";
import { HealthBadge } from "../components/HealthBadge";
import { useAuth } from "../auth/AuthContext";
import { LanguageSwitcher, useLanguage } from "../i18n/LanguageContext";

export function AppLayout() {
  const { user, signOut } = useAuth();
  const { t } = useLanguage();
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const getNavItems = () => {
    if (!user) {
      return [
        { to: "/prices", label: t("nav_prices") },
        { to: "/safety", label: t("nav_safety") },
      ];
    }
    if (user.role === "COLLECTOR") {
      return [
        { to: "/collector", label: t("nav_collector_home") },
        { to: "/collector/lots", label: t("nav_my_lots") },
        { to: "/collector/prices", label: t("nav_prices") },
        { to: "/collector/earnings", label: t("nav_earnings") },
        { to: "/collector/safety", label: t("nav_safety") },
      ];
    }
    if (user.role === "RECYCLER") {
      return [
        { to: "/recycler", label: t("nav_recycler_home") },
        { to: "/prices", label: t("nav_prices") },
        { to: "/safety", label: t("nav_safety") },
      ];
    }
    return [{ to: "/admin", label: t("nav_admin_home") }];
  };

  const navItems = getNavItems();

  return (
    <div className="min-h-screen bg-[#f7faf7] text-slate-950">
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          className="bg-amber-600 text-white text-xs px-4 py-2 font-semibold flex items-center justify-center gap-2 sticky top-0 z-50 shadow"
        >
          <WifiOff className="w-4 h-4 shrink-0" />
          <span>{t("offline_banner")}</span>
        </div>
      )}

      <header className="border-b border-emerald-100 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link to="/" className="flex items-center gap-3 text-lg font-semibold">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-700 text-white">
              <Recycle aria-hidden="true" size={22} />
            </span>
            <span className="tracking-tight font-bold">Vital Edges</span>
          </Link>

          <div className="flex flex-wrap items-center gap-3">
            <LanguageSwitcher />
            <HealthBadge />
            {user ? (
              <span className="text-xs sm:text-sm text-slate-600 font-medium">
                {user.displayName} •{" "}
                <span className="text-emerald-700 font-bold">{user.role}</span>
              </span>
            ) : null}
            {user ? (
              <button
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs sm:text-sm font-medium hover:bg-slate-50 transition-colors"
                onClick={signOut}
                type="button"
              >
                <LogOut aria-hidden="true" size={15} /> {t("logout")}
              </button>
            ) : null}
          </div>
        </div>

        {navItems.length > 0 ? (
          <nav
            className="mx-auto flex max-w-6xl flex-wrap gap-2 px-4 pb-4"
            aria-label="Primary"
          >
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-colors min-h-10 flex items-center ${
                    isActive
                      ? "bg-emerald-700 text-white shadow-sm"
                      : "bg-emerald-50 text-emerald-900 hover:bg-emerald-100"
                  }`
                }
              >
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