import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useCoupons } from "@/hooks/use-coupons";
import { zodResolver } from "@hookform/resolvers/zod";
import { DialogClose } from "@radix-ui/react-dialog";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

// Esquema de validación para el formulario de cupón
const couponFormSchema = z.object({
  code: z.string().max(5, "El código debe tener máximo 5 caracteres").optional(),
  isRandomCode: z.boolean().default(true),
  discountType: z.string({
    required_error: "Selecciona el tipo de descuento",
  }),
  discountValue: z.coerce.number({
    required_error: "Ingresa el valor del descuento",
    invalid_type_error: "Ingresa un número válido",
  })
    .min(1, "El valor mínimo es 1")
    .max(100, "El valor máximo es 100 para porcentajes"),
  duration: z.string({
    required_error: "Selecciona la duración del cupón",
  }),
});

export default function CouponsPage() {
  const { 
    coupons, 
    isLoading, 
    createCoupon, 
    deactivateCoupon, 
    discountTypes, 
    durationOptions 
  } = useCoupons();

  const form = useForm<z.infer<typeof couponFormSchema>>({
    resolver: zodResolver(couponFormSchema),
    defaultValues: {
      isRandomCode: true,
      discountType: "PERCENTAGE",
      discountValue: 10,
      duration: "PERMANENT",
    },
  });

  const onSubmit = async (data: z.infer<typeof couponFormSchema>) => {
    // Si isRandomCode es true, no enviamos el código (el backend lo generará)
    const formData = {
      ...data,
      code: data.isRandomCode ? undefined : data.code,
    };

    createCoupon.mutate(formData as any);
    form.reset({
      isRandomCode: true,
      discountType: "PERCENTAGE",
      discountValue: 10,
      duration: "PERMANENT",
    });
  };

  // Determinar si el cupón está activo o expirado
  const isCouponActive = (coupon: any) => {
    if (!coupon.isActive) return false;
    if (!coupon.expiresAt) return true;
    return new Date(coupon.expiresAt) > new Date();
  };

  // Formatear la fecha de expiración
  const formatExpirationDate = (expiresAt: string | null | Date) => {
    if (!expiresAt) return "Sin expiración";
    const date = typeof expiresAt === 'string' ? new Date(expiresAt) : expiresAt;
    return format(date, "dd/MM/yyyy HH:mm", { locale: es });
  };

  return (
    <DashboardLayout defaultTab="coupons">
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold">Gestión de Cupones</h1>
            <p className="text-gray-500">Crea y administra cupones de descuento para tus clientes</p>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button>Crear Cupón</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Crear Nuevo Cupón</DialogTitle>
                <DialogDescription>
                  Configura los detalles del cupón de descuento.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="isRandomCode"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                        <div className="space-y-0.5">
                          <FormLabel>Código aleatorio</FormLabel>
                          <FormDescription>
                            Generar un código aleatorio de 5 caracteres
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

                  {!form.watch("isRandomCode") && (
                    <FormField
                      control={form.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Código</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="ABC12" 
                              {...field} 
                              value={field.value || ""}
                              maxLength={5}
                              className="uppercase"
                            />
                          </FormControl>
                          <FormDescription>
                            Ingresa un código de máximo 5 caracteres
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}

                  <FormField
                    control={form.control}
                    name="discountType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de descuento</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona un tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {discountTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))}
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
                        <FormLabel>Valor del descuento</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={1} 
                            max={form.watch("discountType") === "PERCENTAGE" ? 100 : undefined}
                            {...field} 
                          />
                        </FormControl>
                        <FormDescription>
                          {form.watch("discountType") === "PERCENTAGE"
                            ? "Ingresa un porcentaje entre 1 y 100"
                            : "Ingresa un monto fijo en pesos"}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Duración</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona una duración" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {durationOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">Cancelar</Button>
                    </DialogClose>
                    <Button 
                      type="submit" 
                      disabled={createCoupon.isPending}
                    >
                      {createCoupon.isPending ? "Creando..." : "Crear Cupón"}
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
              Administra los cupones de descuento de tu empresa
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-[250px]" />
                      <Skeleton className="h-4 w-[200px]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : coupons.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No hay cupones disponibles</p>
                <p className="text-sm text-gray-400 mt-2">Crea un nuevo cupón para comenzar</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Descuento</TableHead>
                      <TableHead>Expiración</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>Usos</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coupons.map((coupon) => (
                      <TableRow key={coupon.id}>
                        <TableCell className="font-medium">{coupon.code}</TableCell>
                        <TableCell>
                          {coupon.discountType === "PERCENTAGE"
                            ? `${coupon.discountValue}%`
                            : `$${coupon.discountValue}`}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar size={16} />
                            <span>{formatExpirationDate(coupon.expiresAt)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {isCouponActive(coupon) ? (
                            <Badge className="bg-green-500">Activo</Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-500 border-red-200">
                              Inactivo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{coupon.usedCount}</TableCell>
                        <TableCell className="text-right">
                          {isCouponActive(coupon) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deactivateCoupon.mutate(coupon.id)}
                              disabled={deactivateCoupon.isPending}
                            >
                              Desactivar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}