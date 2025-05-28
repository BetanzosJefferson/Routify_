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
  TagIcon,
  Users,
  ArrowRightLeft,
  ReceiptIcon,
  Wallet
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
          
          {/* Sección de Rutas */}
          {canAccess("routes") && (
            <div className="space-y-1">
              <NavItem 
                icon={<MapIcon className="h-5 w-5" />} 
                active={location === "/routes"}
                onClick={() => setLocation("/routes")}
              >
                Rutas
              </NavItem>
            </div>
          )}
          
          {/* Publicar Viajes */}
          {canAccess("publish-trip") && (
            <div className="space-y-1">
              <NavItem 
                icon={<ClockIcon className="h-5 w-5" />} 
                active={location === "/publish-trip"}
                onClick={() => setLocation("/publish-trip")}
              >
                Publicar Viajes
              </NavItem>
            </div>
          )}
          
          {/* Viajes */}
          {canAccess("trips") && (
            <div className="space-y-1">
              <NavItem 
                icon={<BuildingIcon className="h-5 w-5" />} 
                active={location === "/trips"}
                onClick={() => setLocation("/trips")}
              >
                Viajes
              </NavItem>
            </div>
          )}

          {/* Línea separadora */}
          {(canAccess("routes") || canAccess("publish-trip") || canAccess("trips")) && (canAccess("reservations") || canAccess("reservation-requests") || canAccess("boarding-list")) && (
            <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
          )}
          
          {/* Sección de Reservaciones */}
          {canAccess("reservations") && (
            <div className="space-y-1">
              <NavItem 
                icon={<UserIcon className="h-5 w-5" />} 
                active={location === "/reservations"}
                onClick={() => setLocation("/reservations")}
              >
                Reservaciones
              </NavItem>
            </div>
          )}
          
          {canAccess("reservation-requests") && (
            <div className="space-y-1">
              <NavItem 
                icon={<FileTextIcon className="h-5 w-5" />} 
                active={location === "/reservation-requests"}
                onClick={() => setLocation("/reservation-requests")}
              >
                Solicitud de reservaciones
              </NavItem>
            </div>
          )}
          
          {canAccess("boarding-list") && (
            <div className="space-y-1">
              <NavItem 
                icon={<UsersIcon className="h-5 w-5" />} 
                active={location === "/boarding-list"}
                onClick={() => setLocation("/boarding-list")}
              >
                Lista de abordaje
              </NavItem>
            </div>
          )}

          {/* Línea separadora */}
          {(canAccess("reservations") || canAccess("reservation-requests") || canAccess("boarding-list")) && canAccess("packages") && (
            <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
          )}
          
          {/* Paqueterías */}
          {canAccess("packages") && (
            <div className="space-y-1">
              <NavItem 
                icon={<FileTextIcon className="h-5 w-5" />} 
                active={location === "/packages"}
                onClick={() => setLocation("/packages")}
              >
                Paqueterias
              </NavItem>
            </div>
          )}

          {/* Línea separadora */}
          {canAccess("packages") && (canAccess("trip-summary") || canAccess("cash-box") || canAccess("cutoff-history") || canAccess("user-cash-boxes") || canAccess("commissions") || canAccess("coupons")) && (
            <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
          )}
          
          {/* Bitácora */}
          {canAccess("trip-summary") && (
            <div className="space-y-1">
              <NavItem 
                icon={<ClipboardListIcon className="h-5 w-5" />} 
                active={location === "/trip-log"}
                onClick={() => setLocation("/trip-log")}
              >
                Bitacora
              </NavItem>
            </div>
          )}
          
          {/* Caja */}
          {canAccess("cash-box") && (
            <div className="space-y-1">
              <NavItem 
                icon={<ReceiptIcon className="h-5 w-5" />} 
                active={location === "/cash-box"}
                onClick={() => setLocation("/cash-box")}
              >
                Caja
              </NavItem>
            </div>
          )}
          
          {/* Historial de cortes */}
          {canAccess("cutoff-history") && (
            <div className="space-y-1">
              <NavItem 
                icon={<ClipboardListIcon className="h-5 w-5" />} 
                active={location === "/cutoff-history"}
                onClick={() => setLocation("/cutoff-history")}
              >
                Historial de cortes
              </NavItem>
            </div>
          )}
          
          {/* Caja de usuarios */}
          {canAccess("user-cash-boxes") && (
            <div className="space-y-1">
              <NavItem 
                icon={<Wallet className="h-5 w-5" />} 
                active={location === "/user-cash-boxes"}
                onClick={() => setLocation("/user-cash-boxes")}
              >
                Caja de usuarios
              </NavItem>
            </div>
          )}
          
          {/* Gestión de comisiones */}
          {canAccess("commissions") && (
            <div className="space-y-1">
              <NavItem 
                icon={<PercentIcon className="h-5 w-5" />} 
                active={location === "/commissions"}
                onClick={() => setLocation("/commissions")}
              >
                Gestion de comisiones
              </NavItem>
            </div>
          )}
          
          {/* Mis comisiones */}
          {canAccess("my-commissions") && (
            <div className="space-y-1">
              <NavItem 
                icon={<PercentIcon className="h-5 w-5" />} 
                active={location === "/my-commissions"}
                onClick={() => setLocation("/my-commissions")}
              >
                Mis comisiones
              </NavItem>
            </div>
          )}
          
          {/* Cupones */}
          {canAccess("coupons") && (
            <div className="space-y-1">
              <NavItem 
                icon={<TagIcon className="h-5 w-5" />} 
                active={location === "/coupons"}
                onClick={() => setLocation("/coupons")}
              >
                Cupones
              </NavItem>
            </div>
          )}

          {/* Línea separadora */}
          {(canAccess("trip-summary") || canAccess("cash-box") || canAccess("cutoff-history") || canAccess("user-cash-boxes") || canAccess("commissions") || canAccess("coupons")) && (canAccess("users") || canAccess("vehicles")) && (
            <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
          )}
          
          {/* Usuarios */}
          {canAccess("users") && (
            <div className="space-y-1">
              <NavItem 
                icon={<UserIcon className="h-5 w-5" />} 
                active={location === "/users"}
                onClick={() => setLocation("/users")}
              >
                Usuarios
              </NavItem>
            </div>
          )}
          
          {/* Unidades */}
          {canAccess("vehicles") && (
            <div className="space-y-1">
              <NavItem 
                icon={<TruckIcon className="h-5 w-5" />} 
                active={location === "/vehicles"}
                onClick={() => setLocation("/vehicles")}
              >
                Unidades
              </NavItem>
            </div>
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