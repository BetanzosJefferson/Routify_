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

export function Topbar() {
  const [, setLocation] = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const { logoutMutation, user } = useAuth();

  const handleLogout = () => {
    logoutMutation.mutate();
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
          {/* Título de la aplicación */}
          <div className="flex-1">
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