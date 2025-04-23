-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "routes" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"origin" text NOT NULL,
	"stops" text[] NOT NULL,
	"destination" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trips" (
	"id" serial PRIMARY KEY NOT NULL,
	"route_id" integer NOT NULL,
	"departure_date" timestamp NOT NULL,
	"departure_time" text NOT NULL,
	"arrival_time" text NOT NULL,
	"capacity" integer NOT NULL,
	"available_seats" integer NOT NULL,
	"price" double precision NOT NULL,
	"vehicle_type" text NOT NULL,
	"segment_prices" jsonb NOT NULL,
	"is_sub_trip" boolean DEFAULT false,
	"parent_trip_id" integer,
	"segment_origin" text,
	"segment_destination" text
);
--> statement-breakpoint
CREATE TABLE "passengers" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"reservation_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reservations" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_id" integer NOT NULL,
	"total_amount" double precision NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "location_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"state" text NOT NULL,
	"code" text NOT NULL,
	"municipalities" jsonb NOT NULL
);

*/