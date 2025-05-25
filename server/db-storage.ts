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
  InsertCoupon,
  TripBudget,
  InsertTripBudget,
  TripExpense,
  InsertTripExpense
} from "@shared/schema";
import { IStorage } from "./storage";
import { db } from "./db";
import { eq, and, gte, lt, like, or, sql, desc, isNull, not, inArray } from "drizzle-orm";

export class DatabaseStorage implements IStorage {
  // Implementación de métodos para presupuestos de viajes (operadores)
  async getTripBudget(tripId: number): Promise<TripBudget | undefined> {
    try {
      console.log(`DB Storage: Consultando presupuesto para viaje ID: ${tripId}`);
      const [budget] = await db
        .select()
        .from(schema.tripBudgets)
        .where(eq(schema.tripBudgets.tripId, tripId));
      return budget;
    } catch (error) {
      console.error(`DB Storage ERROR - getTripBudget: ${error}`);
      return undefined;
    }
  }

  async createTripBudget(budget: InsertTripBudget): Promise<TripBudget> {
    try {
      console.log(`DB Storage: Creando presupuesto para viaje ID: ${budget.tripId} con monto: ${budget.amount}`);
      const [newBudget] = await db
        .insert(schema.tripBudgets)
        .values(budget)
        .returning();
      return newBudget;
    } catch (error) {
      console.error(`DB Storage ERROR - createTripBudget: ${error}`);
      throw error;
    }
  }

  async updateTripBudget(tripId: number, amount: number): Promise<TripBudget | undefined> {
    try {
      console.log(`DB Storage: Actualizando presupuesto para viaje ID: ${tripId} con nuevo monto: ${amount}`);
      const [updatedBudget] = await db
        .update(schema.tripBudgets)
        .set({ amount, updatedAt: new Date() })
        .where(eq(schema.tripBudgets.tripId, tripId))
        .returning();
      return updatedBudget;
    } catch (error) {
      console.error(`DB Storage ERROR - updateTripBudget: ${error}`);
      return undefined;
    }
  }

  // Implementación de métodos para gastos de viajes
  async getTripExpenses(tripId: number): Promise<TripExpense[]> {
    try {
      console.log(`DB Storage: Consultando gastos para viaje ID: ${tripId}`);
      const expenses = await db
        .select()
        .from(schema.tripExpenses)
        .where(eq(schema.tripExpenses.tripId, tripId));
      return expenses;
    } catch (error) {
      console.error(`DB Storage ERROR - getTripExpenses: ${error}`);
      return [];
    }
  }

  async createTripExpense(expense: InsertTripExpense): Promise<TripExpense> {
    try {
      console.log(`DB Storage: Creando gasto para viaje ID: ${expense.tripId} con descripción: ${expense.description} y monto: ${expense.amount}`);
      console.log(`DB Storage: Datos de usuario para el gasto - userID: ${expense.userId}, createdBy: ${expense.createdBy}`);
      
      // Asegurarse de que todos los campos estén presentes y formateados correctamente
      const expenseToSave = {
        ...expense,
        // Asegurarnos de que userId sea un número o null (no undefined)
        userId: expense.userId !== undefined ? Number(expense.userId) : null,
        // Asegurar que createdBy sea un string
        createdBy: expense.createdBy || "Usuario del sistema"
      };
      
      console.log("Datos finales de gasto a insertar:", JSON.stringify(expenseToSave, null, 2));
      
      const [newExpense] = await db
        .insert(schema.tripExpenses)
        .values(expenseToSave)
        .returning();
        
      console.log("Gasto creado con éxito:", JSON.stringify(newExpense, null, 2));
      return newExpense;
    } catch (error) {
      console.error(`DB Storage ERROR - createTripExpense: ${error}`);
      throw error;
    }
  }

  async updateTripExpense(id: number, expense: Partial<TripExpense>): Promise<TripExpense | undefined> {
    try {
      console.log(`DB Storage: Actualizando gasto ID: ${id}`);
      const [updatedExpense] = await db
        .update(schema.tripExpenses)
        .set({ ...expense, updatedAt: new Date() })
        .where(eq(schema.tripExpenses.id, id))
        .returning();
      return updatedExpense;
    } catch (error) {
      console.error(`DB Storage ERROR - updateTripExpense: ${error}`);
      return undefined;
    }
  }
  
  async deleteTripExpense(id: number): Promise<boolean> {
    try {
      console.log(`DB Storage: Eliminando gasto ID: ${id}`);
      const result = await db
        .delete(schema.tripExpenses)
        .where(eq(schema.tripExpenses.id, id))
        .returning({ id: schema.tripExpenses.id });
      return result.length > 0;
    } catch (error) {
      console.error(`DB Storage ERROR - deleteTripExpense: ${error}`);
      return false;
    }
  }
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
    
    // Ya no se calcula el estado del viaje (tripStatus), esta funcionalidad ha sido eliminada
    
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
      // El estado del viaje ya no se utiliza
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
    companyIds?: string[]; // Añadido para filtrar por múltiples compañías (taquilleros)
    driverId?: number;   // Añadido para filtrar viajes de un conductor específico
    visibility?: string; // Añadido para filtrar por visibilidad (publicado/oculto/cancelado)
    includeAllVisibilities?: boolean; // Nuevo parámetro para incluir todos los estados de visibilidad
  }): Promise<TripWithRouteInfo[]> {
    console.time('searchTrips-optimized');
    
    // SOLUCIÓN ACTUALIZADA PARA EL FILTRADO DE COMPAÑÍA QUE RESPETA PRIVILEGIOS DE superAdmin
    console.log(`[searchTrips-v2] Iniciando búsqueda con parámetros:`, params);
    
    // Construir los filtros como un array de condiciones 
    const condiciones = [];
    
    // Aplicar filtro de visibilidad
    if (params.includeAllVisibilities) {
      // Si se solicita incluir todos los estados de visibilidad, no aplicamos filtro
      console.log(`[searchTrips-v2] Incluyendo TODOS los estados de visibilidad (publicado/oculto/cancelado)`);
    } else if (params.visibility) {
      // Si se especifica un valor de visibilidad concreto, lo usamos
      console.log(`[searchTrips-v2] Filtro por visibilidad: ${params.visibility}`);
      condiciones.push(sql`visibility = ${params.visibility}`);
    } else {
      // Por defecto, solo mostrar viajes publicados
      condiciones.push(sql`visibility = 'publicado'`);
      console.log(`[searchTrips-v2] Aplicando filtro predeterminado: solo viajes publicados`);
    }
    
    // 1. FILTRADO POR COMPAÑÍA (PRIORIDAD MÁXIMA)
    if (params.companyIds && params.companyIds.length > 0) {
      // CASO ESPECIAL: Usuario taquillero con múltiples compañías asignadas
      console.log(`[searchTrips-v2] FILTRADO MÚLTIPLE POR COMPAÑÍAS: [${params.companyIds.join(', ')}]`);
      
      // Vamos a construir una condición OR para cada compañía
      if (params.companyIds.length === 1) {
        // Si solo hay una compañía, usar condición simple de igualdad
        condiciones.push(sql`company_id = ${params.companyIds[0]}`);
      } else {
        // Si hay múltiples compañías, crear una condición OR para cada una
        // Por ejemplo: (company_id = 'bamo-456' OR company_id = 'viaja-facil-123')
        const companyConditions = params.companyIds.map(id => sql`company_id = ${id}`);
        
        // Combinar todas las condiciones con OR dentro de paréntesis
        // Combinar usando nuestro propio SQL
        let orConditionSql = sql`(`;
        
        // Añadir cada condición con OR entre ellas
        for (let i = 0; i < companyConditions.length; i++) {
          orConditionSql = sql`${orConditionSql}${companyConditions[i]}`;
          
          // Añadir OR excepto para el último elemento
          if (i < companyConditions.length - 1) {
            orConditionSql = sql`${orConditionSql} OR `;
          }
        }
        
        // Cerrar el paréntesis
        orConditionSql = sql`${orConditionSql})`;
        
        // Añadir la condición completa
        condiciones.push(orConditionSql);
      }
    } else if (params.companyId) {
      // CASO NORMAL: Filtrado por una sola compañía
      // Importante: Los usuarios con privilegios especiales como superAdmin pueden pasar un
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
    // Ya no se calcula el estado del viaje (tripStatus), esta funcionalidad ha sido eliminada
    
    // Now filter by origin and destination if provided
    const tripsWithRouteInfo: TripWithRouteInfo[] = [];
    
    for (const trip of trips) {
      const route = routeMap.get(trip.routeId);
      if (!route) continue;
      
      // Ya no se calcula el estado del viaje (tripStatus), esta funcionalidad ha sido eliminada
      
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
            // El estado del viaje ya no se utiliza
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
          // El estado del viaje ya no se utiliza
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
  
  // Función auxiliar para verificar si dos segmentos se superponen
  // Esta función toma los índices de origen y destino de dos segmentos y determina si se superponen
  private checkSegmentsOverlap(
    segment1OriginIdx: number, 
    segment1DestinationIdx: number,
    segment2OriginIdx: number,
    segment2DestinationIdx: number
  ): boolean {
    // Dos segmentos se solapan si uno comienza antes de que el otro termine,
    // y termina después de que el otro comienza.
    return segment1OriginIdx < segment2DestinationIdx && segment1DestinationIdx > segment2OriginIdx;
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
    
    // PRIMERO: Actualizar el viaje actual (ya sea principal o sub-viaje)
    let newAvailableSeatsForTrip;
    
    if (isAddingSeats) {
      // Al añadir asientos, no exceder la capacidad máxima
      newAvailableSeatsForTrip = Math.min(trip.availableSeats + absoluteChange, trip.capacity);
    } else if (isReducingSeats) {
      // Al reducir asientos, no permitir negativos
      newAvailableSeatsForTrip = Math.max(trip.availableSeats - absoluteChange, 0);
    } else {
      // Si no hay cambio, mantener igual
      newAvailableSeatsForTrip = trip.availableSeats;
    }
    
    console.log(`[updateRelatedTripsAvailability] Actualizando viaje actual ${trip.id}: asientos ${trip.availableSeats} a ${newAvailableSeatsForTrip} (capacidad máxima: ${trip.capacity})`);
    
    // Actualizar el viaje actual
    await db
      .update(schema.trips)
      .set({ availableSeats: newAvailableSeatsForTrip })
      .where(eq(schema.trips.id, trip.id));
    
    // LUEGO: Actualizar viajes relacionados
    if (trip.isSubTrip && trip.parentTripId && trip.segmentOrigin && trip.segmentDestination) {
      // Este es un sub-viaje, necesitamos actualizar:
      // 1. El viaje principal
      // 2. Otros sub-viajes del mismo viaje principal que intersecten
      // 3. Otros viajes principales que compartan ruta
      // 4. Sub-viajes de otros viajes principales que intersecten 
      
      const mainTrip = await this.getTrip(trip.parentTripId);
      if (!mainTrip) return;
      
      // Obtener información de la ruta principal para determinar todas las paradas
      const routeInfo = await this.getRouteWithSegments(mainTrip.routeId);
      if (!routeInfo) return;
      
      // Crear un array con todas las paradas en orden
      const allStops = [routeInfo.origin, ...routeInfo.stops, routeInfo.destination];
      
      console.log(`[updateRelatedTripsAvailability] Ruta completa: ${allStops.join(' -> ')}`);
      
      // Encontrar índices para este segmento
      const segmentOriginIdx = allStops.indexOf(trip.segmentOrigin);
      const segmentDestinationIdx = allStops.indexOf(trip.segmentDestination);
      
      if (segmentOriginIdx === -1 || segmentDestinationIdx === -1) {
        console.error(`[updateRelatedTripsAvailability] Error: No se pudo encontrar el segmento ${trip.segmentOrigin} a ${trip.segmentDestination} en la ruta.`);
        return;
      }
      
      console.log(`[updateRelatedTripsAvailability] Segment range: ${segmentOriginIdx} a ${segmentDestinationIdx} (${trip.segmentOrigin} -> ${trip.segmentDestination})`);
      
      // 1. Actualizar el viaje principal si corresponde (siempre se afecta)
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
        
      // 2. Actualizar otros sub-viajes del mismo viaje principal que intersecten
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
        
        // Verificar si hay superposición de segmentos usando nuestra función auxiliar
        const hasOverlap = this.checkSegmentsOverlap(
          segmentOriginIdx, segmentDestinationIdx,
          subOriginIdx, subDestinationIdx
        );
        
        // Imprimir detalles de la comparación para depuración
        console.log(`[updateRelatedTripsAvailability] Comparando segmentos: ${trip.segmentOrigin}(${segmentOriginIdx}) a ${trip.segmentDestination}(${segmentDestinationIdx}) vs ${subTrip.segmentOrigin}(${subOriginIdx}) a ${subTrip.segmentDestination}(${subDestinationIdx}) - Intersección: ${hasOverlap ? 'SÍ' : 'NO'}`);
        
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
      
      // 3 y 4. Buscar otros viajes principales en la misma ruta y fecha, y sus sub-viajes
      const otherMainTrips = await db
        .select()
        .from(schema.trips)
        .where(
          and(
            eq(schema.trips.routeId, mainTrip.routeId),
            eq(schema.trips.isSubTrip, false),
            eq(schema.trips.departureDate, mainTrip.departureDate), // Solo viajes con la misma fecha
            sql`id != ${mainTrip.id}`
          )
        );
      
      console.log(`[updateRelatedTripsAvailability] Encontrados ${otherMainTrips.length} viajes principales adicionales en la misma ruta`);
      
      // Para cada viaje principal, actualizarlo y sus sub-viajes relevantes
      for (const otherMainTrip of otherMainTrips) {
        // Actualizar el viaje principal
        let newOtherMainAvailableSeats;
        
        if (isAddingSeats) {
          newOtherMainAvailableSeats = Math.min(otherMainTrip.availableSeats + absoluteChange, otherMainTrip.capacity);
        } else if (isReducingSeats) {
          newOtherMainAvailableSeats = Math.max(otherMainTrip.availableSeats - absoluteChange, 0);
        } else {
          newOtherMainAvailableSeats = otherMainTrip.availableSeats;
        }
        
        console.log(`[updateRelatedTripsAvailability] Actualizando viaje principal adicional ${otherMainTrip.id}: asientos ${otherMainTrip.availableSeats} a ${newOtherMainAvailableSeats}`);
        
        await db
          .update(schema.trips)
          .set({ availableSeats: newOtherMainAvailableSeats })
          .where(eq(schema.trips.id, otherMainTrip.id));
        
        // Obtener y actualizar los sub-viajes relevantes de este viaje principal
        const otherSubTrips = await db
          .select()
          .from(schema.trips)
          .where(eq(schema.trips.parentTripId, otherMainTrip.id));
          
        for (const otherSubTrip of otherSubTrips) {
          if (!otherSubTrip.segmentOrigin || !otherSubTrip.segmentDestination) continue;
          
          // Encontrar índices para este sub-viaje
          const otherSubOriginIdx = allStops.indexOf(otherSubTrip.segmentOrigin);
          const otherSubDestinationIdx = allStops.indexOf(otherSubTrip.segmentDestination);
          
          if (otherSubOriginIdx === -1 || otherSubDestinationIdx === -1) continue;
          
          // Verificar si hay superposición con el segmento original usando nuestra función auxiliar
          const hasOtherOverlap = this.checkSegmentsOverlap(
            segmentOriginIdx, segmentDestinationIdx,
            otherSubOriginIdx, otherSubDestinationIdx
          );
          
          // Imprimir detalles de la comparación para depuración
          console.log(`[updateRelatedTripsAvailability] Comparando segmentos adicionales: ${trip.segmentOrigin}(${segmentOriginIdx}) a ${trip.segmentDestination}(${segmentDestinationIdx}) vs ${otherSubTrip.segmentOrigin}(${otherSubOriginIdx}) a ${otherSubTrip.segmentDestination}(${otherSubDestinationIdx}) - Intersección: ${hasOtherOverlap ? 'SÍ' : 'NO'}`);
          
          if (hasOtherOverlap) {
            // Calcular nuevos asientos disponibles
            let newOtherSubAvailableSeats;
            
            if (isAddingSeats) {
              newOtherSubAvailableSeats = Math.min(otherSubTrip.availableSeats + absoluteChange, otherSubTrip.capacity);
            } else if (isReducingSeats) {
              newOtherSubAvailableSeats = Math.max(otherSubTrip.availableSeats - absoluteChange, 0);
            } else {
              newOtherSubAvailableSeats = otherSubTrip.availableSeats;
            }
            
            console.log(`[updateRelatedTripsAvailability] Actualizando sub-viaje adicional ${otherSubTrip.id}: asientos ${otherSubTrip.availableSeats} a ${newOtherSubAvailableSeats}`);
            
            await db
              .update(schema.trips)
              .set({ availableSeats: newOtherSubAvailableSeats })
              .where(eq(schema.trips.id, otherSubTrip.id));
          }
        }
      }
    } else {
      // Es un viaje principal, necesitamos analizar todos los viajes potencialmente afectados
      const routeInfo = await this.getRouteWithSegments(trip.routeId);
      if (!routeInfo) return;
      
      // Crear un array con todas las paradas en orden
      const allStops = [routeInfo.origin, ...routeInfo.stops, routeInfo.destination];
      
      // En caso de ser un viaje principal sin segmento específico, afecta a toda la ruta
      // Buscar todos los viajes que comparten la misma ruta y pueden ser afectados
      // Esto incluye:
      // 1. Sub-viajes directos de este viaje principal
      // 2. Otros viajes principales en la misma ruta
      // 3. Sub-viajes de otros viajes principales que intersectan con esta ruta
      
      // 1. Primero, actualizar los sub-viajes directos
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
      
      // 2 y 3. Buscar otros viajes principales y sus sub-viajes que comparten esta ruta y fecha
      // Obtenemos todos los viajes principales para esta ruta y fecha (excepto el actual)
      const relatedMainTrips = await db
        .select()
        .from(schema.trips)
        .where(
          and(
            eq(schema.trips.routeId, trip.routeId),
            eq(schema.trips.isSubTrip, false),
            eq(schema.trips.departureDate, trip.departureDate), // Solo viajes con la misma fecha
            sql`id != ${trip.id}`
          )
        );
      
      // Para cada viaje principal relacionado, actualizar su disponibilidad
      for (const mainTrip of relatedMainTrips) {
        // Calcular nuevos asientos disponibles
        let newMainAvailableSeats;
        
        if (isAddingSeats) {
          newMainAvailableSeats = Math.min(mainTrip.availableSeats + absoluteChange, mainTrip.capacity);
        } else if (isReducingSeats) {
          newMainAvailableSeats = Math.max(mainTrip.availableSeats - absoluteChange, 0);
        } else {
          newMainAvailableSeats = mainTrip.availableSeats;
        }
        
        console.log(`[updateRelatedTripsAvailability] Actualizando viaje principal relacionado ${mainTrip.id}: asientos ${mainTrip.availableSeats} a ${newMainAvailableSeats}`);
        
        await db
          .update(schema.trips)
          .set({ availableSeats: newMainAvailableSeats })
          .where(eq(schema.trips.id, mainTrip.id));
        
        // Actualizar sus sub-viajes
        const relatedSubTrips = await db
          .select()
          .from(schema.trips)
          .where(eq(schema.trips.parentTripId, mainTrip.id));
          
        for (const subTrip of relatedSubTrips) {
          if (!subTrip.segmentOrigin || !subTrip.segmentDestination) continue;
          
          // Encontrar índices para el sub-viaje
          const subOriginIdx = allStops.indexOf(subTrip.segmentOrigin);
          const subDestinationIdx = allStops.indexOf(subTrip.segmentDestination);
          
          if (subOriginIdx === -1 || subDestinationIdx === -1) continue;
          
          // Calcular nuevos asientos disponibles
          let newSubAvailableSeats;
          
          if (isAddingSeats) {
            newSubAvailableSeats = Math.min(subTrip.availableSeats + absoluteChange, subTrip.capacity);
          } else if (isReducingSeats) {
            newSubAvailableSeats = Math.max(subTrip.availableSeats - absoluteChange, 0);
          } else {
            newSubAvailableSeats = subTrip.availableSeats;
          }
          
          console.log(`[updateRelatedTripsAvailability] Actualizando sub-viaje relacionado ${subTrip.id}: asientos ${subTrip.availableSeats} a ${newSubAvailableSeats}`);
          
          await db
            .update(schema.trips)
            .set({ availableSeats: newSubAvailableSeats })
            .where(eq(schema.trips.id, subTrip.id));
        }
      }
    }
  }
  
  async getReservations(companyId?: string, tripId?: number, companyIds?: string[]): Promise<ReservationWithDetails[]> {
    console.time('getReservations-optimized');
    
    // NUEVA IMPLEMENTACIÓN CON FILTRADO DE COMPAÑÍA Y VIAJE
    console.log(`[getReservations] Iniciando búsqueda${companyId ? ` para compañía ${companyId}` : ''}${companyIds && companyIds.length > 0 ? ` para compañías [${companyIds.join(', ')}]` : ''}${tripId ? ` para viaje ${tripId}` : ''}`);
    
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
    
    // FILTRO POR MÚLTIPLES COMPAÑÍAS (para Taquilleros)
    if (companyIds && companyIds.length > 0) {
      console.log(`[getReservations] FILTRO POR MÚLTIPLES COMPAÑÍAS: [${companyIds.join(', ')}]`);
      
      // Vamos a construir una condición OR para cada compañía
      if (companyIds.length === 1) {
        // Si solo hay una compañía, usar condición simple de igualdad
        condiciones.push(sql`company_id = ${companyIds[0]}`);
      } else {
        // Si hay múltiples compañías, crear una condición OR para cada una
        // Por ejemplo: (company_id = 'bamo-456' OR company_id = 'viaja-facil-123')
        const companyConditions = companyIds.map(id => sql`company_id = ${id}`);
        
        // Combinar usando nuestro propio SQL
        let orConditionSql = sql`(`;
        
        // Añadir cada condición con OR entre ellas
        for (let i = 0; i < companyConditions.length; i++) {
          orConditionSql = sql`${orConditionSql}${companyConditions[i]}`;
          
          // Añadir OR excepto para el último elemento
          if (i < companyConditions.length - 1) {
            orConditionSql = sql`${orConditionSql} OR `;
          }
        }
        
        // Cerrar el paréntesis
        orConditionSql = sql`${orConditionSql})`;
        
        // Añadir la condición completa
        condiciones.push(orConditionSql);
      }
    }
    // FILTRO POR UNA COMPAÑÍA ESPECÍFICA
    else if (companyId) {
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
          markedAsPaidAt: now, // Registrar cuándo se marcó como pagado
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
  
  async getPaidReservationsByCompany(companyId: string): Promise<ReservationWithDetails[]> {
    console.log(`[getPaidReservationsByCompany] Buscando reservaciones pagadas para la compañía ${companyId}`);
    
    try {
      // Primero obtener todos los usuarios de esta compañía
      const companyUsers = await db
        .select()
        .from(schema.users)
        .where(
          or(
            eq(schema.users.companyId, companyId),
            eq(schema.users.company, companyId)
          )
        );
      
      console.log(`[getPaidReservationsByCompany] Encontrados ${companyUsers.length} usuarios de la compañía ${companyId}`);
      
      if (companyUsers.length === 0) {
        return [];
      }
      
      // Obtener los IDs de usuarios
      const userIds = companyUsers.map(user => user.id);
      
      // Obtener todas las reservaciones pagadas por usuarios de esta compañía
      const reservations = await db
        .select()
        .from(schema.reservations)
        .where(
          and(
            inArray(schema.reservations.paidBy, userIds),
            eq(schema.reservations.paymentStatus, schema.PaymentStatus.PAID)
          )
        )
        .orderBy(desc(schema.reservations.markedAsPaidAt));
      
      console.log(`[getPaidReservationsByCompany] Encontradas ${reservations.length} reservaciones pagadas por usuarios de la compañía ${companyId}`);
      
      if (reservations.length === 0) {
        return [];
      }
      
      // Para cada reservación, obtener detalles adicionales incluyendo quién la pagó
      const detailedReservations = await Promise.all(
        reservations.map(async (reservation) => {
          // Encontrar el usuario que pagó
          const paidByUser = companyUsers.find(user => user.id === reservation.paidBy);
          
          // Resto del código igual que en getPaidReservationsByUser...
          // Obtener pasajeros, viaje, etc.
          
          // Incluir información del usuario que pagó
          return {
            ...await this.getReservationDetails(reservation),
            paidByUserInfo: paidByUser ? {
              id: paidByUser.id,
              firstName: paidByUser.firstName,
              lastName: paidByUser.lastName,
              role: paidByUser.role
            } : undefined
          };
        })
      );
      
      return detailedReservations;
    } catch (error) {
      console.error(`[getPaidReservationsByCompany] Error al obtener reservaciones:`, error);
      return [];
    }
  }

  // Función auxiliar para obtener los detalles de una reservación
  private async getReservationDetails(reservation: schema.Reservation): Promise<ReservationWithDetails> {
    // Obtener pasajeros
    const passengers = await this.getPassengers(reservation.id);
    
    // Obtener información del viaje
    const trip = await this.getTripWithRouteInfo(reservation.tripId);
    
    if (!trip) {
      console.log(`No se encontró el viaje ${reservation.tripId} asociado a la reserva ${reservation.id}`);
      
      // Si no se encuentra el viaje, aún devolvemos la reserva pero con un trip vacío
      return {
        ...reservation,
        passengers,
        trip: {
          id: reservation.tripId,
          route: { id: 0, name: "Viaje no disponible", origin: "", destination: "", stops: [] }
        }
      } as ReservationWithDetails;
    }
    
    // Obtener usuario que creó la reservación
    let createdByUser: schema.User | undefined;
    if (reservation.createdBy) {
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, reservation.createdBy));
      
      if (user) {
        createdByUser = user;
      }
    }
    
    // Obtener usuario que escaneó la reservación
    let checkedByUser: schema.User | undefined;
    if (reservation.checkedBy) {
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, reservation.checkedBy));
      
      if (user) {
        checkedByUser = user;
      }
    }
    
    return {
      ...reservation,
      passengers,
      trip,
      createdByUser,
      checkedByUser
    } as ReservationWithDetails;
  }

  async getPaidReservationsByUser(userId: number): Promise<ReservationWithDetails[]> {
    console.log(`[getPaidReservationsByUser] Buscando reservaciones pagadas por usuario ${userId}`);
    
    try {
      // Obtener todas las reservaciones pagadas por este usuario
      const reservations = await db
        .select()
        .from(schema.reservations)
        .where(
          and(
            eq(schema.reservations.paidBy, userId),
            eq(schema.reservations.paymentStatus, schema.PaymentStatus.PAID)
          )
        )
        .orderBy(desc(schema.reservations.markedAsPaidAt));
      
      console.log(`[getPaidReservationsByUser] Encontradas ${reservations.length} reservaciones pagadas por usuario ${userId}`);
      
      if (reservations.length === 0) {
        return [];
      }
      
      // Para cada reservación, obtener detalles adicionales
      const detailedReservations = await Promise.all(
        reservations.map(async (reservation) => {
          // Obtener pasajeros
          const passengers = await this.getPassengers(reservation.id);
          
          // Obtener información del viaje
          const trip = await this.getTripWithRouteInfo(reservation.tripId);
          
          if (!trip) {
            console.log(`[getPaidReservationsByUser] No se encontró el viaje ${reservation.tripId} asociado a la reserva ${reservation.id}`);
            
            // Si no se encuentra el viaje, aún devolvemos la reserva pero con un trip vacío
            return {
              ...reservation,
              passengers,
              trip: {
                id: reservation.tripId,
                route: { id: 0, name: "Viaje no disponible", origin: "", destination: "", stops: [] }
              }
            } as ReservationWithDetails;
          }
          
          // Obtener usuario que creó la reservación
          let createdByUser: User | undefined;
          if (reservation.createdBy) {
            const [user] = await db
              .select()
              .from(schema.users)
              .where(eq(schema.users.id, reservation.createdBy));
            
            if (user) {
              createdByUser = user;
            }
          }
          
          // Obtener usuario que escaneó la reservación
          let checkedByUser: User | undefined;
          if (reservation.checkedBy) {
            const [user] = await db
              .select()
              .from(schema.users)
              .where(eq(schema.users.id, reservation.checkedBy));
            
            if (user) {
              checkedByUser = user;
            }
          }
          
          // Obtener usuario que pagó (aunque sabemos que es el userId)
          let paidByUser: User | undefined;
          if (reservation.paidBy) {
            const [user] = await db
              .select()
              .from(schema.users)
              .where(eq(schema.users.id, reservation.paidBy));
            
            if (user) {
              paidByUser = user;
            }
          }
          
          // Devolver reservación con detalles completos
          return {
            ...reservation,
            passengers,
            trip,
            createdByUser,
            checkedByUser,
            paidByUser
          };
        })
      );
      
      return detailedReservations;
    } catch (error) {
      console.error(`[getPaidReservationsByUser] Error al obtener reservaciones pagadas:`, error);
      return [];
    }
  }
  
  async getPaidReservationsByCompany(companyId: string): Promise<ReservationWithDetails[]> {
    console.log(`[getPaidReservationsByCompany] Buscando reservaciones pagadas para compañía: ${companyId}`);
    
    try {
      // Obtener reservaciones marcadas como pagadas y que pertenecen a la compañía
      const reservations = await db
        .select()
        .from(schema.reservations)
        .where(
          and(
            eq(schema.reservations.companyId, companyId),
            eq(schema.reservations.paymentStatus, schema.PaymentStatus.PAID),
            not(isNull(schema.reservations.markedAsPaidAt))
          )
        )
        .orderBy(desc(schema.reservations.markedAsPaidAt));
      
      console.log(`[getPaidReservationsByCompany] Encontradas ${reservations.length} reservaciones pagadas para compañía ${companyId}`);
      
      if (reservations.length === 0) {
        return [];
      }
      
      // Para cada reservación, obtener detalles adicionales
      const detailedReservations = await Promise.all(
        reservations.map(async (reservation) => {
          // Obtener pasajeros
          const passengers = await this.getPassengers(reservation.id);
          
          // Obtener información del viaje
          const trip = await this.getTripWithRouteInfo(reservation.tripId);
          
          if (!trip) {
            console.log(`[getPaidReservationsByCompany] No se encontró el viaje ${reservation.tripId} asociado a la reserva ${reservation.id}`);
            
            // Si no se encuentra el viaje, aún devolvemos la reserva pero con un trip vacío
            return {
              ...reservation,
              passengers,
              trip: {
                id: reservation.tripId,
                route: { id: 0, name: "Viaje no disponible", origin: "", destination: "", stops: [] }
              }
            } as ReservationWithDetails;
          }
          
          // Obtener usuario que creó la reservación
          let createdByUser: User | undefined;
          if (reservation.createdBy) {
            const [user] = await db
              .select()
              .from(schema.users)
              .where(eq(schema.users.id, reservation.createdBy));
            
            if (user) {
              createdByUser = user;
            }
          }
          
          // Obtener usuario que escaneó la reservación
          let checkedByUser: User | undefined;
          if (reservation.checkedBy) {
            const [user] = await db
              .select()
              .from(schema.users)
              .where(eq(schema.users.id, reservation.checkedBy));
            
            if (user) {
              checkedByUser = user;
            }
          }
          
          // Obtener usuario que marcó como pagada la reservación
          let paidByUser: User | undefined;
          if (reservation.paidBy) {
            const [user] = await db
              .select()
              .from(schema.users)
              .where(eq(schema.users.id, reservation.paidBy));
            
            if (user) {
              paidByUser = user;
            }
          }
          
          return {
            ...reservation,
            trip,
            passengers,
            createdByUser,
            checkedByUser,
            paidByUser
          };
        })
      );
      
      return detailedReservations;
    } catch (error) {
      console.error(`[getPaidReservationsByCompany] Error al obtener reservaciones pagadas para compañía ${companyId}:`, error);
      return [];
    }
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
  
  async getUsersByRole(role: string): Promise<schema.User[]> {
    console.log(`[getUsersByRole] Obteniendo usuarios con rol: ${role}`);
    
    if (!role) {
      console.warn(`[getUsersByRole] Se llamó con rol vacío o nulo`);
      return [];
    }
    
    try {
      // Consultar usuarios por rol
      const users = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.role, role));
      
      console.log(`[getUsersByRole] Encontrados ${users.length} usuarios con rol ${role}`);
      console.log(`[getUsersByRole] IDs de usuarios encontrados: ${users.map(u => u.id).join(', ')}`);
      
      return users;
    } catch (error) {
      console.error(`[getUsersByRole] Error al obtener usuarios por rol ${role}:`, error);
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
        console.log(`[updateReservationRequestStatus] Aprobando solicitud ID ${id}. Creando reservación en tabla reservations.`);
        
        // Obtener información del viaje para almacenar más detalles
        const trip = await this.getTrip(currentRequest.tripId);
        if (!trip) {
          throw new Error(`El viaje con ID ${currentRequest.tripId} no existe.`);
        }
        
        // Preparar los datos para la nueva reservación
        const newReservation: InsertReservation = {
          tripId: currentRequest.tripId,
          totalAmount: currentRequest.totalAmount,
          email: currentRequest.email,
          phone: currentRequest.phone,
          notes: currentRequest.notes ? 
            `${currentRequest.notes} [Creado automáticamente a partir de solicitud #${id}]` : 
            `Creado automáticamente a partir de solicitud #${id}`,
          paymentMethod: currentRequest.paymentMethod || PaymentMethod.CASH,
          paymentStatus: currentRequest.paymentStatus || PaymentStatus.PENDING,
          advanceAmount: currentRequest.advanceAmount || 0,
          advancePaymentMethod: currentRequest.advancePaymentMethod || PaymentMethod.CASH,
          createdBy: currentRequest.requesterId, // El creador es el comisionista
          companyId: currentRequest.companyId,
          status: "confirmed", // La reservación se crea ya confirmada
          commissionPaid: false, // Por defecto, la comisión no está pagada
          createdAt: new Date(), // Fecha de creación actual
          updatedAt: new Date(), // Fecha de actualización
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
  
  async getAllNotifications(): Promise<Notification[]> {
    try {
      // Obtener todas las notificaciones ordenadas por fecha (más recientes primero)
      const notifications = await db
        .select()
        .from(schema.notifications)
        .orderBy(desc(schema.notifications.createdAt));
      
      return notifications;
    } catch (error) {
      console.error('Error al obtener todas las notificaciones:', error);
      return [];
    }
  }
  
  async getNotificationsByType(type: string, companyId: string, direction: 'outgoing' | 'incoming' = 'outgoing'): Promise<Notification[]> {
    try {
      let whereConditions;
      
      // Consulta diferente basada en dirección:
      // - outgoing: notificaciones que fueron creadas por usuarios de la compañía (buscar en metaData)
      // - incoming: notificaciones recibidas por usuarios de la compañía (basado en userId)
      
      if (direction === 'outgoing') {
        // Para outgoing, necesitamos buscar en todos los metaData donde nuestra compañía es la fuente
        // Esta es una implementación simplificada que podría necesitar optimización en el futuro
        const allTransferNotifications = await db
          .select()
          .from(schema.notifications)
          .where(eq(schema.notifications.type, type))
          .orderBy(desc(schema.notifications.createdAt));
        
        // Filtrar manualmente aquellas donde nuestra compañía es la fuente
        return allTransferNotifications.filter(notification => {
          if (!notification.metaData) return false;
          
          try {
            const metaData = JSON.parse(notification.metaData);
            return metaData.sourceCompanyId === companyId || metaData.sourceCompany === companyId;
          } catch (e) {
            return false;
          }
        });
      } else {
        // Para incoming, necesitamos encontrar todas las notificaciones enviadas a usuarios de nuestra compañía
        // Primero, obtenemos todos los usuarios de la compañía
        const companyUsers = await db
          .select()
          .from(schema.users)
          .where(eq(schema.users.companyId, companyId));
        
        const userIds = companyUsers.map(user => user.id);
        
        if (userIds.length === 0) {
          return [];
        }
        
        // Luego, buscamos notificaciones para esos usuarios de tipo 'transfer'
        const notifications = await db
          .select()
          .from(schema.notifications)
          .where(
            and(
              eq(schema.notifications.type, type),
              inArray(schema.notifications.userId, userIds)
            )
          )
          .orderBy(desc(schema.notifications.createdAt));
        
        return notifications;
      }
    } catch (error) {
      console.error(`Error al obtener notificaciones de tipo ${type} para compañía ${companyId}:`, error);
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

  // PACKAGE METHODS
  async getPackages(filters?: { companyId?: string, tripId?: number, tripIds?: number[] }): Promise<schema.Package[]> {
    try {
      console.log(`[getPackages] Buscando paqueterías con filtros:`, filters);
      
      let query = db.select().from(schema.packages);
      
      // Aplicar filtros de seguridad
      if (filters) {
        // Filtro por compañía (aislamiento de datos)
        if (filters.companyId) {
          query = query.where(eq(schema.packages.companyId, filters.companyId));
          console.log(`[getPackages] Aplicando filtro de compañía: ${filters.companyId}`);
        }
        
        // Filtro por viaje único
        if (filters.tripId) {
          query = query.where(eq(schema.packages.tripId, filters.tripId));
          console.log(`[getPackages] Aplicando filtro de viaje único: ${filters.tripId}`);
        }
        // Filtro por múltiples viajes (para conductores)
        else if (filters.tripIds && filters.tripIds.length > 0) {
          query = query.where(inArray(schema.packages.tripId, filters.tripIds));
          console.log(`[getPackages] Aplicando filtro de múltiples viajes: [${filters.tripIds.join(', ')}]`);
        }
      }
      
      // Ejecutar la consulta
      const packages = await query;
      console.log(`[getPackages] Encontradas ${packages.length} paqueterías`);
      
      return packages;
    } catch (error) {
      console.error(`[getPackages] Error al obtener paqueterías:`, error);
      return [];
    }
  }
  
  async getPackagesWithTripInfo(filters?: { companyId?: string, tripId?: number, tripIds?: number[] }): Promise<(schema.Package & { 
    tripOrigin?: string, 
    tripDestination?: string, 
    segmentOrigin?: string, 
    segmentDestination?: string,
    createdByUser?: { firstName: string, lastName: string },
    paidByUser?: { firstName: string, lastName: string },
    deliveredByUser?: { firstName: string, lastName: string }
  })[]> {
    try {
      // Primero obtenemos los paquetes
      const packages = await this.getPackages(filters);
      
      // Si no hay paquetes, retornamos array vacío
      if (packages.length === 0) {
        return [];
      }
      
      // Extraemos los IDs de viajes para buscarlos
      const tripIds = [...new Set(packages.map(pkg => pkg.tripId))];
      
      // Obtenemos todos los viajes necesarios con un solo query
      const trips = await db.select({
        id: schema.trips.id,
        routeId: schema.trips.routeId,
        segmentOrigin: schema.trips.segmentOrigin,
        segmentDestination: schema.trips.segmentDestination
      }).from(schema.trips)
        .where(inArray(schema.trips.id, tripIds));
      
      // Convertimos los trips a un mapa para fácil búsqueda
      const tripsMap = trips.reduce((acc, trip) => {
        acc[trip.id] = trip;
        return acc;
      }, {} as Record<number, typeof trips[0]>);
      
      // Buscamos las rutas relacionadas
      const routeIds = [...new Set(trips.map(trip => trip.routeId))];
      const routes = await db.select({
        id: schema.routes.id,
        origin: schema.routes.origin,
        destination: schema.routes.destination,
      }).from(schema.routes)
        .where(inArray(schema.routes.id, routeIds));
      
      // Convertimos las rutas a un mapa para fácil búsqueda
      const routesMap = routes.reduce((acc, route) => {
        acc[route.id] = route;
        return acc;
      }, {} as Record<number, typeof routes[0]>);
      
      // Extraemos los IDs de usuarios para buscarlos (creador, quien marcó como pagado, quien entregó)
      const userIds = new Set<number>();
      packages.forEach(pkg => {
        if (pkg.createdBy) userIds.add(pkg.createdBy);
        if (pkg.paidBy) userIds.add(pkg.paidBy);
        if (pkg.deliveredBy) userIds.add(pkg.deliveredBy);
      });
      
      // Si hay usuarios relacionados, obtenemos sus datos
      let usersMap: Record<number, { firstName: string, lastName: string }> = {};
      if (userIds.size > 0) {
        const userIdsArray = [...userIds];
        const users = await db.select({
          id: schema.users.id,
          firstName: schema.users.firstName,
          lastName: schema.users.lastName
        }).from(schema.users)
          .where(inArray(schema.users.id, userIdsArray));
        
        // Crear mapa de usuarios para fácil acceso
        usersMap = users.reduce((acc, user) => {
          acc[user.id] = { firstName: user.firstName, lastName: user.lastName };
          return acc;
        }, {} as Record<number, { firstName: string, lastName: string }>);
      }
      
      // Añadimos origen, destino e información de usuarios a cada paquete
      return packages.map(pkg => {
        const tripInfo = tripsMap[pkg.tripId];
        const routeInfo = tripInfo ? routesMap[tripInfo.routeId] : null;
        
        return {
          ...pkg,
          // Priorizar los segmentos si están disponibles, luego usar la ruta completa
          tripOrigin: routeInfo?.origin || "No disponible",
          tripDestination: routeInfo?.destination || "No disponible",
          segmentOrigin: tripInfo?.segmentOrigin || routeInfo?.origin || "No disponible",
          segmentDestination: tripInfo?.segmentDestination || routeInfo?.destination || "No disponible",
          // Información de usuarios
          createdByUser: pkg.createdBy ? usersMap[pkg.createdBy] : undefined,
          paidByUser: pkg.paidBy ? usersMap[pkg.paidBy] : undefined,
          deliveredByUser: pkg.deliveredBy ? usersMap[pkg.deliveredBy] : undefined
        };
      });
    } catch (error) {
      console.error(`[getPackagesWithTripInfo] Error al obtener paqueterías con datos de viaje:`, error);
      return [];
    }
  }
  
  async getPackage(id: number): Promise<schema.Package | undefined> {
    try {
      console.log(`[getPackage] Buscando paquetería con ID: ${id}`);
      
      const [packageItem] = await db
        .select()
        .from(schema.packages)
        .where(eq(schema.packages.id, id));
        
      return packageItem;
    } catch (error) {
      console.error(`[getPackage] Error al obtener paquetería ID ${id}:`, error);
      return undefined;
    }
  }
  
  async getPackageWithTripInfo(id: number): Promise<schema.Package & { 
    trip?: TripWithRouteInfo;
    tripOrigin?: string;
    tripDestination?: string;
  } | undefined> {
    try {
      console.log(`[getPackageWithTripInfo] Buscando paquetería con ID: ${id}`);
      
      // Obtener la paquetería
      const packageItem = await this.getPackage(id);
      if (!packageItem) return undefined;
      
      // Obtener la información del viaje asociado
      const trip = await this.getTripWithRouteInfo(packageItem.tripId);
      
      // Retornar paquetería con datos de viaje
      return {
        ...packageItem,
        trip,
        tripOrigin: trip?.route.origin || "No disponible",
        tripDestination: trip?.route.destination || "No disponible"
      };
    } catch (error) {
      console.error(`[getPackageWithTripInfo] Error al obtener paquetería con datos de viaje ID ${id}:`, error);
      return undefined;
    }
  }
  
  async createPackage(packageData: schema.InsertPackage): Promise<schema.Package> {
    try {
      console.log(`[createPackage] Creando nueva paquetería:`, packageData);
      
      // Insertar la paquetería en la base de datos
      const [newPackage] = await db
        .insert(schema.packages)
        .values(packageData)
        .returning();
        
      console.log(`[createPackage] Paquetería creada con ID: ${newPackage.id}`);
      
      // Si el paquete ocupa asientos, actualizar la disponibilidad del viaje
      if (newPackage.usesSeats && newPackage.seatsQuantity > 0 && newPackage.tripId) {
        console.log(`[createPackage] El paquete ${newPackage.id} ocupa ${newPackage.seatsQuantity} asientos en el viaje ${newPackage.tripId}`);
        
        try {
          // Usar la función que actualiza todos los viajes relacionados
          await this.updateRelatedTripsAvailability(
            newPackage.tripId, 
            -newPackage.seatsQuantity // Cambio negativo para reducir asientos
          );
          
          console.log(`[createPackage] Asientos actualizados en viaje ${newPackage.tripId} y todos los viajes relacionados`);
        } catch (updateError) {
          console.error(`[createPackage] Error al actualizar asientos del viaje:`, updateError);
          // No detenemos el proceso, ya que la paquetería ya fue creada
        }
      }
      
      return newPackage;
    } catch (error) {
      console.error(`[createPackage] Error al crear paquetería:`, error);
      throw new Error(`Error al crear paquetería: ${error}`);
    }
  }
  
  async updatePackage(id: number, packageData: Partial<schema.Package>): Promise<schema.Package | undefined> {
    try {
      console.log(`[updatePackage] Actualizando paquetería ID ${id}:`, packageData);
      
      // Obtener el paquete original para comparar cambios en los asientos
      const originalPackage = await this.getPackage(id);
      if (!originalPackage) {
        console.log(`[updatePackage] No se encontró la paquetería original con ID ${id}`);
        return undefined;
      }
      
      // Actualizar datos de la paquetería
      const [updatedPackage] = await db
        .update(schema.packages)
        .set({
          ...packageData,
          updatedAt: new Date(), // Actualizar la fecha de modificación
        })
        .where(eq(schema.packages.id, id))
        .returning();
        
      if (!updatedPackage) {
        console.log(`[updatePackage] No se pudo actualizar la paquetería con ID ${id}`);
        return undefined;
      }
      
      console.log(`[updatePackage] Paquetería actualizada: ${updatedPackage.id}`);
      
      // Verificar si hubo cambios en el uso de asientos
      const originalSeatsUsed = originalPackage.usesSeats ? (originalPackage.seatsQuantity || 0) : 0;
      const updatedSeatsUsed = updatedPackage.usesSeats ? (updatedPackage.seatsQuantity || 0) : 0;
      const seatsDifference = updatedSeatsUsed - originalSeatsUsed;
      
      // Si hay una diferencia en asientos, actualizar la disponibilidad del viaje
      if (seatsDifference !== 0 && updatedPackage.tripId) {
        console.log(`[updatePackage] Cambio en asientos ocupados: ${seatsDifference} para el viaje ${updatedPackage.tripId}`);
        
        try {
          // Usar la función que actualiza todos los viajes relacionados
          // Si seatsDifference es positivo, se están usando más asientos (reducir disponibles)
          // Si seatsDifference es negativo, se están liberando asientos (aumentar disponibles)
          await this.updateRelatedTripsAvailability(
            updatedPackage.tripId, 
            -seatsDifference // Negativo porque es el cambio en asientos disponibles
          );
          
          console.log(`[updatePackage] Asientos actualizados en viaje ${updatedPackage.tripId} y todos los viajes relacionados`);
        } catch (updateError) {
          console.error(`[updatePackage] Error al actualizar asientos del viaje:`, updateError);
          // No detenemos el proceso, ya que la paquetería ya fue actualizada
        }
      }
      
      return updatedPackage;
    } catch (error) {
      console.error(`[updatePackage] Error al actualizar paquetería ID ${id}:`, error);
      return undefined;
    }
  }
  
  async deletePackage(id: number): Promise<boolean> {
    try {
      console.log(`[deletePackage] Eliminando paquetería ID ${id}`);
      
      // Obtener el paquete antes de eliminarlo para saber si usaba asientos
      const packageToDelete = await this.getPackage(id);
      if (!packageToDelete) {
        console.log(`[deletePackage] No se encontró la paquetería con ID ${id}`);
        return false;
      }
      
      // Eliminar la paquetería
      const result = await db
        .delete(schema.packages)
        .where(eq(schema.packages.id, id))
        .returning({ id: schema.packages.id });
        
      const success = result.length > 0;
      console.log(`[deletePackage] Paquetería ${success ? 'eliminada' : 'no encontrada'}`);
      
      // Si el paquete usaba asientos, actualizar la disponibilidad del viaje
      if (success && packageToDelete.usesSeats && packageToDelete.seatsQuantity > 0 && packageToDelete.tripId) {
        console.log(`[deletePackage] El paquete eliminado ocupaba ${packageToDelete.seatsQuantity} asientos en el viaje ${packageToDelete.tripId}`);
        
        try {
          // Usar la función que actualiza todos los viajes relacionados
          // Al eliminar un paquete, se liberan asientos, por lo que el cambio es positivo
          const seatsToAdd = packageToDelete.seatsQuantity || 0;
          
          await this.updateRelatedTripsAvailability(
            packageToDelete.tripId, 
            seatsToAdd // Cambio positivo para aumentar asientos disponibles
          );
          
          console.log(`[deletePackage] Asientos actualizados en viaje ${packageToDelete.tripId} y todos los viajes relacionados`);
        } catch (updateError) {
          console.error(`[deletePackage] Error al actualizar asientos del viaje:`, updateError);
          // No detenemos el proceso, ya que la paquetería ya fue eliminada
        }
      }
      
      return success;
    } catch (error) {
      console.error(`[deletePackage] Error al eliminar paquetería ID ${id}:`, error);
      return false;
    }
  }

  // Company methods
  async getCompanyById(companyId: string): Promise<{id: string, name: string} | null> {
    try {
      console.log(`[getCompanyById] Buscando compañía con ID: ${companyId}`);
      
      const [company] = await db
        .select({
          id: schema.companies.identifier,
          name: schema.companies.name
        })
        .from(schema.companies)
        .where(eq(schema.companies.identifier, companyId));
      
      if (!company) {
        console.log(`[getCompanyById] No se encontró la compañía con ID: ${companyId}`);
        return null;
      }
      
      console.log(`[getCompanyById] Compañía encontrada: ${JSON.stringify(company)}`);
      return company;
    } catch (error) {
      console.error(`[getCompanyById] Error al buscar compañía ID ${companyId}:`, error);
      return null;
    }
  }

  // ========== SISTEMA DE CAJAS ==========

  // Obtener la caja asignada a un usuario
  async getUserCashbox(userId: number, companyId: string): Promise<schema.Cashbox | undefined> {
    try {
      console.log(`[getUserCashbox] Buscando caja para usuario ${userId} en compañía ${companyId}`);
      
      // Buscar caja donde el operador sea este usuario
      const [cashbox] = await db
        .select()
        .from(schema.cashboxes)
        .where(
          and(
            eq(schema.cashboxes.operatorId, userId),
            eq(schema.cashboxes.companyId, companyId),
            eq(schema.cashboxes.isActive, true)
          )
        );
      
      if (cashbox) {
        console.log(`[getUserCashbox] Caja encontrada: ${cashbox.name} (ID: ${cashbox.id})`);
        return cashbox;
      }
      
      // Si no hay caja asignada al usuario, crear una automáticamente
      console.log(`[getUserCashbox] No se encontró caja para el usuario ${userId}. Creando una automáticamente.`);
      
      // Obtener información del usuario
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId));
      
      if (!user) {
        console.error(`[getUserCashbox] No se encontró el usuario ${userId}`);
        return undefined;
      }
      
      // Crear nueva caja para el usuario
      const newCashbox: schema.InsertCashbox = {
        companyId,
        name: `Caja de ${user.firstName} ${user.lastName}`,
        description: `Caja automática para ${user.firstName} ${user.lastName}`,
        balance: 0,
        operatorId: userId,
        isActive: true,
        createdAt: new Date()
      };
      
      const createdCashbox = await this.createCashbox(newCashbox);
      console.log(`[getUserCashbox] Caja creada automáticamente: ${createdCashbox.name} (ID: ${createdCashbox.id})`);
      
      return createdCashbox;
    } catch (error) {
      console.error(`[getUserCashbox] Error al buscar/crear caja para usuario ${userId}:`, error);
      return undefined;
    }
  }
  
  // Obtener una caja por su ID
  async getCashboxById(id: number): Promise<schema.Cashbox | undefined> {
    try {
      console.log(`[getCashboxById] Buscando caja con ID ${id}`);
      
      const [cashbox] = await db
        .select()
        .from(schema.cashboxes)
        .where(eq(schema.cashboxes.id, id));
      
      if (!cashbox) {
        console.log(`[getCashboxById] No se encontró la caja con ID ${id}`);
        return undefined;
      }
      
      console.log(`[getCashboxById] Caja encontrada: ${cashbox.name} (ID: ${cashbox.id})`);
      return cashbox;
    } catch (error) {
      console.error(`[getCashboxById] Error al buscar caja con ID ${id}:`, error);
      return undefined;
    }
  }
  
  // Obtener cajas de una compañía que tienen transacciones
  async getCompanyCashboxesWithTransactions(companyId: string): Promise<any[]> {
    try {
      console.log(`[getCompanyCashboxesWithTransactions] Obteniendo cajas con transacciones para la compañía ${companyId}`);
      
      // Obtener todas las cajas de la compañía
      const cashboxes = await this.getCashboxes(companyId);
      
      if (!cashboxes.length) {
        console.log(`[getCompanyCashboxesWithTransactions] No se encontraron cajas para la compañía ${companyId}`);
        return [];
      }
      
      // Resultado filtrado - solo cajas con transacciones
      const result = [];
      
      // Para cada caja, verificar si tiene transacciones
      for (const cashbox of cashboxes) {
        try {
          // Obtener transacciones de la caja (solo verificamos si existen)
          const transactions = await db
            .select({ count: count() })
            .from(schema.cashboxTransactions)
            .where(eq(schema.cashboxTransactions.cashboxId, cashbox.id));
          
          const transactionCount = transactions[0]?.count || 0;
          
          if (transactionCount > 0) {
            console.log(`[getCompanyCashboxesWithTransactions] Caja ${cashbox.id} tiene ${transactionCount} transacciones`);
            
            // Obtener información del operador
            let operatorInfo = null;
            if (cashbox.operatorId) {
              try {
                const operator = await this.getUserById(cashbox.operatorId);
                if (operator) {
                  operatorInfo = {
                    id: operator.id,
                    name: `${operator.firstName} ${operator.lastName}`,
                    email: operator.email
                  };
                }
              } catch (err) {
                console.error(`Error al obtener operador de caja ${cashbox.id}:`, err);
              }
            }
            
            result.push({
              ...cashbox,
              operatorInfo,
              transactionsCount: transactionCount
            });
          }
        } catch (err) {
          console.error(`Error al procesar la caja ${cashbox.id}:`, err);
        }
      }
      
      console.log(`[getCompanyCashboxesWithTransactions] Se encontraron ${result.length} cajas con transacciones para la compañía ${companyId}`);
      return result;
    } catch (error) {
      console.error(`[getCompanyCashboxesWithTransactions] Error:`, error);
      return [];
    }
  }
  
  // Obtener todas las cajas de una compañía
  async getCashboxes(companyId: string): Promise<schema.Cashbox[]> {
    try {
      console.log(`[getCashboxes] Obteniendo cajas para la compañía ${companyId}`);
      
      const cashboxes = await db
        .select()
        .from(schema.cashboxes)
        .where(eq(schema.cashboxes.companyId, companyId))
        .orderBy(desc(schema.cashboxes.createdAt));
      
      console.log(`[getCashboxes] Se encontraron ${cashboxes.length} cajas para la compañía ${companyId}`);
      return cashboxes;
    } catch (error) {
      console.error(`[getCashboxes] Error al obtener cajas para compañía ${companyId}:`, error);
      return [];
    }
  }
  
  // Obtener una caja específica por ID
  async getCashbox(id: number): Promise<schema.Cashbox | undefined> {
    try {
      console.log(`[getCashbox] Buscando caja con ID ${id}`);
      
      const [cashbox] = await db
        .select()
        .from(schema.cashboxes)
        .where(eq(schema.cashboxes.id, id));
      
      if (!cashbox) {
        console.log(`[getCashbox] No se encontró la caja con ID ${id}`);
        return undefined;
      }
      
      console.log(`[getCashbox] Caja encontrada: ${cashbox.name} (ID: ${cashbox.id})`);
      return cashbox;
    } catch (error) {
      console.error(`[getCashbox] Error al buscar caja con ID ${id}:`, error);
      return undefined;
    }
  }
  
  // Crear una nueva caja
  async createCashbox(cashbox: schema.InsertCashbox): Promise<schema.Cashbox> {
    try {
      console.log(`[createCashbox] Creando nueva caja "${cashbox.name}" para operador ${cashbox.operatorId}`);
      
      const [newCashbox] = await db
        .insert(schema.cashboxes)
        .values({
          ...cashbox,
          createdAt: cashbox.createdAt || new Date(),
          balance: cashbox.balance || 0,
          isActive: cashbox.isActive === undefined ? true : cashbox.isActive
        })
        .returning();
      
      console.log(`[createCashbox] Caja creada con ID ${newCashbox.id}`);
      return newCashbox;
    } catch (error) {
      console.error(`[createCashbox] Error al crear caja:`, error);
      throw new Error(`Error al crear caja: ${error}`);
    }
  }
  
  // Actualizar una caja
  async updateCashbox(id: number, update: Partial<schema.Cashbox>): Promise<schema.Cashbox | undefined> {
    try {
      console.log(`[updateCashbox] Actualizando caja con ID ${id}`);
      
      const [updatedCashbox] = await db
        .update(schema.cashboxes)
        .set({
          ...update,
          updatedAt: new Date()
        })
        .where(eq(schema.cashboxes.id, id))
        .returning();
      
      if (!updatedCashbox) {
        console.log(`[updateCashbox] No se encontró la caja con ID ${id}`);
        return undefined;
      }
      
      console.log(`[updateCashbox] Caja actualizada: ${updatedCashbox.name} (ID: ${updatedCashbox.id})`);
      return updatedCashbox;
    } catch (error) {
      console.error(`[updateCashbox] Error al actualizar caja con ID ${id}:`, error);
      return undefined;
    }
  }
  
  // Obtener transacciones de una caja
  async getCashboxTransactions(
    cashboxId: number, 
    filters?: { 
      startDate?: Date; 
      endDate?: Date;
      type?: string;
      source?: string;
    }
  ): Promise<schema.CashboxTransaction[]> {
    try {
      console.log(`[getCashboxTransactions] Obteniendo transacciones para caja ${cashboxId} con filtros:`, filters);
      
      let query = db
        .select()
        .from(schema.cashboxTransactions)
        .where(eq(schema.cashboxTransactions.cashboxId, cashboxId));
      
      // Aplicar filtros si existen
      if (filters) {
        if (filters.startDate) {
          query = query.where(gte(schema.cashboxTransactions.createdAt, filters.startDate));
        }
        
        if (filters.endDate) {
          query = query.where(lte(schema.cashboxTransactions.createdAt, filters.endDate));
        }
        
        if (filters.type) {
          query = query.where(eq(schema.cashboxTransactions.type, filters.type));
        }
        
        if (filters.source) {
          query = query.where(eq(schema.cashboxTransactions.source, filters.source));
        }
      }
      
      // Ordenar por fecha de creación descendente (más recientes primero)
      const transactions = await query.orderBy(desc(schema.cashboxTransactions.createdAt));
      
      console.log(`[getCashboxTransactions] Se encontraron ${transactions.length} transacciones para la caja ${cashboxId}`);
      return transactions;
    } catch (error) {
      console.error(`[getCashboxTransactions] Error al obtener transacciones para caja ${cashboxId}:`, error);
      return [];
    }
  }
  
  // Crear una nueva transacción de caja
  async createCashboxTransaction(transaction: schema.InsertCashboxTransaction): Promise<schema.CashboxTransaction> {
    try {
      console.log(`[createCashboxTransaction] Creando nueva transacción para caja ${transaction.cashboxId}`);
      
      // Iniciar transacción en BD para operación atómica
      return await db.transaction(async (tx) => {
        // 1. Insertar la transacción
        const [newTransaction] = await tx
          .insert(schema.cashboxTransactions)
          .values({
            ...transaction,
            createdAt: transaction.createdAt || new Date()
          })
          .returning();
        
        // 2. Actualizar el saldo de la caja
        const cashbox = await tx
          .select()
          .from(schema.cashboxes)
          .where(eq(schema.cashboxes.id, transaction.cashboxId));
        
        if (!cashbox.length) {
          throw new Error(`No se encontró la caja con ID ${transaction.cashboxId}`);
        }
        
        const currentCashbox = cashbox[0];
        let newBalance = currentCashbox.balance;
        
        // Calcular nuevo saldo según el tipo de transacción
        if (transaction.type === schema.TransactionType.INCOME) {
          newBalance += transaction.amount;
        } else if (transaction.type === schema.TransactionType.EXPENSE || 
                   transaction.type === schema.TransactionType.WITHDRAW) {
          newBalance -= transaction.amount;
        }
        
        // Actualizar el saldo de la caja
        await tx
          .update(schema.cashboxes)
          .set({ 
            balance: newBalance,
            updatedAt: new Date()
          })
          .where(eq(schema.cashboxes.id, transaction.cashboxId));
        
        console.log(`[createCashboxTransaction] Transacción creada con ID ${newTransaction.id}. Nuevo saldo: ${newBalance}`);
        return newTransaction;
      });
    } catch (error) {
      console.error(`[createCashboxTransaction] Error al crear transacción:`, error);
      throw new Error(`Error al crear transacción: ${error}`);
    }
  }
  
  // Registrar pago de reservación en caja
  async registerReservationPayment(
    reservationId: number, 
    userId: number, 
    amount: number, 
    paymentMethod: string
  ): Promise<{ success: boolean; transaction?: schema.CashboxTransaction; message: string }> {
    try {
      console.log(`[registerReservationPayment] Registrando pago de reservación ${reservationId} por $${amount}`);
      
      // 1. Verificar que la reservación existe
      const reservation = await this.getReservation(reservationId);
      if (!reservation) {
        return { 
          success: false, 
          message: `No se encontró la reservación con ID ${reservationId}` 
        };
      }
      
      // 2. Obtener la compañía del usuario
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId));
      
      if (!user) {
        return { 
          success: false, 
          message: `No se encontró el usuario con ID ${userId}` 
        };
      }
      
      const companyId = user.companyId || user.company;
      if (!companyId) {
        return { 
          success: false, 
          message: `El usuario no tiene una compañía asignada` 
        };
      }
      
      // 3. Obtener o crear la caja del usuario
      const userCashbox = await this.getUserCashbox(userId, companyId);
      if (!userCashbox) {
        return { 
          success: false, 
          message: `No se pudo obtener o crear una caja para el usuario` 
        };
      }
      
      // 4. Crear la transacción en la caja
      const transaction: schema.InsertCashboxTransaction = {
        cashboxId: userCashbox.id,
        type: schema.TransactionType.INCOME,
        source: schema.TransactionSource.RESERVATION,
        amount,
        description: `Pago de reservación #${reservationId}`,
        createdBy: userId,
        sourceId: reservationId,
        paymentMethod
      };
      
      const newTransaction = await this.createCashboxTransaction(transaction);
      
      console.log(`[registerReservationPayment] Pago registrado en caja. Transacción ID: ${newTransaction.id}`);
      return { 
        success: true, 
        transaction: newTransaction,
        message: `Pago registrado correctamente en la caja` 
      };
    } catch (error) {
      console.error(`[registerReservationPayment] Error al registrar pago:`, error);
      return { 
        success: false, 
        message: `Error al registrar el pago: ${error}` 
      };
    }
  }
  
  // Registrar pago de paquetería en caja
  async registerPackagePayment(
    packageId: number, 
    userId: number, 
    amount: number, 
    paymentMethod: string
  ): Promise<{ success: boolean; transaction?: schema.CashboxTransaction; message: string }> {
    try {
      console.log(`[registerPackagePayment] Registrando pago de paquetería ${packageId} por $${amount}`);
      
      // 1. Verificar que la paquetería existe
      const pkg = await this.getPackage(packageId);
      if (!pkg) {
        return { 
          success: false, 
          message: `No se encontró la paquetería con ID ${packageId}` 
        };
      }
      
      // 2. Obtener la compañía del usuario
      const [user] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userId));
      
      if (!user) {
        return { 
          success: false, 
          message: `No se encontró el usuario con ID ${userId}` 
        };
      }
      
      const companyId = user.companyId || user.company;
      if (!companyId) {
        return { 
          success: false, 
          message: `El usuario no tiene una compañía asignada` 
        };
      }
      
      // 3. Obtener o crear la caja del usuario
      const userCashbox = await this.getUserCashbox(userId, companyId);
      if (!userCashbox) {
        return { 
          success: false, 
          message: `No se pudo obtener o crear una caja para el usuario` 
        };
      }
      
      // 4. Crear la transacción en la caja
      const transaction: schema.InsertCashboxTransaction = {
        cashboxId: userCashbox.id,
        type: schema.TransactionType.INCOME,
        source: schema.TransactionSource.PACKAGE,
        amount,
        description: `Pago de paquetería #${packageId}`,
        createdBy: userId,
        sourceId: packageId,
        paymentMethod
      };
      
      const newTransaction = await this.createCashboxTransaction(transaction);
      
      console.log(`[registerPackagePayment] Pago registrado en caja. Transacción ID: ${newTransaction.id}`);
      return { 
        success: true, 
        transaction: newTransaction,
        message: `Pago registrado correctamente en la caja` 
      };
    } catch (error) {
      console.error(`[registerPackagePayment] Error al registrar pago:`, error);
      return { 
        success: false, 
        message: `Error al registrar el pago: ${error}` 
      };
    }
  }
  
  // Obtener cortes de caja
  async getCashboxCutoffs(cashboxId: number): Promise<schema.CashboxCutoff[]> {
    try {
      console.log(`[getCashboxCutoffs] Obteniendo cortes para caja ${cashboxId}`);
      
      const cutoffs = await db
        .select()
        .from(schema.cashboxCutoffs)
        .where(eq(schema.cashboxCutoffs.cashboxId, cashboxId))
        .orderBy(desc(schema.cashboxCutoffs.createdAt));
      
      console.log(`[getCashboxCutoffs] Se encontraron ${cutoffs.length} cortes para la caja ${cashboxId}`);
      return cutoffs;
    } catch (error) {
      console.error(`[getCashboxCutoffs] Error al obtener cortes para caja ${cashboxId}:`, error);
      return [];
    }
  }
  
  // Obtener un corte específico
  async getCashboxCutoff(id: number): Promise<schema.CashboxCutoff | undefined> {
    try {
      console.log(`[getCashboxCutoff] Buscando corte con ID ${id}`);
      
      const [cutoff] = await db
        .select()
        .from(schema.cashboxCutoffs)
        .where(eq(schema.cashboxCutoffs.id, id));
      
      if (!cutoff) {
        console.log(`[getCashboxCutoff] No se encontró el corte con ID ${id}`);
        return undefined;
      }
      
      console.log(`[getCashboxCutoff] Corte encontrado con ID ${cutoff.id}`);
      return cutoff;
    } catch (error) {
      console.error(`[getCashboxCutoff] Error al buscar corte con ID ${id}:`, error);
      return undefined;
    }
  }
  
  // Realizar un corte de caja
  async createCashboxCutoff(
    userId: number, 
    cashboxId: number, 
    notes?: string
  ): Promise<{ success: boolean; cutoff?: schema.CashboxCutoff; message: string }> {
    try {
      console.log(`[createCashboxCutoff] Realizando corte de caja para caja ${cashboxId} por usuario ${userId}`);
      
      // Iniciar transacción en BD para operación atómica
      return await db.transaction(async (tx) => {
        // 1. Verificar que la caja existe
        const [cashbox] = await tx
          .select()
          .from(schema.cashboxes)
          .where(eq(schema.cashboxes.id, cashboxId));
        
        if (!cashbox) {
          return { 
            success: false, 
            message: `No se encontró la caja con ID ${cashboxId}` 
          };
        }
        
        // 2. Obtener transacciones desde el último corte
        const lastCutoff = await tx
          .select()
          .from(schema.cashboxCutoffs)
          .where(eq(schema.cashboxCutoffs.cashboxId, cashboxId))
          .orderBy(desc(schema.cashboxCutoffs.createdAt))
          .limit(1);
        
        let lastCutoffDate = cashbox.lastCutoffAt || cashbox.createdAt;
        if (lastCutoff.length > 0) {
          lastCutoffDate = lastCutoff[0].createdAt;
        }
        
        // 3. Obtener transacciones desde el último corte
        const transactions = await tx
          .select()
          .from(schema.cashboxTransactions)
          .where(
            and(
              eq(schema.cashboxTransactions.cashboxId, cashboxId),
              gte(schema.cashboxTransactions.createdAt, lastCutoffDate),
              isNull(schema.cashboxTransactions.cutoffId)
            )
          );
        
        console.log(`[createCashboxCutoff] Se encontraron ${transactions.length} transacciones sin procesar`);
        
        // 4. Calcular totales
        let totalIncome = 0;
        let totalExpenses = 0;
        
        for (const transaction of transactions) {
          if (transaction.type === schema.TransactionType.INCOME) {
            totalIncome += transaction.amount;
          } else if (transaction.type === schema.TransactionType.EXPENSE || 
                     transaction.type === schema.TransactionType.WITHDRAW) {
            totalExpenses += transaction.amount;
          }
        }
        
        // 5. Crear el corte
        const [newCutoff] = await tx
          .insert(schema.cashboxCutoffs)
          .values({
            cashboxId,
            operatorId: userId,
            previousBalance: cashbox.balance,
            totalIncome,
            totalExpenses,
            finalBalance: cashbox.balance,
            notes: notes || '',
            createdAt: new Date()
          })
          .returning();
        
        // 6. Actualizar las transacciones con el ID del corte
        for (const transaction of transactions) {
          await tx
            .update(schema.cashboxTransactions)
            .set({ cutoffId: newCutoff.id })
            .where(eq(schema.cashboxTransactions.id, transaction.id));
        }
        
        // 7. Actualizar la caja con el nuevo saldo y fecha de último corte
        await tx
          .update(schema.cashboxes)
          .set({ 
            lastCutoffAt: newCutoff.createdAt,
            updatedAt: new Date(),
            balance: 0  // Reiniciar saldo a 0 después del corte
          })
          .where(eq(schema.cashboxes.id, cashboxId));
        
        // 8. Crear una transacción de retiro con el saldo final
        if (cashbox.balance > 0) {
          await tx
            .insert(schema.cashboxTransactions)
            .values({
              cashboxId,
              type: schema.TransactionType.WITHDRAW,
              source: schema.TransactionSource.MANUAL,
              amount: cashbox.balance,
              description: `Retiro por corte de caja #${newCutoff.id}`,
              createdBy: userId,
              createdAt: new Date(),
              cutoffId: newCutoff.id
            });
        }
        
        console.log(`[createCashboxCutoff] Corte realizado con ID ${newCutoff.id}`);
        return { 
          success: true, 
          cutoff: newCutoff,
          message: `Corte de caja realizado correctamente` 
        };
      });
    } catch (error) {
      console.error(`[createCashboxCutoff] Error al realizar corte:`, error);
      return { 
        success: false, 
        message: `Error al realizar el corte: ${error}` 
      };
    }
  }
  
  async checkReservationTransferPermission(reservationId: number, userId: number): Promise<boolean> {
    try {
      console.log(`[checkReservationTransferPermission] Verificando permisos de transferencia para reserva ${reservationId} y usuario ${userId}`);
      
      // Si el usuario no está autenticado, no tiene permiso
      if (!userId) {
        console.log(`[checkReservationTransferPermission] Sin usuario autenticado`);
        return false;
      }
      
      // Obtener usuario para verificar su compañía
      const user = await this.getUserById(userId);
      if (!user) {
        console.log(`[checkReservationTransferPermission] Usuario ${userId} no encontrado`);
        return false;
      }
      
      const userCompanyId = user.company || user.companyId;
      if (!userCompanyId) {
        console.log(`[checkReservationTransferPermission] Usuario ${userId} sin compañía asignada`);
        return false;
      }
      
      // Obtener todas las notificaciones de transferencia para el usuario
      const notifications = await db
        .select()
        .from(schema.notifications)
        .where(
          and(
            eq(schema.notifications.userId, userId),
            eq(schema.notifications.type, 'transfer')
          )
        );
      
      console.log(`[checkReservationTransferPermission] Encontradas ${notifications.length} notificaciones de transferencia para el usuario ${userId}`);
      
      // Verificar en cada notificación si contiene el ID de la reservación en metaData
      for (const notification of notifications) {
        if (notification.metaData) {
          try {
            const transferData = JSON.parse(notification.metaData);
            
            if (transferData.reservationIds && Array.isArray(transferData.reservationIds)) {
              if (transferData.reservationIds.includes(reservationId)) {
                console.log(`[checkReservationTransferPermission] Permiso concedido: Reserva ${reservationId} transferida al usuario ${userId}`);
                return true;
              }
            }
          } catch (error) {
            console.error(`[checkReservationTransferPermission] Error al parsear metaData:`, error);
            // Continuar con la siguiente notificación si hay error
          }
        }
      }
      
      console.log(`[checkReservationTransferPermission] Permiso denegado: Reserva ${reservationId} no transferida al usuario ${userId}`);
      return false;
    } catch (error) {
      console.error(`[checkReservationTransferPermission] Error:`, error);
      return false;
    }
  }
  
  // Obtener cajas de la compañía que tienen transacciones
  async getCashboxesWithTransactions(companyId: string): Promise<any[]> {
    try {
      console.log(`[getCashboxesWithTransactions] Buscando cajas con transacciones para la compañía ${companyId}`);
      
      // Primero obtenemos todas las cajas de la compañía
      const cashboxes = await db
        .select()
        .from(schema.cashboxes)
        .where(eq(schema.cashboxes.companyId, companyId));
      
      // Resultado final: cajas con información adicional y solo las que tienen transacciones
      const result = [];
      
      // Para cada caja, verificamos si tiene transacciones
      for (const cashbox of cashboxes) {
        // Obtener transacciones de la caja
        const transactions = await db
          .select()
          .from(schema.cashboxTransactions)
          .where(eq(schema.cashboxTransactions.cashboxId, cashbox.id));
        
        // Solo incluimos las cajas que tienen transacciones
        if (transactions.length > 0) {
          // Obtenemos información del operador de la caja
          const [operator] = await db
            .select()
            .from(schema.users)
            .where(eq(schema.users.id, cashbox.operatorId));
          
          // Agregar la caja al resultado con información adicional
          result.push({
            ...cashbox,
            operator: operator ? {
              id: operator.id,
              name: `${operator.firstName} ${operator.lastName}`,
              role: operator.role
            } : null,
            transactionCount: transactions.length,
            lastTransaction: transactions.sort((a, b) => 
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            )[0]
          });
        }
      }
      
      console.log(`[getCashboxesWithTransactions] Se encontraron ${result.length} cajas con transacciones`);
      return result;
    } catch (error) {
      console.error(`[getCashboxesWithTransactions] Error:`, error);
      return [];
    }
  }
  
  // Métodos para la tabla de transacciones
  async createTransaccion(transaccionData: schema.InsertTransaccion): Promise<schema.Transaccion> {
    try {
      console.log(`[createTransaccion] Creando nueva transacción para usuario ${transaccionData.usuario_id}`);
      
      if (!transaccionData.detalles) {
        console.error('[createTransaccion] Error: detalles es requerido');
        throw new Error('Error al crear transacción: detalles (details) es requerido');
      }
      
      // Guardar la transacción en la base de datos
      // Usamos directamente el schema.transacciones con los nombres de campos correctos
      const [newTransaccion] = await db
        .insert(schema.transacciones)
        .values({
          detalles: transaccionData.detalles,
          usuario_id: transaccionData.usuario_id,
          id_corte: transaccionData.id_corte,
          companyId: transaccionData.companyId, // Añadimos el ID de la compañía
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      console.log(`[createTransaccion] Transacción creada con ID: ${newTransaccion.id}, CompanyId: ${transaccionData.companyId || 'No especificado'}`);
      return newTransaccion;
    } catch (error) {
      console.error('[createTransaccion] Error al crear transacción:', error);
      throw new Error(`Error al crear transacción: ${error}`);
    }
  }
  
  async getTransacciones(filters?: { usuario_id?: number, id_corte?: number | null }): Promise<schema.Transaccion[]> {
    try {
      let query = db.select().from(schema.transacciones);
      
      // Filtrar por usuario_id para mostrar solo las transacciones del usuario actual
      if (filters?.usuario_id) {
        query = query.where(eq(schema.transacciones.usuario_id, filters.usuario_id));
      }
      
      // Manejar el filtro de id_corte de manera especial para valores null
      if (filters?.id_corte === null) {
        // Usar isNull para filtrar cuando id_corte es null
        query = query.where(isNull(schema.transacciones.id_corte));
        console.log(`[getTransacciones] Filtrando transacciones con id_corte NULL`);
      } else if (filters?.id_corte) {
        // Filtro normal para valores no nulos
        query = query.where(eq(schema.transacciones.id_corte, filters.id_corte));
        console.log(`[getTransacciones] Filtrando transacciones con id_corte: ${filters.id_corte}`);
      }
      
      // Ordenar por fecha de creación descendente (más recientes primero)
      query = query.orderBy(desc(schema.transacciones.createdAt));
      
      const transacciones = await query;
      console.log(`[getTransacciones] Se encontraron ${transacciones.length} transacciones`);
      return transacciones;
    } catch (error) {
      console.error('[getTransacciones] Error al obtener transacciones:', error);
      return [];
    }
  }
}