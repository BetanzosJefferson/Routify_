import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { CalendarIcon, Percent, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { apiRequest } from "@/lib/queryClient";

// Esquema de validación para el formulario
const couponFormSchema = z.object({
  code: z.string()
    .min(3, "El código debe tener al menos 3 caracteres")
    .max(20, "El código debe tener máximo 20 caracteres")
    .refine(val => /^[A-Z0-9]+$/.test(val), {
      message: "El código solo puede contener letras mayúsculas y números",
    }),
  discountType: z.enum(["percentage", "fixed"], {
    required_error: "Selecciona el tipo de descuento",
  }),
  discountValue: z.number({
    required_error: "Ingresa el valor del descuento",
    invalid_type_error: "Debe ser un número",
  }).positive("El valor debe ser positivo"),
  maxUses: z.number({
    required_error: "Ingresa el número máximo de usos",
    invalid_type_error: "Debe ser un número entero",
  }).int("Debe ser un número entero").positive("Debe ser mayor a cero"),
  expiryDate: z.date({
    required_error: "Selecciona la fecha de expiración",
  }),
  description: z.string().optional(),
  minPurchaseAmount: z.number({
    invalid_type_error: "Debe ser un número",
  }).min(0, "No puede ser negativo").optional(),
  active: z.boolean().default(true),
});

type CouponFormValues = z.infer<typeof couponFormSchema>;

interface EditCouponModalProps {
  open: boolean;
  coupon: any;
  onClose: () => void;
}

export function EditCouponModal({ open, coupon, onClose }: EditCouponModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Estado para controlar si el descuento es porcentaje o monto fijo
  const [isPercentage, setIsPercentage] = useState(coupon.discountType === "percentage");
  
  const form = useForm<CouponFormValues>({
    resolver: zodResolver(couponFormSchema),
    defaultValues: {
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue: coupon.discountValue,
      maxUses: coupon.maxUses,
      description: coupon.description || "",
      minPurchaseAmount: coupon.minPurchaseAmount || 0,
      active: coupon.active,
      expiryDate: new Date(coupon.expiryDate),
    },
  });
  
  // Mutación para actualizar el cupón
  const updateCouponMutation = useMutation({
    mutationFn: async (data: CouponFormValues) => {
      return await apiRequest("PUT", `/api/coupons/${coupon.id}`, data);
    },
    onSuccess: () => {
      toast({
        title: "Cupón actualizado",
        description: "El cupón ha sido actualizado exitosamente.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar el cupón",
        description: error.message || "Ha ocurrido un error. Por favor, inténtalo de nuevo.",
        variant: "destructive",
      });
    },
  });
  
  // Manejar el envío del formulario
  const onSubmit = async (values: CouponFormValues) => {
    updateCouponMutation.mutate(values);
  };
  
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Cupón Promocional</DialogTitle>
          <DialogDescription>
            Modifica la información del cupón "{coupon.code}".
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Código del cupón */}
            <FormField
              control={form.control}
              name="code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Código del cupón</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="VERANO2025"
                      {...field}
                      onBlur={(e) => {
                        field.onChange(e.target.value.toUpperCase());
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Código promocional que los clientes ingresarán.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tipo de descuento */}
            <FormField
              control={form.control}
              name="discountType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de descuento</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      setIsPercentage(value === "percentage");
                    }}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona el tipo de descuento" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="percentage">Porcentaje (%)</SelectItem>
                      <SelectItem value="fixed">Monto fijo ($)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Descuento por porcentaje o monto fijo.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Valor del descuento */}
            <FormField
              control={form.control}
              name="discountValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor del descuento</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        {isPercentage ? (
                          <Percent className="h-4 w-4 text-gray-400" />
                        ) : (
                          <DollarSign className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                      <Input
                        type="number"
                        step={isPercentage ? "1" : "0.01"}
                        min="0"
                        max={isPercentage ? "100" : undefined}
                        className="pl-10"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    {isPercentage
                      ? "Porcentaje de descuento (1-100)"
                      : "Monto fijo de descuento en pesos"}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Fecha de expiración */}
            <FormField
              control={form.control}
              name="expiryDate"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Fecha de expiración</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={`w-full pl-3 text-left font-normal ${
                            !field.value && "text-muted-foreground"
                          }`}
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
                    Fecha en la que el cupón dejará de ser válido.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Máximo de usos */}
            <FormField
              control={form.control}
              name="maxUses"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número máximo de usos</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={coupon.usesCount} // No permitir reducir por debajo de los usos actuales
                      step="1"
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value))}
                    />
                  </FormControl>
                  <FormDescription>
                    Cuántas veces se puede usar este cupón en total. Actualmente usado: {coupon.usesCount} veces.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Monto mínimo de compra */}
            <FormField
              control={form.control}
              name="minPurchaseAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monto mínimo de compra (opcional)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <DollarSign className="h-4 w-4 text-gray-400" />
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        className="pl-10"
                        {...field}
                        onChange={(e) => 
                          field.onChange(e.target.value ? parseFloat(e.target.value) : 0)
                        }
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Monto mínimo requerido para aplicar el cupón. Deja en 0 para no establecer mínimo.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Descripción */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción (opcional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descuento promocional para temporada de verano"
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Breve descripción del cupón para referencia interna.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Activo */}
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Cupón activo</FormLabel>
                    <FormDescription>
                      Desactiva esta opción si quieres que el cupón no sea válido temporalmente.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={updateCouponMutation.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={updateCouponMutation.isPending}
              >
                {updateCouponMutation.isPending ? "Guardando..." : "Guardar Cambios"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}