import { z } from "zod";

// Esquema para el formulario de datos de empresa
export const companyFormSchema = z.object({
  name: z.string().min(1, "El nombre de la empresa es requerido"),
  bankName: z.string().optional(),
  accountHolder: z.string().optional(),
  clabe: z.string().optional(),
  contactPhone: z.string().optional(),
});

// Esquema para el formulario de comisiones
export const commissionFormSchema = z.object({
  name: z.string().min(1, "El nombre de la comisión es requerido"),
  percentage: z.number().min(0, "El porcentaje debe ser un valor positivo"),
  isActive: z.boolean().default(true),
  description: z.string().optional(),
});

// Esquema para el formulario de cupones
export const couponFormSchema = z.object({
  code: z.string().min(1, "El código es requerido"),
  discountPercentage: z.number().min(1, "El porcentaje de descuento debe ser al menos 1%").max(100, "El porcentaje de descuento no puede superar el 100%"),
  maxUses: z.number().min(1, "El número máximo de usos debe ser al menos 1"),
  expirationDate: z.date({
    required_error: "La fecha de expiración es requerida",
  }),
  isActive: z.boolean().default(true),
  description: z.string().optional(),
});

// Esquema para el formulario de transferencia de pasajeros
export const passengerTransferFormSchema = z.object({
  reservationId: z.number({
    required_error: "El ID de la reservación es requerido",
  }),
  targetCompanyId: z.string().min(1, "La empresa destino es requerida"),
  transferReason: z.string().optional(),
});