import { useState, useEffect } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";

// UI Components
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

// Esquema de validación para el formulario
const packageFormSchema = z.object({
  senderName: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres" }),
  senderLastName: z.string().min(2, { message: "El apellido debe tener al menos 2 caracteres" }),
  senderPhone: z.string().min(10, { message: "El teléfono debe tener al menos 10 dígitos" }),
  recipientName: z.string().min(2, { message: "El nombre debe tener al menos 2 caracteres" }),
  recipientLastName: z.string().min(2, { message: "El apellido debe tener al menos 2 caracteres" }),
  recipientPhone: z.string().min(10, { message: "El teléfono debe tener al menos 10 dígitos" }),
  packageDescription: z.string().min(5, { message: "La descripción debe tener al menos 5 caracteres" }),
  price: z.coerce.number().min(0, { message: "El precio no puede ser negativo" }),
  usesSeats: z.boolean().default(false),
  seatsQuantity: z.coerce.number()
    .min(0, { message: "La cantidad no puede ser negativa" })
    .default(0),
  isPaid: z.boolean().default(false),
  paymentMethod: z.string().optional(),
  defaultPaymentMethod: z.string().default("efectivo"),
  deliveryStatus: z.string().default("pendiente"),
});

// Tipo para los valores del formulario
type PackageFormValues = z.infer<typeof packageFormSchema>;

// Props para el componente del formulario
interface PackageFormProps {
  tripId?: number;
  packageId?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PackageForm({ tripId, packageId, onSuccess, onCancel }: PackageFormProps) {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [tripInfo, setTripInfo] = useState<{ availableSeats: number } | null>(null);
  
  // Valores por defecto para el formulario
  const defaultValues: Partial<PackageFormValues> = {
    senderName: "",
    senderLastName: "",
    senderPhone: "",
    recipientName: "",
    recipientLastName: "",
    recipientPhone: "",
    packageDescription: "",
    price: 0,
    usesSeats: false,
    seatsQuantity: 0,
    isPaid: false,
    paymentMethod: "efectivo",
    defaultPaymentMethod: "efectivo",
    deliveryStatus: "pendiente",
  };
  
  // Crear el esquema de validación actualizado con los asientos disponibles
  // Usaremos una variable para almacenar el máximo de asientos disponibles
  const [maxAvailableSeats, setMaxAvailableSeats] = useState<number>(10);
  
  // Configuración del formulario con el esquema básico
  const form = useForm<PackageFormValues>({
    resolver: zodResolver(packageFormSchema),
    defaultValues,
  });
  
  // Actualizar la cantidad máxima de asientos cuando se carga la información del viaje
  useEffect(() => {
    if (tripInfo) {
      // Obtener la cantidad de asientos que usa actualmente este paquete (si estamos editando)
      let currentPackageSeats = 0;
      
      // Si estamos editando un paquete existente, necesitamos saber cuántos asientos usaba anteriormente
      if (packageId && form.getValues().usesSeats) {
        currentPackageSeats = form.getValues().seatsQuantity || 0;
      }
      
      // Calcular el máximo disponible: asientos del viaje + los que ya usaba este paquete (si es edición)
      const maxSeats = tripInfo.availableSeats + currentPackageSeats;
      
      console.log(`Viaje con ${tripInfo.availableSeats} asientos disponibles, paquete usa ${currentPackageSeats}, máximo: ${maxSeats}`);
      
      // Actualizar el estado con el máximo calculado
      setMaxAvailableSeats(maxSeats);
    }
  }, [tripInfo, packageId, form]);
  
  // Cargar datos del viaje seleccionado
  useEffect(() => {
    async function fetchTripInfo() {
      if (!tripId) return;
      
      try {
        const response = await fetch(`/api/trips/${tripId}`);
        if (!response.ok) {
          throw new Error('Error al cargar la información del viaje');
        }
        
        const tripData = await response.json();
        setTripInfo({
          availableSeats: tripData.availableSeats
        });
        
        console.log(`Viaje ID ${tripId} tiene ${tripData.availableSeats} asientos disponibles`);
      } catch (error) {
        console.error('Error al cargar información del viaje:', error);
        // No mostramos toast de error para no interrumpir el flujo
      }
    }
    
    fetchTripInfo();
  }, [tripId]);

  // Cargar datos del paquete existente si se está editando
  useEffect(() => {
    async function fetchPackageData() {
      if (!packageId) return;
      
      setIsLoading(true);
      try {
        const response = await fetch(`/api/packages/${packageId}`);
        if (!response.ok) {
          throw new Error('Error al cargar los datos del paquete');
        }
        
        const packageData = await response.json();
        // Actualizar el formulario con los datos del paquete
        form.reset({
          senderName: packageData.senderName,
          senderLastName: packageData.senderLastName,
          senderPhone: packageData.senderPhone,
          recipientName: packageData.recipientName,
          recipientLastName: packageData.recipientLastName,
          recipientPhone: packageData.recipientPhone,
          packageDescription: packageData.packageDescription,
          price: packageData.price,
          usesSeats: packageData.usesSeats || false,
          seatsQuantity: packageData.seatsQuantity || 0,
          isPaid: packageData.isPaid,
          paymentMethod: packageData.paymentMethod || "efectivo",
          defaultPaymentMethod: packageData.paymentMethod || "efectivo",
          deliveryStatus: packageData.deliveryStatus || "pendiente",
        });
        
        // Si es un paquete existente, también actualizamos el ID del viaje
        if (!tripId && packageData.tripId) {
          const packageTripId = packageData.tripId;
          // Cargar información del viaje asociado al paquete
          try {
            const tripResponse = await fetch(`/api/trips/${packageTripId}`);
            if (tripResponse.ok) {
              const tripData = await tripResponse.json();
              setTripInfo({
                availableSeats: tripData.availableSeats
              });
              console.log(`Viaje ID ${packageTripId} tiene ${tripData.availableSeats} asientos disponibles`);
            }
          } catch (tripError) {
            console.error('Error al cargar información del viaje del paquete:', tripError);
          }
        }
      } catch (error) {
        console.error('Error al cargar el paquete:', error);
        toast({
          title: 'Error',
          description: 'No se pudo cargar la información del paquete',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchPackageData();
  }, [packageId, form, toast, tripId]);
  
  // Obtener valores para condicionar campos
  const isPaid = form.watch("isPaid");
  const usesSeats = form.watch("usesSeats");
  const defaultPaymentMethod = form.watch("defaultPaymentMethod");
  
  // Escuchar cambios en el estado de pago para actualizar el método de pago
  useEffect(() => {
    if (isPaid) {
      // Si se marca como pagado, asegurarnos que se mantiene el método seleccionado en el campo específico
      console.log("Paquete marcado como pagado, método de pago por defecto deshabilitado");
    } else {
      // Si se desmarca como pagado, actualizar el método de pago principal desde el predeterminado
      form.setValue("paymentMethod", defaultPaymentMethod || "efectivo");
      console.log(`Paquete no marcado como pagado, usando método por defecto: ${defaultPaymentMethod}`);
    }
  }, [isPaid, defaultPaymentMethod, form]);
  
  // Mutación para guardar el paquete
  const saveMutation = useMutation({
    mutationFn: async (data: PackageFormValues) => {
      const packageData = {
        ...data,
        tripId: tripId,
      };
      
      // Si tenemos ID de paquete, estamos actualizando, de lo contrario creando nuevo
      const method = packageId ? "PATCH" : "POST";
      const url = packageId ? `/api/packages/${packageId}` : "/api/packages";
      
      const response = await apiRequest(method, url, packageData);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al guardar el paquete");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: packageId ? "Paquete actualizado" : "Paquete registrado",
        description: packageId 
          ? "El paquete ha sido actualizado exitosamente" 
          : "El paquete ha sido registrado exitosamente",
        variant: "default",
      });
      form.reset(defaultValues);
      
      // Invalidar la caché de paquetes
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      
      // Invalidar también la caché de viajes para actualizar los asientos disponibles
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setIsSubmitting(false);
    },
  });
  
  // Manejar el envío del formulario
  const onSubmit = (data: PackageFormValues) => {
    // Validación adicional para asientos
    if (data.usesSeats && data.seatsQuantity > 0) {
      // Verificar que no exceda los asientos disponibles
      if (data.seatsQuantity > maxAvailableSeats) {
        form.setError("seatsQuantity", {
          type: "manual",
          message: `No hay suficientes asientos disponibles (máximo ${maxAvailableSeats})`
        });
        return;
      }
    }
    
    // Si no está marcado como pagado, usar el método de pago predeterminado
    if (!data.isPaid) {
      data.paymentMethod = data.defaultPaymentMethod;
      console.log(`Usando método de pago predeterminado: ${data.defaultPaymentMethod}`);
    }
    
    // Eliminar el campo defaultPaymentMethod antes de enviar, ya que no existe en el esquema del backend
    const { defaultPaymentMethod, ...packageData } = data;
    
    setIsSubmitting(true);
    saveMutation.mutate(packageData as PackageFormValues);
  };
  
  // Si está cargando los datos del paquete, mostrar un indicador
  if (isLoading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Cargando datos...</CardTitle>
          <CardDescription>
            Cargando información del paquete...
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{packageId ? "Editar Paquete" : "Registro de Paquete"}</CardTitle>
        <CardDescription>
          {packageId 
            ? "Solo puedes editar el precio y el método de pago del paquete"
            : "Ingresa los datos del remitente, destinatario y detalles del paquete"
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Datos del Remitente</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="senderName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre del remitente" {...field} disabled={!!packageId} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="senderLastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellido</FormLabel>
                      <FormControl>
                        <Input placeholder="Apellido del remitente" {...field} disabled={!!packageId} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="senderPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Número de teléfono" 
                        {...field} 
                        type="tel"
                        disabled={!!packageId}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Datos del Destinatario</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="recipientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre del destinatario" {...field} disabled={!!packageId} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="recipientLastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellido</FormLabel>
                      <FormControl>
                        <Input placeholder="Apellido del destinatario" {...field} disabled={!!packageId} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="recipientPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teléfono</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Número de teléfono" 
                        {...field} 
                        type="tel"
                        disabled={!!packageId}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Detalles del Paquete</h3>
              <FormField
                control={form.control}
                name="packageDescription"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción del Paquete</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Describa el contenido y características del paquete" 
                        {...field} 
                        disabled={!!packageId}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Precio del Envío (MXN)</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="0.00" 
                        {...field} 
                        type="number"
                        step="0.01"
                        min="0"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              {/* Campo para el método de pago predeterminado (siempre visible) */}
              <div className="form-field">
                <FormItem>
                  <FormLabel>Método de Pago</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      // Actualizar nuestro estado interno
                      form.setValue("defaultPaymentMethod" as any, value);
                      
                      // Si no está marcado como pagado, actualizamos también el método de pago principal
                      if (!isPaid) {
                        form.setValue("paymentMethod", value);
                      }
                    }} 
                    defaultValue={form.getValues("defaultPaymentMethod" as any) || "efectivo"}
                    disabled={isPaid}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione un método de pago" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="transferencia">Transferencia</SelectItem>
                      <SelectItem value="tarjeta">Tarjeta</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {isPaid ? "Este campo está deshabilitado porque el paquete ya está marcado como pagado." : 
                    "Seleccione el método de pago para este envío."}
                  </FormDescription>
                </FormItem>
              </div>
              
              <FormField
                control={form.control}
                name="usesSeats"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Ocupar asientos</FormLabel>
                      <FormDescription>
                        ¿El paquete requiere ocupar asientos de pasajeros?
                      </FormDescription>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={!!packageId}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              {usesSeats && (
                <FormField
                  control={form.control}
                  name="seatsQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cantidad de asientos</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="1" 
                          {...field} 
                          type="number"
                          min="1"
                          max={maxAvailableSeats}
                          disabled={!!packageId}
                          onChange={(e) => {
                            // Limitar el valor al máximo disponible
                            const value = parseInt(e.target.value);
                            if (value > maxAvailableSeats) {
                              field.onChange(maxAvailableSeats);
                            } else {
                              field.onChange(value);
                            }
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        {tripInfo ? 
                          `Máximo ${maxAvailableSeats} asientos disponibles en este viaje` : 
                          'Cargando asientos disponibles...'}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
              
              <FormField
                control={form.control}
                name="isPaid"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Pago realizado</FormLabel>
                      <FormDescription>
                        ¿El cliente ya ha pagado por el envío?
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
              
              {isPaid && (
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Método de Pago</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione un método de pago" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="efectivo">Efectivo</SelectItem>
                          <SelectItem value="transferencia">Transferencia</SelectItem>
                          <SelectItem value="tarjeta">Tarjeta</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            
            <div className="flex justify-end space-x-2">
              {onCancel && (
                <Button 
                  variant="outline" 
                  type="button"
                  onClick={onCancel}
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
              )}
              <Button 
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Guardando...
                  </>
                ) : (
                  "Guardar Paquete"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}