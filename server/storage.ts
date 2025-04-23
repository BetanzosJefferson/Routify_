import { 
  Route, 
  InsertRoute, 
  Trip, 
  InsertTrip, 
  Reservation, 
  InsertReservation, 
  Passenger, 
  InsertPassenger,
  RouteWithSegments,
  TripWithRouteInfo,
  ReservationWithDetails,
  SegmentPrice
} from "@shared/schema";

export interface IStorage {
  // Route methods
  getRoutes(): Promise<Route[]>;
  getRoute(id: number): Promise<Route | undefined>;
  createRoute(route: InsertRoute): Promise<Route>;
  updateRoute(id: number, route: Partial<Route>): Promise<Route | undefined>;
  deleteRoute(id: number): Promise<boolean>;
  getRouteWithSegments(id: number): Promise<RouteWithSegments | undefined>;
  
  // Trip methods
  getTrips(): Promise<TripWithRouteInfo[]>;
  getTrip(id: number): Promise<Trip | undefined>;
  getTripWithRouteInfo(id: number): Promise<TripWithRouteInfo | undefined>;
  createTrip(trip: InsertTrip): Promise<Trip>;
  updateTrip(id: number, trip: Partial<Trip>): Promise<Trip | undefined>;
  deleteTrip(id: number): Promise<boolean>;
  searchTrips(params: {
    origin?: string;
    destination?: string;
    date?: string;
    seats?: number;
  }): Promise<TripWithRouteInfo[]>;
  updateRelatedTripsAvailability(tripId: number, seatChange: number): Promise<void>;
  
  // Reservation methods
  getReservations(): Promise<ReservationWithDetails[]>;
  getReservation(id: number): Promise<Reservation | undefined>;
  getReservationWithDetails(id: number): Promise<ReservationWithDetails | undefined>;
  createReservation(reservation: InsertReservation): Promise<Reservation>;
  updateReservation(id: number, reservation: Partial<Reservation>): Promise<Reservation | undefined>;
  deleteReservation(id: number): Promise<boolean>;
  
  // Passenger methods
  getPassengers(reservationId: number): Promise<Passenger[]>;
  createPassenger(passenger: InsertPassenger): Promise<Passenger>;
  deletePassengersByReservation(reservationId: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private routes: Map<number, Route>;
  private trips: Map<number, Trip>;
  private reservations: Map<number, Reservation>;
  private passengers: Map<number, Passenger>;
  
  private routeId: number;
  private tripId: number;
  private reservationId: number;
  private passengerId: number;
  
  constructor() {
    this.routes = new Map();
    this.trips = new Map();
    this.reservations = new Map();
    this.passengers = new Map();
    
    this.routeId = 1;
    this.tripId = 1;
    this.reservationId = 1;
    this.passengerId = 1;

    // Add some initial data
    this.createRoute({
      name: "Acapulco - México",
      origin: "Acapulco de Juarez - Terminal Condesa",
      stops: [
        "Chilpancingo de los Bravo - Terminal Blvd Vicente Guerrero",
        "Cuernavaca - Polvorín",
        "Cuernavaca - Galerías Cuernavaca",
        "Coyoacan - Taxqueña"
      ],
      destination: "México - Terminal Central Norte"
    });
  }
  
  // Route methods
  async getRoutes(): Promise<Route[]> {
    return Array.from(this.routes.values());
  }
  
  async getRoute(id: number): Promise<Route | undefined> {
    return this.routes.get(id);
  }
  
  async createRoute(route: InsertRoute): Promise<Route> {
    const id = this.routeId++;
    const newRoute: Route = { ...route, id };
    this.routes.set(id, newRoute);
    return newRoute;
  }
  
  async updateRoute(id: number, routeUpdate: Partial<Route>): Promise<Route | undefined> {
    const existingRoute = this.routes.get(id);
    if (!existingRoute) return undefined;
    
    const updatedRoute = { ...existingRoute, ...routeUpdate };
    this.routes.set(id, updatedRoute);
    return updatedRoute;
  }
  
  async deleteRoute(id: number): Promise<boolean> {
    return this.routes.delete(id);
  }
  
  async getRouteWithSegments(id: number): Promise<RouteWithSegments | undefined> {
    const route = await this.getRoute(id);
    if (!route) return undefined;
    
    const segments: Array<{ origin: string; destination: string; price?: number }> = [];
    
    // Add origin to first stop
    if (route.stops.length > 0) {
      segments.push({
        origin: route.origin,
        destination: route.stops[0]
      });
      
      // Add all stops
      for (let i = 0; i < route.stops.length - 1; i++) {
        segments.push({
          origin: route.stops[i],
          destination: route.stops[i + 1]
        });
      }
      
      // Add last stop to destination
      segments.push({
        origin: route.stops[route.stops.length - 1],
        destination: route.destination
      });
    } else {
      // Direct route
      segments.push({
        origin: route.origin,
        destination: route.destination
      });
    }
    
    return {
      ...route,
      segments
    };
  }
  
  // Trip methods
  async getTrips(): Promise<TripWithRouteInfo[]> {
    const trips = Array.from(this.trips.values());
    const tripsWithRoute: TripWithRouteInfo[] = [];
    
    for (const trip of trips) {
      const route = await this.getRoute(trip.routeId);
      if (route) {
        tripsWithRoute.push({
          ...trip,
          route,
          numStops: route.stops.length
        });
      }
    }
    
    return tripsWithRoute;
  }
  
  async getTrip(id: number): Promise<Trip | undefined> {
    return this.trips.get(id);
  }
  
  async getTripWithRouteInfo(id: number): Promise<TripWithRouteInfo | undefined> {
    const trip = await this.getTrip(id);
    if (!trip) return undefined;
    
    const route = await this.getRoute(trip.routeId);
    if (!route) return undefined;
    
    return {
      ...trip,
      route,
      numStops: route.stops.length
    };
  }
  
  async createTrip(trip: InsertTrip): Promise<Trip> {
    const id = this.tripId++;
    const newTrip: Trip = { 
      ...trip, 
      id,
      isSubTrip: trip.isSubTrip ?? false,
      parentTripId: trip.parentTripId ?? null,
      segmentOrigin: trip.segmentOrigin ?? null,
      segmentDestination: trip.segmentDestination ?? null
    };
    this.trips.set(id, newTrip);
    return newTrip;
  }
  
  async updateTrip(id: number, tripUpdate: Partial<Trip>): Promise<Trip | undefined> {
    const existingTrip = this.trips.get(id);
    if (!existingTrip) return undefined;
    
    const updatedTrip = { ...existingTrip, ...tripUpdate };
    this.trips.set(id, updatedTrip);
    return updatedTrip;
  }
  
  async deleteTrip(id: number): Promise<boolean> {
    return this.trips.delete(id);
  }
  
  async searchTrips(params: {
    origin?: string;
    destination?: string;
    date?: string;
    seats?: number;
  }): Promise<TripWithRouteInfo[]> {
    let trips = await this.getTrips();
    
    // First, filter by sub-trips
    if ((params.origin || params.destination) && !(params.origin && params.destination)) {
      // If only origin or only destination is specified, include sub-trips
      trips = trips.filter(trip => {
        // Include main trips
        if (!trip.isSubTrip) return true;
        
        // Include relevant sub-trips
        const segmentOrigin = trip.segmentOrigin;
        const segmentDestination = trip.segmentDestination;
        
        if (params.origin && !params.destination) {
          // Filter by origin only
          const originLower = params.origin.toLowerCase();
          return segmentOrigin?.toLowerCase().includes(originLower);
        } 
        
        if (params.destination && !params.origin) {
          // Filter by destination only
          const destinationLower = params.destination.toLowerCase();
          return segmentDestination?.toLowerCase().includes(destinationLower);
        }
        
        return true;
      });
    } else if (params.origin && params.destination) {
      // If both origin and destination are specified, prioritize direct sub-trips
      const originLower = params.origin.toLowerCase();
      const destinationLower = params.destination.toLowerCase();
      
      // Find sub-trips that match exactly the origin-destination pair
      const exactMatches = trips.filter(trip => {
        if (!trip.isSubTrip) return false;
        
        const segmentOrigin = trip.segmentOrigin?.toLowerCase() || "";
        const segmentDestination = trip.segmentDestination?.toLowerCase() || "";
        
        return segmentOrigin.includes(originLower) && 
               segmentDestination.includes(destinationLower);
      });
      
      // If we found exact sub-trip matches, use those, otherwise continue with regular filtering
      if (exactMatches.length > 0) {
        trips = exactMatches;
      } else {
        // Standard filtering on main trips
        trips = trips.filter(trip => {
          if (trip.isSubTrip) return false;
          
          // Check if main trip has both the origin and destination
          const routeOrigin = trip.route.origin.toLowerCase();
          const routeDestination = trip.route.destination.toLowerCase();
          const routeStops = trip.route.stops.map(stop => stop.toLowerCase());
          
          // Main trip has the origin and destination (either as endpoints or stops)
          const hasOrigin = routeOrigin.includes(originLower) || 
                         routeStops.some(stop => stop.includes(originLower));
          
          const hasDestination = routeDestination.includes(destinationLower) || 
                              routeStops.some(stop => stop.includes(destinationLower));
          
          return hasOrigin && hasDestination;
        });
      }
    }
    
    // Additional filters (date and seats)
    if (params.date) {
      const searchDate = new Date(params.date);
      trips = trips.filter(trip => {
        const tripDate = new Date(trip.departureDate);
        return tripDate.toDateString() === searchDate.toDateString();
      });
    }
    
    const seatsRequired = params.seats !== undefined ? params.seats : 0;
    if (seatsRequired > 0) {
      trips = trips.filter(trip => trip.availableSeats >= seatsRequired);
    }
    
    return trips;
  }
  
  // Update availability on related trips (main trip and sub-trips)
  async updateRelatedTripsAvailability(tripId: number, seatChange: number): Promise<void> {
    const trip = await this.getTrip(tripId);
    if (!trip) return;
    
    if (trip.isSubTrip && trip.parentTripId) {
      // This is a sub-trip, update the main trip and other sub-trips
      const mainTrip = await this.getTrip(trip.parentTripId);
      if (!mainTrip) return;
      
      // Update main trip availability
      await this.updateTrip(mainTrip.id, {
        availableSeats: mainTrip.availableSeats + seatChange
      });
      
      // Get all sub-trips with the same origin/destination
      const allTrips = Array.from(this.trips.values());
      const relatedSubTrips = allTrips.filter(t => 
        t.isSubTrip && 
        t.parentTripId === mainTrip.id &&
        ((t.segmentOrigin === trip.segmentOrigin && 
          t.segmentDestination === trip.segmentDestination) ||
         (t.segmentOrigin === trip.segmentDestination && 
          t.segmentDestination === trip.segmentOrigin))
      );
      
      // Update all related sub-trips
      for (const subTrip of relatedSubTrips) {
        if (subTrip.id !== trip.id) {
          await this.updateTrip(subTrip.id, {
            availableSeats: subTrip.availableSeats + seatChange
          });
        }
      }
    } else {
      // This is a main trip, update all sub-trips
      const allTrips = Array.from(this.trips.values());
      const subTrips = allTrips.filter(t => 
        t.isSubTrip && t.parentTripId === trip.id
      );
      
      // Update all sub-trips
      for (const subTrip of subTrips) {
        await this.updateTrip(subTrip.id, {
          availableSeats: subTrip.availableSeats + seatChange
        });
      }
    }
  }
  
  // Reservation methods
  async getReservations(): Promise<ReservationWithDetails[]> {
    const reservations = Array.from(this.reservations.values());
    const result: ReservationWithDetails[] = [];
    
    for (const reservation of reservations) {
      const tripWithRoute = await this.getTripWithRouteInfo(reservation.tripId);
      if (!tripWithRoute) continue;
      
      const passengers = await this.getPassengers(reservation.id);
      
      result.push({
        ...reservation,
        trip: tripWithRoute,
        passengers
      });
    }
    
    return result;
  }
  
  async getReservation(id: number): Promise<Reservation | undefined> {
    return this.reservations.get(id);
  }
  
  async getReservationWithDetails(id: number): Promise<ReservationWithDetails | undefined> {
    const reservation = await this.getReservation(id);
    if (!reservation) return undefined;
    
    const tripWithRoute = await this.getTripWithRouteInfo(reservation.tripId);
    if (!tripWithRoute) return undefined;
    
    const passengers = await this.getPassengers(reservation.id);
    
    return {
      ...reservation,
      trip: tripWithRoute,
      passengers
    };
  }
  
  async createReservation(reservation: InsertReservation): Promise<Reservation> {
    const id = this.reservationId++;
    const newReservation: Reservation = { 
      ...reservation, 
      id,
      status: reservation.status || "confirmed",
      createdAt: new Date()  
    };
    
    this.reservations.set(id, newReservation);
    
    // Update available seats on the trip
    const trip = await this.getTrip(reservation.tripId);
    if (trip) {
      const passengerCount = (await this.getPassengers(id)).length;
      
      // Update this trip's seat availability
      await this.updateTrip(trip.id, {
        availableSeats: trip.availableSeats - passengerCount
      });
      
      // Update related trips seat availability
      await this.updateRelatedTripsAvailability(trip.id, -passengerCount);
    }
    
    return newReservation;
  }
  
  async updateReservation(id: number, reservationUpdate: Partial<Reservation>): Promise<Reservation | undefined> {
    const existingReservation = this.reservations.get(id);
    if (!existingReservation) return undefined;
    
    const updatedReservation = { ...existingReservation, ...reservationUpdate };
    this.reservations.set(id, updatedReservation);
    return updatedReservation;
  }
  
  async deleteReservation(id: number): Promise<boolean> {
    const reservation = await this.getReservation(id);
    if (!reservation) return false;
    
    // Get passenger count before deleting
    const passengers = await this.getPassengers(id);
    const passengerCount = passengers.length;
    
    // Update available seats on the trip
    const trip = await this.getTrip(reservation.tripId);
    if (trip) {
      // Update this trip's seat availability
      await this.updateTrip(trip.id, {
        availableSeats: trip.availableSeats + passengerCount
      });
      
      // Update related trips seat availability
      await this.updateRelatedTripsAvailability(trip.id, passengerCount);
    }
    
    // Delete passengers
    await this.deletePassengersByReservation(id);
    
    // Delete reservation
    return this.reservations.delete(id);
  }
  
  // Passenger methods
  async getPassengers(reservationId: number): Promise<Passenger[]> {
    const allPassengers = Array.from(this.passengers.values());
    return allPassengers.filter(p => p.reservationId === reservationId);
  }
  
  async createPassenger(passenger: InsertPassenger): Promise<Passenger> {
    const id = this.passengerId++;
    const newPassenger: Passenger = { ...passenger, id };
    this.passengers.set(id, newPassenger);
    return newPassenger;
  }
  
  async deletePassengersByReservation(reservationId: number): Promise<boolean> {
    const allPassengers = Array.from(this.passengers.entries());
    
    for (const [id, passenger] of allPassengers) {
      if (passenger.reservationId === reservationId) {
        this.passengers.delete(id);
      }
    }
    
    return true;
  }
}

import { db } from "./db";
import { eq, and, gte, lte, like, or } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  async getRoutes(): Promise<Route[]> {
    return await db.select().from(schema.routes);
  }
  
  async getRoute(id: number): Promise<Route | undefined> {
    const [route] = await db.select().from(schema.routes).where(eq(schema.routes.id, id));
    return route;
  }
  
  async createRoute(route: InsertRoute): Promise<Route> {
    console.log("Creando ruta con los datos:", JSON.stringify(route));
    const [newRoute] = await db.insert(schema.routes).values(route).returning();
    return newRoute;
  }
  
  async updateRoute(id: number, routeUpdate: Partial<Route>): Promise<Route | undefined> {
    const [updatedRoute] = await db
      .update(schema.routes)
      .set(routeUpdate)
      .where(eq(schema.routes.id, id))
      .returning();
    return updatedRoute;
  }
  
  async deleteRoute(id: number): Promise<boolean> {
    const result = await db
      .delete(schema.routes)
      .where(eq(schema.routes.id, id))
      .returning({ id: schema.routes.id });
    return result.length > 0;
  }
  
  async getRouteWithSegments(id: number): Promise<RouteWithSegments | undefined> {
    const route = await this.getRoute(id);
    if (!route) return undefined;
    
    const segments: Array<{origin: string; destination: string; price?: number}> = [];
    
    // Generate all possible segments from the stops
    const stops = route.stops;
    for (let i = 0; i < stops.length; i++) {
      for (let j = i + 1; j < stops.length; j++) {
        segments.push({
          origin: stops[i],
          destination: stops[j],
        });
      }
    }
    
    return {
      ...route,
      segments
    };
  }
  
  async getTrips(): Promise<TripWithRouteInfo[]> {
    const trips = await db.select().from(schema.trips);
    
    const tripsWithRouteInfo: TripWithRouteInfo[] = [];
    for (const trip of trips) {
      const route = await this.getRoute(trip.routeId);
      if (route) {
        tripsWithRouteInfo.push({
          ...trip,
          route,
          numStops: route.stops.length
        });
      }
    }
    
    return tripsWithRouteInfo;
  }
  
  async getTrip(id: number): Promise<Trip | undefined> {
    const [trip] = await db.select().from(schema.trips).where(eq(schema.trips.id, id));
    return trip;
  }
  
  async getTripWithRouteInfo(id: number): Promise<TripWithRouteInfo | undefined> {
    const trip = await this.getTrip(id);
    if (!trip) return undefined;
    
    const route = await this.getRoute(trip.routeId);
    if (!route) return undefined;
    
    return {
      ...trip,
      route,
      numStops: route.stops.length
    };
  }
  
  async createTrip(trip: InsertTrip): Promise<Trip> {
    const [newTrip] = await db.insert(schema.trips).values(trip).returning();
    return newTrip;
  }
  
  async updateTrip(id: number, tripUpdate: Partial<Trip>): Promise<Trip | undefined> {
    const [updatedTrip] = await db
      .update(schema.trips)
      .set(tripUpdate)
      .where(eq(schema.trips.id, id))
      .returning();
    return updatedTrip;
  }
  
  async deleteTrip(id: number): Promise<boolean> {
    const result = await db
      .delete(schema.trips)
      .where(eq(schema.trips.id, id))
      .returning({ id: schema.trips.id });
    return result.length > 0;
  }
  
  async searchTrips(params: {
    origin?: string;
    destination?: string;
    date?: string;
    seats?: number;
  }): Promise<TripWithRouteInfo[]> {
    // Base query for trips
    const tripsQuery = db.select().from(schema.trips);
    
    // Apply seat filter
    if (params.seats) {
      tripsQuery.where(gte(schema.trips.availableSeats, params.seats));
    }
    
    // Apply date filter
    if (params.date) {
      const searchDate = new Date(params.date);
      searchDate.setHours(0, 0, 0, 0);
      
      const nextDay = new Date(searchDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      tripsQuery.where(
        and(
          gte(schema.trips.departureDate, searchDate),
          lt(schema.trips.departureDate, nextDay)
        )
      );
    }
    
    // Get trips
    const trips = await tripsQuery;
    
    // Now filter by origin and destination if provided
    const tripsWithRouteInfo: TripWithRouteInfo[] = [];
    
    for (const trip of trips) {
      const route = await this.getRoute(trip.routeId);
      if (!route) continue;
      
      // For subtrips, check against segment origin and destination
      if (trip.isSubTrip && trip.segmentOrigin && trip.segmentDestination) {
        const originMatch = !params.origin || trip.segmentOrigin.toLowerCase().includes(params.origin.toLowerCase());
        const destMatch = !params.destination || trip.segmentDestination.toLowerCase().includes(params.destination.toLowerCase());
        
        if (originMatch && destMatch) {
          tripsWithRouteInfo.push({
            ...trip,
            route,
            numStops: route.stops.length
          });
        }
        continue;
      }
      
      // For main trips, check all stops for matching origin and destination
      let originMatch = !params.origin;
      let destMatch = !params.destination;
      
      if (params.origin) {
        originMatch = route.origin.toLowerCase().includes(params.origin.toLowerCase()) || 
                      route.stops.some(stop => stop.toLowerCase().includes(params.origin!.toLowerCase()));
      }
      
      if (params.destination) {
        destMatch = route.destination.toLowerCase().includes(params.destination.toLowerCase()) || 
                    route.stops.some(stop => stop.toLowerCase().includes(params.destination!.toLowerCase()));
      }
      
      if (originMatch && destMatch) {
        tripsWithRouteInfo.push({
          ...trip,
          route,
          numStops: route.stops.length
        });
      }
    }
    
    return tripsWithRouteInfo;
  }
  
  async updateRelatedTripsAvailability(tripId: number, seatChange: number): Promise<void> {
    // Get the original trip
    const trip = await this.getTrip(tripId);
    if (!trip) return;
    
    // Update all sub-trips with the same parentTripId, including the main trip
    if (trip.isSubTrip && trip.parentTripId) {
      // If this is a sub-trip, update the parent and all siblings
      const parentId = trip.parentTripId;
      await db
        .update(schema.trips)
        .set({ availableSeats: db.raw(`available_seats + ${seatChange}`) })
        .where(
          or(
            eq(schema.trips.id, parentId),
            eq(schema.trips.parentTripId, parentId)
          )
        );
    } else {
      // If this is a main trip, update it and all its sub-trips
      await db
        .update(schema.trips)
        .set({ availableSeats: db.raw(`available_seats + ${seatChange}`) })
        .where(
          or(
            eq(schema.trips.id, tripId),
            eq(schema.trips.parentTripId, tripId)
          )
        );
    }
  }
  
  async getReservations(): Promise<ReservationWithDetails[]> {
    const reservations = await db.select().from(schema.reservations);
    
    const reservationsWithDetails: ReservationWithDetails[] = [];
    for (const reservation of reservations) {
      const trip = await this.getTripWithRouteInfo(reservation.tripId);
      if (!trip) continue;
      
      const passengers = await this.getPassengers(reservation.id);
      
      reservationsWithDetails.push({
        ...reservation,
        trip,
        passengers
      });
    }
    
    return reservationsWithDetails;
  }
  
  async getReservation(id: number): Promise<Reservation | undefined> {
    const [reservation] = await db.select().from(schema.reservations).where(eq(schema.reservations.id, id));
    return reservation;
  }
  
  async getReservationWithDetails(id: number): Promise<ReservationWithDetails | undefined> {
    const reservation = await this.getReservation(id);
    if (!reservation) return undefined;
    
    const trip = await this.getTripWithRouteInfo(reservation.tripId);
    if (!trip) return undefined;
    
    const passengers = await this.getPassengers(reservation.id);
    
    return {
      ...reservation,
      trip,
      passengers
    };
  }
  
  async createReservation(reservation: InsertReservation): Promise<Reservation> {
    const [newReservation] = await db.insert(schema.reservations).values(reservation).returning();
    return newReservation;
  }
  
  async updateReservation(id: number, reservationUpdate: Partial<Reservation>): Promise<Reservation | undefined> {
    const [updatedReservation] = await db
      .update(schema.reservations)
      .set(reservationUpdate)
      .where(eq(schema.reservations.id, id))
      .returning();
    return updatedReservation;
  }
  
  async deleteReservation(id: number): Promise<boolean> {
    const result = await db
      .delete(schema.reservations)
      .where(eq(schema.reservations.id, id))
      .returning({ id: schema.reservations.id });
    return result.length > 0;
  }
  
  async getPassengers(reservationId: number): Promise<Passenger[]> {
    return await db
      .select()
      .from(schema.passengers)
      .where(eq(schema.passengers.reservationId, reservationId));
  }
  
  async createPassenger(passenger: InsertPassenger): Promise<Passenger> {
    const [newPassenger] = await db.insert(schema.passengers).values(passenger).returning();
    return newPassenger;
  }
  
  async deletePassengersByReservation(reservationId: number): Promise<boolean> {
    const result = await db
      .delete(schema.passengers)
      .where(eq(schema.passengers.reservationId, reservationId))
      .returning({ id: schema.passengers.id });
    return result.length > 0;
  }
}

// Usamos la versión de almacenamiento en base de datos para implementar la funcionalidad
export const storage = new DatabaseStorage();
