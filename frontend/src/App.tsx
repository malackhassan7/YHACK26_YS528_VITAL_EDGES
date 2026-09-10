import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { RequireRole } from "./auth/RequireRole";
import { AppLayout } from "./layouts/AppLayout";
import { AdminDashboard, CollectorDashboard, RecyclerDashboard } from "./pages/DashboardPages";
import { LandingPage, LoginPage, NotFoundPage, UnauthorizedPage } from "./pages";

const queryClient = new QueryClient();

function RoleRedirect() {
  const { user, status } = useAuth();
  if (status === "loading") {
    return null;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  const target = user.role === "COLLECTOR" ? "/collector" : user.role === "RECYCLER" ? "/recycler" : "/admin";
  return <Navigate to={target} replace />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/dashboard" element={<RoleRedirect />} />
            <Route path="/collector" element={<RequireRole allowedRoles={["COLLECTOR"]}><CollectorDashboard /></RequireRole>} />
            <Route path="/recycler" element={<RequireRole allowedRoles={["RECYCLER"]}><RecyclerDashboard /></RequireRole>} />
            <Route path="/admin" element={<RequireRole allowedRoles={["ADMIN"]}><AdminDashboard /></RequireRole>} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </QueryClientProvider>
  );
}