import React from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { TabType } from "@/hooks/use-active-tab";
import { 
  MapIcon, 
  ClockIcon, 
  BuildingIcon, 
  UserIcon, 
  CarIcon, 
  HomeIcon, 
  Settings2,
  ClipboardListIcon
} from "lucide-react";

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

interface NavItemProps {
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function NavItem({ icon, active, onClick, children }: NavItemProps) {
  return (
    <button
      className={cn(
        "group flex items-center w-full px-3 py-2.5 rounded-md font-medium transition-all duration-200",
        active
          ? "bg-primary text-primary-foreground hover:bg-primary/90"
          : "text-gray-700 hover:text-primary hover:bg-primary/10"
      )}
      onClick={onClick}
    >
      <span className={cn("mr-3", active ? "text-white" : "text-gray-500 group-hover:text-primary")}>{icon}</span>
      <span>{children}</span>
    </button>
  );
}

interface NavSectionProps {
  title: string;
  children: React.ReactNode;
}

function NavSection({ title, children }: NavSectionProps) {
  return (
    <div className="mb-6">
      <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [, setLocation] = useLocation();
  
  const handleTabClick = (tab: TabType) => {
    onTabChange(tab);
    setLocation(`/dashboard?tab=${tab}`);
  };
  
  return (
    <div className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-64 bg-white border-r border-gray-200">
        <div className="px-6 pt-6 pb-4 flex items-center">
          <div className="h-9 w-9 rounded-md bg-primary flex items-center justify-center mr-3">
            <CarIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-800">TransRoute</h1>
            <p className="text-xs text-gray-500">Sistema de Gestión</p>
          </div>
        </div>
        
        <div className="flex-1 flex flex-col overflow-y-auto pt-5 px-3">
          <NavSection title="General">
            <NavItem 
              icon={<HomeIcon className="h-5 w-5" />} 
              active={false}
              onClick={() => {}}
            >
              Dashboard
            </NavItem>
          </NavSection>
          
          <NavSection title="Gestión de Rutas">
            <NavItem 
              icon={<MapIcon className="h-5 w-5" />} 
              active={activeTab === "create-route"}
              onClick={() => handleTabClick("create-route")}
            >
              Rutas
            </NavItem>
            <NavItem 
              icon={<ClockIcon className="h-5 w-5" />} 
              active={activeTab === "publish-trip"}
              onClick={() => handleTabClick("publish-trip")}
            >
              Publicar Viajes
            </NavItem>
            <NavItem 
              icon={<BuildingIcon className="h-5 w-5" />} 
              active={activeTab === "trips"}
              onClick={() => handleTabClick("trips")}
            >
              Viajes
            </NavItem>
          </NavSection>
          
          <NavSection title="Reservaciones y Reportes">
            <NavItem 
              icon={<UserIcon className="h-5 w-5" />} 
              active={activeTab === "reservations"}
              onClick={() => handleTabClick("reservations")}
            >
              Reservaciones
            </NavItem>
            <NavItem 
              icon={<ClipboardListIcon className="h-5 w-5" />} 
              active={activeTab === "trip-summary"}
              onClick={() => handleTabClick("trip-summary")}
            >
              Resumen de Viajes
            </NavItem>
          </NavSection>
          
          <NavSection title="Usuarios">
            <NavItem 
              icon={<UserIcon className="h-5 w-5" />} 
              active={activeTab === "users"}
              onClick={() => handleTabClick("users")}
            >
              Usuarios
            </NavItem>
          </NavSection>
          
          <NavSection title="Configuración">
            <NavItem 
              icon={<Settings2 className="h-5 w-5" />} 
              active={false}
              onClick={() => {}}
            >
              Ajustes
            </NavItem>
          </NavSection>
          
          <div className="mt-auto pt-4 pb-6 px-3">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs text-gray-600 font-medium">TransRoute v1.0</p>
              <p className="text-xs text-gray-500">© 2025 Transport Systems</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}