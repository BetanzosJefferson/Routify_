import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { TabNavigation } from "@/components/layout/tab-navigation";
import { CreateRouteForm } from "@/components/create-route/create-route-form";
import { PublishTripForm } from "@/components/publish-trip/publish-trip-form";
import { TripList } from "@/components/trips/trip-list";
import { ReservationList } from "@/components/reservations/reservation-list";
import { useActiveTab } from "@/hooks/use-active-tab";

export default function Dashboard() {
  const { activeTab } = useActiveTab();
  
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <MobileNav />
        
        <div className="flex-1 overflow-auto focus:outline-none">
          <main className="relative z-0 flex-1 overflow-y-auto py-6 px-4 sm:px-6 lg:px-8">
            <TabNavigation />
            
            {activeTab === "create-route" && <CreateRouteForm />}
            {activeTab === "publish-trip" && <PublishTripForm />}
            {activeTab === "trips" && <TripList />}
            {activeTab === "reservations" && <ReservationList />}
          </main>
        </div>
      </div>
    </div>
  );
}
