import { db } from "./db";
import { 
  tripMasters, 
  tripSegments, 
  routes, 
  vehicles, 
  users,
  TripMaster,
  TripSegment
} from "@shared/schema";
import { eq, and, gte, lte, or, sql } from "drizzle-orm";

/**
 * Clase para gestionar almacenamiento optimizado de viajes
 * Reduce drásticamente la cantidad de registros en la base de datos
 */
export class OptimizedTripStorage {
  /**
   * Obtiene la secuencia de paradas de una ruta
   * @param routeId ID de la ruta
   * @returns Arreglo con la secuencia de paradas (origen, paradas intermedias, destino)
   */
  async getRouteStopSequence(routeId: number): Promise<string[]> {
    const routeData = await db.query.routes.findFirst({
      where: eq(routes.id, routeId)
    });
    
    if (!routeData) {
      throw new Error(`Ruta con ID ${routeId} no encontrada`);
    }
    
    return [routeData.origin, ...routeData.stops, routeData.destination];
  }
  
  /**
   * Crea un viaje optimizado con sus segmentos
   * @param tripData Datos del viaje principal
   * @param segments Segmentos del viaje
   * @returns Viaje creado con sus segmentos
   */
  async createTrip(
    tripData: Omit<TripMaster, "id">, 
    segments: Omit<TripSegment, "id">[]
  ): Promise<TripMaster & { segments: TripSegment[] }> {
    // Insertar el viaje principal (master)
    const [tripMaster] = await db.insert(tripMasters).values(tripData).returning();
    
    // Insertar segmentos con el ID del viaje principal
    const createdSegments = [];
    
    for (const segment of segments) {
      const segmentWithMasterId = {
        ...segment,
        tripMasterId: tripMaster.id
      };
      
      const [createdSegment] = await db.insert(tripSegments)
        .values(segmentWithMasterId)
        .returning();
      
      createdSegments.push(createdSegment);
    }
    
    // Devolver el viaje con sus segmentos
    return {
      ...tripMaster,
      segments: createdSegments
    };
  }
  
  /**
   * Obtiene un viaje optimizado con sus segmentos
   * @param tripId ID del viaje
   * @returns Viaje con todos sus segmentos
   */
  async getTripWithSegments(tripId: number): Promise<TripMaster & { segments: TripSegment[], route?: any }> {
    // Obtener el viaje principal
    const tripMaster = await db.query.tripMasters.findFirst({
      where: eq(tripMasters.id, tripId)
    });
    
    if (!tripMaster) {
      throw new Error(`Viaje con ID ${tripId} no encontrado`);
    }
    
    // Obtener todos los segmentos del viaje
    const segments = await db.query.tripSegments.findMany({
      where: eq(tripSegments.tripMasterId, tripId)
    });
    
    // Obtener información de la ruta
    const routeInfo = await db.query.routes.findFirst({
      where: eq(routes.id, tripMaster.routeId)
    });
    
    return {
      ...tripMaster,
      segments,
      route: routeInfo || undefined
    };
  }
  
  /**
   * Obtiene todos los viajes según los filtros especificados
   * @param filters Filtros para los viajes (compañía, fecha, ruta)
   * @returns Lista de viajes filtrados
   */
  async getTrips(filters: { 
    companyId?: string; 
    startDate?: Date; 
    endDate?: Date; 
    routeId?: number;
    archived?: boolean;
  } = {}): Promise<TripMaster[]> {
    // Construir condiciones de búsqueda
    const conditions = [];
    
    if (filters.companyId) {
      conditions.push(eq(tripMasters.companyId, filters.companyId));
    }
    
    if (filters.routeId) {
      conditions.push(eq(tripMasters.routeId, filters.routeId));
    }
    
    if (filters.startDate) {
      conditions.push(gte(tripMasters.departureDate, filters.startDate));
    }
    
    if (filters.endDate) {
      conditions.push(lte(tripMasters.departureDate, filters.endDate));
    }
    
    if (filters.archived !== undefined) {
      conditions.push(eq(tripMasters.archived, filters.archived));
    }
    
    // Ejecutar la consulta con los filtros
    let query = db.select().from(tripMasters);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    // Ordenar por fecha de salida (más reciente primero)
    query = query.orderBy(tripMasters.departureDate);
    
    return await query;
  }
  
  /**
   * Actualiza un viaje con nueva información
   * @param tripId ID del viaje a actualizar
   * @param tripData Datos actualizados
   * @returns Viaje actualizado
   */
  async updateTrip(tripId: number, tripData: Partial<TripMaster>): Promise<TripMaster> {
    const [updatedTrip] = await db.update(tripMasters)
      .set(tripData)
      .where(eq(tripMasters.id, tripId))
      .returning();
    
    if (!updatedTrip) {
      throw new Error(`No se pudo actualizar el viaje con ID ${tripId}`);
    }
    
    return updatedTrip;
  }
  
  /**
   * Elimina un viaje y todos sus segmentos
   * @param tripId ID del viaje a eliminar
   * @returns true si se eliminó correctamente
   */
  async deleteTrip(tripId: number): Promise<boolean> {
    // Primero eliminar todos los segmentos
    await db.delete(tripSegments)
      .where(eq(tripSegments.tripMasterId, tripId));
    
    // Luego eliminar el viaje principal
    const result = await db.delete(tripMasters)
      .where(eq(tripMasters.id, tripId));
    
    return result.rowCount > 0;
  }
  
  /**
   * Archivar un viaje (marcarlo como completado)
   * @param tripId ID del viaje a archivar
   * @returns Viaje archivado
   */
  async archiveTrip(tripId: number): Promise<TripMaster> {
    const [archivedTrip] = await db.update(tripMasters)
      .set({ archived: true })
      .where(eq(tripMasters.id, tripId))
      .returning();
    
    if (!archivedTrip) {
      throw new Error(`No se pudo archivar el viaje con ID ${tripId}`);
    }
    
    return archivedTrip;
  }
  
  /**
   * Actualiza la disponibilidad de asientos de un viaje
   * @param tripId ID del viaje
   * @param availableSeats Cantidad de asientos disponibles
   * @returns Viaje actualizado
   */
  async updateAvailableSeats(tripId: number, availableSeats: number): Promise<TripMaster> {
    const [updatedTrip] = await db.update(tripMasters)
      .set({ availableSeats })
      .where(eq(tripMasters.id, tripId))
      .returning();
    
    if (!updatedTrip) {
      throw new Error(`No se pudo actualizar la disponibilidad del viaje con ID ${tripId}`);
    }
    
    return updatedTrip;
  }
  
  /**
   * Reduce la disponibilidad de asientos del viaje y todos los segmentos afectados
   * @param tripId ID del viaje
   * @param originStopIndex Índice de la parada de origen
   * @param destinationStopIndex Índice de la parada de destino
   * @param seats Número de asientos a reducir
   */
  async reduceAvailableSeats(
    tripId: number, 
    originStopIndex: number, 
    destinationStopIndex: number, 
    seats: number = 1
  ): Promise<void> {
    // Obtener el viaje
    const trip = await db.query.tripMasters.findFirst({
      where: eq(tripMasters.id, tripId)
    });
    
    if (!trip) {
      throw new Error(`Viaje con ID ${tripId} no encontrado`);
    }
    
    // Actualizar asientos disponibles del viaje principal
    await db.update(tripMasters)
      .set({ 
        availableSeats: Math.max(0, (trip.availableSeats || 0) - seats) 
      })
      .where(eq(tripMasters.id, tripId));
    
    // En una implementación real, actualizaríamos la disponibilidad de cada segmento afectado
    // basándonos en los índices de origen y destino
  }
  
  /**
   * Asigna un vehículo y/o conductor a un viaje
   * @param tripId ID del viaje
   * @param vehicleId ID del vehículo (opcional)
   * @param driverId ID del conductor (opcional)
   * @returns Viaje actualizado
   */
  async assignVehicleAndDriver(
    tripId: number, 
    vehicleId?: number | null, 
    driverId?: number | null
  ): Promise<TripMaster> {
    const updateData: Partial<TripMaster> = {};
    
    if (vehicleId !== undefined) {
      updateData.vehicleId = vehicleId;
    }
    
    if (driverId !== undefined) {
      updateData.driverId = driverId;
    }
    
    const [updatedTrip] = await db.update(tripMasters)
      .set(updateData)
      .where(eq(tripMasters.id, tripId))
      .returning();
    
    if (!updatedTrip) {
      throw new Error(`No se pudo actualizar el viaje con ID ${tripId}`);
    }
    
    return updatedTrip;
  }
}

// Instancia única para usar en la aplicación
export const optimizedTripStorage = new OptimizedTripStorage();