import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { TabNavigation } from "@/components/layout/tab-navigation";
import { RouteList } from "@/components/create-route/route-list";
import { PublishTripForm } from "@/components/publish-trip/publish-trip-form";
import { TripList } from "@/components/trips/trip-list";
import { ReservationList } from "@/components/reservations/reservation-list";

type TabType = "create-route" | "publish-trip" | "trips" | "reservations";

export default function Dashboard() {
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("create-route");
  
  // Update active tab when URL changes
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab") as TabType | null;
    
    if (tab && ["create-route", "publish-trip", "trips", "reservations"].includes(tab)) {
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
        
        <div className="flex-1 overflow-auto focus:outline-none">
          <main className="relative z-0 flex-1 overflow-y-auto py-6 px-4 sm:px-6 lg:px-8">
            <TabNavigation activeTab={activeTab} onTabChange={handleTabChange} />
            
            {activeTab === "create-route" && <RouteList />}
            {activeTab === "publish-trip" && <PublishTripForm />}
            {activeTab === "trips" && <TripList />}
            {activeTab === "reservations" && <ReservationList />}
          </main>
        </div>
      </div>
    </div>
  );
}
