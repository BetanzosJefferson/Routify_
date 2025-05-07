import { z } from "zod";

// Validación para el formulario de publicación de viajes
export const publishTripValidationSchema = z.object({
  routeId: z.number().positive({ message: "Debe seleccionar una ruta" }),
  startDate: z.string().min(1, { message: "Debe especificar una fecha de inicio" }),
  endDate: z.string().min(1, { message: "Debe especificar una fecha de fin" }),
  capacity: z.number().positive({ message: "La capacidad debe ser mayor a 0" }),
  segmentPrices: z.array(
    z.object({
      origin: z.string(),
      destination: z.string(),
      price: z.number().min(0),
      departureTime: z.string().optional(),
      arrivalTime: z.string().optional(),
    })
  ),
  vehicleId: z.number().nullable().optional(),
  driverId: z.number().nullable().optional(),
});