import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  UserIcon, 
  LogOutIcon,
  X,
  MenuIcon
} from "lucide-react";
import { NotificationsMenu } from "@/components/notifications/notifications-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ProfilePage } from "@/components/profile/profile-page";
import { TabType } from "@/hooks/use-active-tab";
import { hasAccessToSection } from "@/lib/role-based-permissions";

interface TopbarProps {
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
}

export function Topbar({ activeTab, onTabChange }: TopbarProps) {
  const [, setLocation] = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { logoutMutation, user } = useAuth();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Función para verificar si el usuario tiene acceso a una sección
  const canAccess = (sectionId: string): boolean => {
    if (!user) return false;
    return hasAccessToSection(user.role, sectionId);
  };

  const handleNavClick = (tab: TabType) => {
    if (onTabChange) {
      onTabChange(tab);
    }
    
    // Actualizar el URL pero sin hacer una redirección completa
    const url = new URL(window.location.href);
    url.searchParams.set('tab', tab);
    window.history.pushState({}, '', url.toString());
    
    setMobileMenuOpen(false);
  };
  
  // Función para obtener el nombre amigable del rol
  const getRoleDisplayName = (role: string): string => {
    switch (role) {
      case "superAdmin":
        return "Super Admin (Dueño)";
      case "admin":
        return "Administrador";
      case "callCenter":
        return "Call Center";
      case "checador":
        return "Checador";
      case "chofer":
        return "Chófer";
      case "taquillero":
        return "Taquilla";
      case "dueno":
        return "Dueño";
      case "desarrollador":
        return "Desarrollador";
      default:
        return role || "";
    }
  };

  return (
    <>
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 dark:bg-gray-950 dark:border-gray-800">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Menú hamburguesa para móviles */}
          <div className="flex items-center">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="md:hidden mr-2" 
                  aria-label="Menu"
                >
                  <MenuIcon className="h-6 w-6" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[240px] sm:w-[300px] p-0">
                <div className="px-6 py-6 border-b border-gray-200">
                  <h2 className="text-xl font-semibold">TransRoute</h2>
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
                      active={window.location.pathname === "/reservations"}
                      onClick={() => {
                        setLocation("/reservations");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Reservaciones
                    </NavLink>
                  )}
                  {canAccess("trip-summary") && (
                    <NavLink 
                      active={window.location.pathname === "/trip-log"}
                      onClick={() => {
                        setLocation("/trip-log");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Bitácora
                    </NavLink>
                  )}
                  {canAccess("cash-box") && (
                    <NavLink 
                      active={window.location.pathname === "/cash-box"}
                      onClick={() => {
                        setLocation("/cash-box");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Caja
                    </NavLink>
                  )}
                  {canAccess("cutoff-history") && (
                    <NavLink 
                      active={window.location.pathname === "/cutoff-history"}
                      onClick={() => {
                        setLocation("/cutoff-history");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Historial de Cortes
                    </NavLink>
                  )}
                  {canAccess("boarding-list") && (
                    <NavLink 
                      active={window.location.pathname === "/boarding-list"}
                      onClick={() => {
                        setLocation("/boarding-list");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Lista de Abordaje
                    </NavLink>
                  )}
                  {canAccess("users") && (
                    <NavLink 
                      active={window.location.pathname === "/users"}
                      onClick={() => {
                        setLocation("/users");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Usuarios
                    </NavLink>
                  )}
                  {canAccess("passenger-transfer") && (
                    <NavLink 
                      active={window.location.pathname === "/passenger-transfer"}
                      onClick={() => {
                        setLocation("/passenger-transfer");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Transferencia de pasajeros
                    </NavLink>
                  )}
                  {canAccess("vehicles") && (
                    <NavLink 
                      active={window.location.pathname === "/vehicles"}
                      onClick={() => {
                        setLocation("/vehicles");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Unidades
                    </NavLink>
                  )}
                  {canAccess("commissions") && (
                    <NavLink 
                      active={window.location.pathname === "/commissions"}
                      onClick={() => {
                        setLocation("/commissions");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Gestión de comisiones
                    </NavLink>
                  )}
                  {canAccess("my-commissions") && (
                    <NavLink 
                      active={window.location.pathname === "/my-commissions"}
                      onClick={() => {
                        setLocation("/my-commissions");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Mis comisiones
                    </NavLink>
                  )}
                  {canAccess("packages") && (
                    <NavLink 
                      active={window.location.pathname === "/packages"}
                      onClick={() => {
                        setLocation("/packages");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Paqueterías
                    </NavLink>
                  )}
                  {canAccess("trip-expense") && (
                    <NavLink 
                      active={window.location.pathname === "/trip-expense"}
                      onClick={() => {
                        setLocation("/trip-expense");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Gastos de Viaje
                    </NavLink>
                  )}
                  {canAccess("trip-expense-summary") && (
                    <NavLink 
                      active={window.location.pathname === "/trip-expense-summary"}
                      onClick={() => {
                        setLocation("/trip-expense-summary");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Resumen de Gastos
                    </NavLink>
                  )}
                  {canAccess("routes") && (
                    <NavLink 
                      active={window.location.pathname === "/routes"}
                      onClick={() => {
                        setLocation("/routes");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Gestión de Rutas
                    </NavLink>
                  )}
                  {canAccess("companies") && (
                    <NavLink 
                      active={window.location.pathname === "/companies"}
                      onClick={() => {
                        setLocation("/companies");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Empresas
                    </NavLink>
                  )}
                  {canAccess("global-analytics") && (
                    <NavLink 
                      active={window.location.pathname === "/global-analytics"}
                      onClick={() => {
                        setLocation("/global-analytics");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Analíticas Globales
                    </NavLink>
                  )}
                  {canAccess("discount-codes") && (
                    <NavLink 
                      active={window.location.pathname === "/discount-codes"}
                      onClick={() => {
                        setLocation("/discount-codes");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Códigos de Descuento
                    </NavLink>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
            
            {/* Título de la aplicación */}
            <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">TransRoute</h1>
          </div>

          {/* Acciones del lado derecho */}
          <div className="flex items-center space-x-4">
            {/* Menú de notificaciones */}
            <div className="relative">
              <NotificationsMenu />
              {/* Componente de depuración: esto debe quitarse en producción */}
              <div id="debug-notification-count" className="hidden"></div>
            </div>

            {/* Menú de usuario */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8 border border-gray-200 dark:border-gray-700">
                    {user?.profilePicture ? (
                      <AvatarImage src={user.profilePicture} alt={`${user.firstName} ${user.lastName}`} />
                    ) : (
                      <AvatarFallback className="bg-primary-foreground text-primary">
                        {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user?.firstName} {user?.lastName}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{getRoleDisplayName(user?.role || "")}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>Perfil</span>
                  </DropdownMenuItem>

                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOutIcon className="mr-2 h-4 w-4" />
                  <span>Cerrar sesión</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Modal de perfil */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-4xl p-0">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setProfileOpen(false)}
            className="absolute right-4 top-4"
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="px-6 pb-6 pt-6">
            <ProfilePage standalone={true} />
          </div>
        </DialogContent>
      </Dialog>
    </>
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