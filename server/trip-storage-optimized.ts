import { db } from "./db";
import { eq, and, gte, lte, or, inArray } from "drizzle-orm";
import { tripMasters, tripSegments, routes, type TripMaster, type TripSegment, type InsertTripMaster, type InsertTripSegment } from "@shared/schema";

/**
 * Clase para manejar el almacenamiento optimizado de viajes
 * Esta implementación reduce la cantidad de registros necesarios para representar un viaje completo
 */
export class OptimizedTripStorage {
  /**
   * Crea un nuevo viaje principal con sus segmentos
   */
  async createTrip(tripData: InsertTripMaster, segments: InsertTripSegment[]): Promise<TripMaster> {
    // Iniciar transacción
    const result = await db.transaction(async (tx) => {
      // Crear el viaje principal
      const [tripMaster] = await tx
        .insert(tripMasters)
        .values(tripData)
        .returning();

      if (!tripMaster) {
        throw new Error("Error al crear el viaje principal");
      }

      // Crear los segmentos del viaje
      const segmentsWithMasterId = segments.map(segment => ({
        ...segment,
        tripMasterId: tripMaster.id
      }));

      await tx
        .insert(tripSegments)
        .values(segmentsWithMasterId);

      return tripMaster;
    });

    return result;
  }

  /**
   * Obtiene un viaje principal con todos sus segmentos
   */
  async getTripWithSegments(tripMasterId: number): Promise<TripMaster & { segments: TripSegment[] }> {
    const tripMaster = await db.query.tripMasters.findFirst({
      where: eq(tripMasters.id, tripMasterId),
    });

    if (!tripMaster) {
      throw new Error(`Viaje con ID ${tripMasterId} no encontrado`);
    }

    const segments = await db.query.tripSegments.findMany({
      where: eq(tripSegments.tripMasterId, tripMasterId),
    });

    return {
      ...tripMaster,
      segments
    };
  }

  /**
   * Obtiene todos los viajes principales filtrados por compañía
   */
  async getTrips(filters: {
    companyId?: string;
    startDate?: Date;
    endDate?: Date;
    routeId?: number;
  } = {}): Promise<TripMaster[]> {
    const conditions = [];

    if (filters.companyId) {
      conditions.push(eq(tripMasters.companyId, filters.companyId));
    }

    if (filters.startDate) {
      conditions.push(gte(tripMasters.departureDate, filters.startDate));
    }

    if (filters.endDate) {
      conditions.push(lte(tripMasters.departureDate, filters.endDate));
    }

    if (filters.routeId) {
      conditions.push(eq(tripMasters.routeId, filters.routeId));
    }

    const query = conditions.length > 0
      ? db.select().from(tripMasters).where(and(...conditions))
      : db.select().from(tripMasters);

    return await query;
  }

  /**
   * Obtiene un segmento específico de viaje
   */
  async getSegment(origin: string, destination: string, tripMasterId: number): Promise<TripSegment | undefined> {
    const [segment] = await db
      .select()
      .from(tripSegments)
      .where(
        and(
          eq(tripSegments.tripMasterId, tripMasterId),
          eq(tripSegments.origin, origin),
          eq(tripSegments.destination, destination)
        )
      );

    return segment;
  }

  /**
   * Actualiza la disponibilidad de asientos en un viaje
   */
  async updateAvailableSeats(tripMasterId: number, availableSeats: number): Promise<void> {
    await db
      .update(tripMasters)
      .set({ availableSeats })
      .where(eq(tripMasters.id, tripMasterId));
  }

  /**
   * Elimina un viaje y todos sus segmentos (los segmentos se eliminan automáticamente por la restricción ON DELETE CASCADE)
   */
  async deleteTrip(tripMasterId: number): Promise<void> {
    await db
      .delete(tripMasters)
      .where(eq(tripMasters.id, tripMasterId));
  }

  /**
   * Calcula la disponibilidad de asientos para un segmento específico
   * basado en todas las reservaciones que lo afectan
   */
  async getAvailableSeatsForSegment(
    tripMasterId: number, 
    originStopIndex: number, 
    destinationStopIndex: number
  ): Promise<number> {
    // Obtener el viaje principal para conocer la capacidad total
    const tripMaster = await db.query.tripMasters.findFirst({
      where: eq(tripMasters.id, tripMasterId),
    });
    
    if (!tripMaster) {
      throw new Error(`Viaje con ID ${tripMasterId} no encontrado`);
    }
    
    // Esta función es un placeholder. En una implementación completa, buscaríamos
    // en la tabla de reservaciones cuántos asientos están ocupados por reservaciones
    // que afectan el segmento especificado (es decir, que incluyen ese segmento en su ruta)
    
    // Para una implementación completa, necesitaríamos obtener
    // las reservaciones y ver cuántas afectan a este segmento específico
    
    // Por ahora, devolvemos simplemente el número de asientos disponibles del viaje principal
    return tripMaster.availableSeats;
  }

  /**
   * Obtiene todos los segmentos de un viaje
   */
  async getTripSegments(tripMasterId: number): Promise<TripSegment[]> {
    return await db
      .select()
      .from(tripSegments)
      .where(eq(tripSegments.tripMasterId, tripMasterId));
  }

  /**
   * Construye todas las ubicaciones ordenadas (origen, paradas, destino) para una ruta
   */
  async getRouteStopSequence(routeId: number): Promise<string[]> {
    const route = await db.query.routes.findFirst({
      where: eq(routes.id, routeId),
    });
    
    if (!route) {
      throw new Error(`Ruta con ID ${routeId} no encontrada`);
    }
    
    return [route.origin, ...route.stops, route.destination];
  }
}

// Exportamos una instancia de la clase para usarla en las rutas
export const optimizedTripStorage = new OptimizedTripStorage();