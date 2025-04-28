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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, Check, Plus, Edit, Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { couponFormSchema } from "@/lib/form-schemas";
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

// Tipo para cupón
interface Coupon {
  id: number;
  code: string;
  discountPercentage: number;
  maxUses: number;
  usedCount: number;
  expirationDate: string;
  isActive: boolean;
  description?: string;
  companyId: string;
  createdAt: string;
  updatedAt?: string;
}

// Tipos para el formulario
type CouponFormValues = z.infer<typeof couponFormSchema>;

export default function CouponsPage() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);

  // Consulta para obtener los cupones
  const { data: coupons, isLoading } = useQuery({
    queryKey: ["/api/coupons"],
    queryFn: async () => {
      const response = await fetch("/api/coupons");
      if (!response.ok) {
        throw new Error("Error al cargar los cupones");
      }
      return response.json() as Promise<Coupon[]>;
    },
  });

  // Configuración del formulario de creación
  const createForm = useForm<CouponFormValues>({
    resolver: zodResolver(couponFormSchema),
    defaultValues: {
      code: "",
      discountPercentage: 10,
      maxUses: 1,
      expirationDate: new Date(new Date().setMonth(new Date().getMonth() + 1)),
      isActive: true,
      description: "",
    },
  });

  // Configuración del formulario de edición
  const editForm = useForm<CouponFormValues>({
    resolver: zodResolver(couponFormSchema),
    defaultValues: {
      code: "",
      discountPercentage: 10,
      maxUses: 1,
      expirationDate: new Date(),
      isActive: true,
      description: "",
    },
  });

  // Mutación para crear cupón
  const createMutation = useMutation({
    mutationFn: async (data: CouponFormValues) => {
      const response = await apiRequest("POST", "/api/coupons", data);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al crear el cupón");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Cupón creado",
        description: "El cupón ha sido creado correctamente.",
        variant: "default",
      });
      setIsCreateDialogOpen(false);
      createForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al crear",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutación para editar cupón
  const updateMutation = useMutation({
    mutationFn: async (data: CouponFormValues & { id: number }) => {
      const { id, ...formData } = data;
      const response = await apiRequest("PATCH", `/api/coupons/${id}`, formData);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al actualizar el cupón");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Cupón actualizado",
        description: "El cupón ha sido actualizado correctamente.",
        variant: "default",
      });
      setIsEditDialogOpen(false);
      setSelectedCoupon(null);
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error al actualizar",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutación para eliminar cupón
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/coupons/${id}`, {});
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al eliminar el cupón");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Cupón eliminado",
        description: "El cupón ha sido eliminado correctamente.",
        variant: "default",
      });
      setIsDeleteDialogOpen(false);
      setSelectedCoupon(null);
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
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
  function onCreateSubmit(data: CouponFormValues) {
    createMutation.mutate(data);
  }

  // Manejar el envío del formulario de edición
  function onEditSubmit(data: CouponFormValues) {
    if (selectedCoupon) {
      updateMutation.mutate({ ...data, id: selectedCoupon.id });
    }
  }

  // Manejar inicio de edición
  function handleEdit(coupon: Coupon) {
    setSelectedCoupon(coupon);
    editForm.reset({
      code: coupon.code,
      discountPercentage: coupon.discountPercentage,
      maxUses: coupon.maxUses,
      expirationDate: new Date(coupon.expirationDate),
      isActive: coupon.isActive,
      description: coupon.description || "",
    });
    setIsEditDialogOpen(true);
  }

  // Manejar inicio de eliminación
  function handleDelete(coupon: Coupon) {
    setSelectedCoupon(coupon);
    setIsDeleteDialogOpen(true);
  }

  // Confirmar eliminación
  function confirmDelete() {
    if (selectedCoupon) {
      deleteMutation.mutate(selectedCoupon.id);
    }
  }

  // Verificar si un cupón está expirado
  function isExpired(expirationDate: string): boolean {
    return new Date(expirationDate) < new Date();
  }

  return (
    <div className="container py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Gestión de Cupones</h1>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Nuevo Cupón
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Crear Nuevo Cupón</DialogTitle>
              <DialogDescription>
                Define los detalles para un nuevo cupón de descuento.
              </DialogDescription>
            </DialogHeader>
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <FormField
                  control={createForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código de Cupón</FormLabel>
                      <FormControl>
                        <Input placeholder="VERANO2024" {...field} className="uppercase" />
                      </FormControl>
                      <FormDescription>
                        Código único que los clientes usarán para aplicar el descuento.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="discountPercentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Porcentaje de Descuento</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input
                              type="number"
                              placeholder="10"
                              min={1}
                              max={100}
                              {...field}
                              onChange={(e) => field.onChange(Number(e.target.value))}
                            />
                          </div>
                        </FormControl>
                        <FormDescription>
                          Valor entre 1% y 100%
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="maxUses"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número Máximo de Usos</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="1"
                            min={1}
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </FormControl>
                        <FormDescription>
                          Cuántas veces se puede usar este cupón
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={createForm.control}
                  name="expirationDate"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Fecha de Expiración</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}
                            >
                              {field.value ? (
                                format(field.value, "PPP", { locale: es })
                              ) : (
                                <span>Seleccionar fecha</span>
                              )}
                              <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        Fecha límite para redimir el cupón
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
                          placeholder="Detalles sobre este cupón y su uso"
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
                          Este cupón estará disponible para su uso inmediato.
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
                      "Crear Cupón"
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
          <CardTitle>Cupones Disponibles</CardTitle>
          <CardDescription>
            Administra los cupones de descuento para tus clientes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : !coupons || coupons.length === 0 ? (
            <div className="text-center py-10 border rounded-lg">
              <p className="text-muted-foreground mb-4">No hay cupones configurados</p>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Primer Cupón
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descuento</TableHead>
                    <TableHead>Usos</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Expira</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((coupon) => (
                    <TableRow key={coupon.id}>
                      <TableCell className="font-medium">{coupon.code}</TableCell>
                      <TableCell>{coupon.discountPercentage}%</TableCell>
                      <TableCell>
                        {coupon.usedCount} / {coupon.maxUses}
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={
                            !coupon.isActive 
                              ? "outline" 
                              : isExpired(coupon.expirationDate) 
                                ? "destructive" 
                                : "default"
                          }
                        >
                          {!coupon.isActive 
                            ? "Inactivo" 
                            : isExpired(coupon.expirationDate) 
                              ? "Expirado" 
                              : "Activo"
                          }
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(coupon.expirationDate), "dd/MM/yyyy")}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {coupon.description || "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(coupon)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(coupon)}
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
            <DialogTitle>Editar Cupón</DialogTitle>
            <DialogDescription>
              Actualiza los detalles del cupón de descuento.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código de Cupón</FormLabel>
                    <FormControl>
                      <Input placeholder="VERANO2024" {...field} className="uppercase" />
                    </FormControl>
                    <FormDescription>
                      Código único que los clientes usarán para aplicar el descuento.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={editForm.control}
                  name="discountPercentage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Porcentaje de Descuento</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type="number"
                            placeholder="10"
                            min={1}
                            max={100}
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                          />
                        </div>
                      </FormControl>
                      <FormDescription>
                        Valor entre 1% y 100%
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={editForm.control}
                  name="maxUses"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número Máximo de Usos</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="1"
                          min={1}
                          {...field}
                          onChange={(e) => field.onChange(Number(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Cuántas veces se puede usar este cupón
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={editForm.control}
                name="expirationDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Fecha de Expiración</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={`w-full pl-3 text-left font-normal ${!field.value && "text-muted-foreground"}`}
                          >
                            {field.value ? (
                              format(field.value, "PPP", { locale: es })
                            ) : (
                              <span>Seleccionar fecha</span>
                            )}
                            <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      Fecha límite para redimir el cupón
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
                        placeholder="Detalles sobre este cupón y su uso"
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
                        Este cupón estará disponible para su uso.
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
              Esta acción no se puede deshacer. Se eliminará permanentemente el cupón
              {selectedCoupon && <strong> "{selectedCoupon.code}"</strong>} del sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
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