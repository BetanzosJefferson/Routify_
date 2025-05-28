import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "@/components/layout/sidebar";

import { Topbar } from "@/components/layout/topbar";
import { RouteList } from "@/components/create-route/route-list";
import { PublishTripForm } from "@/components/publish-trip/publish-trip-form";
import { TripList } from "@/components/trips/trip-list";
import { ReservationList } from "@/components/reservations/reservation-list";
import TripSummary from "@/components/trip-summary/trip-summary";
import { UsersPage } from "@/components/users/users-page";
import VehiclesPage from "@/components/vehicles/vehicles-page";
import CommissionsPage from "@/components/commissions/commissions-page";
import { BoardingList } from "@/components/boarding-list/boarding-list";
import { PassengerTransferPage } from "@/components/passenger-transfer/passenger-transfer-page";
import { UserCashBoxesPage } from "@/components/user-cash-boxes/user-cash-boxes-page";
import { TabType } from "@/hooks/use-active-tab";
import { useAuth } from "@/hooks/use-auth";
import { hasAccessToSection } from "@/lib/role-based-permissions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

export default function Dashboard() {
  const [location] = useLocation();
  // Establecemos tab por defecto basado en el rol del usuario
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>(
    // Para choferes, la sección por defecto es boarding-list
    // Para comisionistas, la sección por defecto es trips
    // Para taquilla, la sección por defecto es trips
    // Para checador, la sección por defecto es trips
    // Para call center, la sección por defecto es trips
    user?.role === 'chofer' ? "boarding-list" : 
    user?.role === 'comisionista' ? "trips" :
    user?.role === 'taquilla' ? "trips" :
    user?.role === 'checador' ? "trips" :
    user?.role === 'callCenter' ? "trips" : "create-route"
  );
  
  // Update active tab when URL changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as TabType | null;
    
    if (tab && ["create-route", "publish-trip", "trips", "reservations", "trip-summary", "users", "vehicles", "commissions", "boarding-list"].includes(tab)) {
      // Solo actualizar si el usuario tiene acceso a esta sección
      if (user && hasAccessToSection(user.role, tab)) {
        setActiveTab(tab);
      } else {
        // Si no tiene acceso, buscar la primera sección a la que sí tenga acceso
        const accessibleSections = [
          "create-route", "publish-trip", "trips", "reservations", 
          "trip-summary", "boarding-list", "users", "vehicles", "commissions"
        ].filter(section => hasAccessToSection(user?.role || "", section));
        
        if (accessibleSections.length > 0) {
          setActiveTab(accessibleSections[0] as TabType);
          
          // Actualizar la URL para reflejar la sección a la que sí tiene acceso
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set('tab', accessibleSections[0]);
          window.history.replaceState({}, '', newUrl.toString());
        }
      }
    }
  }, [location, user]);
  
  // Verificar si el usuario tiene acceso a la sección actual
  const canAccess = (sectionId: string): boolean => {
    if (!user) return false;
    return hasAccessToSection(user.role, sectionId);
  };
  
  // Tab change handler for child components
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };
  
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <Topbar activeTab={activeTab} onTabChange={handleTabChange} />
        
        <div className="flex-1 overflow-auto focus:outline-none">
          <main className="relative z-0 flex-1 overflow-y-auto py-6 px-4 sm:px-6 lg:px-8">
            {/* Se eliminó TabNavigation para no duplicar la navegación */}
            
            {activeTab === "create-route" && canAccess("routes") ? (
              <RouteList />
            ) : activeTab === "create-route" && (
              <AccessDeniedAlert />
            )}
            
            {activeTab === "publish-trip" && canAccess("publish-trip") ? (
              <PublishTripForm />
            ) : activeTab === "publish-trip" && (
              <AccessDeniedAlert />
            )}
            
            {activeTab === "trips" && canAccess("trips") ? (
              <TripList />
            ) : activeTab === "trips" && (
              <AccessDeniedAlert />
            )}
            
            {activeTab === "reservations" && canAccess("reservations") ? (
              <ReservationList />
            ) : activeTab === "reservations" && (
              <AccessDeniedAlert />
            )}
            
            {activeTab === "trip-summary" && canAccess("trip-summary") ? (
              <TripSummary />
            ) : activeTab === "trip-summary" && (
              <AccessDeniedAlert />
            )}
            
            {activeTab === "boarding-list" && canAccess("boarding-list") ? (
              <BoardingList />
            ) : activeTab === "boarding-list" && (
              <AccessDeniedAlert />
            )}
            
            {activeTab === "users" && canAccess("users") ? (
              <UsersPage />
            ) : activeTab === "users" && (
              <AccessDeniedAlert />
            )}
            
            {activeTab === "vehicles" && canAccess("vehicles") ? (
              <VehiclesPage />
            ) : activeTab === "vehicles" && (
              <AccessDeniedAlert />
            )}
            
            {activeTab === "commissions" && canAccess("commissions") ? (
              <CommissionsPage />
            ) : activeTab === "commissions" && (
              <AccessDeniedAlert />
            )}
            
            {activeTab === "passenger-transfer" && canAccess("passenger-transfer") ? (
              <PassengerTransferPage />
            ) : activeTab === "passenger-transfer" && (
              <AccessDeniedAlert />
            )}
            
            {activeTab === "user-cash-boxes" && canAccess("user-cash-boxes") ? (
              <UserCashBoxesPage />
            ) : activeTab === "user-cash-boxes" && (
              <AccessDeniedAlert />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

// Componente para mostrar una alerta de acceso denegado
function AccessDeniedAlert() {
  return (
    <Alert variant="destructive" className="mb-6">
      <AlertCircle className="h-4 w-4 mr-2" />
      <AlertTitle>Acceso Denegado</AlertTitle>
      <AlertDescription>
        No tienes permisos para acceder a esta sección. Contacta al administrador si crees que deberías tener acceso.
      </AlertDescription>
    </Alert>
  );
}
