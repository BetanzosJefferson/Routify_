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
    try {
      if (companyId) {
        console.log(`DB Storage: Consultando rutas para la compañía: ${companyId}`);
        const routes = await db
          .select()
          .from(schema.routes)
          .where(eq(schema.routes.companyId, companyId));
        console.log(`DB Storage: Rutas filtradas encontradas: ${routes.length}`);
        return routes;
      } else {
        console.log("DB Storage: Consultando todas las rutas");
        const routes = await db.select().from(schema.routes);
        console.log(`DB Storage: Rutas encontradas: ${routes.length}`);
        console.log("DB Storage: Datos de rutas:", JSON.stringify(routes));
        return routes;
      }
    } catch (error) {
      console.error("DB Storage: Error al consultar rutas:", error);
      return [];
    }
  }
  
  async getRoute(id: number): Promise<Route | undefined> {
    const [route] = await db.select().from(schema.routes).where(eq(schema.routes.id, id));
    return route;
  }
  
  async createRoute(route: InsertRoute): Promise<Route> {
    console.log("Creando ruta con los datos:", JSON.stringify(route));
    try {
      // Asegurarse de que stops sea un array de strings válido
      let safeStops: string[] = [];
      
      if (route.stops) {
        // Si es un array, usarlo directamente
        if (Array.isArray(route.stops)) {
          safeStops = route.stops;
        } 
        // Si es un string JSON, intentar parsearlo
        else if (typeof route.stops === 'string') {
          try {
            const parsed = JSON.parse(route.stops);
            if (Array.isArray(parsed)) {
              safeStops = parsed;
            }
          } catch (e) {
            console.error("Error al parsear stops como JSON:", e);
          }
        }
      }
      
      const safeRoute = {
        name: route.name,
        origin: route.origin,
        destination: route.destination,
        stops: safeStops,
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
    
    // Crear un array con todos los puntos en la ruta (origen, paradas, destino)
    const allPoints = [route.origin, ...route.stops, route.destination];
    
    // Función para verificar si dos ubicaciones están en la misma ciudad
    function isSameCity(location1: string, location2: string): boolean {
      // Extraer el nombre de la ciudad (asumiendo formato "Ciudad, Estado - Ubicación")
      const city1 = location1.split(' - ')[0].trim();
      const city2 = location2.split(' - ')[0].trim();
      return city1 === city2;
    }
    
    // Generar todas las combinaciones posibles de segmentos
    for (let i = 0; i < allPoints.length - 1; i++) {
      for (let j = i + 1; j < allPoints.length; j++) {
        // No agregar segmentos donde origen y destino están en la misma ciudad
        if (isSameCity(allPoints[i], allPoints[j])) continue;
        
        // Agregar cada combinación posible como un segmento
        segments.push({
          origin: allPoints[i],
          destination: allPoints[j]
        });
      }
    }
    
    // Si no hay segmentos (caso raro), al menos agregar la ruta directa
    if (segments.length === 0) {
      segments.push({
        origin: route.origin,
        destination: route.destination
      });
    }
    
    console.log(`Generados ${segments.length} segmentos válidos (excluyendo misma ciudad) para la ruta ${id}`);
    
    return {
      ...route,
      segments
    };
  }
  
  async getTrips(companyId?: string): Promise<TripWithRouteInfo[]> {
    console.time('getTrips-optimized');
    
    // FILTRO CRÍTICO: Obtener viajes, filtrando por compañía si es necesario
    let tripsQuery = db.select().from(schema.trips);
    
    if (companyId) {
      console.log(`[getTrips] FILTRO CRÍTICO: Filtrando viajes solo de compañía: "${companyId}"`);
      
      // Verificar primero si hay viajes para este companyId
      const testCountQuery = await db.select({ count: sql`COUNT(*)` })
        .from(schema.trips)
        .where(eq(schema.trips.companyId, companyId));
        
      const viajesCount = Number(testCountQuery[0]?.count || 0);
      console.log(`[getTrips] La compañía ${companyId} tiene ${viajesCount} viajes en la base de datos`);
      
      // Aplicar el filtro de compañía
      tripsQuery = tripsQuery.where(eq(schema.trips.companyId, companyId));
    } else {
      console.log(`[getTrips] ALERTA: Obteniendo todos los viajes sin filtro de compañía`);
    }
    const trips = await tripsQuery;
    
    // Obtener todas las rutas de una sola vez
    console.log('Obteniendo todas las rutas en una sola consulta');
    const routes = await db.select().from(schema.routes);
    
    // Obtener todos los usuarios dueños (Owner) para relacionar con las compañías
    const owners = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.role, schema.UserRole.OWNER));
    
    // Crear un mapa de compañía -> datos del dueño para búsqueda rápida
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
    
    // Crear mapa de rutas para búsqueda rápida
    const routeMap = new Map<number, Route>();
    routes.forEach(route => {
      routeMap.set(route.id, route);
    });
    
    // Asociar cada viaje con su ruta y compañía
    const tripsWithRouteInfo: TripWithRouteInfo[] = [];
    
    for (const trip of trips) {
      const route = routeMap.get(trip.routeId);
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
      // Si no se encuentra la ruta, simplemente no incluimos este viaje
    }
    
    console.timeEnd('getTrips-optimized');
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
    
    // Obtener la información de la compañía si existe
    let companyName = undefined;
    let companyLogo = undefined;
    
    if (trip.companyId) {
      // Buscar al dueño (Owner) de la compañía para obtener la información
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
    try {
      // Primero, obtener el viaje que queremos eliminar
      const trip = await this.getTrip(id);
      if (!trip) return false;
      
      // Si es un viaje principal (no es subTrip), eliminar también todos sus sub-viajes
      if (!trip.isSubTrip) {
        console.log(`Eliminando viaje principal ${id} y todos sus sub-viajes`);
        // Eliminar todos los sub-viajes que tienen este viaje como parentTripId
        await db
          .delete(schema.trips)
          .where(eq(schema.trips.parentTripId, id));
      } else {
        console.log(`Eliminando sub-viaje ${id}`);
      }
      
      // Finalmente, eliminar el viaje solicitado
      const result = await db
        .delete(schema.trips)
        .where(eq(schema.trips.id, id))
        .returning({ id: schema.trips.id });
        
      return result.length > 0;
    } catch (error) {
      console.error(`Error al eliminar viaje ${id}:`, error);
      return false;
    }
  }
  
  async searchTrips(params: {
    origin?: string;
    destination?: string;
    date?: string;
    seats?: number;
    companyId?: string;  // Añadido para filtrar por compañía
  }): Promise<TripWithRouteInfo[]> {
    console.time('searchTrips-optimized');
    
    // Base query for trips
    const tripsQuery = db.select().from(schema.trips);
    
    // PRIORIDAD #1: FILTRAR POR COMPAÑÍA
    // ¡Importante! Este filtro debe aplicarse primero y es obligatorio para usuarios no superAdmin/taquilla
    if (params.companyId) {
      console.log(`[searchTrips] FILTRO CRÍTICO: Filtrando viajes solo de compañía: "${params.companyId}"`);
      
      // Verificar antes si hay viajes para este companyId 
      const testCountQuery = await db.select({ count: sql`COUNT(*)` })
        .from(schema.trips)
        .where(eq(schema.trips.companyId, params.companyId));
        
      const viajesCount = Number(testCountQuery[0]?.count || 0);
      console.log(`[searchTrips] La compañía ${params.companyId} tiene ${viajesCount} viajes en la base de datos`);
      
      // Aplicar el filtro de compañía usando SQL parametrizado seguro
      tripsQuery.where(eq(schema.trips.companyId, params.companyId));
    } else {
      console.log(`[searchTrips] ALERTA: No se está aplicando filtro de compañía`);
    }
    
    // PRIORIDAD #2: FILTROS ADICIONALES
    // Apply seat filter
    if (params.seats) {
      console.log(`[searchTrips] Filtro: Mínimo ${params.seats} asientos disponibles`);
      tripsQuery.where(gte(schema.trips.availableSeats, params.seats));
    }
    
    // Apply date filter
    if (params.date) {
      // Ajustamos para manejar correctamente la fecha sin problemas de zona horaria
      const searchDate = new Date(params.date + 'T00:00:00');
      console.log(`Buscando viajes para la fecha: ${searchDate.toISOString()}`);
      
      // Creamos la fecha del día siguiente (a las 00:00:00)
      const nextDay = new Date(params.date + 'T00:00:00');
      nextDay.setDate(nextDay.getDate() + 1);
      console.log(`Hasta la fecha: ${nextDay.toISOString()}`);
      
      // Convertimos las fechas a strings para comparación directa de fechas sin hora
      const searchDateStr = params.date;
      
      // Usamos SQL para comparar solo las partes de fecha sin considerar la hora
      tripsQuery.where(sql`DATE(departure_date) = ${searchDateStr}`);
    }
    
    // Get trips
    const trips = await tripsQuery;
    console.log(`Encontrados ${trips.length} viajes que coinciden con los filtros básicos`);
    
    // Get all routes in a single query for better performance
    const routes = await db.select().from(schema.routes);
    
    // Obtener todos los usuarios dueños (Owner) para relacionar con las compañías
    const owners = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.role, schema.UserRole.OWNER));
    
    // Crear un mapa de compañía -> datos del dueño para búsqueda rápida
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
    
    // Create map for quick lookups
    const routeMap = new Map<number, Route>();
    routes.forEach(route => {
      routeMap.set(route.id, route);
    });
    
    // Now filter by origin and destination if provided
    const tripsWithRouteInfo: TripWithRouteInfo[] = [];
    
    for (const trip of trips) {
      const route = routeMap.get(trip.routeId);
      if (!route) continue;
      
      // Buscar información de la compañía si existe
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
        const searchOrigin = params.origin.toLowerCase();
        originMatch = route.origin.toLowerCase().includes(searchOrigin) || 
                      route.stops.some(stop => stop.toLowerCase().includes(searchOrigin));
      }
      
      if (params.destination) {
        const searchDest = params.destination.toLowerCase();
        destMatch = route.destination.toLowerCase().includes(searchDest) || 
                    route.stops.some(stop => stop.toLowerCase().includes(searchDest));
      }
      
      if (originMatch && destMatch) {
        tripsWithRouteInfo.push({
          ...trip,
          route,
          numStops: route.stops.length,
          companyName: companyData.companyName,
          companyLogo: companyData.companyLogo
        });
      }
    }
    
    console.timeEnd('searchTrips-optimized');
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

  // Vehicle methods
  async getVehicles(companyId?: string): Promise<Vehicle[]> {
    // Si se proporciona un companyId, filtrar por compañía
    if (companyId) {
      console.log(`DB Storage: Obteniendo vehículos filtrados por compañía ${companyId}`);
      return await db
        .select()
        .from(schema.vehicles)
        .where(eq(schema.vehicles.companyId, companyId));
    }
    
    // Si no hay filtro, devolver todos los vehículos
    console.log('DB Storage: Obteniendo todos los vehículos (sin filtro de compañía)');
    return await db.select().from(schema.vehicles);
  }
  
  async getVehicle(id: number): Promise<Vehicle | undefined> {
    const [vehicle] = await db.select().from(schema.vehicles).where(eq(schema.vehicles.id, id));
    return vehicle;
  }
  
  async createVehicle(vehicle: InsertVehicle): Promise<Vehicle> {
    const [newVehicle] = await db.insert(schema.vehicles).values({
      ...vehicle,
      createdAt: new Date(),
      updatedAt: null,
      hasAC: vehicle.hasAC ?? null,
      hasRecliningSeats: vehicle.hasRecliningSeats ?? null,
      services: vehicle.services ?? null,
      description: vehicle.description ?? null
    }).returning();
    return newVehicle;
  }
  
  async updateVehicle(id: number, vehicleUpdate: Partial<Vehicle>): Promise<Vehicle | undefined> {
    const [updatedVehicle] = await db
      .update(schema.vehicles)
      .set({
        ...vehicleUpdate,
        updatedAt: new Date()
      })
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
  
  // Commission methods
  async getCommissions(): Promise<Commission[]> {
    return await db.select().from(schema.commissions);
  }
  
  async getCommission(id: number): Promise<Commission | undefined> {
    const [commission] = await db.select().from(schema.commissions).where(eq(schema.commissions.id, id));
    return commission;
  }
  
  async createCommission(commission: InsertCommission): Promise<Commission> {
    const [newCommission] = await db.insert(schema.commissions).values({
      ...commission,
      createdAt: new Date(),
      updatedAt: null,
      routeId: commission.routeId ?? null,
      tripId: commission.tripId ?? null,
      description: commission.description ?? null,
      percentage: commission.percentage ?? null
    }).returning();
    return newCommission;
  }
  
  async updateCommission(id: number, commissionUpdate: Partial<Commission>): Promise<Commission | undefined> {
    const [updatedCommission] = await db
      .update(schema.commissions)
      .set({
        ...commissionUpdate,
        updatedAt: new Date()
      })
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