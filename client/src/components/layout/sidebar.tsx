import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  MapIcon, 
  ClockIcon, 
  BuildingIcon, 
  UserIcon 
} from "lucide-react";

type TabType = "create-route" | "publish-trip" | "trips" | "reservations";

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

interface NavItemProps {
  icon: React.ReactNode;
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}

const NavItem = ({ icon, children, active, onClick }: NavItemProps) => {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "flex items-center px-4 py-2 text-sm font-medium rounded-md cursor-pointer",
        active 
          ? "text-gray-900 bg-gray-100" 
          : "text-gray-700 hover:bg-gray-100"
      )}
    >
      <div className={cn(
        "h-5 w-5 mr-3",
        active ? "text-primary" : "text-gray-500"
      )}>
        {icon}
      </div>
      {children}
    </div>
  );
};

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [, setLocation] = useLocation();
  
  const handleTabClick = (tab: TabType) => {
    onTabChange(tab);
    setLocation(`/dashboard?tab=${tab}`);
  };
  
  return (
    <div className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-64 bg-white border-r border-gray-200">
        <div className="px-6 pt-6 pb-4">
          <h1 className="text-2xl font-semibold text-gray-800">TransRoute</h1>
          <p className="text-sm text-gray-500">Route Management System</p>
        </div>
        <div className="flex-1 flex flex-col overflow-y-auto">
          <nav className="flex-1 px-2 py-4 space-y-2">
            <NavItem 
              icon={<MapIcon />} 
              active={activeTab === "create-route"}
              onClick={() => handleTabClick("create-route")}
            >
              Create Route
            </NavItem>
            <NavItem 
              icon={<ClockIcon />} 
              active={activeTab === "publish-trip"}
              onClick={() => handleTabClick("publish-trip")}
            >
              Publish Trip
            </NavItem>
            <NavItem 
              icon={<BuildingIcon />} 
              active={activeTab === "trips"}
              onClick={() => handleTabClick("trips")}
            >
              Trips
            </NavItem>
            <NavItem 
              icon={<UserIcon />} 
              active={activeTab === "reservations"}
              onClick={() => handleTabClick("reservations")}
            >
              Reservations
            </NavItem>
          </nav>
        </div>
      </div>
    </div>
  );
}
