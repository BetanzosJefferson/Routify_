import { pgTable, serial, text, integer, timestamp, doublePrecision, jsonb, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const routes = pgTable("routes", {
	id: serial().primaryKey().notNull(),
	name: text().notNull(),
	origin: text().notNull(),
	stops: text().array().notNull(),
	destination: text().notNull(),
});

export const trips = pgTable("trips", {
	id: serial().primaryKey().notNull(),
	routeId: integer("route_id").notNull(),
	departureDate: timestamp("departure_date", { mode: 'string' }).notNull(),
	departureTime: text("departure_time").notNull(),
	arrivalTime: text("arrival_time").notNull(),
	capacity: integer().notNull(),
	availableSeats: integer("available_seats").notNull(),
	price: doublePrecision().notNull(),
	vehicleType: text("vehicle_type").notNull(),
	segmentPrices: jsonb("segment_prices").notNull(),
	isSubTrip: boolean("is_sub_trip").default(false),
	parentTripId: integer("parent_trip_id"),
	segmentOrigin: text("segment_origin"),
	segmentDestination: text("segment_destination"),
});

export const passengers = pgTable("passengers", {
	id: serial().primaryKey().notNull(),
	firstName: text("first_name").notNull(),
	lastName: text("last_name").notNull(),
	reservationId: integer("reservation_id").notNull(),
});

export const reservations = pgTable("reservations", {
	id: serial().primaryKey().notNull(),
	tripId: integer("trip_id").notNull(),
	totalAmount: doublePrecision("total_amount").notNull(),
	email: text().notNull(),
	phone: text().notNull(),
	status: text().default('confirmed').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
	notes: text(),
});

export const locationData = pgTable("location_data", {
	id: serial().primaryKey().notNull(),
	state: text().notNull(),
	code: text().notNull(),
	municipalities: jsonb().notNull(),
});
