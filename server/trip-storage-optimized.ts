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
import { eq, and, gte, lte, lt, gt, or, sql } from "drizzle-orm";

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
    
    // Obtener todos los segmentos afectados por la reservación
    // Un segmento está afectado si la reservación pasa por él
    // Es decir, si cualquier parte de la ruta reservada se superpone al segmento
    const affectedSegments = await db.query.tripSegments.findMany({
      where: and(
        eq(tripSegments.tripMasterId, tripId),
        // La lógica de superposición:
        // El segmento está afectado si:
        // 1. Su origen está dentro del rango de la reserva
        // 2. Su destino está dentro del rango de la reserva
        // 3. La reserva cubre completamente el segmento
        or(
          // Origen del segmento dentro del rango de la reserva
          and(
            gte(tripSegments.originStopIndex, originStopIndex),
            lt(tripSegments.originStopIndex, destinationStopIndex)
          ),
          // Destino del segmento dentro del rango de la reserva
          and(
            gt(tripSegments.destinationStopIndex, originStopIndex),
            lte(tripSegments.destinationStopIndex, destinationStopIndex)
          ),
          // La reserva cubre todo el segmento
          and(
            lte(tripSegments.originStopIndex, originStopIndex),
            gte(tripSegments.destinationStopIndex, destinationStopIndex)
          )
        )
      )
    });
    
    // Actualizar cada segmento afectado
    for (const segment of affectedSegments) {
      const currentAvailableSeats = segment.availableSeats !== null ? segment.availableSeats : trip.availableSeats;
      await db.update(tripSegments)
        .set({
          availableSeats: Math.max(0, currentAvailableSeats - seats)
        })
        .where(eq(tripSegments.id, segment.id));
    }
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
  
  /**
   * Calcula la disponibilidad de asientos para un segmento específico
   * @param tripId ID del viaje
   * @param originStopIndex Índice de parada de origen
   * @param destinationStopIndex Índice de parada de destino
   * @returns Número de asientos disponibles
   */
  async calculateSegmentAvailability(
    tripId: number,
    originStopIndex: number,
    destinationStopIndex: number
  ): Promise<number> {
    // Obtener el viaje principal
    const trip = await db.query.tripMasters.findFirst({
      where: eq(tripMasters.id, tripId)
    });
    
    if (!trip) {
      throw new Error(`Viaje con ID ${tripId} no encontrado`);
    }
    
    // Buscar segmentos directos que se superponen con el rango solicitado
    const overlappingSegments = await db.query.tripSegments.findMany({
      where: and(
        eq(tripSegments.tripMasterId, tripId),
        // Un segmento se superpone con el rango solicitado si:
        // 1. El origen del segmento está dentro del rango solicitado
        // 2. El destino del segmento está dentro del rango solicitado
        // 3. El segmento cubre completamente el rango solicitado
        or(
          // Origen del segmento dentro del rango solicitado
          and(
            gte(tripSegments.originStopIndex, originStopIndex),
            lt(tripSegments.originStopIndex, destinationStopIndex)
          ),
          // Destino del segmento dentro del rango solicitado
          and(
            gt(tripSegments.destinationStopIndex, originStopIndex),
            lte(tripSegments.destinationStopIndex, destinationStopIndex)
          ),
          // El segmento cubre completamente el rango solicitado
          and(
            lte(tripSegments.originStopIndex, originStopIndex),
            gte(tripSegments.destinationStopIndex, destinationStopIndex)
          )
        )
      )
    });
    
    // Si no hay segmentos superpuestos, usamos la disponibilidad del viaje principal
    if (overlappingSegments.length === 0) {
      return trip.availableSeats;
    }
    
    // Encontrar la menor disponibilidad entre todos los segmentos superpuestos
    let minAvailableSeats = trip.availableSeats;
    
    for (const segment of overlappingSegments) {
      // Si el segmento tiene un valor de disponibilidad específico, lo usamos
      // Si no, usamos la disponibilidad del viaje principal
      const segmentAvailability = segment.availableSeats !== null
        ? segment.availableSeats
        : trip.availableSeats;
      
      // Actualizar el mínimo
      minAvailableSeats = Math.min(minAvailableSeats, segmentAvailability);
    }
    
    return minAvailableSeats;
  }
}

// Instancia única para usar en la aplicación
export const optimizedTripStorage = new OptimizedTripStorage();