import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

type TabType = "create-route" | "publish-trip" | "trips" | "reservations";

interface TabNavigationProps {
  className?: string;
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function TabNavigation({ className, activeTab, onTabChange }: TabNavigationProps) {
  const [, setLocation] = useLocation();
  
  const handleTabClick = (tab: TabType) => {
    onTabChange(tab);
    setLocation(`/dashboard?tab=${tab}`);
  };
  
  return (
    <div className={cn("block", className)}>
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <TabItem 
            active={activeTab === "create-route"}
            onClick={() => handleTabClick("create-route")}
          >
            Rutas
          </TabItem>
          <TabItem 
            active={activeTab === "publish-trip"}
            onClick={() => handleTabClick("publish-trip")}
          >
            Gestión de Viajes
          </TabItem>
          <TabItem 
            active={activeTab === "trips"}
            onClick={() => handleTabClick("trips")}
          >
            Viajes
          </TabItem>
          <TabItem 
            active={activeTab === "reservations"}
            onClick={() => handleTabClick("reservations")}
          >
            Reservaciones
          </TabItem>
        </nav>
      </div>
    </div>
  );
}

interface TabItemProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabItem({ active, onClick, children }: TabItemProps) {
  return (
    <div 
      className={cn(
        "py-4 px-1 text-sm font-medium cursor-pointer",
        active 
          ? "text-primary border-b-2 border-primary" 
          : "text-gray-500 border-b-2 border-transparent hover:text-gray-700 hover:border-gray-300"
      )}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
