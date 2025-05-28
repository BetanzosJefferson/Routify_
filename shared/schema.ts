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

// Las definiciones de TripVisibility y TripStatus se han movido más abajo en el archivo

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
  vehicleType: text("vehicle_type"), // Ya no es requerido
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
  companyId: text("company_id"),
  // Campo de visibilidad
  visibility: text("visibility").default("publicado") // publicado, oculto, cancelado
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
  visibility?: string;
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

// RESERVATION STATUS ENUM
export const ReservationStatus = {
  CONFIRMED: "confirmed",
  CANCELED: "canceled",
} as const;

export type ReservationStatusType = typeof ReservationStatus[keyof typeof ReservationStatus];

// TRIP VISIBILITY ENUM
export const TripVisibility = {
  PUBLISHED: "publicado",
  HIDDEN: "oculto",
  CANCELLED: "cancelado",
} as const;

export type TripVisibilityType = typeof TripVisibility[keyof typeof TripVisibility];

// Eliminamos el TRIP STATUS ENUM ya que no se utilizará más

// RESERVATION SCHEMA
export const reservations = pgTable("reservations", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull(),
  totalAmount: doublePrecision("total_amount").notNull(),
  email: text("email"), // Ahora es opcional
  phone: text("phone").notNull(),
  notes: text("notes"),
  // Campos de pago actualizados
  paymentMethod: text("payment_method").notNull().default(PaymentMethod.CASH), // 'efectivo' o 'transferencia'
  status: text("status").notNull().default(ReservationStatus.CONFIRMED), // Estado de la reservación (confirmed, canceled)
  paymentStatus: text("payment_status").notNull().default(PaymentStatus.PENDING), // Estado del pago (pendiente, pagado, cancelado)
  advanceAmount: doublePrecision("advance_amount").default(0), // Monto del anticipo
  advancePaymentMethod: text("advance_payment_method").default(PaymentMethod.CASH), // Método del anticipo
  createdBy: integer("created_by"), // ID del usuario que crea la reservación
  paidBy: integer("paid_by"), // ID del usuario que marca como pagado el ticket
  markedAsPaidAt: timestamp("marked_as_paid_at"), // Fecha y hora en que se marcó como pagado
  commissionPaid: boolean("commission_paid").default(false), // Indicador si la comisión ha sido pagada
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // Campo para aislamiento de datos por compañía
  companyId: text("company_id"),
  // Campos para control de escaneo de ticket
  checkedBy: integer("checked_by"), // ID del usuario que escaneó el ticket
  checkedAt: timestamp("checked_at"), // Fecha y hora del escaneo
  checkCount: integer("check_count").default(0), // Contador de veces que se ha escaneado el ticket
  // Campos para cupones y descuentos
  couponCode: text("coupon_code"), // Código del cupón aplicado
  discountAmount: doublePrecision("discount_amount").default(0), // Monto del descuento aplicado
  originalAmount: doublePrecision("original_amount"), // Monto original antes del descuento
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
  // Campos para terminales
  originTerminal?: string;
  destinationTerminal?: string;
  // Nombre completo de la ruta
  routeName?: string;
};

export type ReservationWithDetails = Reservation & {
  trip: TripWithRouteInfo;
  passengers: Passenger[];
  createdByUser?: User;
  checkedByUser?: User;
  paidByUser?: User;
  companyInfo?: {
    id: string | null;
    name: string;
  };
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
  driverId: z.number().optional().nullable(),  // ID del conductor asignado
  // Campos para visibilidad y estado del viaje
  visibility: z.enum([TripVisibility.PUBLISHED, TripVisibility.HIDDEN, TripVisibility.CANCELLED])
    .default(TripVisibility.PUBLISHED).optional(), // Estado de visibilidad (publicado, oculto, cancelado)
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
  email: z.union([
    z.string().email("Correo electrónico válido es requerido"),
    z.literal(""),
    z.null(),
    z.undefined()
  ]).optional(),
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
  createdBy: z.number().optional(),
  // Campos para cupones y descuentos
  couponCode: z.string().optional(),
  discountAmount: z.number().min(0).optional(),
  originalAmount: z.number().min(0).optional()
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

// CUPONES SCHEMA
export const coupons = pgTable("coupons", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  usageLimit: integer("usage_limit").notNull(), // Cantidad máxima de usos
  usageCount: integer("usage_count").default(0), // Contador de usos actuales
  expirationHours: integer("expiration_hours").notNull(), // Caducidad en horas
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // Fecha calculada de expiración
  discountType: text("discount_type").notNull(), // "fixed" o "percentage"
  discountValue: doublePrecision("discount_value").notNull(), // Valor del descuento
  isActive: boolean("is_active").default(true),
  // Campo para aislamiento de datos por compañía
  companyId: text("company_id"),
});

// SCHEMA DE PRESUPUESTOS DE OPERADORES
export const tripBudgets = pgTable("trip_budgets", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => trips.id),
  amount: doublePrecision("amount").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // Campo para aislamiento de datos por compañía
  companyId: text("company_id"),
});

export const insertTripBudgetSchema = createInsertSchema(tripBudgets);
export type InsertTripBudget = z.infer<typeof insertTripBudgetSchema>;
export type TripBudget = typeof tripBudgets.$inferSelect;

// SCHEMA DE GASTOS DE VIAJE
export const tripExpenses = pgTable("trip_expenses", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull().references(() => trips.id),
  type: text("type").notNull(), // Tipo de gasto: gasolina, casetas, comida, etc.
  amount: doublePrecision("amount").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // Campo para aislamiento de datos por compañía
  companyId: text("company_id"),
  // Campos para el registro del usuario que creó el gasto
  userId: integer("user_id").references(() => users.id),
  createdBy: text("created_by"), // Nombre del usuario que registró el gasto
});

export const insertTripExpenseSchema = createInsertSchema(tripExpenses);
export type InsertTripExpense = z.infer<typeof insertTripExpenseSchema>;
export type TripExpense = typeof tripExpenses.$inferSelect;

export const insertCouponSchema = createInsertSchema(coupons);
export type InsertCoupon = z.infer<typeof insertCouponSchema>;
export type Coupon = typeof coupons.$inferSelect;

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
  }),
  checkedByUser: one(users, {
    fields: [reservations.checkedBy],
    references: [users.id]
  }),
  paidByUser: one(users, {
    fields: [reservations.paidBy],
    references: [users.id]
  })
}));

export const passengerRelations = relations(passengers, ({ one }) => ({
  reservation: one(reservations, {
    fields: [passengers.reservationId],
    references: [reservations.id]
  })
}));

// ESQUEMA DE PAQUETERÍAS
export const packages = pgTable("packages", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").references(() => trips.id),
  
  // Datos del remitente
  senderName: text("sender_name").notNull(),
  senderLastName: text("sender_lastname").notNull(),
  senderPhone: text("sender_phone").notNull(),
  
  // Datos del destinatario
  recipientName: text("recipient_name").notNull(),
  recipientLastName: text("recipient_lastname").notNull(),
  recipientPhone: text("recipient_phone").notNull(),
  
  // Detalles del paquete
  packageDescription: text("package_description").notNull(),
  price: doublePrecision("price").notNull(),
  
  // Uso de asientos
  usesSeats: boolean("uses_seats").default(false).notNull(),
  seatsQuantity: integer("seats_quantity").default(0),
  
  // Estado del pago
  isPaid: boolean("is_paid").default(false).notNull(),
  paymentMethod: text("payment_method"), // efectivo, transferencia, etc.
  paidBy: integer("paid_by"), // ID del usuario que marca como pagado
  
  // Metadatos
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id), // ID del usuario que registra el paquete
  companyId: text("company_id"), // Para el aislamiento de datos por compañía
  
  // Para seguimiento de estado
  deliveryStatus: text("delivery_status").notNull().default("pendiente"), // pendiente, entregado
  deliveredAt: timestamp("delivered_at"),
  deliveredBy: integer("delivered_by"), // ID del usuario que marca como entregado
});

export const insertPackageSchema = createInsertSchema(packages).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true,
  deliveredAt: true 
});
export type InsertPackage = z.infer<typeof insertPackageSchema>;
export type Package = typeof packages.$inferSelect;

// Relaciones para paqueterías
export const packageRelations = relations(packages, ({ one }) => ({
  trip: one(trips, {
    fields: [packages.tripId],
    references: [trips.id]
  }),
  createdByUser: one(users, {
    fields: [packages.createdBy],
    references: [users.id]
  }),
  paidByUser: one(users, {
    fields: [packages.paidBy],
    references: [users.id]
  }),
  deliveredByUser: one(users, {
    fields: [packages.deliveredBy],
    references: [users.id]
  }),
  company: one(companies, {
    fields: [packages.companyId],
    references: [companies.identifier]
  })
}));

// COMPANIES SCHEMA
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  identifier: text("identifier").notNull().unique(), // un identificador único para la compañía (e.g. bamo-456)
  logo: text("logo").default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdBy: integer("created_by").references(() => users.id),
});

export const insertCompanySchema = createInsertSchema(companies);
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Company = typeof companies.$inferSelect;

// USER SCHEMA
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default(UserRole.TICKET_OFFICE),
  company: text("company").default(""), // Este campo se mantiene para compatibilidad con el código existente
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
  metadata: json("metadata"), // Campo para almacenar datos adicionales como las empresas seleccionadas
});

export const insertInvitationSchema = createInsertSchema(invitations);
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Invitation = typeof invitations.$inferSelect;

// TICKET OFFICE USER COMPANIES SCHEMA
export const userCompanies = pgTable("user_companies", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  companyId: text("company_id").notNull().references(() => companies.identifier),
  createdAt: timestamp("created_at").notNull().defaultNow()
});

export const insertUserCompanySchema = createInsertSchema(userCompanies);
export type InsertUserCompany = z.infer<typeof insertUserCompanySchema>;
export type UserCompany = typeof userCompanies.$inferSelect;

// Relaciones para userCompanies
export const userCompanyRelations = relations(userCompanies, ({ one }) => ({
  user: one(users, {
    fields: [userCompanies.userId],
    references: [users.id]
  }),
  company: one(companies, {
    fields: [userCompanies.companyId],
    references: [companies.identifier]
  })
}));

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
  // Relación con las compañías asignadas (para usuarios taquilla)
  assignedCompanies: many(userCompanies),
  // Relación para las reservaciones creadas por este usuario
  createdReservations: many(reservations, {
    fields: [users.id],
    references: [reservations.createdBy]
  }),
  // Relación para las reservaciones escaneadas por este usuario
  checkedReservations: many(reservations, {
    fields: [users.id],
    references: [reservations.checkedBy]
  }),
  // Relación para las reservaciones marcadas como pagadas por este usuario
  paidReservations: many(reservations, {
    fields: [users.id],
    references: [reservations.paidBy]
  }),
  // Relación con la compañía a la que pertenece el usuario
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.identifier]
  }),
  // Relación para las compañías creadas por este usuario
  companiesCreated: many(companies, {
    fields: [users.id],
    references: [companies.createdBy]
  })
}));

export const invitationRelations = relations(invitations, ({ one }) => ({
  createdBy: one(users, {
    fields: [invitations.createdById],
    references: [users.id]
  })
}));

// COMPANY RELATIONS
export const companyRelations = relations(companies, ({ many, one }) => ({
  users: many(users),
  trips: many(trips),
  vehicles: many(vehicles),
  createdByUser: one(users, {
    fields: [companies.createdBy],
    references: [users.id]
  })
}));

// VEHICLE RELATIONS
export const vehicleRelations = relations(vehicles, ({ many, one }) => ({
  // Podemos agregar relaciones en el futuro según se necesite
  company: one(companies, {
    fields: [vehicles.companyId],
    references: [companies.identifier]
  })
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

// ESQUEMA PARA SOLICITUDES DE RESERVACIÓN
export const reservationRequests = pgTable("reservation_requests", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull(),
  passengersData: jsonb("passengers_data").notNull(),
  totalAmount: doublePrecision("total_amount").notNull(),
  email: text("email"),
  phone: text("phone").notNull(),
  paymentStatus: text("payment_status").notNull().default(PaymentStatus.PENDING),
  advanceAmount: doublePrecision("advance_amount").default(0),
  advancePaymentMethod: text("advance_payment_method").default(PaymentMethod.CASH),
  paymentMethod: text("payment_method").notNull().default(PaymentMethod.CASH),
  notes: text("notes"),
  requesterId: integer("requester_id").notNull(), // ID del comisionista que solicita
  companyId: text("company_id").notNull(),
  status: text("status").notNull().default("pendiente"), // pendiente, aprobada, rechazada
  reviewedBy: integer("reviewed_by"), // ID del usuario que aprobó/rechazó
  reviewNotes: text("review_notes"), // Notas de la revisión
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertReservationRequestSchema = createInsertSchema(reservationRequests).omit({ 
  id: true, 
  reviewedBy: true,
  reviewNotes: true,
});
export type InsertReservationRequest = z.infer<typeof insertReservationRequestSchema>;
export type ReservationRequest = typeof reservationRequests.$inferSelect;

// ESQUEMA PARA NOTIFICACIONES
// SCHEMA DE CORTES DE CAJA
export const boxCutoff = pgTable("box_cutoff", {
  id: serial("id").primaryKey(),
  fecha_inicio: timestamp("fecha_inicio").notNull(),
  fecha_fin: timestamp("fecha_fin").notNull(),
  total_ingresos: doublePrecision("total_ingresos").notNull().default(0),
  total_efectivo: doublePrecision("total_efectivo").notNull().default(0),
  total_transferencias: doublePrecision("total_transferencias").notNull().default(0),
  user_id: integer("user_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  // Campo para aislamiento de datos por compañía
  companyId: text("company_id"),
});

export const insertBoxCutoffSchema = createInsertSchema(boxCutoff);
export type InsertBoxCutoff = z.infer<typeof insertBoxCutoffSchema>;
export type BoxCutoff = typeof boxCutoff.$inferSelect;
// El sistema ya cuenta con una implementación existente de estas tablas.
// La implementación del historial de cortes de caja se manejará usando las tablas existentes.

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // Usuario al que va dirigida la notificación
  type: text("type").notNull(), // tipo: 'reservation_request', 'payment', etc.
  title: text("title").notNull(),
  message: text("message").notNull(),
  relatedId: integer("related_id"), // ID del objeto relacionado (ej: id de solicitud)
  metaData: text("meta_data"), // Datos adicionales en formato JSON (para almacenar información extra)
  read: boolean("read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({ id: true });
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// RELACIONES PARA SOLICITUDES DE RESERVACIÓN Y NOTIFICACIONES
export const reservationRequestRelations = relations(reservationRequests, ({ one }) => ({
  trip: one(trips, {
    fields: [reservationRequests.tripId],
    references: [trips.id]
  }),
  requester: one(users, {
    fields: [reservationRequests.requesterId],
    references: [users.id]
  }),
  reviewer: one(users, {
    fields: [reservationRequests.reviewedBy],
    references: [users.id]
  })
}));

export const notificationRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id]
  })
}));

// COUPON RELATIONS
export const couponRelations = relations(coupons, ({ one }) => ({
  company: one(companies, {
    fields: [coupons.companyId],
    references: [companies.identifier]
  })
}));

// ========== SISTEMA DE CAJAS ==========

// Enum para tipo de transacción
export const TransactionType = {
  INCOME: "income",      // Ingreso (reservación o paquetería)
  EXPENSE: "expense",    // Gasto
  WITHDRAW: "withdraw",  // Retiro (corte de caja)
} as const;

export type TransactionTypeType = typeof TransactionType[keyof typeof TransactionType];

// Enum para la fuente de la transacción
export const TransactionSource = {
  RESERVATION: "reservation",   // Reservación
  PACKAGE: "package",          // Paquetería
  MANUAL: "manual",            // Entrada manual
} as const;

export type TransactionSourceType = typeof TransactionSource[keyof typeof TransactionSource];

// Las tablas y funcionalidades de caja registradora han sido completamente eliminadas del sistema

// TABLA DE TRANSACCIONES
export const transacciones = pgTable("transactions", { // Cambiado de "transacciones" a "transactions"
  id: serial("id").primaryKey(),
  detalles: jsonb("details").notNull(), // Cambiado de "detalles" a "details"
  user_id: integer("user_id").notNull().references(() => users.id), // Nombre correcto en la BD
  cutoff_id: integer("cutoff_id").references(() => boxCutoff.id), // Referencia a la tabla box_cutoff
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  companyId: text("company_id"), // Campo para aislamiento de datos por compañía
});

export const insertTransaccionSchema = createInsertSchema(transacciones, {
  id: z.number().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
  cutoff_id: z.number().optional().nullable(), // Usamos el nombre correcto
  detalles: z.any().optional(), // Campo para mapear a "details"
  user_id: z.number().optional(), // Campo para mapear a "user_id" en la base de datos
  companyId: z.string().optional().nullable() // Campo de compañía
});

export type Transaccion = typeof transacciones.$inferSelect;
export type InsertTransaccion = z.infer<typeof insertTransaccionSchema>;

// Relaciones para la tabla de transacciones
export const transaccionesRelations = relations(transacciones, ({ one }) => ({
  usuario: one(users, {
    fields: [transacciones.user_id],
    references: [users.id]
  }),
  // Relación con corte de caja eliminada
}));
