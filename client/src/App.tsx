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
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import AuthPage from "@/pages/auth-page";
import RegisterPage from "@/pages/register-page";
import PassengerListPage from "@/pages/passenger-list-page";
import ReservationDetails from "@/pages/reservation-details";
import CouponsPage from "@/pages/coupons-page";
import { UsersPage } from "@/components/users/users-page";

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute path="/trip/:tripId/passengers" component={PassengerListPage} />
      <ProtectedRoute path="/cupones" component={CouponsPage} requiredRoles={['OWNER', 'SUPER_ADMIN']} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/register/:token" component={RegisterPage} />
      <Route path="/reservation-details" component={ReservationDetails} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DataLoaderProvider>
        <AuthProvider>
          <ThemeProvider>
            <TooltipProvider>
              <Toaster />
              <Router />
            </TooltipProvider>
          </ThemeProvider>
        </AuthProvider>
      </DataLoaderProvider>
    </QueryClientProvider>
  );
}

export default App;
