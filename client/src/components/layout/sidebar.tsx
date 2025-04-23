import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { 
  MapIcon, 
  ClockIcon, 
  BuildingIcon, 
  UserIcon 
} from "lucide-react";

interface NavItemProps {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  active: boolean;
}

const NavItem = ({ href, icon, children, active }: NavItemProps) => {
  return (
    <Link href={href}>
      <a 
        className={cn(
          "flex items-center px-4 py-2 text-sm font-medium rounded-md",
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
      </a>
    </Link>
  );
};

export function Sidebar() {
  const [location] = useLocation();
  
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
              href="/dashboard?tab=create-route" 
              icon={<MapIcon />} 
              active={location.includes("create-route") || location === "/dashboard"}
            >
              Create Route
            </NavItem>
            <NavItem 
              href="/dashboard?tab=publish-trip" 
              icon={<ClockIcon />} 
              active={location.includes("publish-trip")}
            >
              Publish Trip
            </NavItem>
            <NavItem 
              href="/dashboard?tab=trips" 
              icon={<BuildingIcon />} 
              active={location.includes("trips") && !location.includes("publish-trip")}
            >
              Trips
            </NavItem>
            <NavItem 
              href="/dashboard?tab=reservations" 
              icon={<UserIcon />} 
              active={location.includes("reservations")}
            >
              Reservations
            </NavItem>
          </nav>
        </div>
      </div>
    </div>
  );
}
