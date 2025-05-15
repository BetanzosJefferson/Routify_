import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/lib/theme-provider";
import { ProtectedRoute } from "@/lib/protected-route";
import { DataLoaderProvider } from "@/hooks/use-data-loader";
import { NotificationsProvider } from "@/components/notifications/notifications-provider";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import AuthPage from "@/pages/auth-page";
import RegisterPage from "@/pages/register-page";
import PassengerListPage from "@/pages/passenger-list-page";
import ReservationDetails from "@/pages/reservation-details";
import CommissionsPage from "@/pages/commissions-page";
import MyCommissionsPage from "@/pages/my-commissions-page";
import ReservationRequestsPage from "@/pages/reservation-requests-page";
import NotificationsPage from "@/pages/notifications-page";
import CouponsPage from "@/pages/coupons-page";
import PackagesPage from "@/pages/packages-page";
import PackageDetailPage from "@/pages/package-detail-page";
import EditTripPage from "@/pages/edit-trip-page";
import CashRegisterPageRoute from "@/pages/cash-register-page";
import TransfersPage from "@/pages/transfers-page";
import VerifyCompanyLinkPage from "@/pages/verify-company-link-page";
import { UsersPage } from "@/components/users/users-page";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/trip/:tripId/passengers" component={PassengerListPage} />
      <ProtectedRoute path="/commissions" component={CommissionsPage} />
      <ProtectedRoute path="/my-commissions" component={MyCommissionsPage} />
      <ProtectedRoute path="/reservation-requests" component={ReservationRequestsPage} />
      <ProtectedRoute path="/notifications" component={NotificationsPage} />
      <ProtectedRoute path="/coupons" component={CouponsPage} />
      <ProtectedRoute path="/packages" component={PackagesPage} />
      <ProtectedRoute path="/cash-register" component={CashRegisterPageRoute} />
      <ProtectedRoute path="/edit-trip/:id" component={EditTripPage} />
      <ProtectedRoute path="/transfers" component={TransfersPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/register/:token" component={RegisterPage} />
      <Route path="/reservation-details" component={ReservationDetails} />
      <Route path="/reservation-details/:id" component={ReservationDetails} />
      <Route path="/package/:id" component={PackageDetailPage} />
      <Route path="/verify-company-link/:token" component={VerifyCompanyLinkPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DataLoaderProvider>
        <AuthProvider>
          <NotificationsProvider>
            <ThemeProvider>
              <TooltipProvider>
                <Toaster />
                <Router />
              </TooltipProvider>
            </ThemeProvider>
          </NotificationsProvider>
        </AuthProvider>
      </DataLoaderProvider>
    </QueryClientProvider>
  );
}

export default App;
