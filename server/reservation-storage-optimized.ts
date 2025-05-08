import { db } from "./db";
import { 
  reservations, 
  passengers, 
  tripMasters, 
  tripSegments, 
  routes,
  users,
  Reservation,
  Passenger,
  InsertReservation,
  InsertPassenger,
  PaymentStatus
} from "@shared/schema";
import { eq, and, gte, lte, or, sql, desc, asc, isNull, isNotNull, inArray } from "drizzle-orm";
import { optimizedTripStorage } from "./trip-storage-optimized";

/**
 * Clase para gestionar el almacenamiento optimizado de reservaciones
 * Adaptado al nuevo modelo de viajes con segmentos
 */
export class OptimizedReservationStorage {
  /**
   * Crea una nueva reservación para un viaje optimizado
   * @param reservationData Datos de la reservación
   * @param passengerData Datos de los pasajeros
   * @returns Reservación creada con sus pasajeros
   */
  async createReservation(
    reservationData: Omit<InsertReservation, "id">,
    passengerData: Omit<InsertPassenger, "id" | "reservationId">[]
  ): Promise<Reservation & { passengers: Passenger[] }> {
    // Obtener el viaje para verificar disponibilidad
    const trip = await db.query.tripMasters.findFirst({
      where: eq(tripMasters.id, reservationData.tripId)
    });
    
    if (!trip) {
      throw new Error(`Viaje con ID ${reservationData.tripId} no encontrado`);
    }
    
    // Verificar disponibilidad para el segmento solicitado
    if (reservationData.originStopIndex !== undefined && reservationData.destinationStopIndex !== undefined) {
      const availableSeats = await optimizedTripStorage.calculateSegmentAvailability(
        trip.id,
        reservationData.originStopIndex,
        reservationData.destinationStopIndex
      );
      
      // Verificar si hay suficientes asientos disponibles
      const requiredSeats = passengerData.length;
      if (availableSeats < requiredSeats) {
        throw new Error(`No hay suficientes asientos disponibles. Disponibles: ${availableSeats}, Requeridos: ${requiredSeats}`);
      }
      
      // Reducir la disponibilidad de asientos en el viaje y segmentos afectados
      await optimizedTripStorage.reduceAvailableSeats(
        trip.id,
        reservationData.originStopIndex,
        reservationData.destinationStopIndex,
        requiredSeats
      );
    }
    
    // Crear la reservación
    const [createdReservation] = await db.insert(reservations)
      .values(reservationData)
      .returning();
    
    // Crear los registros de pasajeros
    const createdPassengers = [];
    
    for (const passenger of passengerData) {
      const [createdPassenger] = await db.insert(passengers)
        .values({
          ...passenger,
          reservationId: createdReservation.id
        })
        .returning();
      
      createdPassengers.push(createdPassenger);
    }
    
    return {
      ...createdReservation,
      passengers: createdPassengers
    };
  }
  
  /**
   * Obtiene una reservación con todos sus detalles
   * @param reservationId ID de la reservación
   * @returns Reservación con detalles o null si no existe
   */
  async getReservationWithDetails(reservationId: number): Promise<any | null> {
    // Obtener la reservación
    const reservation = await db.query.reservations.findFirst({
      where: eq(reservations.id, reservationId)
    });
    
    if (!reservation) {
      return null;
    }
    
    // Obtener los pasajeros
    const passengersList = await db.query.passengers.findMany({
      where: eq(passengers.reservationId, reservationId)
    });
    
    // Obtener el viaje
    const trip = await db.query.tripMasters.findFirst({
      where: eq(tripMasters.id, reservation.tripId)
    });
    
    if (!trip) {
      throw new Error(`Viaje con ID ${reservation.tripId} no encontrado`);
    }
    
    // Obtener la ruta
    const route = await db.query.routes.findFirst({
      where: eq(routes.id, trip.routeId)
    });
    
    // Obtener usuario que creó la reservación
    let createdByUser = null;
    if (reservation.createdBy) {
      createdByUser = await db.query.users.findFirst({
        where: eq(users.id, reservation.createdBy)
      });
    }
    
    // Obtener usuario que marcó como pagado
    let paidByUser = null;
    if (reservation.paidBy) {
      paidByUser = await db.query.users.findFirst({
        where: eq(users.id, reservation.paidBy)
      });
    }
    
    // Obtener usuario que escaneó el ticket
    let checkedByUser = null;
    if (reservation.checkedBy) {
      checkedByUser = await db.query.users.findFirst({
        where: eq(users.id, reservation.checkedBy)
      });
    }
    
    // Construir la respuesta completa
    return {
      ...reservation,
      passengers: passengersList,
      trip: {
        ...trip,
        route
      },
      createdByUser,
      paidByUser,
      checkedByUser
    };
  }
  
  /**
   * Obtiene todas las reservaciones aplicando filtros
   * @param filters Filtros a aplicar (compañía, estado de pago, etc.)
   * @param tripId ID del viaje (opcional)
   * @returns Lista de reservaciones filtradas
   */
  async getReservations(
    filters: {
      companyId?: string;
      status?: string;
      paymentStatus?: string;
      startDate?: Date;
      endDate?: Date;
      createdBy?: number;
    } = {},
    tripId?: number
  ): Promise<Reservation[]> {
    // Construir condiciones de búsqueda
    const conditions = [];
    
    if (tripId) {
      conditions.push(eq(reservations.tripId, tripId));
    }
    
    if (filters.companyId) {
      conditions.push(eq(reservations.companyId, filters.companyId));
    }
    
    if (filters.status) {
      conditions.push(eq(reservations.status, filters.status));
    }
    
    if (filters.paymentStatus) {
      conditions.push(eq(reservations.paymentStatus, filters.paymentStatus));
    }
    
    if (filters.createdBy) {
      conditions.push(eq(reservations.createdBy, filters.createdBy));
    }
    
    if (filters.startDate || filters.endDate) {
      // Para filtrar por fecha, necesitamos unir con la tabla de viajes
      // Esto requiere una implementación más compleja usando SQL crudo
      // Para simplificar, recuperamos todas las reservaciones y filtramos después
      const allReservations = await db.select()
        .from(reservations)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      
      const tripIds = allReservations.map(r => r.tripId);
      
      // Obtener los viajes correspondientes
      const trips = await db.select()
        .from(tripMasters)
        .where(inArray(tripMasters.id, tripIds));
      
      // Filtrar por fecha
      const tripMap = new Map(trips.map(t => [t.id, t]));
      
      return allReservations.filter(r => {
        const trip = tripMap.get(r.tripId);
        if (!trip) return false;
        
        if (filters.startDate && trip.departureDate < filters.startDate) return false;
        if (filters.endDate && trip.departureDate > filters.endDate) return false;
        
        return true;
      });
    }
    
    // Consulta normal si no hay filtros de fecha
    let query = db.select().from(reservations);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    // Ordenar por ID descendente (más recientes primero)
    query = query.orderBy(desc(reservations.id));
    
    return await query;
  }
  
  /**
   * Actualiza el estado de una reservación
   * @param reservationId ID de la reservación
   * @param status Nuevo estado
   * @returns Reservación actualizada
   */
  async updateReservationStatus(reservationId: number, status: string): Promise<Reservation> {
    const [updatedReservation] = await db.update(reservations)
      .set({ status })
      .where(eq(reservations.id, reservationId))
      .returning();
    
    if (!updatedReservation) {
      throw new Error(`No se pudo actualizar la reservación con ID ${reservationId}`);
    }
    
    return updatedReservation;
  }
  
  /**
   * Actualiza el estado de pago de una reservación
   * @param reservationId ID de la reservación
   * @param paymentStatus Nuevo estado de pago
   * @param paidBy ID del usuario que marca como pagado
   * @returns Reservación actualizada
   */
  async updatePaymentStatus(
    reservationId: number,
    paymentStatus: string,
    paidBy?: number
  ): Promise<Reservation> {
    const updateData: any = { paymentStatus };
    
    if (paidBy && paymentStatus === PaymentStatus.PAID) {
      updateData.paidBy = paidBy;
    }
    
    const [updatedReservation] = await db.update(reservations)
      .set(updateData)
      .where(eq(reservations.id, reservationId))
      .returning();
    
    if (!updatedReservation) {
      throw new Error(`No se pudo actualizar el estado de pago de la reservación con ID ${reservationId}`);
    }
    
    return updatedReservation;
  }
  
  /**
   * Marca una reservación como escaneada/verificada
   * @param reservationId ID de la reservación
   * @param checkedBy ID del usuario que escanea
   * @returns Reservación actualizada
   */
  async markAsChecked(reservationId: number, checkedBy: number): Promise<Reservation> {
    // Obtener la reservación actual
    const reservation = await db.query.reservations.findFirst({
      where: eq(reservations.id, reservationId)
    });
    
    if (!reservation) {
      throw new Error(`Reservación con ID ${reservationId} no encontrada`);
    }
    
    // Incrementar el contador de escaneos
    const checkCount = (reservation.checkCount || 0) + 1;
    
    const [updatedReservation] = await db.update(reservations)
      .set({
        checkedBy,
        checkedAt: new Date(),
        checkCount
      })
      .where(eq(reservations.id, reservationId))
      .returning();
    
    if (!updatedReservation) {
      throw new Error(`No se pudo marcar como escaneada la reservación con ID ${reservationId}`);
    }
    
    return updatedReservation;
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
    return optimizedTripStorage.calculateSegmentAvailability(
      tripId,
      originStopIndex,
      destinationStopIndex
    );
  }
}

export const optimizedReservationStorage = new OptimizedReservationStorage();