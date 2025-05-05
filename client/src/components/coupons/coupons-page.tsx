import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { TicketIcon, Edit, Trash, Plus, AlertCircle, Check, X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { format } from "date-fns";
import { es } from "date-fns/locale";

// Definir el esquema de validación para el formulario de cupones
const couponFormSchema = z.object({
  code: z.string()
    .max(5, "El código no debe exceder 5 caracteres")
    .optional()
    .transform(val => val === "" ? undefined : val),
  usageLimit: z.number()
    .min(1, "El límite de usos debe ser al menos 1"),
  expirationHours: z.number()
    .min(1, "La caducidad debe ser al menos 1 hora"),
  discountType: z.enum(["fixed", "percentage"], {
    required_error: "El tipo de descuento es requerido",
  }),
  discountValue: z.number()
    .min(1, "El valor del descuento debe ser entre 1 y 100 para porcentajes, o mayor a 0 para montos fijos"),
  isActive: z.boolean().default(true),
  generateRandomCode: z.boolean().default(false),
}).refine((data) => {
  // Si es porcentaje, debe estar entre 1 y 100
  if (data.discountType === "percentage") {
    return data.discountValue >= 1 && data.discountValue <= 100;
  }
  return true;
}, { 
  message: "El porcentaje debe estar entre 1% y 100%",
  path: ["discountValue"]  // Esto hace que el error se muestre en el campo discountValue
}).refine((data) => {
  // Si no se genera código aleatorio, el código es requerido
  return data.generateRandomCode || data.code !== undefined;
}, {
  message: "El código es requerido si no se genera automáticamente",
  path: ["code"]
});

type CouponFormValues = z.infer<typeof couponFormSchema>;

type Coupon = {
  id: number;
  code: string;
  usageLimit: number;
  usageCount: number;
  expirationHours: number;
  createdAt: Date;
  expiresAt: Date;
  discountType: "fixed" | "percentage";
  discountValue: number;
  isActive: boolean;
  companyId: string | null;
};

export default function CouponsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  // Consulta para obtener cupones
  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ["/api/coupons"],
    queryFn: async () => {
      const response = await fetch("/api/coupons");
      if (!response.ok) {
        throw new Error("Error al cargar cupones");
      }
      return response.json();
    },
  });

  // Mutación para crear/actualizar cupones
  const mutation = useMutation({
    mutationFn: async (values: CouponFormValues) => {
      const url = isEditing 
        ? `/api/coupons/${selectedCoupon?.id}` 
        : "/api/coupons";
      
      const method = isEditing ? "PATCH" : "POST";
      
      // Ya no generamos código aleatorio aquí porque ahora
      // está visible en el campo 'code' gracias al switch

      // Quitar el campo generateRandomCode antes de enviar al servidor
      const { generateRandomCode, ...dataToSend } = values;
      
      console.log("Enviando datos al servidor:", dataToSend);
      const response = await apiRequest(method, url, dataToSend);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al procesar cupón");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      toast({
        title: isEditing ? "Cupón actualizado" : "Cupón creado",
        description: isEditing 
          ? "El cupón ha sido actualizado exitosamente" 
          : "El cupón ha sido creado exitosamente",
      });
      setIsOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutación para eliminar cupones
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/coupons/${id}`);
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al eliminar cupón");
      }
      
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      toast({
        title: "Cupón eliminado",
        description: "El cupón ha sido eliminado exitosamente",
      });
      setIsConfirmDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Configurar el formulario
  const form = useForm<CouponFormValues>({
    resolver: zodResolver(couponFormSchema),
    defaultValues: {
      code: "",
      usageLimit: 1,
      expirationHours: 24,
      discountType: "percentage",
      discountValue: 10,
      isActive: true,
      generateRandomCode: false,
    },
  });

  // Función para abrir el formulario de creación
  const handleCreate = () => {
    setIsEditing(false);
    setSelectedCoupon(null);
    form.reset({
      code: "",
      usageLimit: 1,
      expirationHours: 24,
      discountType: "percentage",
      discountValue: 10,
      isActive: true,
      generateRandomCode: false,
    });
    setIsOpen(true);
  };

  // Función para abrir el formulario de edición
  const handleEdit = (coupon: Coupon) => {
    setIsEditing(true);
    setSelectedCoupon(coupon);
    form.reset({
      code: coupon.code,
      usageLimit: coupon.usageLimit,
      expirationHours: coupon.expirationHours,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      isActive: coupon.isActive,
      generateRandomCode: false,
    });
    setIsOpen(true);
  };

  // Función para confirmar eliminación
  const handleDelete = (coupon: Coupon) => {
    setSelectedCoupon(coupon);
    setIsConfirmDialogOpen(true);
  };

  // Función que se ejecuta al enviar el formulario
  const onSubmit = (values: CouponFormValues) => {
    mutation.mutate(values);
  };

  // Helper para formatear fechas
  const formatDate = (date: Date) => {
    return format(new Date(date), "dd 'de' MMMM yyyy, HH:mm", { locale: es });
  };

  // Helper para mostrar el estado del cupón
  const getStatusBadge = (coupon: Coupon) => {
    const now = new Date();
    const expiresAt = new Date(coupon.expiresAt);
    
    if (!coupon.isActive) {
      return (
        <Badge variant="destructive" className="gap-1">
          <X size={14} />
          Inactivo
        </Badge>
      );
    }
    
    if (expiresAt < now) {
      return (
        <Badge variant="outline" className="gap-1 text-orange-500 border-orange-500">
          <AlertCircle size={14} />
          Caducado
        </Badge>
      );
    }
    
    if (coupon.usageCount >= coupon.usageLimit) {
      return (
        <Badge variant="outline" className="gap-1 text-purple-500 border-purple-500">
          <AlertCircle size={14} />
          Límite alcanzado
        </Badge>
      );
    }
    
    return (
      <Badge variant="default" className="gap-1 bg-green-100 text-green-800 hover:bg-green-200">
        <Check size={14} />
        Activo
      </Badge>
    );
  };

  // Helper para mostrar el tipo de descuento
  const getDiscountText = (coupon: Coupon) => {
    if (coupon.discountType === "percentage") {
      return `${coupon.discountValue}%`;
    } else {
      return `$${coupon.discountValue.toFixed(2)}`;
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Cupones</h1>
        <Button onClick={handleCreate} className="gap-2">
          <Plus size={16} />
          Crear Cupón
        </Button>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Gestión de Cupones</CardTitle>
          <CardDescription>
            Administra los cupones de descuento para tus clientes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <p>Cargando cupones...</p>
            </div>
          ) : coupons.length === 0 ? (
            <div className="text-center py-6">
              <TicketIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-semibold text-gray-900">No hay cupones</h3>
              <p className="mt-1 text-sm text-gray-500">
                Empieza creando un nuevo cupón de descuento.
              </p>
              <div className="mt-6">
                <Button onClick={handleCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Crear nuevo cupón
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Descuento</TableHead>
                    <TableHead>Uso</TableHead>
                    <TableHead>Creado</TableHead>
                    <TableHead>Caduca</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {coupons.map((coupon: Coupon) => (
                    <TableRow key={coupon.id}>
                      <TableCell className="font-medium">{coupon.code}</TableCell>
                      <TableCell>{getDiscountText(coupon)}</TableCell>
                      <TableCell>{coupon.usageCount} / {coupon.usageLimit}</TableCell>
                      <TableCell>{formatDate(coupon.createdAt)}</TableCell>
                      <TableCell>{formatDate(coupon.expiresAt)}</TableCell>
                      <TableCell>{getStatusBadge(coupon)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="icon"
                                  onClick={() => handleEdit(coupon)}
                                >
                                  <Edit size={16} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Editar</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  size="icon"
                                  onClick={() => handleDelete(coupon)}
                                >
                                  <Trash size={16} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Eliminar</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
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

      {/* Dialog para crear/editar cupones */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Editar Cupón" : "Crear Nuevo Cupón"}
            </DialogTitle>
            <DialogDescription>
              {isEditing 
                ? "Actualiza los detalles del cupón de descuento." 
                : "Completa los campos para crear un nuevo cupón de descuento."}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {!isEditing && (
                <FormField
                  control={form.control}
                  name="generateRandomCode"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Generar código aleatorio
                        </FormLabel>
                        <FormDescription>
                          Activar para generar un código aleatorio de 5 caracteres
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked);
                            if (checked) {
                              // Generar un código aleatorio y mostrarlo en el campo
                              const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
                              let randomCode = "";
                              for (let i = 0; i < 5; i++) {
                                randomCode += chars.charAt(Math.floor(Math.random() * chars.length));
                              }
                              form.setValue("code", randomCode);
                            } else {
                              // Limpiar el campo si se desactiva
                              form.setValue("code", "");
                            }
                          }}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
              
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Código</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Ej: DESC5"
                        maxLength={5}
                        disabled={isEditing || form.watch("generateRandomCode")}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormDescription>
                      {form.watch("generateRandomCode") 
                        ? "Se generará un código aleatorio al crear el cupón." 
                        : "Máximo 5 caracteres."}
                      {isEditing && " No se puede editar el código de un cupón existente."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="discountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Descuento</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccionar tipo de descuento" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                          <SelectItem value="fixed">Monto Fijo ($)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="discountValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Valor del Descuento</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={form.watch("discountType") === "percentage" ? 1 : 0.01}
                          max={form.watch("discountType") === "percentage" ? 100 : undefined}
                          step={form.watch("discountType") === "percentage" ? 1 : 0.01}
                          onChange={e => field.onChange(parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        {form.watch("discountType") === "percentage" 
                          ? "Ingresa un valor entre 1 y 100"
                          : "Ingresa el monto en pesos"
                        }
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="usageLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Límite de Usos</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={1}
                          onChange={e => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Cantidad máxima de veces que se puede usar
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="expirationHours"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Caducidad (horas)</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="number"
                          min={1}
                          onChange={e => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormDescription>
                        Horas hasta que el cupón expire
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Activar Cupón
                      </FormLabel>
                      <FormDescription>
                        El cupón estará disponible para ser utilizado
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
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsOpen(false)}
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit"
                  disabled={mutation.isPending}
                >
                  {mutation.isPending 
                    ? "Guardando..." 
                    : isEditing 
                      ? "Actualizar Cupón" 
                      : "Crear Cupón"
                  }
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmación para eliminar */}
      <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Esto eliminará permanentemente
              el cupón <span className="font-semibold">{selectedCoupon?.code}</span>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedCoupon && deleteMutation.mutate(selectedCoupon.id)}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}