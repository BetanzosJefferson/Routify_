import React from "react";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { TabType } from "@/hooks/use-active-tab";
import { useAuth } from "@/hooks/use-auth";
import { hasAccessToSection } from "@/lib/role-based-permissions";
import { 
  MapIcon, 
  ClockIcon, 
  BuildingIcon, 
  UserIcon, 
  CarIcon, 
  HomeIcon, 
  Settings2,
  ClipboardListIcon,
  TruckIcon,
  PercentIcon,
  UsersIcon,
  BellIcon,
  FileTextIcon,
  TagIcon
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
          : "text-gray-700 dark:text-gray-200 hover:text-primary dark:hover:text-primary hover:bg-primary/10"
      )}
      onClick={onClick}
    >
      <span className={cn("mr-3 flex-shrink-0", active ? "text-white" : "text-gray-500 dark:text-gray-400 group-hover:text-primary")}>{icon}</span>
      <span className="truncate">{children}</span>
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
      <h3 className="px-3 mb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{title}</h3>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export function Sidebar({ activeTab, onTabChange }: SidebarProps) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  
  const handleTabClick = (tab: TabType) => {
    // Verificar si estamos en una URL distinta a '/' y volver al dashboard
    if (location !== '/' && location !== '/dashboard') {
      setLocation('/?tab=' + tab);
    } else {
      onTabChange(tab);
      
      // Actualizar el URL pero sin hacer una redirección completa
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tab);
      window.history.pushState({}, '', url.toString());
    }
  };

  // Función para verificar si el usuario tiene acceso a una sección
  const canAccess = (sectionId: string): boolean => {
    if (!user) return false;
    return hasAccessToSection(user.role, sectionId);
  };
  
  return (
    <div className="hidden md:flex md:flex-shrink-0">
      <div className="flex flex-col w-64 bg-white dark:bg-gray-950 border-r border-gray-200 dark:border-gray-800 theme-transition">
        <div className="px-6 pt-6 pb-4 flex items-center">
          <div className="h-9 w-9 rounded-md bg-primary flex items-center justify-center mr-3">
            <CarIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100">TransRoute</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Sistema de Gestión</p>
          </div>
        </div>
        
        <div className="flex-1 flex flex-col overflow-y-auto pt-5 px-3">
          {/* Sección de Dashboard - no incluida en TabType por el momento */}
          {/*{canAccess("dashboard") && (
            <NavSection title="General">
              <NavItem 
                icon={<HomeIcon className="h-5 w-5" />} 
                active={false}
                onClick={() => {}}
              >
                Dashboard
              </NavItem>
            </NavSection>
          )}*/}
          
          {/* Sección de Gestión de Rutas */}
          {(canAccess("routes") || canAccess("publish-trip") || canAccess("trips")) && (
            <NavSection title="Gestión de Rutas">
              {canAccess("routes") && (
                <NavItem 
                  icon={<MapIcon className="h-5 w-5" />} 
                  active={(location === '/' || location === '/dashboard') && activeTab === "create-route"}
                  onClick={() => handleTabClick("create-route")}
                >
                  Rutas
                </NavItem>
              )}
              {canAccess("publish-trip") && (
                <NavItem 
                  icon={<ClockIcon className="h-5 w-5" />} 
                  active={(location === '/' || location === '/dashboard') && activeTab === "publish-trip"}
                  onClick={() => handleTabClick("publish-trip")}
                >
                  Publicar Viajes
                </NavItem>
              )}
              {canAccess("trips") && (
                <NavItem 
                  icon={<BuildingIcon className="h-5 w-5" />} 
                  active={(location === '/' || location === '/dashboard') && activeTab === "trips"}
                  onClick={() => handleTabClick("trips")}
                >
                  Viajes
                </NavItem>
              )}
            </NavSection>
          )}
          
          {/* Sección de Reservaciones y Reportes */}
          {(canAccess("reservations") || canAccess("trip-summary") || canAccess("boarding-list")) && (
            <NavSection title="Reservaciones y Reportes">
              {canAccess("reservations") && (
                <NavItem 
                  icon={<UserIcon className="h-5 w-5" />} 
                  active={(location === '/' || location === '/dashboard') && activeTab === "reservations"}
                  onClick={() => handleTabClick("reservations")}
                >
                  Reservaciones
                </NavItem>
              )}
              {canAccess("trip-summary") && (
                <NavItem 
                  icon={<ClipboardListIcon className="h-5 w-5" />} 
                  active={(location === '/' || location === '/dashboard') && activeTab === "trip-summary"}
                  onClick={() => handleTabClick("trip-summary")}
                >
                  Bitácora
                </NavItem>
              )}
              {canAccess("cash-register") && (
                <NavItem 
                  icon={<DollarSignIcon className="h-5 w-5" />} 
                  active={(location === '/cash-register') || ((location === '/' || location === '/dashboard') && activeTab === "cash-register")}
                  onClick={() => navigate("/cash-register")}
                >
                  Caja
                </NavItem>
              )}
              {canAccess("boarding-list") && (
                <NavItem 
                  icon={<UsersIcon className="h-5 w-5" />} 
                  active={(location === '/' || location === '/dashboard') && activeTab === "boarding-list"}
                  onClick={() => handleTabClick("boarding-list")}
                >
                  Lista de Abordaje
                </NavItem>
              )}
            </NavSection>
          )}
          
          {/* Sección de Usuarios */}
          {canAccess("users") && (
            <NavSection title="Usuarios">
              <NavItem 
                icon={<UserIcon className="h-5 w-5" />} 
                active={(location === '/' || location === '/dashboard') && activeTab === "users"}
                onClick={() => handleTabClick("users")}
              >
                Usuarios
              </NavItem>
            </NavSection>
          )}
          
          {/* Sección de Solicitudes */}
          {canAccess("reservation-requests") && (
            <NavSection title="Solicitudes">
              <NavItem 
                icon={<FileTextIcon className="h-5 w-5" />} 
                active={location === "/reservation-requests"}
                onClick={() => setLocation("/reservation-requests")}
              >
                Solicitudes de Reservación
              </NavItem>
            </NavSection>
          )}
          
          {/* Sección de Flota y Finanzas */}
          {(canAccess("vehicles") || canAccess("commissions") || canAccess("my-commissions") || canAccess("coupons") || canAccess("packages")) && (
            <NavSection title="Flota y Finanzas">
              {canAccess("vehicles") && (
                <NavItem 
                  icon={<TruckIcon className="h-5 w-5" />} 
                  active={(location === '/' || location === '/dashboard') && activeTab === "vehicles"}
                  onClick={() => handleTabClick("vehicles")}
                >
                  Unidades
                </NavItem>
              )}
              {canAccess("commissions") && (
                <NavItem 
                  icon={<PercentIcon className="h-5 w-5" />} 
                  active={location === "/commissions"}
                  onClick={() => setLocation("/commissions")}
                >
                  Gestión de comisiones
                </NavItem>
              )}
              {canAccess("my-commissions") && (
                <NavItem 
                  icon={<PercentIcon className="h-5 w-5" />} 
                  active={location === "/my-commissions"}
                  onClick={() => setLocation("/my-commissions")}
                >
                  Mis comisiones
                </NavItem>
              )}
              {canAccess("coupons") && (
                <NavItem 
                  icon={<TagIcon className="h-5 w-5" />} 
                  active={location === "/coupons"}
                  onClick={() => setLocation("/coupons")}
                >
                  Cupones
                </NavItem>
              )}
              {canAccess("packages") && (
                <NavItem 
                  icon={<FileTextIcon className="h-5 w-5" />} 
                  active={location === "/packages"}
                  onClick={() => setLocation("/packages")}
                >
                  Paqueterías
                </NavItem>
              )}
            </NavSection>
          )}
          
          {/* Sección de Configuración - no incluida en TabType por el momento */}
          {/*{canAccess("settings") && (
            <NavSection title="Configuración">
              <NavItem 
                icon={<Settings2 className="h-5 w-5" />} 
                active={false}
                onClick={() => {}}
              >
                Ajustes
              </NavItem>
            </NavSection>
          )}*/}
          
          <div className="mt-auto pt-4 pb-6 px-3">
            <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
              <p className="text-xs text-gray-600 dark:text-gray-300 font-medium">TransRoute v1.0</p>
              <p className="text-xs text-gray-500 dark:text-gray-500">© 2025 Transport Systems</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}