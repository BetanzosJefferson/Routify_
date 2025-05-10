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
  InsertCommission,
  ReservationRequest,
  InsertReservationRequest,
  Notification,
  InsertNotification,
  UserRole,
  Coupon,
  InsertCoupon
} from "@shared/schema";
import { IStorage } from "./storage";
import { db } from "./db";
import { eq, and, gte, lt, like, or, sql, desc, isNull, not, inArray } from "drizzle-orm";

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
        companyId: route.companyId, // Incluir el companyId para la creación de rutas
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
    try {
      // Verificamos el formato de stops para asegurar que sea un array
      let safeRoutUpdate = { ...routeUpdate };
      if (routeUpdate.stops !== undefined) {
        let safeStops: string[] = [];
        
        // Validar que stops sea un array o convertirlo apropiadamente
        if (Array.isArray(routeUpdate.stops)) {
          safeStops = routeUpdate.stops;
          console.log("Actualizando stops como array:", safeStops);
        }
        // Si es un string JSON, intentar parsearlo
        else if (typeof routeUpdate.stops === 'string') {
          try {
            const parsed = JSON.parse(routeUpdate.stops as string);
            if (Array.isArray(parsed)) {
              safeStops = parsed;
              console.log("Actualizando stops desde string JSON:", safeStops);
            }
          } catch (e) {
            console.error("Error al parsear stops como JSON en actualización:", e);
            
            // Si hay error, verificar si es un string simple y convertirlo a array de un elemento
            if (typeof routeUpdate.stops === 'string') {
              safeStops = [routeUpdate.stops as string];
              console.log("Estableciendo stops como array de un solo elemento:", safeStops);
            }
          }
        }
        
        // Actualizar el objeto routeUpdate con los stops validados
        safeRoutUpdate.stops = safeStops;
      }
      
      console.log("Datos procesados para actualización de ruta:", safeRoutUpdate);
      const [updatedRoute] = await db
        .update(schema.routes)
        .set(safeRoutUpdate)
        .where(eq(schema.routes.id, id))
        .returning();
      
      console.log("Ruta actualizada exitosamente:", updatedRoute);
      return updatedRoute;
    } catch (error) {
      console.error("Error al actualizar ruta en la base de datos:", error);
      throw error;
    }
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
    
    // Obtener todos los vehículos y conductores en una sola consulta
    console.log('Obteniendo todos los vehículos y conductores en una sola consulta');
    const vehicles = await db.select().from(schema.vehicles);
    const drivers = await db
      .select()
      .from(schema.users)
      .where(
        or(
          eq(schema.users.role, "chofer"),
          eq(schema.users.role, "CHOFER"),
          eq(schema.users.role, "Chofer"),
          eq(schema.users.role, "driver"),
          eq(schema.users.role, "DRIVER"),
          eq(schema.users.role, "Driver")
        )
      );
    
    // Crear mapas para búsqueda rápida
    const vehicleMap = new Map<number, schema.Vehicle>();
    vehicles.forEach(vehicle => {
      vehicleMap.set(vehicle.id, vehicle);
    });
    
    const driverMap = new Map<number, schema.User>();
    drivers.forEach(driver => {
      driverMap.set(driver.id, driver);
    });
    
    console.log(`Cargados ${vehicles.length} vehículos y ${drivers.length} conductores para búsqueda rápida`);
    
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
        
        // Buscar vehículo asignado
        let assignedVehicle = undefined;
        if (trip.vehicleId && vehicleMap.has(trip.vehicleId)) {
          assignedVehicle = vehicleMap.get(trip.vehicleId);
          console.log(`Viaje ${trip.id}: Encontrado vehículo asignado ${assignedVehicle.brand} ${assignedVehicle.model} (${assignedVehicle.plates})`);
        }
        
        // Buscar conductor asignado
        let assignedDriver = undefined;
        if (trip.driverId && driverMap.has(trip.driverId)) {
          assignedDriver = driverMap.get(trip.driverId);
          console.log(`Viaje ${trip.id}: Encontrado conductor asignado ${assignedDriver.firstName} ${assignedDriver.lastName}`);
        }
        
        const tripWithInfo = {
          ...trip,
          route,
          numStops: route.stops.length,
          // Agregar información de la compañía
          companyName: companyData.companyName,
          companyLogo: companyData.companyLogo,
          // Agregar información de vehículo y conductor
          assignedVehicle,
          assignedDriver
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
    
    // Calcular el estado del viaje según las fechas
    const calculateTripStatus = (trip: any): string => {
      const now = new Date();
      const departureDate = new Date(trip.departureDate);
      departureDate.setHours(0, 0, 0, 0); // Establecer a inicio del día
      
      // Parsear la hora de salida y llegada
      const parseTimeToMinutes = (timeStr: string): number => {
        if (!timeStr) return 0;
        const [time, period] = timeStr.split(' ');
        const [hoursStr, minutesStr] = time.split(':');
        let hours = parseInt(hoursStr, 10);
        const minutes = parseInt(minutesStr, 10);
        
        // Convertir a formato 24 horas
        if (period === 'PM' && hours < 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        
        return hours * 60 + minutes;
      };
      
      // Establecer la hora de salida y llegada en el objeto de fecha
      const departureTime = parseTimeToMinutes(trip.departureTime);
      const arrivalTime = parseTimeToMinutes(trip.arrivalTime);
      
      // Crear fechas completas para salida y llegada
      const fullDepartureDate = new Date(departureDate);
      fullDepartureDate.setHours(Math.floor(departureTime / 60), departureTime % 60, 0, 0);
      
      const fullArrivalDate = new Date(departureDate);
      
      // Si la hora de llegada es menor que la de salida, asumimos que llega al día siguiente
      if (arrivalTime < departureTime) {
        fullArrivalDate.setDate(fullArrivalDate.getDate() + 1);
      }
      fullArrivalDate.setHours(Math.floor(arrivalTime / 60), arrivalTime % 60, 0, 0);
      
      // Determinar el estado del viaje usando las constantes del esquema
      if (now < fullDepartureDate) {
        return schema.TripStatus.NOT_STARTED;
      } else if (now >= fullDepartureDate && now < fullArrivalDate) {
        return schema.TripStatus.IN_PROGRESS;
      } else {
        return schema.TripStatus.COMPLETED;
      }
    };
    
    // Calcular el estado actual del viaje
    const calculatedTripStatus = calculateTripStatus(trip);
    
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
      tripStatus: calculatedTripStatus, // Incluir el estado calculado del viaje
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
    // Registrar los datos para depuración
    console.log(`🔄 Actualizando viaje ${id} con datos:`, JSON.stringify(tripUpdate, null, 2));
    
    // Verificar si se están actualizando los horarios
    if (tripUpdate.departureTime || tripUpdate.arrivalTime) {
      console.log(`⏰ ACTUALIZACIÓN DE HORARIOS DETECTADA: 
        - Salida: ${tripUpdate.departureTime || 'sin cambios'} 
        - Llegada: ${tripUpdate.arrivalTime || 'sin cambios'}`);
    }
    
    // Realizar la actualización en la base de datos
    const [updatedTrip] = await db
      .update(schema.trips)
      .set(tripUpdate)
      .where(eq(schema.trips.id, id))
      .returning();
    
    // Registrar el resultado
    console.log(`✅ Viaje ${id} actualizado, nuevos valores:`, 
      JSON.stringify({
        departureTime: updatedTrip.departureTime,
        arrivalTime: updatedTrip.arrivalTime,
        price: updatedTrip.price,
        capacity: updatedTrip.capacity
      }, null, 2)
    );
    
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
    visibility?: string; // Añadido para filtrar por visibilidad (publicado/oculto/cancelado)
  }): Promise<TripWithRouteInfo[]> {
    console.time('searchTrips-optimized');
    
    // SOLUCIÓN ACTUALIZADA PARA EL FILTRADO DE COMPAÑÍA QUE RESPETA PRIVILEGIOS DE superAdmin
    console.log(`[searchTrips-v2] Iniciando búsqueda con parámetros:`, params);
    
    // Construir los filtros como un array de condiciones 
    const condiciones = [];
    
    // Aplicar filtro de visibilidad si está especificado
    if (params.visibility) {
      console.log(`[searchTrips-v2] Filtro por visibilidad: ${params.visibility}`);
      condiciones.push(sql`visibility = ${params.visibility}`);
    } else {
      // Por defecto, solo mostrar viajes publicados
      condiciones.push(sql`visibility = 'publicado'`);
      console.log(`[searchTrips-v2] Aplicando filtro predeterminado: solo viajes publicados`);
    }
    
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
      console.log(`[searchTrips-v2] Filtro de fecha original: ${params.date}`);
      
      try {
        // Asegurarnos de que la fecha está en el formato YYYY-MM-DD para la consulta SQL
        let formattedDate = params.date;
        
        // Si la fecha incluye tiempo (T o espacio), extraer solo la parte de la fecha
        if (params.date.includes('T') || params.date.includes(' ')) {
          formattedDate = params.date.split(/[T ]/)[0];
        }
        
        console.log(`[searchTrips-v2] Fecha formateada para SQL: ${formattedDate}`);
        
        // Filtrado directo por SQL para máxima seguridad en el formato de fecha
        condiciones.push(sql`DATE(departure_date) = ${formattedDate}`);
      } catch (error) {
        console.error(`[searchTrips-v2] Error al formatear fecha para consulta: ${error}`);
        // En caso de error, usar la fecha original
        condiciones.push(sql`DATE(departure_date) = ${params.date}`);
      }
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
    
    // Obtener todos los vehículos en una sola consulta
    const vehicles = await db.select().from(schema.vehicles);
    
    // Crear un mapa de vehículos para búsqueda rápida
    const vehicleMap = new Map<number, schema.Vehicle>();
    vehicles.forEach(vehicle => {
      vehicleMap.set(vehicle.id, vehicle);
    });
    
    // Obtener todos los conductores (choferes) en una sola consulta
    const drivers = await db
      .select()
      .from(schema.users)
      .where(
        or(
          eq(schema.users.role, "chofer"),
          eq(schema.users.role, "CHOFER"),
          eq(schema.users.role, "Chofer"),
          eq(schema.users.role, "driver"),
          eq(schema.users.role, "DRIVER"),
          eq(schema.users.role, "Driver")
        )
      );
    
    // Crear un mapa de conductores para búsqueda rápida
    const driverMap = new Map<number, schema.User>();
    drivers.forEach(driver => {
      driverMap.set(driver.id, driver);
    });
    
    console.log(`Cargados ${vehicles.length} vehículos y ${drivers.length} conductores para búsqueda rápida`);
    
    // Función auxiliar para calcular el estado del viaje según las fechas
    const calculateTripStatus = (trip: any): string => {
      const now = new Date();
      const departureDate = new Date(trip.departureDate);
      departureDate.setHours(0, 0, 0, 0); // Establecer a inicio del día
      
      // Parsear la hora de salida y llegada
      const parseTimeToMinutes = (timeStr: string): number => {
        if (!timeStr) return 0;
        const [time, period] = timeStr.split(' ');
        const [hoursStr, minutesStr] = time.split(':');
        let hours = parseInt(hoursStr, 10);
        const minutes = parseInt(minutesStr, 10);
        
        // Convertir a formato 24 horas
        if (period === 'PM' && hours < 12) hours += 12;
        if (period === 'AM' && hours === 12) hours = 0;
        
        return hours * 60 + minutes;
      };
      
      // Establecer la hora de salida y llegada en el objeto de fecha
      const departureTime = parseTimeToMinutes(trip.departureTime);
      const arrivalTime = parseTimeToMinutes(trip.arrivalTime);
      
      // Crear fechas completas para salida y llegada
      const fullDepartureDate = new Date(departureDate);
      fullDepartureDate.setHours(Math.floor(departureTime / 60), departureTime % 60, 0, 0);
      
      const fullArrivalDate = new Date(departureDate);
      
      // Si la hora de llegada es menor que la de salida, asumimos que llega al día siguiente
      if (arrivalTime < departureTime) {
        fullArrivalDate.setDate(fullArrivalDate.getDate() + 1);
      }
      fullArrivalDate.setHours(Math.floor(arrivalTime / 60), arrivalTime % 60, 0, 0);
      
      // Determinar el estado del viaje
      if (now < fullDepartureDate) {
        return "aun_no_inicia";
      } else if (now >= fullDepartureDate && now < fullArrivalDate) {
        return "en_progreso";
      } else {
        return "finalizado";
      }
    };
    
    // Now filter by origin and destination if provided
    const tripsWithRouteInfo: TripWithRouteInfo[] = [];
    
    for (const trip of trips) {
      const route = routeMap.get(trip.routeId);
      if (!route) continue;
      
      // Calcular el estado actual del viaje
      const calculatedTripStatus = calculateTripStatus(trip);
      
      // Buscar información de la compañía si existe
      let companyData = { companyName: undefined, companyLogo: undefined };
      
      if (trip.companyId && companyMap.has(trip.companyId)) {
        companyData = companyMap.get(trip.companyId);
      }
      
      // Buscar vehículo asignado
      let assignedVehicle = undefined;
      if (trip.vehicleId && vehicleMap.has(trip.vehicleId)) {
        assignedVehicle = vehicleMap.get(trip.vehicleId);
        console.log(`Viaje ${trip.id}: Encontrado vehículo asignado ${assignedVehicle.brand} ${assignedVehicle.model} (${assignedVehicle.plates})`);
      }
      
      // Buscar conductor asignado
      let assignedDriver = undefined;
      if (trip.driverId && driverMap.has(trip.driverId)) {
        assignedDriver = driverMap.get(trip.driverId);
        console.log(`Viaje ${trip.id}: Encontrado conductor asignado ${assignedDriver.firstName} ${assignedDriver.lastName}`);
      }
      
      // For subtrips, check against segment origin and destination
      if (trip.isSubTrip && trip.segmentOrigin && trip.segmentDestination) {
        const originMatch = !params.origin || trip.segmentOrigin.toLowerCase().includes(params.origin.toLowerCase());
        const destMatch = !params.destination || trip.segmentDestination.toLowerCase().includes(params.destination.toLowerCase());
        
        if (originMatch && destMatch) {
          tripsWithRouteInfo.push({
            ...trip,
            route,
            tripStatus: calculatedTripStatus, // Estado calculado dinámicamente
            numStops: route.stops.length,
            companyName: companyData.companyName,
            companyLogo: companyData.companyLogo,
            assignedVehicle,
            assignedDriver
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
          tripStatus: calculatedTripStatus, // Estado calculado dinámicamente
          numStops: route.stops.length,
          companyName: companyData.companyName,
          companyLogo: companyData.companyLogo,
          assignedVehicle,
          assignedDriver
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
    
    // Determinar si estamos añadiendo o eliminando asientos
    const isAddingSeats = seatChange > 0;
    const isReducingSeats = seatChange < 0;
    const absoluteChange = Math.abs(seatChange);
    
    console.log(`[updateRelatedTripsAvailability] Actualizando viaje ${tripId} con cambio de ${seatChange} asientos (${isAddingSeats ? 'añadiendo' : 'reduciendo'})`);
    
    if (trip.isSubTrip && trip.parentTripId && trip.segmentOrigin && trip.segmentDestination) {
      // Este es un sub-viaje, actualizar el viaje principal
      const mainTrip = await this.getTrip(trip.parentTripId);
      if (!mainTrip) return;
      
      // Calcular nuevos asientos disponibles
      let newAvailableSeats;
      
      if (isAddingSeats) {
        // Al añadir asientos, no exceder la capacidad máxima
        newAvailableSeats = Math.min(mainTrip.availableSeats + absoluteChange, mainTrip.capacity);
      } else if (isReducingSeats) {
        // Al reducir asientos, no permitir negativos
        newAvailableSeats = Math.max(mainTrip.availableSeats - absoluteChange, 0);
      } else {
        // Si no hay cambio, mantener igual
        newAvailableSeats = mainTrip.availableSeats;
      }
      
      console.log(`[updateRelatedTripsAvailability] Actualizando viaje principal ${mainTrip.id}: asientos ${mainTrip.availableSeats} a ${newAvailableSeats} (capacidad máxima: ${mainTrip.capacity})`);
      
      // Actualizar el viaje principal
      await db
        .update(schema.trips)
        .set({ availableSeats: newAvailableSeats })
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
          // Calcular nuevos asientos disponibles para el sub-viaje
          let newSubAvailableSeats;
          
          if (isAddingSeats) {
            // Al añadir asientos, no exceder la capacidad máxima
            newSubAvailableSeats = Math.min(subTrip.availableSeats + absoluteChange, subTrip.capacity);
          } else if (isReducingSeats) {
            // Al reducir asientos, no permitir negativos
            newSubAvailableSeats = Math.max(subTrip.availableSeats - absoluteChange, 0);
          } else {
            // Si no hay cambio, mantener igual
            newSubAvailableSeats = subTrip.availableSeats;
          }
          
          console.log(`[updateRelatedTripsAvailability] Actualizando sub-viaje ${subTrip.id}: asientos ${subTrip.availableSeats} a ${newSubAvailableSeats} (capacidad máxima: ${subTrip.capacity})`);
          
          await db
            .update(schema.trips)
            .set({ availableSeats: newSubAvailableSeats })
            .where(eq(schema.trips.id, subTrip.id));
        }
      }
    } else {
      // Es un viaje principal, actualizar todos sus sub-viajes
      const subTrips = await db
        .select()
        .from(schema.trips)
        .where(eq(schema.trips.parentTripId, tripId));
        
      for (const subTrip of subTrips) {
        // Calcular nuevos asientos disponibles para el sub-viaje
        let newSubAvailableSeats;
        
        if (isAddingSeats) {
          // Al añadir asientos, no exceder la capacidad máxima
          newSubAvailableSeats = Math.min(subTrip.availableSeats + absoluteChange, subTrip.capacity);
        } else if (isReducingSeats) {
          // Al reducir asientos, no permitir negativos
          newSubAvailableSeats = Math.max(subTrip.availableSeats - absoluteChange, 0);
        } else {
          // Si no hay cambio, mantener igual
          newSubAvailableSeats = subTrip.availableSeats;
        }
        
        console.log(`[updateRelatedTripsAvailability] Actualizando sub-viaje ${subTrip.id} del viaje principal ${tripId}: asientos ${subTrip.availableSeats} a ${newSubAvailableSeats} (capacidad máxima: ${subTrip.capacity})`);
        
        await db
          .update(schema.trips)
          .set({ availableSeats: newSubAvailableSeats })
          .where(eq(schema.trips.id, subTrip.id));
      }
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
      
      // Obtener información del usuario que escaneó el ticket
      let checkedByUser: schema.User | undefined = undefined;
      if (reservation.checkedBy) {
        // Buscar el usuario por ID
        const [user] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, reservation.checkedBy));
        
        if (user) {
          checkedByUser = user;
          console.log(`[getReservations] Reserva ${reservation.id} escaneada por usuario ${user.firstName} ${user.lastName} (ID: ${user.id})`);
        }
      }
      
      // Obtener información del usuario que marcó como pagado el ticket
      let paidByUser: schema.User | undefined = undefined;
      if (reservation.paidBy) {
        // Buscar el usuario por ID
        const [user] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, reservation.paidBy));
        
        if (user) {
          paidByUser = user;
          console.log(`[getReservations] Reserva ${reservation.id} marcada como pagada por usuario ${user.firstName} ${user.lastName} (ID: ${user.id})`);
        }
      }
      
      // Agregar a los resultados
      reservationsWithDetails.push({
        ...reservation,
        trip,
        passengers,
        createdByUser, // Añadimos el usuario creador
        checkedByUser, // Añadimos el usuario que escaneó el ticket
        paidByUser     // Añadimos el usuario que marcó como pagado el ticket
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
    
    // Obtener información del usuario que escaneó el ticket
    let checkedByUser: schema.User | undefined = undefined;
    if (reservation.checkedBy) {
      // Buscar el usuario por ID
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, reservation.checkedBy));
      
      if (user) {
        checkedByUser = user;
        console.log(`[getReservationWithDetails] Reserva ${id} escaneada por usuario ${user.firstName} ${user.lastName} (ID: ${user.id})`);
      }
    }
    
    // Obtener información del usuario que marcó como pagado el ticket
    let paidByUser: schema.User | undefined = undefined;
    if (reservation.paidBy) {
      // Buscar el usuario por ID
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, reservation.paidBy));
      
      if (user) {
        paidByUser = user;
        console.log(`[getReservationWithDetails] Reserva ${id} marcada como pagada por usuario ${user.firstName} ${user.lastName} (ID: ${user.id})`);
      }
    }
    
    console.log(`[getReservationWithDetails] Acceso concedido a reserva ${id} con ${passengers.length} pasajeros`);
    
    return {
      ...reservation,
      trip,
      passengers,
      createdByUser, // Añadimos el usuario creador
      checkedByUser, // Añadimos el usuario que escaneó el ticket
      paidByUser     // Añadimos el usuario que marcó como pagado el ticket
    };
  }
  
  async createReservation(reservation: InsertReservation): Promise<Reservation> {
    // Preparamos los datos asegurándonos de que notes sea null si no está definido
    const reservationData = { ...reservation };
    
    if (reservationData.notes === undefined) {
      reservationData.notes = null;
    }
    
    // Crear la reservación en la base de datos
    const [newReservation] = await db.insert(schema.reservations).values(reservationData).returning();

    // Verificar si hay pasajeros asociados a esta reservación (ya sea del request original o nuevos)
    const passengersData = reservationData['passengersData'] as any[] || [];
    const passengerCount = passengersData.length;
    
    console.log(`[createReservation] Reservación ${newReservation.id} creada con ${passengerCount} pasajeros`);
    
    // Actualizar la disponibilidad de asientos en el viaje
    if (passengerCount > 0) {
      try {
        const trip = await this.getTrip(reservation.tripId);
        if (trip) {
          console.log(`[createReservation] Viaje ${trip.id}: asientos disponibles antes = ${trip.availableSeats}`);
          
          // No permitir asientos negativos
          const newAvailableSeats = Math.max(0, trip.availableSeats - passengerCount);
          
          // Actualizar los asientos disponibles
          await db
            .update(schema.trips)
            .set({ availableSeats: newAvailableSeats })
            .where(eq(schema.trips.id, trip.id));
          
          console.log(`[createReservation] Viaje ${trip.id}: asientos disponibles actualizados a ${newAvailableSeats}`);
          
          // Actualizar viajes relacionados si existen
          await this.updateRelatedTripsAvailability(trip.id, -passengerCount);
        } else {
          console.error(`[createReservation] No se encontró el viaje ${reservation.tripId} para actualizar asientos`);
        }
      } catch (error) {
        console.error(`[createReservation] Error al actualizar asientos disponibles:`, error);
        // No fallamos aquí para no interrumpir la creación de la reservación
      }
    }
    
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
  
  async checkTicket(id: number, userId: number): Promise<Reservation | undefined> {
    try {
      // Primero obtenemos la reservación para ver si ya ha sido escaneada
      const reservation = await this.getReservation(id);
      
      if (!reservation) {
        throw new Error("Reservación no encontrada");
      }
      
      // Si es la primera vez que se escanea, actualizamos los campos correspondientes
      if (!reservation.checkedBy) {
        console.log(`[checkTicket] Primera vez que se escanea el ticket #${id} por el usuario ${userId}`);
        
        const [updatedReservation] = await db
          .update(schema.reservations)
          .set({
            checkedBy: userId,
            checkedAt: new Date(),
            checkCount: 1
          })
          .where(eq(schema.reservations.id, id))
          .returning();
          
        return updatedReservation;
      } else {
        // Si ya ha sido escaneado, solo incrementamos el contador
        console.log(`[checkTicket] Ticket #${id} ya fue escaneado por el usuario ${reservation.checkedBy}. Incrementando contador.`);
        
        const [updatedReservation] = await db
          .update(schema.reservations)
          .set({
            checkCount: (reservation.checkCount || 0) + 1
          })
          .where(eq(schema.reservations.id, id))
          .returning();
          
        return updatedReservation;
      }
    } catch (error) {
      console.error("[checkTicket] Error al registrar escaneo de ticket:", error);
      throw error;
    }
  }

  async markAsPaid(id: number, userId: number): Promise<Reservation | undefined> {
    try {
      // Primero obtenemos la reservación
      const reservation = await this.getReservation(id);
      
      if (!reservation) {
        throw new Error("Reservación no encontrada");
      }
      
      console.log(`[markAsPaid] Marcando ticket #${id} como pagado por el usuario ${userId}`);
      
      // Actualizar el estado de pago y guardar el usuario que marca como pagado
      const now = new Date();
      const [updatedReservation] = await db
        .update(schema.reservations)
        .set({
          paidBy: userId,
          paymentStatus: 'PAID', // Establecer estado a PAGADO
          updatedAt: now
        })
        .where(eq(schema.reservations.id, id))
        .returning();
        
      return updatedReservation;
    } catch (error) {
      console.error("[markAsPaid] Error al marcar ticket como pagado:", error);
      throw error;
    }
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

  // User methods
  async getUsers(): Promise<schema.User[]> {
    console.log("[getUsers] Obteniendo todos los usuarios");
    return await db.select().from(schema.users);
  }
  
  async getUsersByCompany(companyId: string): Promise<schema.User[]> {
    console.log(`[getUsersByCompany] Obteniendo usuarios para compañía: ${companyId}`);
    
    if (!companyId) {
      console.warn(`[getUsersByCompany] Se llamó con companyId vacío o nulo: "${companyId}"`);
      return [];
    }
    
    try {
      // Filtrar por companyId o si el campo company es igual al companyId (compatibilidad con datos antiguos)
      const users = await db.select()
        .from(schema.users)
        .where(
          or(
            eq(schema.users.companyId, companyId),
            eq(schema.users.company, companyId)
          )
        );
      
      console.log(`[getUsersByCompany] Encontrados ${users.length} usuarios para compañía ${companyId}`);
      console.log(`[getUsersByCompany] IDs de usuarios encontrados: ${users.map(u => u.id).join(', ')}`);
      
      return users;
    } catch (error) {
      console.error(`[getUsersByCompany] Error al obtener usuarios para compañía ${companyId}:`, error);
      return [];
    }
  }
  
  async getUsersByCompanyAndRole(companyId: string, role: string): Promise<schema.User[]> {
    console.log(`[getUsersByCompanyAndRole] Buscando usuarios de compañía ${companyId} con rol ${role}`);
    
    if (!companyId || !role) {
      console.warn(`[getUsersByCompanyAndRole] Compañía o rol inválidos: companyId=${companyId}, role=${role}`);
      return [];
    }
    
    try {
      let normalizedRole = role.toLowerCase();
      
      // Primero recuperamos todos los usuarios de la compañía
      const companyUsers = await db.select()
        .from(schema.users)
        .where(
          or(
            eq(schema.users.companyId, companyId),
            eq(schema.users.company, companyId)
          )
        );
      
      console.log(`[getUsersByCompanyAndRole] Encontrados ${companyUsers.length} usuarios para compañía ${companyId}, filtrando por rol ${role}`);
      
      // Luego filtramos localmente por el rol
      let filteredUsers;
      
      // Caso especial para conductores (varias variantes posibles)
      if (normalizedRole === 'chofer') {
        filteredUsers = companyUsers.filter(user => {
          const userRole = (user.role || '').toLowerCase();
          return userRole === 'chofer' || userRole === 'driver' || userRole === 'chófer';
        });
      } else {
        // Para otros roles, simplemente comparamos el lowercase
        filteredUsers = companyUsers.filter(user => 
          (user.role || '').toLowerCase() === normalizedRole
        );
      }
      
      console.log(`[getUsersByCompanyAndRole] Filtrados ${filteredUsers.length} usuarios con rol ${role} para compañía ${companyId}`);
      
      return filteredUsers;
    } catch (error) {
      console.error(`[getUsersByCompanyAndRole] Error al filtrar usuarios por rol ${role} y compañía ${companyId}:`, error);
      return [];
    }
  }

  async getUserById(id: number): Promise<schema.User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async updateUser(id: number, userData: { 
    email?: string; 
    password?: string; 
    commissionPercentage?: number; 
  }): Promise<schema.User | undefined> {
    // Si se proporciona una contraseña, hacemos hash
    const updateData: any = { ...userData };
    
    if (userData.password) {
      const bcrypt = require('bcryptjs');
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(userData.password, salt);
    }
    
    // Asegurarnos de actualizar la fecha
    updateData.updatedAt = new Date();
    
    try {
      const [updatedUser] = await db
        .update(schema.users)
        .set(updateData)
        .where(eq(schema.users.id, id))
        .returning();
      
      console.log(`[updateUser] Usuario con ID ${id} actualizado correctamente`);
      return updatedUser;
    } catch (error) {
      console.error(`[updateUser] Error al actualizar usuario con ID ${id}:`, error);
      return undefined;
    }
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      // Verificar si el usuario tiene reservaciones asociadas
      const reservations = await db
        .select({ id: schema.reservations.id })
        .from(schema.reservations)
        .where(eq(schema.reservations.createdBy, id));
      
      if (reservations.length > 0) {
        console.log(`[deleteUser] No se puede eliminar usuario con ID ${id} porque tiene ${reservations.length} reservaciones asociadas`);
        return false;
      }
      
      // Verificar si ha invitado a otros usuarios
      const invitedUsers = await db
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.invitedById, id));
      
      if (invitedUsers.length > 0) {
        console.log(`[deleteUser] No se puede eliminar usuario con ID ${id} porque tiene ${invitedUsers.length} usuarios invitados`);
        return false;
      }
      
      // Eliminar invitaciones creadas por el usuario
      await db
        .delete(schema.invitations)
        .where(eq(schema.invitations.createdById, id));
      
      // Eliminar el usuario
      const result = await db
        .delete(schema.users)
        .where(eq(schema.users.id, id))
        .returning({ id: schema.users.id });
      
      console.log(`[deleteUser] Usuario con ID ${id} eliminado correctamente`);
      return result.length > 0;
    } catch (error) {
      console.error(`[deleteUser] Error al eliminar usuario con ID ${id}:`, error);
      return false;
    }
  }
  
  // =================== MÉTODOS PARA PAGOS DE COMISIONES ===================
  
  async markCommissionsAsPaid(reservationIds: number[]): Promise<{
    success: boolean;
    message: string;
    affectedCount: number;
  }> {
    try {
      // Actualizar todas las reservaciones en la lista para marcarlas como pagadas
      const results = await db
        .update(schema.reservations)
        .set({ 
          commissionPaid: true,
          updatedAt: new Date()
        })
        .where(
          and(
            sql`id = ANY(${reservationIds})`,  // Más eficiente para listas de IDs
            eq(schema.reservations.commissionPaid, false) // Asegurarse de que no estén pagadas ya
          )
        )
        .returning({ id: schema.reservations.id });
      
      // Número de reservaciones actualizadas
      const affectedCount = results.length;
      
      if (affectedCount > 0) {
        return {
          success: true, 
          message: `Se marcaron ${affectedCount} comisiones como pagadas.`,
          affectedCount
        };
      } else {
        return {
          success: false,
          message: "No se encontraron comisiones pendientes para los IDs proporcionados.",
          affectedCount: 0
        };
      }
    } catch (error) {
      console.error("Error al marcar comisiones como pagadas:", error);
      return {
        success: false,
        message: `Error al marcar comisiones como pagadas: ${error.message}`,
        affectedCount: 0
      };
    }
  }
  
  // =================== MÉTODOS PARA SOLICITUDES DE RESERVACIÓN ===================
  
  async createReservationRequest(requestData: any): Promise<ReservationRequest> {
    try {
      console.log("[createReservationRequest] Creando solicitud de reservación:", requestData);
      
      // Insertar la solicitud en la base de datos
      const [newRequest] = await db
        .insert(schema.reservationRequests)
        .values({
          ...requestData,
          status: "pendiente",
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      console.log("[createReservationRequest] Solicitud creada con ID:", newRequest.id);
      
      // Buscar usuarios que puedan aprobar la solicitud (Dueño, Administrador, Call Center)
      // de la misma empresa que el comisionista
      const approvers = await db
        .select()
        .from(schema.users)
        .where(
          and(
            eq(schema.users.companyId, requestData.companyId),
            or(
              eq(schema.users.role, UserRole.OWNER),
              eq(schema.users.role, UserRole.ADMIN),
              eq(schema.users.role, UserRole.CALL_CENTER)
            )
          )
        );
      
      console.log(`[createReservationRequest] Encontrados ${approvers.length} usuarios aprobadores para la empresa ${requestData.companyId}`);
      
      // Obtener datos del comisionista para incluir en la notificación
      const [requester] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, requestData.requesterId));
      
      if (!requester) {
        console.error(`No se encontró al comisionista con ID ${requestData.requesterId}`);
        return newRequest;
      }
      
      // Obtener información del viaje para la notificación
      const [trip] = await db
        .select()
        .from(schema.trips)
        .where(eq(schema.trips.id, requestData.tripId));
      
      if (!trip) {
        console.error(`No se encontró el viaje con ID ${requestData.tripId}`);
        return newRequest;
      }
      
      // Crear una notificación para cada usuario que puede aprobar
      for (const approver of approvers) {
        const notification: InsertNotification = {
          userId: approver.id,
          type: "reservation_request",
          title: "Nueva solicitud de reservación",
          message: `${requester.firstName} ${requester.lastName} ha solicitado una reservación para ${trip.departureDate.toLocaleDateString()} con ${requestData.passengersData.length} pasajeros. Monto total: $${requestData.totalAmount}.`,
          relatedId: newRequest.id,
          read: false,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await this.createNotification(notification);
      }
      
      return newRequest;
    } catch (error) {
      console.error("Error al crear solicitud de reservación:", error);
      throw error;
    }
  }
  
  async getReservationRequests(filters?: { 
    companyId?: string, 
    status?: string,
    requesterId?: number 
  }): Promise<any[]> {
    try {
      console.log("[getReservationRequests] Iniciando consulta con filtros:", filters);
      
      // Construir condiciones para la consulta
      const conditions = [];
      
      if (filters?.companyId) {
        console.log(`[getReservationRequests] Filtrando por compañía: ${filters.companyId}`);
        conditions.push(eq(schema.reservationRequests.companyId, filters.companyId));
      }
      
      if (filters?.status) {
        console.log(`[getReservationRequests] Filtrando por estado: ${filters.status}`);
        conditions.push(eq(schema.reservationRequests.status, filters.status));
      }
      
      if (filters?.requesterId) {
        console.log(`[getReservationRequests] Filtrando por solicitante: ${filters.requesterId}`);
        conditions.push(eq(schema.reservationRequests.requesterId, filters.requesterId));
      }
      
      // Ejecutar la consulta con los filtros
      let query = db.select().from(schema.reservationRequests);
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      // Ordenar por fecha de creación (más recientes primero)
      query = query.orderBy(desc(schema.reservationRequests.createdAt));
      
      const requests = await query;
      console.log(`[getReservationRequests] Encontradas ${requests.length} solicitudes`);
      
      // Enriquecer los datos de las solicitudes con información adicional
      const enrichedRequests = await Promise.all(
        requests.map(async (request) => {
          // Obtener información del viaje y ruta
          const [tripResult] = await db
            .select({
              trip: schema.trips,
              route: schema.routes
            })
            .from(schema.trips)
            .leftJoin(schema.routes, eq(schema.trips.routeId, schema.routes.id))
            .where(eq(schema.trips.id, request.tripId));
          
          let tripOrigin = "";
          let tripDestination = "";
          let tripDate = "";
          let tripDepartureTime = "";
          
          if (tripResult) {
            const { trip, route } = tripResult;
            tripOrigin = route?.origin || "";
            tripDestination = route?.destination || "";
            tripDate = trip.departureDate ? trip.departureDate.toISOString().split('T')[0] : "";
            tripDepartureTime = trip.departureTime || "";
            
            console.log(`[getReservationRequests] Información de viaje para solicitud ${request.id}: 
              Origen: ${tripOrigin}
              Destino: ${tripDestination}
              Fecha: ${tripDate}
              Hora: ${tripDepartureTime}`
            );
          }
          
          // Obtener información del comisionista
          const [requester] = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.id, request.requesterId));
          
          // Obtener información del revisor (si existe)
          let reviewer = null;
          if (request.reviewedBy) {
            [reviewer] = await db
              .select()
              .from(schema.users)
              .where(eq(schema.users.id, request.reviewedBy));
          }
          
          // Información de pago formateada para mostrar
          let advancePaymentInfo = "";
          if (request.advanceAmount > 0) {
            const method = request.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia';
            advancePaymentInfo = `${request.advanceAmount} (${method})`;
            console.log(`[getReservationRequests] Anticipo para solicitud ${request.id}: ${advancePaymentInfo}`);
          }
          
          const requesterName = requester ? `${requester.firstName} ${requester.lastName}` : `Agente #${request.requesterId}`;
          
          // Extraer nombres de pasajeros para mostrar
          const passengersData = request.passengersData as any[] || [];
          const passengerNames = passengersData.map(passenger => 
            `${passenger.firstName || ''} ${passenger.lastName || ''}`
          ).filter(name => name.trim() !== '');
          
          return {
            ...request,
            trip: tripResult?.trip,
            route: tripResult?.route,
            tripOrigin,
            tripDestination,
            tripDate,
            tripDepartureTime,
            requester,
            requesterName,
            reviewer,
            advancePaymentInfo,
            passengerNames
          };
        })
      );
      
      return enrichedRequests;
    } catch (error) {
      console.error("Error al obtener solicitudes de reservación:", error);
      return [];
    }
  }
  
  async getReservationRequest(id: number): Promise<any> {
    try {
      console.log(`[getReservationRequest] Obteniendo solicitud con ID: ${id}`);
      const [request] = await db
        .select()
        .from(schema.reservationRequests)
        .where(eq(schema.reservationRequests.id, id));
      
      if (!request) {
        console.log(`[getReservationRequest] No se encontró solicitud con ID: ${id}`);
        return null;
      }
      
      // Obtener información del viaje y ruta
      const [tripResult] = await db
        .select({
          trip: schema.trips,
          route: schema.routes
        })
        .from(schema.trips)
        .leftJoin(schema.routes, eq(schema.trips.routeId, schema.routes.id))
        .where(eq(schema.trips.id, request.tripId));
      
      let tripOrigin = "";
      let tripDestination = "";
      let tripDate = "";
      let tripDepartureTime = "";
      
      if (tripResult) {
        const { trip, route } = tripResult;
        tripOrigin = route?.origin || "";
        tripDestination = route?.destination || "";
        tripDate = trip.departureDate ? trip.departureDate.toISOString().split('T')[0] : "";
        tripDepartureTime = trip.departureTime || "";
        
        console.log(`[getReservationRequest] Información de viaje para solicitud ${request.id}: 
          Origen: ${tripOrigin}
          Destino: ${tripDestination}
          Fecha: ${tripDate}
          Hora: ${tripDepartureTime}`
        );
      }
      
      // Obtener información del comisionista
      const [requester] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, request.requesterId));
      
      // Obtener información del revisor (si existe)
      let reviewer = null;
      if (request.reviewedBy) {
        [reviewer] = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.id, request.reviewedBy));
      }
      
      // Información de pago formateada para mostrar
      let advancePaymentInfo = "";
      if (request.advanceAmount > 0) {
        const method = request.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia';
        advancePaymentInfo = `${request.advanceAmount} (${method})`;
        console.log(`[getReservationRequest] Anticipo para solicitud ${request.id}: ${advancePaymentInfo}`);
      }
      
      const requesterName = requester ? `${requester.firstName} ${requester.lastName}` : `Agente #${request.requesterId}`;
      
      // Extraer nombres de pasajeros para mostrar
      const passengersData = request.passengersData as any[] || [];
      const passengerNames = passengersData.map(passenger => 
        `${passenger.firstName || ''} ${passenger.lastName || ''}`
      ).filter(name => name.trim() !== '');
      
      return {
        ...request,
        trip: tripResult?.trip,
        route: tripResult?.route,
        tripOrigin,
        tripDestination,
        tripDate,
        tripDepartureTime,
        requester,
        requesterName,
        reviewer,
        advancePaymentInfo,
        passengerNames
      };
    } catch (error) {
      console.error(`Error al obtener solicitud de reservación ${id}:`, error);
      return null;
    }
  }
  
  async updateReservationRequestStatus(
    id: number, 
    status: string, 
    reviewedBy: number, 
    reviewNotes?: string
  ): Promise<ReservationRequest> {
    try {
      // Obtener la solicitud actual antes de actualizarla
      const [currentRequest] = await db
        .select()
        .from(schema.reservationRequests)
        .where(eq(schema.reservationRequests.id, id));
      
      if (!currentRequest) {
        throw new Error(`No se encontró la solicitud con ID ${id}`);
      }
      
      // Actualizar el estado de la solicitud
      const [updatedRequest] = await db
        .update(schema.reservationRequests)
        .set({
          status,
          reviewedBy,
          reviewNotes,
          updatedAt: new Date()
        })
        .where(eq(schema.reservationRequests.id, id))
        .returning();
      
      // Si fue aprobada, crear una reservación real
      if (status === "aprobada") {
        const newReservation: InsertReservation = {
          tripId: currentRequest.tripId,
          totalAmount: currentRequest.totalAmount,
          email: currentRequest.email,
          phone: currentRequest.phone,
          notes: currentRequest.notes || null,
          paymentMethod: currentRequest.paymentMethod,
          paymentStatus: currentRequest.paymentStatus,
          advanceAmount: currentRequest.advanceAmount || 0,
          advancePaymentMethod: currentRequest.advancePaymentMethod || "efectivo",
          createdBy: currentRequest.requesterId, // El creador es el comisionista
          companyId: currentRequest.companyId,
          status: "confirmada", // La reservación se crea ya confirmada
          commissionPaid: false, // Por defecto, la comisión no está pagada
          // Inicializar los campos de escaneo de tickets
          checkedBy: null,
          checkedAt: null,
          checkCount: 0
        };
        
        // Crear la reservación
        const reservation = await this.createReservation(newReservation);
        
        // Crear los pasajeros
        const passengersData = currentRequest.passengersData as any[];
        const passengerCount = passengersData.length;
        
        // Crear cada pasajero en la base de datos
        for (const passengerData of passengersData) {
          await this.createPassenger({
            ...passengerData,
            reservationId: reservation.id
          });
        }
        
        // Actualizar la cantidad de asientos disponibles en el viaje
        try {
          const trip = await this.getTrip(currentRequest.tripId);
          if (trip && passengerCount > 0) {
            console.log(`[updateReservationRequestStatus] Viaje ${trip.id}: asientos disponibles antes = ${trip.availableSeats}, pasajeros = ${passengerCount}`);
            
            // Calcular nuevos asientos disponibles, no permitir que sean negativos
            const newAvailableSeats = Math.max(0, trip.availableSeats - passengerCount);
            
            // Actualizar asientos disponibles
            await db
              .update(schema.trips)
              .set({ availableSeats: newAvailableSeats })
              .where(eq(schema.trips.id, trip.id));
            
            console.log(`[updateReservationRequestStatus] Viaje ${trip.id}: asientos disponibles actualizados a ${newAvailableSeats}`);
            
            // Actualizar viajes relacionados
            await this.updateRelatedTripsAvailability(trip.id, -passengerCount);
          }
        } catch (error) {
          console.error(`[updateReservationRequestStatus] Error al actualizar asientos disponibles:`, error);
          // No fallamos aquí para no interrumpir el proceso principal
        }
        
        // Crear notificación para el comisionista
        const notification: InsertNotification = {
          userId: currentRequest.requesterId,
          type: "reservation_approved",
          title: "Solicitud de reservación aprobada",
          message: `Tu solicitud de reservación ha sido aprobada. Se ha creado la reservación #${reservation.id}.`,
          relatedId: reservation.id,
          read: false,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await this.createNotification(notification);
      } else if (status === "rechazada") {
        // Si fue rechazada, notificar al comisionista
        const notification: InsertNotification = {
          userId: currentRequest.requesterId,
          type: "reservation_rejected",
          title: "Solicitud de reservación rechazada",
          message: `Tu solicitud de reservación ha sido rechazada.${reviewNotes ? ` Motivo: ${reviewNotes}` : ""}`,
          relatedId: id,
          read: false,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await this.createNotification(notification);
      }
      
      return updatedRequest;
    } catch (error) {
      console.error(`Error al actualizar estado de solicitud ${id}:`, error);
      throw error;
    }
  }
  
  // =================== MÉTODOS PARA NOTIFICACIONES ===================
  
  async createNotification(notificationData: InsertNotification): Promise<Notification> {
    try {
      const [newNotification] = await db
        .insert(schema.notifications)
        .values(notificationData)
        .returning();
      
      return newNotification;
    } catch (error) {
      console.error("Error al crear notificación:", error);
      throw error;
    }
  }
  
  async getNotifications(userId: number): Promise<Notification[]> {
    try {
      // Obtener notificaciones ordenadas por fecha (más recientes primero)
      const notifications = await db
        .select()
        .from(schema.notifications)
        .where(eq(schema.notifications.userId, userId))
        .orderBy(desc(schema.notifications.createdAt));
      
      return notifications;
    } catch (error) {
      console.error(`Error al obtener notificaciones para usuario ${userId}:`, error);
      return [];
    }
  }
  
  async markNotificationAsRead(id: number): Promise<Notification> {
    try {
      const [updatedNotification] = await db
        .update(schema.notifications)
        .set({
          read: true,
          updatedAt: new Date()
        })
        .where(eq(schema.notifications.id, id))
        .returning();
      
      return updatedNotification;
    } catch (error) {
      console.error(`Error al marcar notificación ${id} como leída:`, error);
      throw error;
    }
  }
  
  async getUnreadNotificationsCount(userId: number): Promise<number> {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.userId, userId),
            eq(schema.notifications.read, false)
          )
        );
      
      return Number(result[0]?.count || 0);
    } catch (error) {
      console.error(`Error al contar notificaciones no leídas para usuario ${userId}:`, error);
      return 0;
    }
  }
  
  // ======= Coupon Methods =======
  
  async getCoupons(companyId?: string): Promise<Coupon[]> {
    try {
      if (companyId) {
        console.log(`DB Storage: Consultando cupones para la compañía: ${companyId}`);
        return await db
          .select()
          .from(schema.coupons)
          .where(eq(schema.coupons.companyId, companyId));
      } else {
        console.log("DB Storage: Consultando todos los cupones");
        return await db.select().from(schema.coupons);
      }
    } catch (error) {
      console.error("DB Storage: Error al consultar cupones:", error);
      return [];
    }
  }
  
  async getCoupon(id: number): Promise<Coupon | undefined> {
    try {
      const [coupon] = await db
        .select()
        .from(schema.coupons)
        .where(eq(schema.coupons.id, id));
      return coupon;
    } catch (error) {
      console.error(`DB Storage: Error al obtener cupón ${id}:`, error);
      return undefined;
    }
  }
  
  async getCouponByCode(code: string): Promise<Coupon | undefined> {
    try {
      const [coupon] = await db
        .select()
        .from(schema.coupons)
        .where(eq(schema.coupons.code, code));
      return coupon;
    } catch (error) {
      console.error(`DB Storage: Error al obtener cupón con código ${code}:`, error);
      return undefined;
    }
  }
  
  async createCoupon(coupon: InsertCoupon): Promise<Coupon> {
    try {
      // Calcular la fecha de expiración basada en las horas de expiración
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + coupon.expirationHours);
      
      const couponData = {
        ...coupon,
        expiresAt,
        usageCount: 0, // Asegurarse de que inicie en 0
      };
      
      console.log(`Creando cupón con datos:`, couponData);
      const [newCoupon] = await db.insert(schema.coupons).values(couponData).returning();
      console.log(`Cupón creado:`, newCoupon);
      return newCoupon;
    } catch (error) {
      console.error("DB Storage: Error al crear cupón:", error);
      throw error;
    }
  }
  
  async updateCoupon(id: number, couponUpdate: Partial<Coupon>): Promise<Coupon | undefined> {
    try {
      // Si se actualiza expirationHours, recalcular la fecha de expiración
      if (couponUpdate.expirationHours !== undefined) {
        const currentCoupon = await this.getCoupon(id);
        if (currentCoupon) {
          // Usar la fecha de creación original y sumar las nuevas horas
          const expiresAt = new Date(currentCoupon.createdAt);
          expiresAt.setHours(expiresAt.getHours() + couponUpdate.expirationHours);
          couponUpdate.expiresAt = expiresAt;
        }
      }
      
      const [updatedCoupon] = await db
        .update(schema.coupons)
        .set(couponUpdate)
        .where(eq(schema.coupons.id, id))
        .returning();
      
      return updatedCoupon;
    } catch (error) {
      console.error(`DB Storage: Error al actualizar cupón ${id}:`, error);
      return undefined;
    }
  }
  
  async deleteCoupon(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(schema.coupons)
        .where(eq(schema.coupons.id, id))
        .returning({ id: schema.coupons.id });
      
      return result.length > 0;
    } catch (error) {
      console.error(`DB Storage: Error al eliminar cupón ${id}:`, error);
      return false;
    }
  }
  
  async incrementCouponUsage(id: number): Promise<Coupon | undefined> {
    try {
      // Obtener el cupón actual para verificar el límite de uso
      const currentCoupon = await this.getCoupon(id);
      if (!currentCoupon) {
        console.error(`DB Storage: Cupón ${id} no encontrado para incrementar uso`);
        return undefined;
      }
      
      // Incrementar el contador de uso
      const newUsageCount = (currentCoupon.usageCount || 0) + 1;
      
      // Actualizar el contador
      const [updatedCoupon] = await db
        .update(schema.coupons)
        .set({ usageCount: newUsageCount })
        .where(eq(schema.coupons.id, id))
        .returning();
      
      return updatedCoupon;
    } catch (error) {
      console.error(`DB Storage: Error al incrementar uso del cupón ${id}:`, error);
      return undefined;
    }
  }
  
  async verifyCouponValidity(code: string): Promise<{
    valid: boolean;
    coupon?: Coupon;
    message?: string;
  }> {
    try {
      const coupon = await this.getCouponByCode(code);
      
      // Verificar si el cupón existe
      if (!coupon) {
        return {
          valid: false,
          message: 'El cupón no existe'
        };
      }
      
      // Verificar si el cupón está activo
      if (!coupon.isActive) {
        return {
          valid: false,
          coupon,
          message: 'El cupón no está activo'
        };
      }
      
      // Verificar si el cupón ha alcanzado su límite de uso
      if (coupon.usageCount >= coupon.usageLimit) {
        return {
          valid: false,
          coupon,
          message: 'El cupón ha alcanzado su límite de uso'
        };
      }
      
      // Verificar si el cupón ha expirado
      const now = new Date();
      const expiresAt = new Date(coupon.expiresAt);
      
      if (expiresAt < now) {
        return {
          valid: false,
          coupon,
          message: 'El cupón ha expirado'
        };
      }
      
      // Si pasa todas las verificaciones, el cupón es válido
      return {
        valid: true,
        coupon
      };
    } catch (error) {
      console.error(`DB Storage: Error al verificar validez del cupón ${code}:`, error);
      return {
        valid: false,
        message: 'Error al verificar el cupón'
      };
    }
  }
  
  // Método para pagar comisiones
  async markCommissionsAsPaid(reservationIds: number[]): Promise<{
    success: boolean;
    message: string;
    affectedCount: number;
  }> {
    try {
      if (reservationIds.length === 0) {
        return { 
          success: false, 
          message: 'No se proporcionaron IDs de reservaciones', 
          affectedCount: 0 
        };
      }
      
      // Actualizar todas las reservaciones seleccionadas
      const result = await db
        .update(schema.reservations)
        .set({ commissionPaid: true })
        .where(
          and(
            // Asegurarse de que la reservación exista
            inArray(schema.reservations.id, reservationIds),
            // Asegurarse de que la comisión no esté ya pagada
            eq(schema.reservations.commissionPaid, false)
          )
        )
        .returning({ id: schema.reservations.id });
      
      return {
        success: true,
        message: `Se marcaron ${result.length} comisiones como pagadas`,
        affectedCount: result.length
      };
    } catch (error) {
      console.error('DB Storage: Error al marcar comisiones como pagadas:', error);
      return {
        success: false,
        message: 'Error al procesar el pago de comisiones',
        affectedCount: 0
      };
    }
  }
}