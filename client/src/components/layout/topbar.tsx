import { useState } from "react";
import { useLocation } from "wouter";
import { 
  BellIcon, 
  UserIcon, 
  SettingsIcon, 
  LogOutIcon,
  X
} from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ProfilePage } from "@/components/profile/profile-page";

export function Topbar() {
  const [, setLocation] = useLocation();
  const [profileOpen, setProfileOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);

  const handleLogout = () => {
    // Implementar lógica de logout aquí
    setLocation("/auth");
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
            {/* Botón de notificaciones */}
            <Button variant="ghost" size="icon" className="text-gray-500">
              <BellIcon className="h-5 w-5" />
            </Button>

            {/* Menú de usuario */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8 border border-gray-200 dark:border-gray-700">
                    <AvatarFallback className="bg-primary-foreground text-primary">
                      <UserIcon className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuGroup>
                  <DropdownMenuItem onClick={() => setProfileOpen(true)}>
                    <UserIcon className="mr-2 h-4 w-4" />
                    <span>Perfil</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => {
                    setProfileOpen(true);
                    // Asegurarnos que el tab de configuración esté seleccionado
                    setTimeout(() => {
                      const configTab = document.querySelector('[value="config"]');
                      if (configTab) {
                        (configTab as HTMLElement).click();
                      }
                    }, 100);
                  }}>
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    <span>Configuración</span>
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
          <DialogHeader className="p-6 pb-2">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-2xl font-bold">Mi Perfil</DialogTitle>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setProfileOpen(false)}
                className="absolute right-4 top-4"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <DialogDescription>
              Administra tu información personal y configuraciones
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 pt-2">
            <ProfilePage />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}