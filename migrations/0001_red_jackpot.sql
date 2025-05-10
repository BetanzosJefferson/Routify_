CREATE TABLE "commissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"amount" double precision NOT NULL,
	"percentage" boolean DEFAULT false,
	"trip_id" integer,
	"route_id" integer,
	"company_id" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"identifier" text NOT NULL,
	"logo" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	CONSTRAINT "companies_identifier_unique" UNIQUE("identifier")
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"usage_limit" integer NOT NULL,
	"usage_count" integer DEFAULT 0,
	"expiration_hours" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" double precision NOT NULL,
	"is_active" boolean DEFAULT true,
	"company_id" text,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"role" text NOT NULL,
	"email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_by_id" integer NOT NULL,
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"related_id" integer,
	"read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packages" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_id" integer,
	"sender_name" text NOT NULL,
	"sender_lastname" text NOT NULL,
	"sender_phone" text NOT NULL,
	"recipient_name" text NOT NULL,
	"recipient_lastname" text NOT NULL,
	"recipient_phone" text NOT NULL,
	"package_description" text NOT NULL,
	"price" double precision NOT NULL,
	"uses_seats" boolean DEFAULT false NOT NULL,
	"seats_quantity" integer DEFAULT 0,
	"is_paid" boolean DEFAULT false NOT NULL,
	"payment_method" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" integer,
	"company_id" text,
	"delivery_status" text DEFAULT 'pendiente' NOT NULL,
	"delivered_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "reservation_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"trip_id" integer NOT NULL,
	"passengers_data" jsonb NOT NULL,
	"total_amount" double precision NOT NULL,
	"email" text NOT NULL,
	"phone" text NOT NULL,
	"payment_status" text DEFAULT 'pendiente' NOT NULL,
	"advance_amount" double precision DEFAULT 0,
	"advance_payment_method" text DEFAULT 'efectivo',
	"payment_method" text DEFAULT 'efectivo' NOT NULL,
	"notes" text,
	"requester_id" integer NOT NULL,
	"company_id" text NOT NULL,
	"status" text DEFAULT 'pendiente' NOT NULL,
	"reviewed_by" integer,
	"review_notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'taquilla' NOT NULL,
	"company" text DEFAULT '',
	"profile_picture" text DEFAULT '',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"invited_by_id" integer,
	"company_id" text DEFAULT '',
	"commission_percentage" double precision DEFAULT 0,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" serial PRIMARY KEY NOT NULL,
	"plates" text NOT NULL,
	"brand" text NOT NULL,
	"model" text NOT NULL,
	"economic_number" text NOT NULL,
	"capacity" integer NOT NULL,
	"has_ac" boolean DEFAULT false,
	"has_reclining_seats" boolean DEFAULT false,
	"services" text[],
	"description" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"company_id" text,
	CONSTRAINT "vehicles_plates_unique" UNIQUE("plates"),
	CONSTRAINT "vehicles_economic_number_unique" UNIQUE("economic_number")
);
--> statement-breakpoint
ALTER TABLE "trips" ALTER COLUMN "price" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "trips" ALTER COLUMN "price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ALTER COLUMN "vehicle_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "trips" ALTER COLUMN "segment_prices" SET DATA TYPE json;--> statement-breakpoint
ALTER TABLE "reservations" ALTER COLUMN "created_at" SET DEFAULT now();--> statement-breakpoint
ALTER TABLE "routes" ADD COLUMN "company_id" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "vehicle_id" integer;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "driver_id" integer;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "company_id" text;--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "visibility" text DEFAULT 'publicado';--> statement-breakpoint
ALTER TABLE "trips" ADD COLUMN "trip_status" text DEFAULT 'aun_no_inicia';--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "payment_method" text DEFAULT 'efectivo' NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "payment_status" text DEFAULT 'pendiente' NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "advance_amount" double precision DEFAULT 0;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "advance_payment_method" text DEFAULT 'efectivo';--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "created_by" integer;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "paid_by" integer;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "commission_paid" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "company_id" text;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "checked_by" integer;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "checked_at" timestamp;--> statement-breakpoint
ALTER TABLE "reservations" ADD COLUMN "check_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_route_id_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."routes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "companies" ADD CONSTRAINT "companies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packages" ADD CONSTRAINT "packages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_invited_by_id_users_id_fk" FOREIGN KEY ("invited_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;