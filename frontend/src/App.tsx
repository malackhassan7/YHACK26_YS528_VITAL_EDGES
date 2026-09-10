import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { LanguageProvider } from "./i18n/LanguageContext";
import { RequireRole } from "./auth/RequireRole";
import { AppLayout } from "./layouts/AppLayout";
import { AdminDashboard, CollectorDashboard } from "./pages/DashboardPages";
import { LandingPage, LoginPage, NotFoundPage, UnauthorizedPage } from "./pages";
import { CollectorLotsPage } from "./pages/CollectorLotsPage";
import { LotDetailsPage } from "./pages/LotDetailsPage";
import { LotMatchesPage } from "./pages/LotMatchesPage";
import { LotPricePage } from "./pages/LotPricePage";
import { LotVerificationPage } from "./pages/LotVerificationPage";
import { LotWizardPage } from "./pages/LotWizardPage";
import { NewLotPage } from "./pages/NewLotPage";
import { RecyclerMarketplacePage } from "./pages/RecyclerMarketplacePage";
import { RecyclerLotReviewPage } from "./pages/RecyclerLotReviewPage";
import { CollectorOffersPage } from "./pages/CollectorOffersPage";
import { TransactionPage } from "./pages/TransactionPage";
import { PriceCatalogPage } from "./pages/PriceCatalogPage";
import { SafetyCenterPage } from "./pages/SafetyCenterPage";
import { CollectorEarningsPage } from "./pages/CollectorEarningsPage";

const queryClient = new QueryClient();

function RoleRedirect() {
  const { user, status } = useAuth();
  if (status === "loading") return null;
  if (!user) return <Navigate to="/login" replace />;
  const target =
    user.role === "COLLECTOR"
      ? "/collector"
      : user.role === "RECYCLER"
      ? "/recycler"
      : "/admin";
  return <Navigate to={target} replace />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/dashboard" element={<RoleRedirect />} />

              {/* Public / Common Reference Pages */}
              <Route path="/prices" element={<PriceCatalogPage />} />
              <Route path="/safety" element={<SafetyCenterPage />} />

              {/* Collector Routes */}
              <Route
                path="/collector"
                element={
                  <RequireRole allowedRoles={["COLLECTOR"]}>
                    <CollectorDashboard />
                  </RequireRole>
                }
              />
              <Route
                path="/collector/prices"
                element={
                  <RequireRole allowedRoles={["COLLECTOR"]}>
                    <PriceCatalogPage />
                  </RequireRole>
                }
              />
              <Route
                path="/collector/safety"
                element={
                  <RequireRole allowedRoles={["COLLECTOR"]}>
                    <SafetyCenterPage />
                  </RequireRole>
                }
              />
              <Route
                path="/collector/earnings"
                element={
                  <RequireRole allowedRoles={["COLLECTOR"]}>
                    <CollectorEarningsPage />
                  </RequireRole>
                }
              />
              <Route
                path="/collector/lots"
                element={
                  <RequireRole allowedRoles={["COLLECTOR"]}>
                    <CollectorLotsPage />
                  </RequireRole>
                }
              />
              <Route
                path="/collector/lots/new"
                element={
                  <RequireRole allowedRoles={["COLLECTOR"]}>
                    <NewLotPage />
                  </RequireRole>
                }
              />
              <Route
                path="/collector/lots/:lotId/edit"
                element={
                  <RequireRole allowedRoles={["COLLECTOR"]}>
                    <LotWizardPage />
                  </RequireRole>
                }
              />
              <Route
                path="/collector/lots/:lotId/verify"
                element={
                  <RequireRole allowedRoles={["COLLECTOR"]}>
                    <LotVerificationPage />
                  </RequireRole>
                }
              />
              <Route
                path="/collector/lots/:lotId/price"
                element={
                  <RequireRole allowedRoles={["COLLECTOR"]}>
                    <LotPricePage />
                  </RequireRole>
                }
              />
              <Route
                path="/collector/lots/:lotId/matches"
                element={
                  <RequireRole allowedRoles={["COLLECTOR"]}>
                    <LotMatchesPage />
                  </RequireRole>
                }
              />
              <Route
                path="/collector/lots/:lotId/offers"
                element={
                  <RequireRole allowedRoles={["COLLECTOR"]}>
                    <CollectorOffersPage />
                  </RequireRole>
                }
              />
              <Route
                path="/collector/lots/:lotId/transaction"
                element={
                  <RequireRole allowedRoles={["COLLECTOR"]}>
                    <TransactionPage />
                  </RequireRole>
                }
              />
              <Route
                path="/collector/lots/:lotId"
                element={
                  <RequireRole allowedRoles={["COLLECTOR"]}>
                    <LotDetailsPage />
                  </RequireRole>
                }
              />

              {/* Recycler Routes */}
              <Route
                path="/recycler"
                element={
                  <RequireRole allowedRoles={["RECYCLER"]}>
                    <RecyclerMarketplacePage />
                  </RequireRole>
                }
              />
              <Route
                path="/recycler/marketplace"
                element={
                  <RequireRole allowedRoles={["RECYCLER"]}>
                    <RecyclerMarketplacePage />
                  </RequireRole>
                }
              />
              <Route
                path="/recycler/lots/:lotId"
                element={
                  <RequireRole allowedRoles={["RECYCLER"]}>
                    <RecyclerLotReviewPage />
                  </RequireRole>
                }
              />

              {/* Shared Transaction View */}
              <Route
                path="/transactions/:transactionId"
                element={
                  <RequireRole allowedRoles={["COLLECTOR", "RECYCLER", "ADMIN"]}>
                    <TransactionPage />
                  </RequireRole>
                }
              />

              {/* Admin Routes */}
              <Route
                path="/admin"
                element={
                  <RequireRole allowedRoles={["ADMIN"]}>
                    <AdminDashboard />
                  </RequireRole>
                }
              />
              <Route path="/unauthorized" element={<UnauthorizedPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}