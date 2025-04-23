import * as schema from "@shared/schema";
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
import { IStorage } from "./storage";
import { db } from "./db";
import { eq, and, gte, lt, like, or, sql } from "drizzle-orm";

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
    try {
      // Asegurarse de que stops sea un array de strings (no undefined)
      const safeRoute = {
        ...route,
        stops: Array.isArray(route.stops) ? route.stops : [],
      };
      console.log("Datos procesados para inserción:", safeRoute);
      const [newRoute] = await db.insert(schema.routes).values(safeRoute).returning();
      console.log("Ruta creada exitosamente:", newRoute);
      return newRoute;
    } catch (error) {
      console.error("Error al insertar ruta en la base de datos:", error);
      throw error;
    }
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
    // Obtener el viaje original
    const trip = await this.getTrip(tripId);
    if (!trip) return;
    
    if (trip.isSubTrip && trip.parentTripId && trip.segmentOrigin && trip.segmentDestination) {
      // Este es un sub-viaje, actualizar el viaje principal
      const mainTrip = await this.getTrip(trip.parentTripId);
      if (!mainTrip) return;
      
      // Actualizar el viaje principal
      await db
        .update(schema.trips)
        .set({ availableSeats: sql`available_seats + ${seatChange}` })
        .where(eq(schema.trips.id, mainTrip.id));
      
      // Obtener información de la ruta principal para determinar todas las paradas
      const routeInfo = await this.getRouteWithSegments(mainTrip.routeId);
      if (!routeInfo) return;
      
      // Crear un array con todas las paradas en orden
      const allStops = [routeInfo.origin, ...routeInfo.stops, routeInfo.destination];
      
      // Encontrar índices para este segmento
      const segmentOriginIdx = allStops.indexOf(trip.segmentOrigin);
      const segmentDestinationIdx = allStops.indexOf(trip.segmentDestination);
      
      if (segmentOriginIdx === -1 || segmentDestinationIdx === -1) return;
      
      // Obtener todos los sub-viajes relacionados con el viaje principal
      const subTrips = await db
        .select()
        .from(schema.trips)
        .where(
          and(
            eq(schema.trips.parentTripId, mainTrip.id),
            eq(schema.trips.isSubTrip, true),
            sql`id != ${trip.id}`
          )
        );
      
      // Actualizar cada sub-viaje que se superpone con el segmento actual
      for (const subTrip of subTrips) {
        if (!subTrip.segmentOrigin || !subTrip.segmentDestination) continue;
        
        // Encontrar índices para el sub-viaje comparado
        const subOriginIdx = allStops.indexOf(subTrip.segmentOrigin);
        const subDestinationIdx = allStops.indexOf(subTrip.segmentDestination);
        
        if (subOriginIdx === -1 || subDestinationIdx === -1) continue;
        
        // Verificar si hay superposición de segmentos
        const hasOverlap = (
          // Si alguna parte del segmento actual está dentro del otro segmento
          (segmentOriginIdx >= subOriginIdx && segmentOriginIdx < subDestinationIdx) ||
          (segmentDestinationIdx > subOriginIdx && segmentDestinationIdx <= subDestinationIdx) ||
          // O si el otro segmento está completamente dentro del segmento actual
          (subOriginIdx >= segmentOriginIdx && subDestinationIdx <= segmentDestinationIdx)
        );
        
        if (hasOverlap) {
          await db
            .update(schema.trips)
            .set({ availableSeats: sql`available_seats + ${seatChange}` })
            .where(eq(schema.trips.id, subTrip.id));
        }
      }
    } else {
      // Es un viaje principal, actualizar todos sus sub-viajes
      await db
        .update(schema.trips)
        .set({ availableSeats: sql`available_seats + ${seatChange}` })
        .where(eq(schema.trips.parentTripId, tripId));
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
    // Preparamos los datos asegurándonos de que notes sea null si no está definido
    const reservationData = { ...reservation };
    
    if (reservationData.notes === undefined) {
      reservationData.notes = null;
    }
    
    const [newReservation] = await db.insert(schema.reservations).values(reservationData).returning();
    return newReservation;
  }
  
  async updateReservation(id: number, reservationUpdate: Partial<Reservation>): Promise<Reservation | undefined> {
    // Manejar el caso de notes undefined
    const updateData = { ...reservationUpdate };
    
    if (updateData.notes === undefined) {
      updateData.notes = null;
    }
    
    const [updatedReservation] = await db
      .update(schema.reservations)
      .set(updateData)
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