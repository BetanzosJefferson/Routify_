import { pgTable, text, serial, integer, boolean, timestamp, json, doublePrecision, jsonb, uuid, varchar } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// USER ROLE ENUM
export const UserRole = {
  SUPER_ADMIN: "superAdmin",
  COMPANY_OWNER: "companyOwner", // Nuevo rol: Dueño de empresa
  ADMIN: "admin",
  CALL_CENTER: "callCenter",
  CHECKER: "checador",
  DRIVER: "chofer",
  TICKET_OFFICE: "taquilla",
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

// ROUTE SCHEMA
export const routes = pgTable("routes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  origin: text("origin").notNull(),
  stops: text("stops").array().notNull(),
  destination: text("destination").notNull(),
  companyId: integer("company_id").references(() => companies.id),
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
  price: doublePrecision("price").notNull(),
  vehicleType: text("vehicle_type").notNull(),
  segmentPrices: json("segment_prices").notNull(),
  // New fields for sub-trips
  isSubTrip: boolean("is_sub_trip").default(false),
  parentTripId: integer("parent_trip_id"),
  segmentOrigin: text("segment_origin"),
  segmentDestination: text("segment_destination")
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

// RESERVATION SCHEMA
export const reservations = pgTable("reservations", {
  id: serial("id").primaryKey(),
  tripId: integer("trip_id").notNull(),
  totalAmount: doublePrecision("total_amount").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  notes: text("notes"),
  paymentMethod: text("payment_method").notNull().default("cash"), // 'cash' o 'transfer'
  status: text("status").notNull().default("confirmed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
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
};

export type ReservationWithDetails = Reservation & {
  trip: TripWithRouteInfo;
  passengers: Passenger[];
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
  stopTimes: z.array(stopTimeSchema).optional()
});

export const createReservationValidationSchema = z.object({
  tripId: z.number(),
  numPassengers: z.number().min(1, "At least 1 passenger is required"),
  passengers: z.array(
    z.object({
      firstName: z.string().min(1, "First name is required"),
      lastName: z.string().min(1, "Last name is required")
    })
  ),
  email: z.string().email("Valid email is required"),
  phone: z.string().min(1, "Phone number is required"),
  paymentMethod: z.enum(["cash", "transfer"], {
    required_error: "Método de pago es requerido",
    invalid_type_error: "Método de pago debe ser efectivo o transferencia"
  }),
  notes: z.string().optional()
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
  companyId: integer("company_id").references(() => companies.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCommissionSchema = createInsertSchema(commissions);
export type InsertCommission = z.infer<typeof insertCommissionSchema>;
export type Commission = typeof commissions.$inferSelect;

// RELACIONES ENTRE TABLAS
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
  reservations: many(reservations)
}));

export const reservationRelations = relations(reservations, ({ one, many }) => ({
  trip: one(trips, {
    fields: [reservations.tripId],
    references: [trips.id]
  }),
  passengers: many(passengers)
}));

export const passengerRelations = relations(passengers, ({ one }) => ({
  reservation: one(reservations, {
    fields: [passengers.reservationId],
    references: [reservations.id]
  })
}));

// COMPANY SCHEMA
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logo: text("logo").default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
  companyId: integer("company_id").references(() => companies.id),
  profilePicture: text("profile_picture").default(""),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
  companyId: integer("company_id").references(() => companies.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdById: integer("created_by_id").notNull(),
});

export const insertInvitationSchema = createInsertSchema(invitations);
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type Invitation = typeof invitations.$inferSelect;

// COMPANY RELATIONS
export const companyRelations = relations(companies, ({ many }) => ({
  users: many(users),
  routes: many(routes),
  vehicles: many(vehicles)
}));

// USER RELATIONS
export const userRelations = relations(users, ({ one, many }) => ({
  invitationsCreated: many(invitations),
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id]
  })
}));

export const invitationRelations = relations(invitations, ({ one }) => ({
  createdBy: one(users, {
    fields: [invitations.createdById],
    references: [users.id]
  }),
  company: one(companies, {
    fields: [invitations.companyId],
    references: [companies.id]
  })
}));

// ROUTE RELATIONS
export const routeRelations = relations(routes, ({ one, many }) => ({
  trips: many(trips),
  company: one(companies, {
    fields: [routes.companyId],
    references: [companies.id]
  })
}));

// VEHICLE RELATIONS
export const vehicleRelations = relations(vehicles, ({ one }) => ({
  company: one(companies, {
    fields: [vehicles.companyId],
    references: [companies.id]
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
