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
import CashBoxPage from "@/pages/cash-box";
import CutoffHistoryPage from "@/pages/cutoff-history";
// Temporalmente deshabilitado
// import PassengerTransferPageRoute from "@/pages/passenger-transfer-page";
import BoardingListPageRoute from "@/pages/boarding-list-page";
import TripLogPageRoute from "@/pages/trip-log-page";
import UsersPageRoute from "@/pages/users-page";
import VehiclesPageRoute from "@/pages/vehicles-page";
import ReservationsPageRoute from "@/pages/reservations-page";
import RoutesPageRoute from "@/pages/routes-page";
import PublishTripPageRoute from "@/pages/publish-trip-page";
import TripsPageRoute from "@/pages/trips-page";
import UserCashBoxesPageRoute from "@/pages/user-cash-boxes-page";

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
      <ProtectedRoute path="/cash-box" component={CashBoxPage} />
      <ProtectedRoute path="/cutoff-history" component={CutoffHistoryPage} />
      <ProtectedRoute path="/edit-trip/:id" component={EditTripPage} />
      {/* Temporalmente deshabilitada la ruta de transferencia de pasajeros
      <ProtectedRoute path="/passenger-transfer" component={PassengerTransferPageRoute} /> */}
      <ProtectedRoute path="/boarding-list" component={BoardingListPageRoute} />
      <ProtectedRoute path="/trip-log" component={TripLogPageRoute} />
      <ProtectedRoute path="/users" component={UsersPageRoute} />
      <ProtectedRoute path="/vehicles" component={VehiclesPageRoute} />
      <ProtectedRoute path="/reservations" component={ReservationsPageRoute} />
      <ProtectedRoute path="/routes" component={RoutesPageRoute} />
      <ProtectedRoute path="/publish-trip" component={PublishTripPageRoute} />
      <ProtectedRoute path="/trips" component={TripsPageRoute} />
      <ProtectedRoute path="/user-cash-boxes" component={UserCashBoxesPageRoute} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/register/:token" component={RegisterPage} />
      <Route path="/reservation-details" component={ReservationDetails} />
      <Route path="/reservation-details/:id" component={ReservationDetails} />
      <Route path="/package/:id" component={PackageDetailPage} />
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
