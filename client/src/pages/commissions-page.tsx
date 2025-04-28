import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { 
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { commissionFormSchema } from "@/lib/form-schemas";
import { 
  Plus, 
  Percent, 
  Edit, 
  Trash2, 
  Loader2, 
  CheckCircle2
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Tipo para comisión
interface Commission {
  id: number;
  name: string;
  percentage: number;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
  companyId: string;
}

// Tipos para el formulario
type CommissionFormValues = z.infer<typeof commissionFormSchema>;

export default function CommissionsPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);

  // Consulta para obtener las comisiones
  const { data: commissions, isLoading } = useQuery({
    queryKey: ["/api/commissions"],
    queryFn: async () => {
      const response = await fetch("/api/commissions");
      if (!response.ok) {
        throw new Error("Error al cargar las comisiones");
      }
      return response.json() as Promise<Commission[]>;
    },
  });

  // Configuración del formulario de creación
  const createForm = useForm<CommissionFormValues>({
    resolver: zodResolver(commissionFormSchema),
    defaultValues: {
      name: "",
      percentage: 0,
      description: "",
      isActive: true,
    },
  });

  // Configuración del formulario de edición
  const editForm = useForm<CommissionFormValues>({
    resolver: zodResolver(commissionFormSchema),
    defaultValues: {
      name: "",
      percentage: 0,
      description: "",
      isActive: true,
    },
  });

  // Mutación para crear comisión
  const createMutation = useMutation({
    mutationFn: async (data: CommissionFormValues) => {
      const formattedData = {
        ...data,
        percentage: Number(data.percentage),
      };
      const response = await apiRequest("POST", "/api/commissions", formattedData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al crear la comisión");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Comisión creada",
        description: "La comisión ha sido creada correctamente.",
        variant: "default",
      });
      setIsCreateDialogOpen(false);
      createForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/commissions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al crear",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutación para editar comisión
  const updateMutation = useMutation({
    mutationFn: async (data: CommissionFormValues & { id: number }) => {
      const { id, ...formData } = data;
      const formattedData = {
        ...formData,
        percentage: Number(formData.percentage),
      };
      const response = await apiRequest("PATCH", `/api/commissions/${id}`, formattedData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al actualizar la comisión");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Comisión actualizada",
        description: "La comisión ha sido actualizada correctamente.",
        variant: "default",
      });
      setIsEditDialogOpen(false);
      setSelectedCommission(null);
      queryClient.invalidateQueries({ queryKey: ["/api/commissions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutación para eliminar comisión
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/commissions/${id}`, {});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al eliminar la comisión");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Comisión eliminada",
        description: "La comisión ha sido eliminada correctamente.",
        variant: "default",
      });
      setIsDeleteDialogOpen(false);
      setSelectedCommission(null);
      queryClient.invalidateQueries({ queryKey: ["/api/commissions"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al eliminar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Manejar el envío del formulario de creación
  function onCreateSubmit(data: CommissionFormValues) {
    createMutation.mutate(data);
  }

  // Manejar el envío del formulario de edición
  function onEditSubmit(data: CommissionFormValues) {
    if (selectedCommission) {
      updateMutation.mutate({ ...data, id: selectedCommission.id });
    }
  }

  // Manejar inicio de edición
  function handleEdit(commission: Commission) {
    setSelectedCommission(commission);
    editForm.reset({
      name: commission.name,
      percentage: commission.percentage, // Usar directamente el número
      description: commission.description || "",
      isActive: commission.isActive,
    });
    setIsEditDialogOpen(true);
  }

  // Manejar inicio de eliminación
  function handleDelete(commission: Commission) {
    setSelectedCommission(commission);
    setIsDeleteDialogOpen(true);
  }

  // Confirmar eliminación
  function confirmDelete() {
    if (selectedCommission) {
      deleteMutation.mutate(selectedCommission.id);
    }
  }

  return (
    <div className="container py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Gestión de Comisiones</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nueva Comisión
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Crear Nueva Comisión</DialogTitle>
              <DialogDescription>
                Define los detalles para una nueva estructura de comisión.
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre de la Comisión</FormLabel>
                      <FormControl>
                        <Input placeholder="Comisión Estándar" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="percentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Porcentaje</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            placeholder="10"
                            {...field}
                            className="pl-7"
                          />
                          <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                            <Percent className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Valor entre 0 y 100 (sin el símbolo %).
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción (Opcional)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe el propósito o condiciones de esta comisión"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Activo</FormLabel>
                        <FormDescription>
                          Esta comisión estará disponible para los comisionistas.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      "Crear Comisión"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comisiones Disponibles</CardTitle>
          <CardDescription>
            Administra las estructuras de comisión para tus colaboradores.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !commissions || commissions.length === 0 ? (
            <div className="text-center py-10 border rounded-lg">
              <p className="text-muted-foreground mb-4">No hay comisiones configuradas</p>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Agregar Primera Comisión
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Porcentaje</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {commissions.map((commission) => (
                    <TableRow key={commission.id}>
                      <TableCell className="font-medium">{commission.name}</TableCell>
                      <TableCell>{commission.percentage}%</TableCell>
                      <TableCell>
                        <Badge variant={commission.isActive ? "default" : "secondary"}>
                          {commission.isActive ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {commission.description || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(commission)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(commission)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de edición */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Comisión</DialogTitle>
            <DialogDescription>
              Actualiza los detalles de la comisión.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de la Comisión</FormLabel>
                    <FormControl>
                      <Input placeholder="Comisión Estándar" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Porcentaje</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          placeholder="10"
                          {...field}
                          className="pl-7"
                        />
                        <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                          <Percent className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Valor entre 0 y 100 (sin el símbolo %).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción (Opcional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describe el propósito o condiciones de esta comisión"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Activo</FormLabel>
                      <FormDescription>
                        Esta comisión estará disponible para los comisionistas.
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Actualizando...
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

      {/* Diálogo de confirmación de eliminación */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente la comisión 
              <span className="font-semibold"> {selectedCommission?.name}</span>.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Eliminar"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}