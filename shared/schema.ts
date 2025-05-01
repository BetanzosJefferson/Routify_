import { pgTable, text, serial, integer, boolean, timestamp, json, doublePrecision, jsonb, uuid, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// USER ROLE ENUM
export const UserRole = {
  SUPER_ADMIN: "superAdmin",
  ADMIN: "admin",
  CALL_CENTER: "callCenter",
  CHECKER: "checador",
  DRIVER: "chofer",
  TICKET_OFFICE: "taquilla",
  OWNER: "dueño",
  DEVELOPER: "desarrollador",
  COMMISSIONER: "comisionista",
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

// ROUTE SCHEMA
export const routes = pgTable("routes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  origin: text("origin").notNull(),
  stops: text("stops").array().notNull(),
  destination: text("destination").notNull(),
  companyId: text("company_id"),
});

export const insertRouteSchema = createInsertSchema(routes);
export type InsertRoute = z.infer<typeof insertRouteSchema>;
export type Route = typeof routes.$inferSelect;

// TRIP SCHEMA
export const trips = pgTable("trips", {
  id: serial("id").primaryKey(),
  routeId: integer("route_id").notNull(),
  departureDate: timestamp("departure_date").notNull(),
  departureTime: text("departure_time").notNull(),
  arrivalTime: text("arrival_time").notNull(),
  capacity: integer("capacity").notNull(),
  availableSeats: integer("available_seats").notNull(),
  price: doublePrecision("price").default(0), // Campo calculado a partir de los precios de segmentos
  vehicleType: text("vehicle_type").notNull(),
  segmentPrices: json("segment_prices").notNull(),
  // New fields for sub-trips
  isSubTrip: boolean("is_sub_trip").default(false),
  parentTripId: integer("parent_trip_id"),
  segmentOrigin: text("segment_origin"),
  segmentDestination: text("segment_destination"),
  // Campos para asignación de vehículo y conductor
  vehicleId: integer("vehicle_id"),
  driverId: integer("driver_id"),
  // Nuevo campo para aislamiento de datos por compañía
  companyId: text("company_id")
});

export const insertTripSchema = createInsertSchema(trips);
export type InsertTrip = z.infer<typeof insertTripSchema>;

// Extended trip type with additional fields for API usage 
// (not extending InsertTrip directly to avoid type errors)
export interface TripWithTimes {
  routeId: number;
  departureDate: Date;
  departureTime?: string;
  arrivalTime?: string;
  capacity: number;
  availableSeats: number;
  price: number; 
  vehicleType: string;
  segmentPrices: any;
  isSubTrip: boolean;
  parentTripId: number | null;
  segmentOrigin?: string;
  segmentDestination?: string;
  vehicleId?: number | null;
  driverId?: number | null;
  companyId?: string | null;
}
export type Trip = typeof trips.$inferSelect;

// PASSENGER SCHEMA
export const passengers = pgTable("passengers", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  reservationId: integer("reservation_id").notNull(),
});

export const insertPassengerSchema = createInsertSchema(passengers);
export type InsertPassenger = z.infer<typeof insertPassengerSchema>;
export type Passenger = typeof passengers.$inferSelect;

// PAYMENT STATUS ENUM
export const PaymentStatus = {
  PENDING: "pendiente",
  PAID: "pagado",
  CANCELLED: "cancelado",
} as const;

export type PaymentStatusType = typeof PaymentStatus[keyof typeof PaymentStatus];

// PAYMENT METHOD ENUM
export const PaymentMethod = {
  CASH: "efectivo",
  TRANSFER: "transferencia",
} as const;

export type PaymentMethodType = typeof PaymentMethod[keyof typeof PaymentMethod];

// RESERVATION SCHEMA
export const reservations = pgTable("reservations", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull(),
  totalAmount: doublePrecision("total_amount").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  notes: text("notes"),
  // Campos de pago actualizados
  paymentMethod: text("payment_method").notNull().default(PaymentMethod.CASH), // 'efectivo' o 'transferencia'
  status: text("status").notNull().default("confirmed"), // Estado de la reservación (confirmed, cancelled)
  paymentStatus: text("payment_status").notNull().default(PaymentStatus.PENDING), // Estado del pago (pendiente, pagado, cancelado)
  advanceAmount: doublePrecision("advance_amount").default(0), // Monto del anticipo
  advancePaymentMethod: text("advance_payment_method").default(PaymentMethod.CASH), // Método del anticipo
  createdBy: integer("created_by"), // ID del usuario que crea la reservación
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // Campo para aislamiento de datos por compañía
  companyId: text("company_id"),
});

export const insertReservationSchema = createInsertSchema(reservations);
export type InsertReservation = z.infer<typeof insertReservationSchema>;
export type Reservation = typeof reservations.$inferSelect;

// EXTENDED TYPES FOR FRONTEND

export type RouteWithSegments = Route & {
  segments: Array<{
    origin: string;
    destination: string;
    price?: number;
  }>;
};

export type TripWithRouteInfo = Trip & {
  route: Route;
  numStops: number;
  // Campos adicionales para mostrar información de la empresa
  companyName?: string;
  companyLogo?: string;
  // Información del vehículo y conductor asignados
  assignedVehicle?: Vehicle;
  assignedDriver?: User;
};

export type ReservationWithDetails = Reservation & {
  trip: TripWithRouteInfo;
  passengers: Passenger[];
  createdByUser?: User;
};

export type SegmentPrice = {
  origin: string;
  destination: string;
  price: number;
};

// EXTENDED VALIDATION SCHEMAS

export const createRouteValidationSchema = z.object({
  name: z.string().min(1, "Nombre de la ruta es requerido"),
  origin: z.string().min(1, "Origen es requerido"),
  stops: z.array(z.string()),
  destination: z.string().min(1, "Destino es requerido"),
});

// Definición del tipo de tiempo para paradas
const stopTimeSchema = z.object({
  hour: z.string().min(1, "Hour is required"),
  minute: z.string().min(1, "Minute is required"),
  ampm: z.enum(["AM", "PM"]),
  location: z.string().min(1, "Location is required")
});

export const publishTripValidationSchema = z.object({
  routeId: z.number().min(1, "Route selection is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  capacity: z.number().min(1, "Capacity is required"),
  vehicleType: z.string().min(1, "Vehicle type is required"),
  price: z.number().optional(),
  segmentPrices: z.array(
    z.object({
      origin: z.string(),
      destination: z.string(),
      price: z.number().min(0, "Price must be a positive number"),
      departureTime: z.string().optional(),
      arrivalTime: z.string().optional()
    })
  ),
  // Campo opcional para tiempos de parada personalizados
  stopTimes: z.array(stopTimeSchema).optional(),
  // Campos para asignación de vehículos y conductores
  vehicleId: z.number().optional().nullable(), // ID del vehículo asignado
  driverId: z.number().optional().nullable()   // ID del conductor asignado
});

export const createReservationValidationSchema = z.object({
  tripId: z.number(),
  numPassengers: z.number().min(1, "Al menos 1 pasajero es requerido"),
  passengers: z.array(
    z.object({
      firstName: z.string().min(1, "Nombre es requerido"),
      lastName: z.string().min(1, "Apellido es requerido")
    })
  ),
  email: z.string().email("Correo electrónico válido es requerido"),
  phone: z.string().min(1, "Número de teléfono es requerido"),
  totalAmount: z.number().min(0, "El monto total debe ser un número positivo"),
  // Nuevos campos
  paymentMethod: z.enum([PaymentMethod.CASH, PaymentMethod.TRANSFER], {
    required_error: "Método de pago es requerido",
    invalid_type_error: "Método de pago debe ser efectivo o transferencia"
  }),
  advanceAmount: z.number().min(0, "El anticipo debe ser un número positivo").optional(),
  advancePaymentMethod: z.enum([PaymentMethod.CASH, PaymentMethod.TRANSFER], {
    required_error: "Método de pago del anticipo es requerido",
    invalid_type_error: "Método de pago del anticipo debe ser efectivo o transferencia"
  }).optional(),
  paymentStatus: z.enum([PaymentStatus.PENDING, PaymentStatus.PAID], {
    required_error: "Estado de pago es requerido"
  }).optional(),
  notes: z.string().optional(),
  createdBy: z.number().optional()
}).superRefine((data, ctx) => {
  // Validar que el anticipo no sea mayor que el monto total
  if (data.advanceAmount && data.advanceAmount > data.totalAmount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "El anticipo no puede ser mayor que el monto total",
      path: ["advanceAmount"]
    });
  }
  
  // Si el anticipo es igual al monto total, el estado de pago debería ser PAGADO
  if (data.advanceAmount && data.advanceAmount === data.totalAmount) {
    if (data.paymentStatus !== PaymentStatus.PAID) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Si el anticipo es igual al monto total, el estado de pago debe ser PAGADO",
        path: ["paymentStatus"]
      });
    }
  }
});

// LOCATION DATA SCHEMA
export const locationData = pgTable("location_data", {
  id: serial("id").primaryKey(),
  state: text("state").notNull(),
  code: text("code").notNull(),
  municipalities: jsonb("municipalities").notNull()
});

export const insertLocationSchema = createInsertSchema(locationData);
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type Location = typeof locationData.$inferSelect;

export type Municipality = {
  name: string;
  code: string;
};

// SCHEMA DE UNIDADES (VEHÍCULOS)
export const vehicles = pgTable("vehicles", {
  id: serial("id").primaryKey(),
  plates: text("plates").notNull().unique(),
  brand: text("brand").notNull(),
  model: text("model").notNull(),
  economicNumber: text("economic_number").notNull().unique(),
  capacity: integer("capacity").notNull(),
  hasAC: boolean("has_ac").default(false),
  hasRecliningSeats: boolean("has_reclining_seats").default(false),
  services: text("services").array(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // Campo para asociar el vehículo con una compañía
  companyId: text("company_id"),
});

export const insertVehicleSchema = createInsertSchema(vehicles);
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;
export type Vehicle = typeof vehicles.$inferSelect;

// SCHEMA DE COMISIONES
export const commissions = pgTable("commissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  amount: doublePrecision("amount").notNull(),
  percentage: boolean("percentage").default(false),
  tripId: integer("trip_id").references(() => trips.id),
  routeId: integer("route_id").references(() => routes.id),
  // Campo para asociar la comisión con una compañía
  companyId: text("company_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCommissionSchema = createInsertSchema(commissions);
export type InsertCommission = z.infer<typeof insertCommissionSchema>;
export type Commission = typeof commissions.$inferSelect;

// RELACIONES ENTRE TABLAS
export const routeRelations = relations(routes, ({ many }) => ({
  trips: many(trips),
}));

export const tripRelations = relations(trips, ({ one, many }) => ({
  route: one(routes, {
    fields: [trips.routeId],
    references: [routes.id]
  }),
  subTrips: many(trips, {
    relationName: 'parentTrip'
  }),
  parentTrip: one(trips, {
    fields: [trips.parentTripId],
    references: [trips.id],
    relationName: 'parentTrip'
  }),
  vehicle: one(vehicles, {
    fields: [trips.vehicleId],
    references: [vehicles.id]
  }),
  driver: one(users, {
    fields: [trips.driverId],
    references: [users.id]
  }),
  reservations: many(reservations)
}));

export const reservationRelations = relations(reservations, ({ one, many }) => ({
  trip: one(trips, {
    fields: [reservations.tripId],
    references: [trips.id]
  }),
  passengers: many(passengers),
  createdByUser: one(users, {
    fields: [reservations.createdBy],
    references: [users.id]
  })
}));

export const passengerRelations = relations(passengers, ({ one }) => ({
  reservation: one(reservations, {
    fields: [passengers.reservationId],
    references: [reservations.id]
  })
}));

// USER SCHEMA
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default(UserRole.TICKET_OFFICE),
  company: text("company").default(""),
  profilePicture: text("profile_picture").default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // Campo para referenciar al usuario que invitó/creó este usuario
  invitedById: integer("invited_by_id").references(() => users.id),
  // Campo para referenciar la compañía a la que pertenece el usuario
  companyId: text("company_id").default(""),
  // Campo para almacenar el porcentaje de comisión para usuarios comisionistas
  commissionPercentage: doublePrecision("commission_percentage").default(0),
});

export const insertUserSchema = createInsertSchema(users)
  .extend({
    email: z.string().email("Por favor ingrese un correo electrónico válido"),
    password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// INVITATION SCHEMA
export const invitations = pgTable("invitations", {
  id: serial("id").primaryKey(),
  token: uuid("token").notNull().unique().defaultRandom(),
  role: text("role").notNull(),
  email: text("email"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdById: integer("created_by_id").notNull(),
});

export const insertInvitationSchema = createInsertSchema(invitations);
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Invitation = typeof invitations.$inferSelect;

// USER RELATIONS
export const userRelations = relations(users, ({ many, one }) => ({
  invitationsCreated: many(invitations),
  // Relación para los usuarios invitados por este usuario
  invitedUsers: many(users, { relationName: 'invitedBy' }),
  // Relación con el usuario que invitó a este usuario
  invitedBy: one(users, {
    fields: [users.invitedById],
    references: [users.id],
    relationName: 'invitedBy'
  }),
  // Relación para las reservaciones creadas por este usuario
  createdReservations: many(reservations, {
    fields: [users.id],
    references: [reservations.createdBy]
  })
}));

export const invitationRelations = relations(invitations, ({ one }) => ({
  createdBy: one(users, {
    fields: [invitations.createdById],
    references: [users.id]
  })
}));

// VEHICLE RELATIONS
export const vehicleRelations = relations(vehicles, ({ many }) => ({
  // Podemos agregar relaciones en el futuro según se necesite
}));

// COMMISSION RELATIONS
export const commissionRelations = relations(commissions, ({ one }) => ({
  trip: one(trips, {
    fields: [commissions.tripId],
    references: [trips.id]
  }),
  route: one(routes, {
    fields: [commissions.routeId],
    references: [routes.id]
  })
}));
