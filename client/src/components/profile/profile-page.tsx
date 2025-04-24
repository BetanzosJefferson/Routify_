import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useTheme } from "@/hooks/use-theme";
import { 
  Moon, 
  Sun, 
  UserIcon,
  Building2,
  BookText,
  Loader2,
  Upload
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export function ProfilePage() {
  const [activeTab, setActiveTab] = useState("profile");
  const { theme, setTheme } = useTheme();
  const [isUploading, setIsUploading] = useState(false);

  // Consulta para obtener información del usuario
  const { data: user, isLoading } = useQuery<User>({
    queryKey: ['/api/user'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/user');
      if (!res.ok) throw new Error('Error al cargar usuario');
      return await res.json();
    }
  });

  const handleLogout = () => {
    // Implementar cuando se añada autenticación
    console.log("Cerrar sesión - funcionalidad pendiente");
  };

  const handleThemeToggle = (checked: boolean) => {
    setTheme(checked ? "dark" : "light");
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "superAdmin": return "Super Administrador";
      case "admin": return "Administrador";
      case "callCenter": return "Call Center";
      case "checador": return "Checador";
      case "chofer": return "Chofer";
      case "taquilla": return "Taquilla";
      default: return role;
    }
  };

  const handleProfilePictureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    // Simular una subida de archivo (implementar más adelante)
    setTimeout(() => {
      setIsUploading(false);
      // Aquí se implementaría la subida al servidor
      console.log("Archivo seleccionado:", file.name);
    }, 1500);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader className="border-b">
        <CardTitle className="text-2xl font-bold">Mi Perfil</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <Tabs 
          value={activeTab} 
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="mb-6">
            <TabsTrigger value="profile" className="flex items-center">
              <UserIcon className="h-4 w-4 mr-2" />
              Perfil
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center">
              <BookText className="h-4 w-4 mr-2" />
              Configuración
            </TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col items-center">
                <div className="relative">
                  <Avatar className="h-32 w-32 border-2 border-primary/20">
                    {user?.profilePicture ? (
                      <AvatarImage src={user.profilePicture} alt={`${user.firstName} ${user.lastName}`} />
                    ) : (
                      <AvatarFallback className="bg-primary/5 text-primary text-2xl">
                        {user?.firstName.charAt(0)}{user?.lastName.charAt(0)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="absolute -bottom-2 -right-2 rounded-full p-2"
                    onClick={() => document.getElementById('profile-picture-upload')?.click()}
                    disabled={isUploading}
                  >
                    {isUploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                  </Button>
                  <Input 
                    id="profile-picture-upload" 
                    type="file" 
                    className="hidden" 
                    onChange={handleProfilePictureUpload}
                    accept="image/*"
                  />
                </div>
                <h2 className="mt-4 text-xl font-semibold">{user?.firstName} {user?.lastName}</h2>
                <span className="text-sm text-muted-foreground">{getRoleDisplayName(user?.role || "")}</span>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="mt-6" 
                  onClick={handleLogout}
                >
                  Cerrar Sesión
                </Button>
              </div>

              <div className="md:col-span-2 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">Nombre</Label>
                    <Input 
                      id="firstName" 
                      value={user?.firstName || ""} 
                      readOnly 
                      className="bg-muted" 
                    />
                  </div>
                  <div>
                    <Label htmlFor="lastName">Apellido</Label>
                    <Input 
                      id="lastName" 
                      value={user?.lastName || ""} 
                      readOnly 
                      className="bg-muted" 
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="email">Correo Electrónico</Label>
                  <Input 
                    id="email" 
                    value={user?.email || ""} 
                    readOnly 
                    className="bg-muted" 
                  />
                </div>

                <div>
                  <Label htmlFor="company">Empresa</Label>
                  <div className="flex items-center space-x-2">
                    <Building2 className="h-4 w-4 text-gray-400" />
                    <Input 
                      id="company" 
                      value={user?.company || "No especificada"} 
                      readOnly 
                      className="bg-muted" 
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="role">Rol</Label>
                  <Input 
                    id="role" 
                    value={getRoleDisplayName(user?.role || "")} 
                    readOnly 
                    className="bg-muted" 
                  />
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="config">
            <div className="space-y-6">
              <div className="flex items-center justify-between border p-4 rounded-lg">
                <div className="flex items-center space-x-2">
                  {theme === "dark" ? (
                    <Moon className="h-5 w-5" />
                  ) : (
                    <Sun className="h-5 w-5" />
                  )}
                  <Label htmlFor="theme-toggle">Modo Oscuro</Label>
                </div>
                <Switch 
                  id="theme-toggle" 
                  checked={theme === "dark"}
                  onCheckedChange={handleThemeToggle}
                />
              </div>
              <div className="text-sm text-muted-foreground">
                Se añadirán más opciones de configuración próximamente.
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}