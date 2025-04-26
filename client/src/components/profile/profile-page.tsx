import { useState } from "react";
import { User } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { 
  UserIcon,
  Building2,
  Loader2,
  Upload
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

interface ProfilePageProps {
  standalone?: boolean;
}

export function ProfilePage({ standalone = false }: ProfilePageProps) {
  const [isUploading, setIsUploading] = useState(false);
  const { user, isLoading, logoutMutation } = useAuth();
  const { toast } = useToast();

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case "superAdmin": return "Super Administrador";
      case "admin": return "Administrador";
      case "callCenter": return "Call Center";
      case "checador": return "Checador";
      case "chofer": return "Chofer";
      case "taquilla": return "Taquilla";
      case "dueño": return "Dueño";
      case "desarrollador": return "Desarrollador";
      default: return role;
    }
  };

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    
    try {
      // Convertir la imagen a base64
      const base64Image = await convertFileToBase64(file);
      
      // Enviar al servidor
      const response = await fetch('/api/auth/update-profile-picture', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ profilePicture: base64Image }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Error al actualizar la foto de perfil');
      }
      
      // Actualizar el estado local
      const updatedUser = await response.json();
      
      // Invalidar la caché para forzar una nueva consulta
      queryClient.setQueryData(["/api/auth/user"], updatedUser);
      
      toast({
        title: "Foto actualizada",
        description: "Tu foto de perfil ha sido actualizada correctamente.",
      });
      
      console.log("Foto de perfil actualizada:", file.name);
    } catch (error) {
      console.error(error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar la foto de perfil. Inténtalo de nuevo.",
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  // Función para convertir un archivo a base64
  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // Optimizar la imagen antes de enviarla
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          // Crear un canvas para redimensionar la imagen
          const canvas = document.createElement('canvas');
          // Reducir la imagen a un tamaño máximo razonable
          const MAX_SIZE = 500;
          let width = img.width;
          let height = img.height;
          
          // Calcular las nuevas dimensiones manteniendo la proporción
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Dibujar la imagen redimensionada en el canvas
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Convertir el canvas a una imagen base64 con calidad reducida
          const optimizedImage = canvas.toDataURL('image/jpeg', 0.7);
          resolve(optimizedImage);
        };
        img.onerror = () => {
          // Si hay un error al cargar la imagen, usamos el original
          resolve(reader.result as string);
        };
      };
      reader.onerror = (error) => reject(error);
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const profileContent = (
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
          {/* Solo los usuarios que no son call center, checador o chofer pueden cambiar la foto de perfil */}
          {user?.role !== 'callCenter' && user?.role !== 'checador' && user?.role !== 'chofer' && (
            <>
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
            </>
          )}
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
              value={user?.company || (user?.companyId ? user.companyId : "No especificada")} 
              readOnly 
              className="bg-muted text-muted-foreground border-dashed cursor-not-allowed opacity-60" 
              disabled
            />
          </div>
        </div>

        <div>
          <Label htmlFor="role">Rol</Label>
          <Input 
            id="role" 
            value={getRoleDisplayName(user?.role || "")} 
            readOnly 
            className="bg-muted text-muted-foreground border-dashed cursor-not-allowed opacity-60" 
            disabled
          />
        </div>
      </div>
    </div>
  );

  // Si es standalone, envuelve en un Card
  if (standalone) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardHeader className="border-b">
          <CardTitle className="text-2xl font-bold">Mi Perfil</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          {profileContent}
        </CardContent>
      </Card>
    );
  }

  // De lo contrario, solo devuelve el contenido
  return profileContent;
}