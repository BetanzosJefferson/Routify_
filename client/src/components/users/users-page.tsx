import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CreateInvitationForm } from "./create-invitation";
import { UserRole, UserRoleType, type User, type Invitation } from "@shared/schema";

export function UsersPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [currentTab, setCurrentTab] = useState<"users" | "invitations">("users");

  // Fetch users
  const usersQuery = useQuery({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Error al cargar usuarios");
      const users = await res.json() as User[];
      
      // Filtrado adicional en el cliente para asegurar que los permisos se aplican
      // Esto actúa como una capa extra de seguridad
      const authUser = JSON.parse(localStorage.getItem("currentUser") || "{}");
      if (authUser && authUser.role === UserRole.OWNER) {
        return users.filter(user => user.invitedById === authUser.id);
      }
      
      return users;
    },
  });

  // Fetch invitations
  const invitationsQuery = useQuery({
    queryKey: ["/api/invitations"],
    queryFn: async () => {
      const res = await fetch("/api/invitations");
      if (!res.ok) throw new Error("Error al cargar invitaciones");
      return res.json() as Promise<Invitation[]>;
    },
  });

  // Function to get role display name
  const getRoleDisplayName = (role: string): string => {
    switch (role) {
      case UserRole.SUPER_ADMIN:
        return "Super Admin (Dueño)";
      case UserRole.ADMIN:
        return "Administrador";
      case UserRole.CALL_CENTER:
        return "Call Center";
      case UserRole.CHECKER:
        return "Checador";
      case UserRole.DRIVER:
        return "Chófer";
      case UserRole.TICKET_OFFICE:
        return "Taquilla";
      default:
        return role;
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
        <Button onClick={() => setIsCreateDialogOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" />
          Agregar Usuario
        </Button>
      </div>

      <Tabs
        value={currentTab}
        onValueChange={(value) => setCurrentTab(value as "users" | "invitations")}
        className="w-full"
      >
        <TabsList className="grid grid-cols-2 w-[400px] mb-6">
          <TabsTrigger value="users">Usuarios</TabsTrigger>
          <TabsTrigger value="invitations">Invitaciones</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Usuarios Activos</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => usersQuery.refetch()}
                  disabled={usersQuery.isLoading}
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${usersQuery.isLoading ? "animate-spin" : ""}`}
                  />
                  Actualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {usersQuery.isLoading ? (
                <div className="flex justify-center items-center h-32">
                  <p className="text-muted-foreground">Cargando usuarios...</p>
                </div>
              ) : usersQuery.isError ? (
                <div className="flex justify-center items-center h-32">
                  <p className="text-red-500">Error al cargar usuarios</p>
                </div>
              ) : usersQuery.data && usersQuery.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-2 text-left">Foto</th>
                        <th className="px-4 py-2 text-left">Nombre</th>
                        <th className="px-4 py-2 text-left">Correo</th>
                        <th className="px-4 py-2 text-left">Rol</th>
                        <th className="px-4 py-2 text-left">Contraseña</th>
                        <th className="px-4 py-2 text-left">Fecha Registro</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersQuery.data.map((user) => (
                        <tr key={user.id} className="border-b hover:bg-muted/50">
                          <td className="px-4 py-2">
                            <Avatar className="h-10 w-10">
                              {user.profilePicture ? (
                                <AvatarImage src={user.profilePicture} alt={`${user.firstName} ${user.lastName}`} />
                              ) : (
                                <AvatarFallback className="bg-primary/5 text-primary">
                                  {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                                </AvatarFallback>
                              )}
                            </Avatar>
                          </td>
                          <td className="px-4 py-2">
                            {user.firstName} {user.lastName}
                          </td>
                          <td className="px-4 py-2">{user.email}</td>
                          <td className="px-4 py-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                              {getRoleDisplayName(user.role)}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            <span className="font-mono text-xs bg-gray-100 p-1 rounded">
                              {/* Mostramos solo los 6 primeros caracteres de la contraseña para debugging */}
                              {user.password?.substring(0, 6) || ''}...
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex justify-center items-center h-32">
                  <p className="text-muted-foreground">
                    No hay usuarios registrados. Crea uno usando el botón "Agregar Usuario".
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invitations">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Invitaciones Activas</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => invitationsQuery.refetch()}
                  disabled={invitationsQuery.isLoading}
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${invitationsQuery.isLoading ? "animate-spin" : ""}`}
                  />
                  Actualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {invitationsQuery.isLoading ? (
                <div className="flex justify-center items-center h-32">
                  <p className="text-muted-foreground">Cargando invitaciones...</p>
                </div>
              ) : invitationsQuery.isError ? (
                <div className="flex justify-center items-center h-32">
                  <p className="text-red-500">Error al cargar invitaciones</p>
                </div>
              ) : invitationsQuery.data && invitationsQuery.data.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-2 text-left">Token</th>
                        <th className="px-4 py-2 text-left">Rol</th>
                        <th className="px-4 py-2 text-left">Destinatario</th>
                        <th className="px-4 py-2 text-left">Fecha Creación</th>
                        <th className="px-4 py-2 text-left">Expira</th>
                        <th className="px-4 py-2 text-left">Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invitationsQuery.data.map((invitation) => (
                        <tr key={invitation.id} className="border-b hover:bg-muted/50">
                          <td className="px-4 py-2 font-mono text-xs">
                            {invitation.token.substring(0, 8)}...
                          </td>
                          <td className="px-4 py-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                              {getRoleDisplayName(invitation.role)}
                            </span>
                          </td>
                          <td className="px-4 py-2">
                            {invitation.email || "No especificado"}
                          </td>
                          <td className="px-4 py-2">
                            {new Date(invitation.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2">
                            {new Date(invitation.expiresAt).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-2">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                invitation.usedAt
                                  ? "bg-green-100 text-green-800"
                                  : "bg-yellow-100 text-yellow-800"
                              }`}
                            >
                              {invitation.usedAt ? "Utilizada" : "Pendiente"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex justify-center items-center h-32">
                  <p className="text-muted-foreground">
                    No hay invitaciones activas. Crea una usando el botón "Agregar Usuario".
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para crear invitación */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Usuario</DialogTitle>
          </DialogHeader>
          <CreateInvitationForm onComplete={() => {
            invitationsQuery.refetch();
          }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}