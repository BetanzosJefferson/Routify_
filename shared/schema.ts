import { pgTable, text, serial, integer, boolean, timestamp, json, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ROUTE SCHEMA
export const routes = pgTable("routes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  origin: text("origin").notNull(),
  stops: text("stops").array().notNull(),
  destination: text("destination").notNull(),
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

export const createRouteValidationSchema = insertRouteSchema.extend({
  name: z.string().min(1, "Route name is required"),
  origin: z.string().min(1, "Origin is required"),
  stops: z.array(z.string().min(1, "Stop location is required")),
  destination: z.string().min(1, "Destination is required"),
});

export const publishTripValidationSchema = z.object({
  routeId: z.number().min(1, "Route selection is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  departureHour: z.string().min(1, "Departure hour is required"),
  departureMinute: z.string().min(1, "Departure minute is required"),
  departureAmPm: z.enum(["AM", "PM"]),
  arrivalHour: z.string().min(1, "Arrival hour is required"),
  arrivalMinute: z.string().min(1, "Arrival minute is required"),
  arrivalAmPm: z.enum(["AM", "PM"]),
  capacity: z.number().min(1, "Capacity is required"),
  price: z.number().min(0, "Price is required"),
  vehicleType: z.string().min(1, "Vehicle type is required"),
  segmentPrices: z.array(
    z.object({
      origin: z.string(),
      destination: z.string(),
      price: z.number().min(0, "Price must be a positive number")
    })
  )
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
  phone: z.string().min(1, "Phone number is required")
});
