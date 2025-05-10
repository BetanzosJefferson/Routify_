import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertPackageSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PriceInput } from "@/components/ui/price-input";
import { CalendarIcon, CheckCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

// Esquema de validación extendido para el formulario
const packageFormSchema = insertPackageSchema.extend({
  tripId: z.number().optional(),
  senderName: z.string().min(2, "El nombre del remitente es requerido"),
  senderLastName: z.string().min(2, "El apellido del remitente es requerido"),
  senderPhone: z.string().min(10, "El teléfono debe tener al menos 10 dígitos"),
  recipientName: z.string().min(2, "El nombre del destinatario es requerido"),
  recipientLastName: z.string().min(2, "El apellido del destinatario es requerido"),
  recipientPhone: z.string().min(10, "El teléfono debe tener al menos 10 dígitos"),
  packageDescription: z.string().min(5, "La descripción es requerida"),
  price: z.number().min(1, "El precio es requerido"),
  isPaid: z.boolean().default(false),
  paymentMethod: z.string().optional(),
  deliveryStatus: z.string().default("pendiente"),
});

// Tipo para el formulario
type PackageFormValues = z.infer<typeof packageFormSchema>;

// Tipo para las props del componente
interface PackageFormProps {
  tripId?: number;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function PackageForm({ tripId, onSuccess, onCancel }: PackageFormProps) {
  const { toast } = useToast();
  
  // Configurar el formulario con valores por defecto
  const form = useForm<PackageFormValues>({
    resolver: zodResolver(packageFormSchema),
    defaultValues: {
      tripId: tripId,
      senderName: "",
      senderLastName: "",
      senderPhone: "",
      recipientName: "",
      recipientLastName: "",
      recipientPhone: "",
      packageDescription: "",
      price: 0,
      isPaid: false,
      paymentMethod: "efectivo",
      deliveryStatus: "pendiente",  // Estado predeterminado
    },
  });
  
  // Observar el estado del checkbox de pago
  const isPaid = form.watch("isPaid");
  
  // Mutación para crear un paquete
  const createPackageMutation = useMutation({
    mutationFn: async (data: PackageFormValues) => {
      const response = await apiRequest("POST", "/api/packages", data);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al crear el paquete");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Paquete creado",
        description: "El paquete ha sido creado exitosamente",
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
      form.reset();
      if (onSuccess) onSuccess();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Función para manejar el envío del formulario
  const onSubmit = (data: PackageFormValues) => {
    // Asegurarse de que el método de pago esté configurado cuando está pagado
    if (data.isPaid && !data.paymentMethod) {
      form.setError("paymentMethod", {
        type: "manual",
        message: "Seleccione un método de pago",
      });
      return;
    }
    
    // Si no está pagado, establecer el método de pago como null
    if (!data.isPaid) {
      data.paymentMethod = undefined;
    }
    
    // Enviar los datos
    createPackageMutation.mutate(data);
  };
  
  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle>Nuevo Paquete</CardTitle>
        <CardDescription>
          Complete la información para registrar un nuevo paquete
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Sección de información del remitente */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Información del Remitente</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="senderName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre del remitente" {...field} />
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
                        <Input placeholder="Apellido del remitente" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="senderPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl>
                        <Input placeholder="Teléfono del remitente" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            {/* Sección de información del destinatario */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Información del Destinatario</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="recipientName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre del destinatario" {...field} />
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
                        <Input placeholder="Apellido del destinatario" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="recipientPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl>
                        <Input placeholder="Teléfono del destinatario" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
            
            {/* Sección de información del paquete */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Información del Paquete</h3>
              <div className="grid grid-cols-1 gap-4">
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
                          rows={3}
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
                      <FormLabel>Precio</FormLabel>
                      <FormControl>
                        <PriceInput
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="0.00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="isPaid"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>¿Paquete Pagado?</FormLabel>
                        </div>
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
                            disabled={!isPaid}
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
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>
            </div>
            
            {/* Botones de acción */}
            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={onCancel}
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={createPackageMutation.isPending}
              >
                {createPackageMutation.isPending ? (
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