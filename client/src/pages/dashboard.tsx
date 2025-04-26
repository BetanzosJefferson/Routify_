import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
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
import { TabType } from "@/hooks/use-active-tab";
import { useAuth } from "@/hooks/use-auth";

export default function Dashboard() {
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("create-route");
  
  // Update active tab when URL changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as TabType | null;
    
    if (tab && ["create-route", "publish-trip", "trips", "reservations", "trip-summary", "users", "vehicles", "commissions", "boarding-list"].includes(tab)) {
      setActiveTab(tab);
    }
  }, [location]);
  
  // Tab change handler for child components
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };
  
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <MobileNav activeTab={activeTab} onTabChange={handleTabChange} />
        <Topbar />
        
        <div className="flex-1 overflow-auto focus:outline-none">
          <main className="relative z-0 flex-1 overflow-y-auto py-6 px-4 sm:px-6 lg:px-8">
            {/* Se eliminó TabNavigation para no duplicar la navegación */}
            
            {activeTab === "create-route" && <RouteList />}
            {activeTab === "publish-trip" && <PublishTripForm />}
            {activeTab === "trips" && <TripList />}
            {activeTab === "reservations" && <ReservationList />}
            {activeTab === "trip-summary" && <TripSummary />}
            {activeTab === "boarding-list" && <BoardingList />}
            {activeTab === "users" && <UsersPage />}
            {activeTab === "vehicles" && <VehiclesPage />}
            {activeTab === "commissions" && <CommissionsPage />}
          </main>
        </div>
      </div>
    </div>
  );
}
