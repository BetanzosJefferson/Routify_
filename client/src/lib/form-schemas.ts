import { z } from "zod";

// Esquema para el formulario de datos bancarios de la empresa
export const companyFormSchema = z.object({
  bankName: z.string().min(1, { message: "El nombre del banco es obligatorio" }),
  accountHolder: z.string().min(1, { message: "El titular de la cuenta es obligatorio" }),
  clabe: z.string()
    .min(18, { message: "La CLABE debe tener 18 dígitos" })
    .max(18, { message: "La CLABE debe tener 18 dígitos" })
    .regex(/^\d+$/, { message: "La CLABE debe contener solo números" })
    .optional()
    .or(z.literal("")),
  contactPhone: z.string()
    .min(10, { message: "El teléfono debe tener al menos 10 dígitos" })
    .optional()
    .or(z.literal(""))
});

// Esquema para el formulario de comisión
export const commissionFormSchema = z.object({
  name: z.string().min(1, { message: "El nombre de la comisión es obligatorio" }),
  percentage: z.string()
    .transform((val) => Number(val.replace('%', '').trim()))
    .refine((val) => !isNaN(val) && val >= 0 && val <= 100, {
      message: "El porcentaje debe ser un número entre 0 y 100"
    }),
  description: z.string().optional().or(z.literal("")),
  isActive: z.boolean().default(true)
});

// Esquema para el formulario de cupones
export const couponFormSchema = z.object({
  code: z.string()
    .min(3, { message: "El código debe tener al menos 3 caracteres" })
    .max(15, { message: "El código no debe exceder 15 caracteres" })
    .regex(/^[A-Z0-9]+$/, { message: "Solo letras mayúsculas y números" }),
  discountPercentage: z.string()
    .transform((val) => Number(val.replace('%', '').trim()))
    .refine((val) => !isNaN(val) && val > 0 && val <= 100, {
      message: "El descuento debe ser un número entre 1 y 100"
    }),
  maxUses: z.string()
    .transform((val) => parseInt(val.trim()))
    .refine((val) => !isNaN(val) && val > 0, {
      message: "El número máximo de usos debe ser mayor a 0"
    }),
  expirationDate: z.date()
    .refine((date) => date > new Date(), {
      message: "La fecha de expiración debe ser posterior a hoy"
    }),
  isActive: z.boolean().default(true),
  description: z.string().optional().or(z.literal(""))
});