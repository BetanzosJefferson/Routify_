import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, RefreshCw, Trash2, Edit, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CreateInvitationForm } from "./create-invitation";
import { UserRole, UserRoleType, type User, type Invitation } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Form, 
  FormControl, 
  FormDescription,
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// Esquema de validación para la edición de usuario
const userEditSchema = z.object({
  email: z.string().email("Correo electrónico inválido").optional(),
  password: z.union([
    z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
    z.string().length(0) // Permite cadena vacía
  ]).optional(),
  commissionPercentage: z.number().min(0, "El porcentaje no puede ser negativo").max(100, "El porcentaje no puede superar 100").optional(),
});

type UserEditFormValues = z.infer<typeof userEditSchema>;

export function UsersPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [currentTab, setCurrentTab] = useState<"users" | "invitations">("users");
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  
  // Mutation para eliminar usuario
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const response = await apiRequest("DELETE", `/api/users/${userId}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al eliminar usuario");
      }
      return userId;
    },
    onSuccess: () => {
      // Refrescar lista de usuarios
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsDeleteDialogOpen(false);
      setUserToDelete(null);
      
      toast({
        title: "Usuario eliminado",
        description: "El usuario ha sido eliminado correctamente",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo eliminar el usuario",
      });
    }
  });
  
  // Función para iniciar el proceso de eliminación
  const handleDeleteUser = (userId: number) => {
    setUserToDelete(userId);
    setIsDeleteDialogOpen(true);
  };
  
  // Función para confirmar la eliminación
  const confirmDeleteUser = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete);
    }
  };
  
  // Formulario para editar usuario
  const form = useForm<UserEditFormValues>({
    resolver: zodResolver(userEditSchema),
    defaultValues: {
      email: "",
      password: "",
      commissionPercentage: undefined,
    },
  });

  // Mutation para actualizar usuario
  const updateUserMutation = useMutation({
    mutationFn: async (data: { id: number; data: UserEditFormValues }) => {
      const response = await apiRequest("PATCH", `/api/users/${data.id}`, data.data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al actualizar usuario");
      }
      return await response.json();
    },
    onSuccess: () => {
      // Refrescar lista de usuarios
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsEditDialogOpen(false);
      setUserToEdit(null);
      form.reset();
      
      toast({
        title: "Usuario actualizado",
        description: "El usuario ha sido actualizado correctamente",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "No se pudo actualizar el usuario",
      });
    }
  });
  
  // Función para iniciar el proceso de edición
  const handleEditUser = (user: User) => {
    setUserToEdit(user);
    
    // Configurar valores por defecto (solo email y porcentaje de comisión)
    form.reset({
      email: user.email,
      password: "",
      commissionPercentage: user.commissionPercentage ?? undefined,
    });
    
    setIsEditDialogOpen(true);
  };
  
  // Función para enviar el formulario de edición
  const onSubmitEditForm = (data: UserEditFormValues) => {
    if (!userToEdit) return;
    
    // Filtrar campos vacíos o indefinidos
    const filteredData: UserEditFormValues = {};
    if (data.email && data.email !== userToEdit.email) filteredData.email = data.email;
    if (data.password && data.password.trim() !== '') filteredData.password = data.password;
    if (data.commissionPercentage !== undefined) filteredData.commissionPercentage = data.commissionPercentage;
    
    // Solo enviar si hay datos a actualizar
    if (Object.keys(filteredData).length > 0) {
      updateUserMutation.mutate({ id: userToEdit.id, data: filteredData });
    } else {
      toast({
        title: "Sin cambios",
        description: "No se detectaron cambios para guardar",
      });
      setIsEditDialogOpen(false);
    }
  };

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
      case UserRole.COMMISSIONER:
        return "Comisionista";
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
                <>
                  {/* Vista de escritorio - Tabla */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="px-4 py-2 text-left">Foto</th>
                          <th className="px-4 py-2 text-left">Nombre</th>
                          <th className="px-4 py-2 text-left">Correo</th>
                          <th className="px-4 py-2 text-left">Rol</th>
                          <th className="px-4 py-2 text-left">Fecha Registro</th>
                          <th className="px-4 py-2 text-left">Acciones</th>
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
                              {user.role === UserRole.COMMISSIONER && user.commissionPercentage !== null && (
                                <div className="text-xs text-muted-foreground mt-1">
                                  Comisión: {user.commissionPercentage}%
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-2">{user.email}</td>
                            <td className="px-4 py-2">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                {getRoleDisplayName(user.role)}
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-2 space-x-2">
                              {/* Botones de acción */}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditUser(user)}
                                title="Editar usuario"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              
                              {/* Botón de eliminar solo visible para superAdmin o Dueño */}
                              {(currentUser?.role === UserRole.SUPER_ADMIN || currentUser?.role === UserRole.OWNER) && (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteUser(user.id)}
                                  disabled={deleteUserMutation.isPending || (user.id === currentUser.id)}
                                  title={user.id === currentUser.id ? "No puedes eliminar tu propia cuenta" : "Eliminar usuario"}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Vista móvil - Tarjetas */}
                  <div className="md:hidden space-y-4">
                    {usersQuery.data.map((user) => (
                      <Card key={user.id} className="border border-gray-200 shadow-sm">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-12 w-12">
                                {user.profilePicture ? (
                                  <AvatarImage src={user.profilePicture} alt={`${user.firstName} ${user.lastName}`} />
                                ) : (
                                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                                    {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                                  </AvatarFallback>
                                )}
                              </Avatar>
                              <div className="flex-1">
                                <div className="font-semibold text-gray-900">
                                  {user.firstName} {user.lastName}
                                </div>
                                <div className="text-sm text-gray-600">{user.email}</div>
                                {user.role === UserRole.COMMISSIONER && user.commissionPercentage !== null && (
                                  <div className="text-xs text-blue-600 mt-1">
                                    Comisión: {user.commissionPercentage}%
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditUser(user)}
                                className="h-8 w-8"
                                title="Editar usuario"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              
                              {/* Botón de eliminar solo visible para superAdmin o Dueño */}
                              {(currentUser?.role === UserRole.SUPER_ADMIN || currentUser?.role === UserRole.OWNER) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteUser(user.id)}
                                  disabled={deleteUserMutation.isPending || (user.id === currentUser.id)}
                                  className="h-8 w-8"
                                  title={user.id === currentUser.id ? "No puedes eliminar tu propia cuenta" : "Eliminar usuario"}
                                >
                                  <Trash2 className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </div>
                          </div>

                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Rol</span>
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                {getRoleDisplayName(user.role)}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Fecha de registro</span>
                              <span className="text-sm font-medium">
                                {new Date(user.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </>
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
      
      {/* Dialog para confirmar eliminación */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Estás seguro que deseas eliminar este usuario? Esta acción no puede deshacerse.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmDeleteUser}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Eliminar Usuario"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Dialog para editar usuario */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Editar Usuario</DialogTitle>
            <DialogDescription>
              {userToEdit && (
                <div>
                  Editando a: <strong>{userToEdit.firstName} {userToEdit.lastName}</strong> 
                  (<span className="text-primary">{getRoleDisplayName(userToEdit.role)}</span>)
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmitEditForm)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correo Electrónico</FormLabel>
                    <FormControl>
                      <Input placeholder="correo@ejemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nueva Contraseña</FormLabel>
                    <FormControl>
                      <Input 
                        type="password" 
                        placeholder="Dejar vacío para mantener la actual" 
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription className="text-xs italic">
                      Opcional: Solo llena este campo si deseas cambiar la contraseña
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Mostrar campo de porcentaje de comisión solo para comisionistas */}
              {userToEdit?.role === UserRole.COMMISSIONER && (
                <FormField
                  control={form.control}
                  name="commissionPercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Porcentaje de Comisión</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Ej: 10"
                          min={0}
                          max={100}
                          step={0.5}
                          {...field}
                          value={field.value ?? ''}
                          onChange={(e) => {
                            const value = e.target.value ? parseFloat(e.target.value) : undefined;
                            field.onChange(value);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={updateUserMutation.isPending}
                >
                  {updateUserMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    "Guardar Cambios"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}