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
  SegmentPrice,
  Vehicle,
  InsertVehicle,
  Commission,
  InsertCommission
} from "@shared/schema";
import { IStorage } from "./storage";
import { db } from "./db";
import { eq, and, gte, lt, like, or, sql } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  async getRoutes(companyId?: string): Promise<Route[]> {
    console.log(companyId ? `DB Storage: Consultando rutas para la compañía: ${companyId}` : "DB Storage: Consultando todas las rutas");
    
    try {
      // Si se proporciona un companyId, filtrar por compañía
      if (companyId) {
        // SEGURIDAD: Primero verificar si existen rutas para esta compañía
        const countQuery = await db
          .select({ count: sql`count(*)` })
          .from(schema.routes)
          .where(eq(schema.routes.companyId, companyId));
        
        const routeCount = parseInt(countQuery[0].count.toString());
        console.log(`DB Storage: Existen ${routeCount} rutas para compañía ${companyId}`);
        
        // Obtener las rutas filtradas
        const routes = await db
          .select()
          .from(schema.routes)
          .where(eq(schema.routes.companyId, companyId));
        
        console.log(`DB Storage: Rutas filtradas encontradas: ${routes.length}`);
        
        // Verificación adicional - imprimir datos para depuración
        if (routes.length > 0) {
          console.log(`DB Storage: Datos de rutas:`, JSON.stringify(routes));
        }
        
        return routes;
      }
      
      // Si no hay filtro, obtener todas las rutas
      const routes = await db.select().from(schema.routes);
      console.log(`DB Storage: Rutas encontradas: ${routes.length}`);
      return routes;
    } catch (error) {
      console.error(`DB Storage ERROR - getRoutes: ${error}`);
      return [];
    }
  }
  
  async getRoute(id: number): Promise<Route | undefined> {
    const [route] = await db.select().from(schema.routes).where(eq(schema.routes.id, id));
    return route;
  }
  
  async createRoute(route: InsertRoute): Promise<Route> {
    console.log("DB Storage: Creando ruta con los datos:", JSON.stringify(route));
    
    // Validación adicional para asegurar que rutas no superadmin tengan companyId
    if (!route.companyId) {
      console.log("DB Storage - ADVERTENCIA: Intento de crear ruta sin companyId");
    }
    
    const [newRoute] = await db.insert(schema.routes).values(route).returning();
    console.log("DB Storage: Ruta creada con ID:", newRoute.id, "CompanyId:", newRoute.companyId);
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
  
  async getTrips(companyId?: string): Promise<TripWithRouteInfo[]> {
    console.log("DB Storage: Obteniendo viajes");
    const startTime = performance.now();
    
    // Construir la consulta base
    let query = db.select().from(schema.trips);
    
    // Si hay un companyId, filtrar por esa compañía
    if (companyId) {
      console.log(`DB Storage: Filtrando viajes por compañía: ${companyId}`);
      console.log(`DEBUG SQL: SELECT * FROM trips WHERE company_id = '${companyId}'`);
      query = query.where(eq(schema.trips.companyId, companyId));
    }
    
    // Ejecutar la consulta construida
    const trips = await query;
    
    // Obtener todos los usuarios dueños (Owner) para relacionar con las compañías
    const owners = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.role, schema.UserRole.OWNER));
    
    // Crear un mapa de compañía -> datos del dueño para buscar rápidamente
    const companyMap = new Map();
    owners.forEach(owner => {
      const companyId = owner.companyId || owner.company;
      if (companyId) {
        companyMap.set(companyId, {
          companyName: owner.company,
          companyLogo: owner.profilePicture
        });
      }
    });
    
    // Imprimir el mapa de compañías para depuración
    console.log("Mapa de compañías:");
    companyMap.forEach((data, id) => {
      console.log(`Compañía ${id}: Nombre=${data.companyName}, Logo=${data.companyLogo ? "Sí" : "No"}`);
    });
    
    const tripsWithRouteInfo: TripWithRouteInfo[] = [];
    for (const trip of trips) {
      const route = await this.getRoute(trip.routeId);
      if (route) {
        // Obtener datos de la compañía si existen
        let companyData = { companyName: undefined, companyLogo: undefined };
        if (trip.companyId && companyMap.has(trip.companyId)) {
          companyData = companyMap.get(trip.companyId);
          console.log(`Encontrados datos para compañía ${trip.companyId} en el viaje ${trip.id}`);
        } else if (trip.companyId) {
          console.log(`Viaje ${trip.id} tiene companyId=${trip.companyId} pero no se encontraron datos correspondientes`);
        } else {
          console.log(`Viaje ${trip.id} no tiene companyId`);
        }
        
        const tripWithInfo = {
          ...trip,
          route,
          numStops: route.stops.length,
          // Agregar información de la compañía
          companyName: companyData.companyName,
          companyLogo: companyData.companyLogo
        };
        
        // Verificar que los datos de la compañía estén presentes
        console.log(`Viaje ${trip.id} - companyName: ${tripWithInfo.companyName}, companyLogo: ${tripWithInfo.companyLogo}`);
        
        tripsWithRouteInfo.push(tripWithInfo);
      }
    }
    
    const endTime = performance.now();
    console.log(`getTrips-optimized: ${(endTime - startTime).toFixed(3)}ms`);
    
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
    
    // Obtener información de la compañía si existe companyId
    let companyName = undefined;
    let companyLogo = undefined;
    
    if (trip.companyId) {
      // Buscar el dueño de la compañía para obtener el nombre y logo
      const [owner] = await db
        .select()
        .from(schema.users)
        .where(
          and(
            eq(schema.users.role, schema.UserRole.OWNER),
            or(
              eq(schema.users.companyId, trip.companyId),
              eq(schema.users.company, trip.companyId)
            )
          )
        );
      
      if (owner) {
        companyName = owner.company;
        companyLogo = owner.profilePicture;
      }
    }
    
    return {
      ...trip,
      route,
      numStops: route.stops.length,
      companyName,
      companyLogo
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
    companyId?: string | null;
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
    
    // Apply company filter if provided
    if (params.companyId) {
      tripsQuery.where(eq(schema.trips.companyId, params.companyId));
      console.log(`Filtrando viajes por compañía ID: ${params.companyId}`);
    }
    
    // Get trips
    const trips = await tripsQuery;
    
    // Obtener todos los usuarios dueños (Owner) para relacionar con las compañías
    const owners = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.role, schema.UserRole.OWNER));
    
    // Crear un mapa de compañía -> datos del dueño para buscar rápidamente
    const companyMap = new Map();
    owners.forEach(owner => {
      const companyId = owner.companyId || owner.company;
      if (companyId) {
        companyMap.set(companyId, {
          companyName: owner.company,
          companyLogo: owner.profilePicture
        });
      }
    });
    
    // Now filter by origin and destination if provided
    const tripsWithRouteInfo: TripWithRouteInfo[] = [];
    
    for (const trip of trips) {
      const route = await this.getRoute(trip.routeId);
      if (!route) continue;
      
      // Obtener datos de la compañía si existen
      let companyData = { companyName: undefined, companyLogo: undefined };
      if (trip.companyId && companyMap.has(trip.companyId)) {
        companyData = companyMap.get(trip.companyId);
      }
      
      // For subtrips, check against segment origin and destination
      if (trip.isSubTrip && trip.segmentOrigin && trip.segmentDestination) {
        const originMatch = !params.origin || trip.segmentOrigin.toLowerCase().includes(params.origin.toLowerCase());
        const destMatch = !params.destination || trip.segmentDestination.toLowerCase().includes(params.destination.toLowerCase());
        
        if (originMatch && destMatch) {
          tripsWithRouteInfo.push({
            ...trip,
            route,
            numStops: route.stops.length,
            // Agregar información de la compañía
            companyName: companyData.companyName,
            companyLogo: companyData.companyLogo
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
          numStops: route.stops.length,
          // Agregar información de la compañía
          companyName: companyData.companyName,
          companyLogo: companyData.companyLogo
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
        .set({ 
          availableSeats: sql`available_seats + ${seatChange}` 
        })
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
        .set({ 
          availableSeats: sql`available_seats + ${seatChange}` 
        })
        .where(
          or(
            eq(schema.trips.id, tripId),
            eq(schema.trips.parentTripId, tripId)
          )
        );
    }
  }
  
  async getReservations(companyId?: string): Promise<ReservationWithDetails[]> {
    console.log("DB Storage: Consultando reservaciones");
    
    // Primero, definimos la consulta base
    let query = db.select().from(schema.reservations);
    
    // Si hay un companyId, filtrar directamente por ese campo en la tabla de reservaciones
    if (companyId) {
      console.log(`DB Storage: Filtrando reservaciones por compañía: ${companyId}`);
      query = query.where(eq(schema.reservations.companyId, companyId));
    }
    
    // Ejecutar la consulta
    const reservations = await query;
    console.log(`DB Storage: Reservaciones encontradas: ${reservations.length}`);
    
    const reservationsWithDetails: ReservationWithDetails[] = [];
    
    // Para cada reservación, obtenemos el viaje relacionado
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
    
    console.log(`DB Storage: Reservaciones procesadas: ${reservationsWithDetails.length}`);
    return reservationsWithDetails;
  }
  
  async getReservation(id: number): Promise<Reservation | undefined> {
    const [reservation] = await db.select().from(schema.reservations).where(eq(schema.reservations.id, id));
    return reservation;
  }
  
  async getReservationWithDetails(id: number, companyId?: string): Promise<ReservationWithDetails | undefined> {
    const reservation = await this.getReservation(id);
    if (!reservation) return undefined;
    
    const trip = await this.getTripWithRouteInfo(reservation.tripId);
    if (!trip) return undefined;
    
    // Si se proporciona companyId, verificar que el viaje pertenezca a esa compañía
    if (companyId && trip.companyId !== companyId) {
      console.log(`Acceso denegado: El viaje ${trip.id} pertenece a la compañía ${trip.companyId} pero se solicita acceso desde la compañía ${companyId}`);
      return undefined; // No permitir acceso a reservaciones de otras compañías
    }
    
    const passengers = await this.getPassengers(reservation.id);
    
    return {
      ...reservation,
      trip,
      passengers
    };
  }
  
  async createReservation(reservation: InsertReservation): Promise<Reservation> {
    // Si no se proporciona un companyId, intentamos obtenerlo del viaje relacionado
    if (!reservation.companyId) {
      const trip = await this.getTrip(reservation.tripId);
      if (trip && trip.companyId) {
        console.log(`Heredando companyId ${trip.companyId} del viaje ${trip.id} para la nueva reservación`);
        reservation.companyId = trip.companyId;
      } else {
        console.warn(`No se pudo obtener companyId del viaje ${reservation.tripId}. La reservación no tendrá companyId.`);
      }
    }
    
    console.log("Creando reservación con datos:", JSON.stringify(reservation, null, 2));
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
  
  // Métodos para gestión de vehículos (unidades)
  async getVehicles(companyId?: string): Promise<Vehicle[]> {
    console.log("DB Storage: Consultando vehículos");
    
    // Definir la consulta base
    let query = db.select().from(schema.vehicles);
    
    // Si hay un companyId, filtrar directamente por ese campo
    if (companyId) {
      console.log(`DB Storage: Filtrando vehículos por compañía: ${companyId}`);
      query = query.where(eq(schema.vehicles.companyId, companyId));
    }
    
    // Ejecutar la consulta
    const vehicles = await query;
    console.log(`DB Storage: Vehículos encontrados: ${vehicles.length}`);
    
    return vehicles;
  }
  
  async getVehicle(id: number): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(schema.vehicles).where(eq(schema.vehicles.id, id));
    return vehicle;
  }
  
  async createVehicle(vehicle: InsertVehicle): Promise<Vehicle> {
    console.log("Creando vehículo con datos:", JSON.stringify(vehicle, null, 2));
    
    // Aseguramos que los valores opcionales sean correctamente manejados
    const vehicleData = {
      plates: vehicle.plates,
      brand: vehicle.brand,
      model: vehicle.model,
      economicNumber: vehicle.economicNumber,
      capacity: vehicle.capacity,
      hasAC: vehicle.hasAC === true,
      hasRecliningSeats: vehicle.hasRecliningSeats === true,
      services: Array.isArray(vehicle.services) ? vehicle.services : [],
      description: vehicle.description || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const [newVehicle] = await db.insert(schema.vehicles).values(vehicleData).returning();
    return newVehicle;
  }
  
  async updateVehicle(id: number, vehicleUpdate: Partial<Vehicle>): Promise<Vehicle | undefined> {
    const [updatedVehicle] = await db
      .update(schema.vehicles)
      .set(vehicleUpdate)
      .where(eq(schema.vehicles.id, id))
      .returning();
    return updatedVehicle;
  }
  
  async deleteVehicle(id: number): Promise<boolean> {
    const result = await db
      .delete(schema.vehicles)
      .where(eq(schema.vehicles.id, id))
      .returning({ id: schema.vehicles.id });
    return result.length > 0;
  }
  
  // Métodos para gestión de comisiones
  async getCommissions(): Promise<Commission[]> {
    return await db.select().from(schema.commissions);
  }
  
  async getCommission(id: number): Promise<Commission | undefined> {
    const [commission] = await db.select().from(schema.commissions).where(eq(schema.commissions.id, id));
    return commission;
  }
  
  async createCommission(commission: InsertCommission): Promise<Commission> {
    const [newCommission] = await db.insert(schema.commissions).values(commission).returning();
    return newCommission;
  }
  
  async updateCommission(id: number, commissionUpdate: Partial<Commission>): Promise<Commission | undefined> {
    const [updatedCommission] = await db
      .update(schema.commissions)
      .set(commissionUpdate)
      .where(eq(schema.commissions.id, id))
      .returning();
    return updatedCommission;
  }
  
  async deleteCommission(id: number): Promise<boolean> {
    const result = await db
      .delete(schema.commissions)
      .where(eq(schema.commissions.id, id))
      .returning({ id: schema.commissions.id });
    return result.length > 0;
  }
}