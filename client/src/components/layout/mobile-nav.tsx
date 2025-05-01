import { useState } from "react";
import { useLocation } from "wouter";
import { MenuIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { TabType } from "@/hooks/use-active-tab";
import { useAuth } from "@/hooks/use-auth";
import { hasAccessToSection } from "@/lib/role-based-permissions";

interface MobileNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function MobileNav({ activeTab, onTabChange }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  
  // Función para verificar si el usuario tiene acceso a una sección
  const canAccess = (sectionId: string): boolean => {
    if (!user) return false;
    return hasAccessToSection(user.role, sectionId);
  };
  
  const handleNavClick = (tab: TabType) => {
    onTabChange(tab);
    
    // Actualizar el URL pero sin hacer una redirección completa
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.pushState({}, '', url.toString());
    
    setOpen(false);
  };
  
  return (
    <div className="md:hidden flex items-center justify-between bg-white border-b border-gray-200 px-4 py-3">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="mr-2" aria-label="Menu">
            <MenuIcon className="h-6 w-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[240px] sm:w-[300px] p-0">
          <div className="px-6 py-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">TransRoute</h2>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)}>
                <XIcon className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <nav className="flex flex-col p-4">
            {canAccess("routes") && (
              <NavLink 
                active={activeTab === "create-route"}
                onClick={() => handleNavClick("create-route")}
              >
                Rutas
              </NavLink>
            )}
            {canAccess("publish-trip") && (
              <NavLink 
                active={activeTab === "publish-trip"}
                onClick={() => handleNavClick("publish-trip")}
              >
                Publicar Viajes
              </NavLink>
            )}
            {canAccess("trips") && (
              <NavLink 
                active={activeTab === "trips"}
                onClick={() => handleNavClick("trips")}
              >
                Viajes
              </NavLink>
            )}
            {canAccess("reservations") && (
              <NavLink 
                active={activeTab === "reservations"}
                onClick={() => handleNavClick("reservations")}
              >
                Reservaciones
              </NavLink>
            )}
            {canAccess("trip-summary") && (
              <NavLink 
                active={activeTab === "trip-summary"}
                onClick={() => handleNavClick("trip-summary")}
              >
                Resumen de Viajes
              </NavLink>
            )}
            {canAccess("boarding-list") && (
              <NavLink 
                active={activeTab === "boarding-list"}
                onClick={() => handleNavClick("boarding-list")}
              >
                Lista de Abordaje
              </NavLink>
            )}
            {canAccess("users") && (
              <NavLink 
                active={activeTab === "users"}
                onClick={() => handleNavClick("users")}
              >
                Usuarios
              </NavLink>
            )}
            {canAccess("vehicles") && (
              <NavLink 
                active={activeTab === "vehicles"}
                onClick={() => handleNavClick("vehicles")}
              >
                Unidades
              </NavLink>
            )}
            {canAccess("commissions") && (
              <NavLink 
                active={window.location.pathname === "/commissions"}
                onClick={() => {
                  setLocation("/commissions");
                  setOpen(false);
                }}
              >
                Gestión de comisiones
              </NavLink>
            )}
          </nav>
        </SheetContent>
      </Sheet>
      
      <h1 className="text-lg font-semibold text-gray-800">TransRoute</h1>
      <div className="w-12"></div>
    </div>
  );
}

interface NavLinkProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function NavLink({ active, onClick, children }: NavLinkProps) {
  return (
    <div 
      className={`flex items-center px-2 py-3 text-base font-medium rounded-md cursor-pointer ${
        active 
          ? "text-primary bg-gray-50" 
          : "text-gray-700 hover:bg-gray-100"
      }`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}
