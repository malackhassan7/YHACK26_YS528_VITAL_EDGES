import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";
import type { UserRole } from "../domain/roles";
import { AuthFailurePage, AuthLoadingPage } from "../pages/StatusPages";

export function RequireRole({ allowedRoles, children }: { allowedRoles: readonly UserRole[]; children: React.ReactNode }) {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return <AuthLoadingPage />;
  }

  if (status === "error") {
    return <AuthFailurePage />;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}