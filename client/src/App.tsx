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
import LoginPage from "@/pages/login-page";
import RegisterPage from "@/pages/register-page";
import PassengerListPage from "@/pages/passenger-list-page";
import { UsersPage } from "@/components/users/users-page";
import { UserRole } from "@shared/schema";

// Importamos el componente BoardingList
import { BoardingList } from "@/components/boarding-list/boarding-list";

// Componente simple para la página de abordaje
const BoardingListPage = () => (
  <div className="container mx-auto px-4 py-8">
    <BoardingList />
  </div>
);

function Router() {
  return (
    <Switch>
      <ProtectedRoute path="/" component={Dashboard} />
      <ProtectedRoute path="/dashboard" component={Dashboard} />
      <ProtectedRoute 
        path="/boarding" 
        component={BoardingListPage} 
        allowedRoles={[UserRole.CHECKER, UserRole.ADMIN, UserRole.COMPANY_OWNER]} 
      />
      <ProtectedRoute 
        path="/trip/:tripId/passengers" 
        component={PassengerListPage} 
        allowedRoles={[UserRole.TICKET_OFFICE, UserRole.CALL_CENTER, UserRole.ADMIN, UserRole.COMPANY_OWNER]}
      />
      <ProtectedRoute 
        path="/users" 
        component={UsersPage} 
        allowedRoles={[UserRole.SUPER_ADMIN, UserRole.COMPANY_OWNER, UserRole.ADMIN]} 
      />
      <Route path="/login" component={LoginPage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/register/:token" component={RegisterPage} />
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
