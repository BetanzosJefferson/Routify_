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
              <SheetContent side="left" className="w-[280px] sm:w-[320px] p-0 bg-gradient-to-b from-slate-50 to-white">
                <div className="px-6 py-6 border-b border-gray-200 bg-white shadow-sm">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center shadow-lg">
                      <span className="text-white font-bold text-lg">TR</span>
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-800">TransRoute</h2>
                      <p className="text-sm text-gray-500">Sistema de Gestión</p>
                    </div>
                  </div>
                </div>
                <nav className="flex flex-col p-4 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)]">
                  {/* Rutas */}
                  {canAccess("routes") && (
                    <NavLink 
                      active={window.location.pathname === "/routes"}
                      onClick={() => {
                        setLocation("/routes");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Rutas
                    </NavLink>
                  )}
                  
                  {/* Publicar Viajes */}
                  {canAccess("publish-trip") && (
                    <NavLink 
                      active={window.location.pathname === "/publish-trip"}
                      onClick={() => {
                        setLocation("/publish-trip");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Publicar Viajes
                    </NavLink>
                  )}
                  
                  {/* Viajes */}
                  {canAccess("trips") && (
                    <NavLink 
                      active={window.location.pathname === "/trips"}
                      onClick={() => {
                        setLocation("/trips");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Viajes
                    </NavLink>
                  )}
                  
                  {/* Reservaciones */}
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
                  
                  {/* Solicitud de reservaciones */}
                  {canAccess("reservation-requests") && (
                    <NavLink 
                      active={window.location.pathname === "/reservation-requests"}
                      onClick={() => {
                        setLocation("/reservation-requests");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Solicitud de reservaciones
                    </NavLink>
                  )}
                  
                  {/* Lista de abordaje */}
                  {canAccess("boarding-list") && (
                    <NavLink 
                      active={window.location.pathname === "/boarding-list"}
                      onClick={() => {
                        setLocation("/boarding-list");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Lista de abordaje
                    </NavLink>
                  )}
                  
                  {/* Paqueterías */}
                  {canAccess("packages") && (
                    <NavLink 
                      active={window.location.pathname === "/packages"}
                      onClick={() => {
                        setLocation("/packages");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Paqueterias
                    </NavLink>
                  )}
                  
                  {/* Bitácora */}
                  {canAccess("trip-summary") && (
                    <NavLink 
                      active={window.location.pathname === "/trip-log"}
                      onClick={() => {
                        setLocation("/trip-log");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Bitacora
                    </NavLink>
                  )}
                  
                  {/* Caja */}
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
                  
                  {/* Historial de cortes */}
                  {canAccess("cutoff-history") && (
                    <NavLink 
                      active={window.location.pathname === "/cutoff-history"}
                      onClick={() => {
                        setLocation("/cutoff-history");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Historial de cortes
                    </NavLink>
                  )}
                  
                  {/* Caja de usuarios */}
                  {canAccess("user-cash-boxes") && (
                    <NavLink 
                      active={window.location.pathname === "/user-cash-boxes"}
                      onClick={() => {
                        setLocation("/user-cash-boxes");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Caja de usuarios
                    </NavLink>
                  )}
                  
                  {/* Gestión de comisiones */}
                  {canAccess("commissions") && (
                    <NavLink 
                      active={window.location.pathname === "/commissions"}
                      onClick={() => {
                        setLocation("/commissions");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Gestion de comisiones
                    </NavLink>
                  )}
                  
                  {/* Mis comisiones */}
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
                  
                  {/* Cupones */}
                  {canAccess("coupons") && (
                    <NavLink 
                      active={window.location.pathname === "/coupons"}
                      onClick={() => {
                        setLocation("/coupons");
                        setMobileMenuOpen(false);
                      }}
                    >
                      Cupones
                    </NavLink>
                  )}
                  
                  {/* Usuarios */}
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
                  
                  {/* Unidades */}
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
                </nav>
                
                {/* Información del usuario */}
                <div className="mt-auto p-4 border-t border-gray-200 bg-white">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                      {user?.profilePicture ? (
                        <img 
                          src={user.profilePicture} 
                          alt="Profile" 
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-gray-600 font-semibold text-sm">
                          {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {user?.firstName} {user?.lastName}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {getRoleDisplayName(user?.role)}
                      </p>
                    </div>
                  </div>
                </div>
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
      className={`flex items-center px-4 py-3 text-sm font-medium rounded-lg cursor-pointer transition-all duration-200 ${
        active 
          ? "text-blue-700 bg-blue-50 border-l-4 border-blue-700 shadow-sm" 
          : "text-gray-700 hover:bg-gray-50 hover:text-gray-900 hover:translate-x-1"
      }`}
      onClick={onClick}
    >
      <div className={`w-2 h-2 rounded-full mr-3 ${
        active ? "bg-blue-700" : "bg-gray-400"
      }`} />
      {children}
    </div>
  );
}