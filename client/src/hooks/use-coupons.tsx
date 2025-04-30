import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coupon, CouponDuration, DiscountType, InsertCoupon } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export function useCoupons() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Obtener todos los cupones
  const {
    data: coupons = [],
    isLoading,
    error,
    refetch
  } = useQuery<Coupon[]>({
    queryKey: ["/api/coupons"],
    refetchOnWindowFocus: false,
  });

  // Crear un nuevo cupón
  const createCoupon = useMutation({
    mutationFn: async (data: Omit<InsertCoupon, "companyId" | "createdById" | "isActive">) => {
      // El backend asignará el companyId y createdById del usuario autenticado
      const response = await apiRequest("POST", "/api/coupons", data);
      const newCoupon = await response.json();
      return newCoupon;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      toast({
        title: "Cupón creado",
        description: "El cupón se ha creado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al crear cupón",
        description: error.message || "Ha ocurrido un error al crear el cupón",
        variant: "destructive",
      });
    },
  });

  // Desactivar un cupón
  const deactivateCoupon = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("PUT", `/api/coupons/${id}/deactivate`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/coupons"] });
      toast({
        title: "Cupón desactivado",
        description: "El cupón ha sido desactivado correctamente",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al desactivar cupón",
        description: error.message || "Ha ocurrido un error al desactivar el cupón",
        variant: "destructive",
      });
    },
  });

  // Validar un código de cupón
  const validateCoupon = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest("GET", `/api/coupons/validate/${code}`);
      return response.json();
    },
    onError: (error: any) => {
      toast({
        title: "Error al validar cupón",
        description: error.message || "El cupón no es válido o ha expirado",
        variant: "destructive",
      });
    },
  });

  // Tipos de descuento para select
  const discountTypes = [
    { value: DiscountType.PERCENTAGE, label: "Porcentaje (%)" },
    { value: DiscountType.FIXED, label: "Monto fijo ($)" },
  ];

  // Duración para select
  const durationOptions = [
    { value: CouponDuration.ONE_HOUR, label: "1 hora" },
    { value: CouponDuration.ONE_DAY, label: "24 horas" },
    { value: CouponDuration.TWO_DAYS, label: "48 horas" },
    { value: CouponDuration.ONE_WEEK, label: "1 semana" },
    { value: CouponDuration.PERMANENT, label: "Sin expiración" },
  ];

  return {
    coupons,
    isLoading,
    error,
    refetch,
    createCoupon,
    deactivateCoupon,
    validateCoupon,
    discountTypes,
    durationOptions,
  };
}