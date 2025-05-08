import { db } from "./db";
import { 
  reservations, 
  passengers, 
  tripMasters, 
  tripSegments,
  users,
  Reservation,
  Passenger,
  TripMaster,
  TripSegment,
  insertReservationSchema,
  insertPassengerSchema
} from "@shared/schema";
import { eq, and, gte, lte, or, inArray, sql } from "drizzle-orm";
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
    reservationData: Omit<Reservation, "id" | "createdAt" | "updatedAt"> & { 
      originStopIndex: number;
      destinationStopIndex: number;
    },
    passengerData: Omit<Passenger, "id" | "reservationId">[]
  ): Promise<Reservation & { passengers: Passenger[] }> {
    // Validar que los datos de la reservación son correctos
    const validationResult = insertReservationSchema.safeParse(reservationData);
    
    if (!validationResult.success) {
      throw new Error(`Datos de reservación inválidos: ${JSON.stringify(validationResult.error.format())}`);
    }
    
    // Insertar la reservación
    const [reservation] = await db.insert(reservations).values({
      tripId: reservationData.tripId,
      totalAmount: reservationData.totalAmount,
      email: reservationData.email,
      phone: reservationData.phone,
      notes: reservationData.notes,
      paymentMethod: reservationData.paymentMethod,
      status: reservationData.status,
      paymentStatus: reservationData.paymentStatus,
      advanceAmount: reservationData.advanceAmount,
      advancePaymentMethod: reservationData.advancePaymentMethod,
      createdBy: reservationData.createdBy,
      companyId: reservationData.companyId,
      originStopIndex: reservationData.originStopIndex,
      destinationStopIndex: reservationData.destinationStopIndex
    }).returning();
    
    // Insertar los pasajeros
    const createdPassengers = [];
    
    for (const passenger of passengerData) {
      const [createdPassenger] = await db.insert(passengers).values({
        ...passenger,
        reservationId: reservation.id
      }).returning();
      
      createdPassengers.push(createdPassenger);
    }
    
    // Reducir los asientos disponibles en el viaje
    await optimizedTripStorage.reduceAvailableSeats(
      reservationData.tripId,
      reservationData.originStopIndex,
      reservationData.destinationStopIndex
    );
    
    // Devolver la reservación completa
    return {
      ...reservation,
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
      where: eq(reservations.id, reservationId),
      with: {
        passengers: true
      }
    });
    
    if (!reservation) {
      return null;
    }
    
    // Obtener información del viaje
    const trip = await optimizedTripStorage.getTripWithSegments(reservation.tripId);
    
    // Obtener información de los usuarios relacionados
    const createdByUser = reservation.createdBy ? await db.query.users.findFirst({
      where: eq(users.id, reservation.createdBy)
    }) : undefined;
    
    const checkedByUser = reservation.checkedBy ? await db.query.users.findFirst({
      where: eq(users.id, reservation.checkedBy)
    }) : undefined;
    
    const paidByUser = reservation.paidBy ? await db.query.users.findFirst({
      where: eq(users.id, reservation.paidBy)
    }) : undefined;
    
    // Combinar toda la información
    return {
      ...reservation,
      trip,
      createdByUser,
      checkedByUser,
      paidByUser
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
      paymentStatus?: string; 
      status?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}, 
    tripId?: number
  ): Promise<Reservation[]> {
    // Construir condiciones
    const conditions = [];
    
    if (tripId) {
      conditions.push(eq(reservations.tripId, tripId));
    }
    
    if (filters.companyId) {
      conditions.push(eq(reservations.companyId, filters.companyId));
    }
    
    if (filters.paymentStatus) {
      conditions.push(eq(reservations.paymentStatus, filters.paymentStatus));
    }
    
    if (filters.status) {
      conditions.push(eq(reservations.status, filters.status));
    }
    
    // Ejecutar la consulta
    let query = db.select().from(reservations);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    // Ordenar por fecha de creación (más reciente primero)
    query = query.orderBy(reservations.createdAt);
    
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
    
    if (paidBy) {
      updateData.paidBy = paidBy;
    }
    
    const [updatedReservation] = await db.update(reservations)
      .set(updateData)
      .where(eq(reservations.id, reservationId))
      .returning();
    
    if (!updatedReservation) {
      throw new Error(`No se pudo actualizar el estado de pago de la reservación ${reservationId}`);
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
    
    // Actualizar contador de escaneos y datos de verificación
    const [updatedReservation] = await db.update(reservations)
      .set({
        checkedBy,
        checkedAt: new Date(),
        checkCount: (reservation.checkCount || 0) + 1
      })
      .where(eq(reservations.id, reservationId))
      .returning();
    
    if (!updatedReservation) {
      throw new Error(`No se pudo marcar como escaneada la reservación ${reservationId}`);
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
    // Obtener capacidad total del viaje
    const trip = await db.query.tripMasters.findFirst({
      where: eq(tripMasters.id, tripId)
    });
    
    if (!trip) {
      throw new Error(`Viaje con ID ${tripId} no encontrado`);
    }
    
    // Obtener todas las reservaciones que afectan a este segmento
    const reservationsCount = await db.select({
      count: sql<number>`count(*)`
    })
    .from(reservations)
    .where(
      and(
        eq(reservations.tripId, tripId),
        // La reservación afecta a este segmento si:
        // 1. Su origen está antes o en el origen del segmento solicitado
        // 2. Su destino está después o en el destino del segmento solicitado
        or(
          // Caso 1: La reservación comienza antes del segmento y termina dentro
          and(
            lte(reservations.originStopIndex, originStopIndex),
            and(
              gte(reservations.destinationStopIndex, originStopIndex),
              lte(reservations.destinationStopIndex, destinationStopIndex)
            )
          ),
          // Caso 2: La reservación comienza dentro del segmento y termina después
          and(
            and(
              gte(reservations.originStopIndex, originStopIndex),
              lte(reservations.originStopIndex, destinationStopIndex)
            ),
            gte(reservations.destinationStopIndex, destinationStopIndex)
          ),
          // Caso 3: La reservación abarca todo el segmento
          and(
            lte(reservations.originStopIndex, originStopIndex),
            gte(reservations.destinationStopIndex, destinationStopIndex)
          ),
          // Caso 4: La reservación está completamente dentro del segmento
          and(
            gte(reservations.originStopIndex, originStopIndex),
            lte(reservations.destinationStopIndex, destinationStopIndex)
          )
        ),
        // Solo considerar reservaciones confirmadas (no canceladas)
        eq(reservations.status, "confirmed")
      )
    );
    
    const occupied = reservationsCount[0]?.count || 0;
    const available = Math.max(0, trip.capacity - occupied);
    
    return available;
  }
}

// Instancia única para usar en la aplicación
export const optimizedReservationStorage = new OptimizedReservationStorage();