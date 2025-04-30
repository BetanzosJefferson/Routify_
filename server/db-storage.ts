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
    
    // NUEVA IMPLEMENTACIÓN PARA GETTRIPS
    console.log(`[getTrips-v2] Iniciando búsqueda de viajes${companyId ? ` para compañía ${companyId}` : ''}`);
    
    // Construir condiciones como array
    const condiciones = [];
    
    // FILTRO CRÍTICO: Filtrar por compañía si se proporciona
    if (companyId) {
      console.log(`[getTrips-v2] FILTRO CRÍTICO: Compañía ${companyId}`);
      
      // Consulta directa para verificar cuántos viajes existen
      const testQuery = await db.execute(
        sql`SELECT COUNT(*) FROM trips WHERE company_id = ${companyId}`
      );
      
      const viajesContador = Number(testQuery.rows?.[0]?.count || 0); 
      console.log(`[getTrips-v2] Verificación: Existen ${viajesContador} viajes para compañía ${companyId}`);
      
      // Agregar condición de compañía directamente como SQL para máxima seguridad
      condiciones.push(sql`company_id = ${companyId}`);
    } else {
      console.log(`[getTrips-v2] ADVERTENCIA: Obteniendo TODOS los viajes sin filtro de compañía`);
    }
    
    // Ejecutar la consulta con las condiciones
    let trips;
    
    if (condiciones.length > 0) {
      // Construir cláusula WHERE combinando condiciones con AND
      let whereClause = condiciones[0];
      for (let i = 1; i < condiciones.length; i++) {
        whereClause = sql`${whereClause} AND ${condiciones[i]}`;
      }
      
      // Ejecutar consulta con filtros
      console.log(`[getTrips-v2] Ejecutando consulta con filtros`);
      trips = await db.select().from(schema.trips).where(whereClause);
    } else {
      // Sin filtros - solo para superAdmin/taquilla
      console.log(`[getTrips-v2] Ejecutando consulta SIN FILTROS`);
      trips = await db.select().from(schema.trips);
    }
    
    console.log(`[getTrips-v2] Encontrados ${trips.length} viajes`);
    
    // CAPA EXTRA DE SEGURIDAD: Filtrar después de obtener los resultados
    if (companyId) {
      // Verificar que todos los viajes sean realmente de la compañía solicitada
      const viajesFiltrados = trips.filter(trip => trip.companyId === companyId);
      
      if (viajesFiltrados.length !== trips.length) {
        console.log(`[getTrips-v2] ALERTA DE SEGURIDAD: La consulta SQL devolvió ${trips.length} viajes pero solo ${viajesFiltrados.length} son de la compañía ${companyId}`);
        trips = viajesFiltrados;
      }
    }
    
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
    
    // Obtener información del vehículo asignado si existe
    let assignedVehicle = undefined;
    if (trip.vehicleId) {
      console.log(`Buscando vehículo asignado con ID: ${trip.vehicleId}`);
      const [vehicle] = await db
        .select()
        .from(schema.vehicles)
        .where(eq(schema.vehicles.id, trip.vehicleId));
      
      if (vehicle) {
        console.log(`Vehículo encontrado: ${vehicle.brand} ${vehicle.model} (${vehicle.plates})`);
        assignedVehicle = vehicle;
      }
    }
    
    // Obtener información del conductor asignado si existe
    let assignedDriver = undefined;
    if (trip.driverId) {
      console.log(`Buscando conductor asignado con ID: ${trip.driverId}`);
      const [driver] = await db
        .select()
        .from(schema.users)
        .where(
          and(
            eq(schema.users.id, trip.driverId),
            eq(schema.users.role, "chofer")
          )
        );
      
      if (driver) {
        console.log(`Conductor encontrado: ${driver.firstName} ${driver.lastName}`);
        assignedDriver = driver;
      }
    }
    
    return {
      ...trip,
      route,
      numStops: route.stops.length,
      companyName,
      companyLogo,
      assignedVehicle,
      assignedDriver
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
    driverId?: number;   // Añadido para filtrar viajes de un conductor específico
  }): Promise<TripWithRouteInfo[]> {
    console.time('searchTrips-optimized');
    
    // SOLUCIÓN ACTUALIZADA PARA EL FILTRADO DE COMPAÑÍA QUE RESPETA PRIVILEGIOS DE superAdmin
    console.log(`[searchTrips-v2] Iniciando búsqueda con parámetros:`, params);
    
    // Construir los filtros como un array de condiciones 
    const condiciones = [];
    
    // 1. FILTRADO POR COMPAÑÍA (PRIORIDAD MÁXIMA)
    if (params.companyId) {
      // Importante: Los usuarios con privilegios especiales como superAdmin y taquilla pueden pasar un
      // parámetro especial "ALL" para indicar que quieren ver todos los viajes
      
      if (params.companyId === 'ALL') {
        console.log(`[searchTrips-v2] ACCESO TOTAL SOLICITADO: Mostrando todos los viajes sin filtrar por compañía`);
        // No añadir ningún filtro de compañía
      } else {
        console.log(`[searchTrips-v2] FILTRADO CRÍTICO POR COMPAÑÍA: "${params.companyId}"`);
        
        // Hacemos un SELECT COUNT para verificar que existen viajes para esta compañía
        const testQuery = await db.execute(
          sql`SELECT COUNT(*) FROM trips WHERE company_id = ${params.companyId}`
        );
        
        const viajesContador = Number(testQuery.rows?.[0]?.count || 0);
        console.log(`[searchTrips-v2] Verificación: Existen ${viajesContador} viajes para compañía ${params.companyId}`);
        
        // Añadimos la condición de compañía como SQL directo para máxima seguridad
        condiciones.push(sql`company_id = ${params.companyId}`);
      }
    } else {
      console.log(`[searchTrips-v2] ADVERTENCIA DE SEGURIDAD: No se está filtrando por compañía - ACCESO TOTAL`);
    }
    
    // 2. FILTROS ADICIONALES
    // Aplicar filtro de asientos disponibles
    if (params.seats) {
      console.log(`[searchTrips-v2] Filtro: Mínimo ${params.seats} asientos disponibles`);
      condiciones.push(sql`available_seats >= ${params.seats}`);
    }
    
    // Aplicar filtro de fecha
    if (params.date) {
      console.log(`[searchTrips-v2] Filtro de fecha: ${params.date}`);
      
      // Filtrado directo por SQL para máxima seguridad en el formato de fecha
      condiciones.push(sql`DATE(departure_date) = ${params.date}`);
    }
    
    // Aplicar filtro por conductor (driverId)
    if (params.driverId) {
      console.log(`[searchTrips-v2] Filtro por conductor ID: ${params.driverId}`);
      condiciones.push(sql`driver_id = ${params.driverId}`);
      
      // Verificar que existen viajes para este conductor
      const testQuery = await db.execute(
        sql`SELECT COUNT(*) FROM trips WHERE driver_id = ${params.driverId}`
      );
      
      const viajesContador = Number(testQuery.rows?.[0]?.count || 0);
      console.log(`[searchTrips-v2] Verificación: Existen ${viajesContador} viajes asignados al conductor ID ${params.driverId}`);
    }
    
    // CONSULTA FINAL: Construir y ejecutar la consulta SQL con todas las condiciones
    let trips;
    
    if (condiciones.length > 0) {
      // Construir la consulta SQL combinando todas las condiciones con AND
      let whereClause = condiciones[0];
      for (let i = 1; i < condiciones.length; i++) {
        whereClause = sql`${whereClause} AND ${condiciones[i]}`;
      }
      
      // Ejecutar la consulta combinada
      console.log(`[searchTrips-v2] Ejecutando consulta con filtros: ${whereClause}`);
      trips = await db.select().from(schema.trips).where(whereClause);
    } else {
      // Sin filtros - Esto solo debería ocurrir para superAdmin/taquilla
      console.log(`[searchTrips-v2] Ejecutando consulta SIN FILTROS`);
      trips = await db.select().from(schema.trips);
    }
    
    console.log(`[searchTrips-v2] Encontrados ${trips.length} viajes que coinciden con los filtros SQL`);
    
    // 3. CAPA DE SEGURIDAD ADICIONAL: Verificar después de obtener los datos
    let viajesFiltrados = trips;
    
    // Verificación extra si se requiere filtro de compañía
    if (params.companyId && params.companyId !== 'ALL') {
      console.log(`[searchTrips-v2] VERIFICACIÓN ADICIONAL de compañía: ${params.companyId}`);
      // Aplicar un segundo filtro después de la base de datos como capa adicional de seguridad
      viajesFiltrados = trips.filter(trip => trip.companyId === params.companyId);
      
      // Verificar si hubo diferencia (esto indicaría un problema en la consulta SQL)
      if (viajesFiltrados.length !== trips.length) {
        console.log(`[searchTrips-v2] ALERTA DE SEGURIDAD: La consulta SQL devolvió ${trips.length} viajes pero solo ${viajesFiltrados.length} son de la compañía ${params.companyId}`);
      }
      
      // Actualizar trips a la versión filtrada
      trips = viajesFiltrados;
    } else if (!params.companyId || params.companyId === 'ALL') {
      console.log(`[searchTrips-v2] ACCESO TOTAL: Mostrando todos los viajes sin filtro adicional de compañía`);
    }
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
  
  async getReservations(companyId?: string, tripId?: number): Promise<ReservationWithDetails[]> {
    console.time('getReservations-optimized');
    
    // NUEVA IMPLEMENTACIÓN CON FILTRADO DE COMPAÑÍA Y VIAJE
    console.log(`[getReservations] Iniciando búsqueda${companyId ? ` para compañía ${companyId}` : ''}${tripId ? ` para viaje ${tripId}` : ''}`);
    
    // Construir condiciones de filtrado como array
    const condiciones = [];
    
    // FILTRO POR VIAJE ESPECÍFICO (Prioridad 1)
    // Esto es útil para conductores que necesitan ver reservas de sus viajes asignados
    if (tripId) {
      console.log(`[getReservations] FILTRO POR VIAJE: ID ${tripId}`);
      condiciones.push(sql`trip_id = ${tripId}`);
      
      // Verificar cuántas reservas existen para este viaje
      const testTripQuery = await db.execute(
        sql`SELECT COUNT(*) FROM reservations WHERE trip_id = ${tripId}`
      );
      
      const reservasPorViaje = Number(testTripQuery.rows?.[0]?.count || 0);
      console.log(`[getReservations] Verificación: Existen ${reservasPorViaje} reservas para el viaje ${tripId}`);
    }
    
    // FILTRO CRÍTICO: Compañía (Prioridad 2)
    if (companyId) {
      console.log(`[getReservations] FILTRO CRÍTICO: Compañía ${companyId}`);
      
      // Verificar cuántas reservas existen para esta compañía
      const testQuery = await db.execute(
        sql`SELECT COUNT(*) FROM reservations WHERE company_id = ${companyId}`
      );
      
      const reservasContador = Number(testQuery.rows?.[0]?.count || 0);
      console.log(`[getReservations] Verificación: Existen ${reservasContador} reservas para compañía ${companyId}`);
      
      // Aplicar filtro directo como SQL
      condiciones.push(sql`company_id = ${companyId}`);
    } else if (!tripId) {
      // Solo mostramos la advertencia si tampoco hay filtro por viaje
      console.log(`[getReservations] ADVERTENCIA: Obteniendo TODAS las reservas sin filtro de compañía ni viaje`);
    }
    
    // Ejecutar consulta
    let reservations;
    
    if (condiciones.length > 0) {
      // Combinar condiciones con AND
      let whereClause = condiciones[0];
      for (let i = 1; i < condiciones.length; i++) {
        whereClause = sql`${whereClause} AND ${condiciones[i]}`;
      }
      
      // Ejecutar consulta con filtros
      console.log(`[getReservations] Ejecutando consulta CON filtros`);
      reservations = await db.select().from(schema.reservations).where(whereClause);
    } else {
      // Sin filtros (solo superAdmin debería llegar aquí)
      console.log(`[getReservations] Ejecutando consulta SIN filtros`);
      reservations = await db.select().from(schema.reservations);
    }
    
    console.log(`[getReservations] Encontradas ${reservations.length} reservas`);
    
    // CAPA DE SEGURIDAD ADICIONAL
    if (companyId) {
      // Verificar que todas las reservas sean realmente de la compañía
      const reservasFiltradas = reservations.filter(r => r.companyId === companyId);
      
      if (reservasFiltradas.length !== reservations.length) {
        console.log(`[getReservations] ALERTA DE SEGURIDAD: La consulta SQL devolvió ${reservations.length} reservas pero solo ${reservasFiltradas.length} son de la compañía ${companyId}`);
        reservations = reservasFiltradas;
      }
    }
    
    // Obtener detalles para cada reserva
    const reservationsWithDetails: ReservationWithDetails[] = [];
    
    for (const reservation of reservations) {
      // Obtener información del viaje asociado 
      // NOTA: getTripWithRouteInfo ya incluye sus propias verificaciones de seguridad
      const trip = await this.getTripWithRouteInfo(reservation.tripId);
      if (!trip) {
        console.log(`[getReservations] No se encontró el viaje ${reservation.tripId} asociado a la reserva ${reservation.id}`);
        continue;
      }
      
      // Obtener pasajeros
      const passengers = await this.getPassengers(reservation.id);
      
      // Obtener información del usuario que creó la reservación
      let createdByUser: schema.User | undefined = undefined;
      if (reservation.createdBy) {
        // Buscar el usuario por ID
        const [user] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, reservation.createdBy));
        
        if (user) {
          createdByUser = user;
          console.log(`[getReservations] Reserva ${reservation.id} creada por usuario ${user.firstName} ${user.lastName} (ID: ${user.id})`);
        }
      }
      
      // Agregar a los resultados
      reservationsWithDetails.push({
        ...reservation,
        trip,
        passengers,
        createdByUser // Añadimos el usuario creador
      });
    }
    
    console.timeEnd('getReservations-optimized');
    return reservationsWithDetails;
  }
  
  async getReservation(id: number): Promise<Reservation | undefined> {
    const [reservation] = await db.select().from(schema.reservations).where(eq(schema.reservations.id, id));
    return reservation;
  }
  
  async getReservationWithDetails(id: number, companyId?: string): Promise<ReservationWithDetails | undefined> {
    console.log(`[getReservationWithDetails] Buscando reserva ${id}${companyId ? ` para compañía ${companyId}` : ''}`);
    
    // Obtener la reserva
    const reservation = await this.getReservation(id);
    if (!reservation) {
      console.log(`[getReservationWithDetails] Reserva ${id} no encontrada`);
      return undefined;
    }
    
    // SEGURIDAD: Verificar acceso por compañía
    if (companyId && reservation.companyId && reservation.companyId !== companyId) {
      console.log(`[getReservationWithDetails] ACCESO DENEGADO: La reserva ${id} pertenece a compañía ${reservation.companyId} pero se solicitó desde ${companyId}`);
      return undefined; // Denegar acceso a reservas de otras compañías
    }
    
    // Obtener información del viaje asociado
    const trip = await this.getTripWithRouteInfo(reservation.tripId);
    if (!trip) {
      console.log(`[getReservationWithDetails] Viaje ${reservation.tripId} no encontrado para la reserva ${id}`);
      return undefined;
    }
    
    // SEGURIDAD ADICIONAL: Verificar también que el viaje sea de la misma compañía
    if (companyId && trip.companyId && trip.companyId !== companyId) {
      console.log(`[getReservationWithDetails] ACCESO DENEGADO: El viaje ${trip.id} pertenece a compañía ${trip.companyId} pero se solicitó desde ${companyId}`);
      return undefined; // Denegar acceso a viajes de otras compañías
    }
    
    // Obtener los pasajeros
    const passengers = await this.getPassengers(reservation.id);
    
    // Obtener información del usuario que creó la reservación
    let createdByUser: schema.User | undefined = undefined;
    if (reservation.createdBy) {
      // Buscar el usuario por ID
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, reservation.createdBy));
      
      if (user) {
        createdByUser = user;
        console.log(`[getReservationWithDetails] Reserva ${id} creada por usuario ${user.firstName} ${user.lastName} (ID: ${user.id})`);
      }
    }
    
    console.log(`[getReservationWithDetails] Acceso concedido a reserva ${id} con ${passengers.length} pasajeros`);
    
    return {
      ...reservation,
      trip,
      passengers,
      createdByUser // Añadimos el usuario creador
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
  async getCommissions(companyId?: string): Promise<Commission[]> {
    // APLICAR FILTRO DE COMPAÑÍA si se proporciona
    if (companyId) {
      console.log(`[getCommissions] Filtrando comisiones por compañía: ${companyId}`);
      return await db
        .select()
        .from(schema.commissions)
        .where(eq(schema.commissions.companyId, companyId));
    }
    
    // Si no hay filtro, devolver todas las comisiones
    console.log('[getCommissions] Obteniendo todas las comisiones (sin filtro de compañía)');
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
  
  // Implementación de getCommissionerReservations para obtener reservaciones creadas por comisionistas
  async getCommissionerReservations(companyId?: string): Promise<ReservationWithDetails[]> {
    console.time('getCommissionerReservations');
    
    // Importamos UserRole desde schema
    const { UserRole } = schema;
    
    console.log(`[getCommissionerReservations] Iniciando búsqueda${companyId ? ` para compañía ${companyId}` : ''}`);
    
    // Primero, necesitamos obtener los usuarios con rol "comisionista"
    const comisionistas = await db.select().from(schema.users)
      .where(sql`role = ${UserRole.COMMISSIONER}`);
    
    console.log(`[getCommissionerReservations] Encontrados ${comisionistas.length} usuarios comisionistas`);
    
    if (comisionistas.length === 0) {
      console.log(`[getCommissionerReservations] No hay comisionistas en el sistema`);
      console.timeEnd('getCommissionerReservations');
      return [];
    }
    
    // Obtener los IDs de los comisionistas
    const comisionistaIds = comisionistas.map(u => u.id);
    
    // Construir condiciones de filtrado
    const condiciones = [];
    
    // Filtro para solo obtener reservaciones creadas por comisionistas
    // Usamos el campo "created_by" que existe en la tabla reservations
    condiciones.push(sql`created_by IN (${sql.join(comisionistaIds, sql`, `)})`);
    
    // Aplicar filtro de compañía si existe
    if (companyId) {
      console.log(`[getCommissionerReservations] FILTRO: Compañía ${companyId}`);
      condiciones.push(sql`company_id = ${companyId}`);
    }
    
    // Ejecutar consulta
    let reservations;
    
    if (condiciones.length > 0) {
      // Combinar condiciones con AND
      let whereClause = condiciones[0];
      for (let i = 1; i < condiciones.length; i++) {
        whereClause = sql`${whereClause} AND ${condiciones[i]}`;
      }
      
      console.log(`[getCommissionerReservations] Ejecutando consulta con filtros`);
      reservations = await db.select().from(schema.reservations).where(whereClause);
    } else {
      console.log(`[getCommissionerReservations] Ejecutando consulta sin filtros`);
      reservations = await db.select().from(schema.reservations);
    }
    
    console.log(`[getCommissionerReservations] Encontradas ${reservations.length} reservas de comisionistas`);
    
    // Cargar información adicional
    const reservationsWithDetails: ReservationWithDetails[] = [];
    
    for (const reservation of reservations) {
      try {
        // Obtener el viaje asociado
        const trip = await this.getTripWithRouteInfo(reservation.tripId);
        if (!trip) {
          console.log(`[getCommissionerReservations] No se encontró el viaje ${reservation.tripId} asociado a la reserva ${reservation.id}`);
          continue;
        }
        
        // Obtener pasajeros
        const passengers = await this.getPassengers(reservation.id);
        
        // Obtener usuario que creó la reserva
        let createdByUser = null;
        if (reservation.createdBy !== undefined) {
          const user = await db.select().from(schema.users).where(sql`id = ${reservation.createdBy}`).limit(1);
          if (user && user.length > 0) {
            createdByUser = user[0];
            console.log(`[getCommissionerReservations] Reserva ${reservation.id} creada por usuario ${user[0].firstName} ${user[0].lastName} (ID: ${user[0].id})`);
          }
        }
        
        reservationsWithDetails.push({
          ...reservation,
          trip,
          passengers,
          createdByUser: createdByUser
        });
      } catch (error) {
        console.error(`[getCommissionerReservations] Error procesando reserva ID ${reservation.id}:`, error);
      }
    }
    
    console.timeEnd('getCommissionerReservations');
    return reservationsWithDetails;
  }
}