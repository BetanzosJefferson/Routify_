import { useLocation } from "wouter";
import { 
  BellIcon, 
  UserIcon, 
  SettingsIcon, 
  LogOutIcon,
  SearchIcon 
} from "lucide-react";
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
import { Input } from "@/components/ui/input";

export function Topbar() {
  const [, setLocation] = useLocation();

  const handleLogout = () => {
    // Implementar lógica de logout aquí
    setLocation("/auth");
  };

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Buscador */}
        <div className="flex-1 md:w-1/3 lg:w-1/4 hidden md:block">
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <SearchIcon className="h-4 w-4 text-gray-400" />
            </div>
            <Input
              type="search"
              placeholder="Buscar..."
              className="pl-10 text-sm focus:outline-none"
            />
          </div>
        </div>

        {/* Espacio en medio (flexbox centra automáticamente) */}
        <div className="flex-1 md:hidden"></div>

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
                <Avatar className="h-8 w-8 border border-gray-200">
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
                <DropdownMenuItem>
                  <UserIcon className="mr-2 h-4 w-4" />
                  <span>Perfil</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
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
  );
}