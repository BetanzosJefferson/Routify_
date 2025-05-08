import { db } from "./db";
import { eq, and, or, inArray } from "drizzle-orm";
import { reservations, passengers, users, tripMasters, tripSegments } from "@shared/schema";
import { optimizedTripStorage } from "./trip-storage-optimized";

/**
 * Clase para gestionar reservaciones en el modelo optimizado
 */
export class OptimizedReservationStorage {
  /**
   * Crea una reservación verificando la disponibilidad de asientos
   * en el segmento específico y actualizando los asientos disponibles en el viaje
   */
  async createReservation(reservationData: any, passengersData: any[]) {
    // Obtener información del segmento específico del viaje
    const tripSegment = await this.getSegmentForReservation(
      reservationData.tripMasterId,
      reservationData.originStopIndex,
      reservationData.destinationStopIndex
    );
    
    if (!tripSegment) {
      throw new Error("No se encontró el segmento especificado para el viaje");
    }
    
    // Obtener viaje principal
    const tripMaster = await db.query.tripMasters.findFirst({
      where: eq(tripMasters.id, reservationData.tripMasterId),
    });
    
    if (!tripMaster) {
      throw new Error("Viaje no encontrado");
    }
    
    // Verificar disponibilidad de asientos
    const numPassengers = passengersData.length;
    const availableSeats = await optimizedTripStorage.getAvailableSeatsForSegment(
      reservationData.tripMasterId,
      reservationData.originStopIndex,
      reservationData.destinationStopIndex
    );
    
    if (availableSeats < numPassengers) {
      throw new Error(`No hay suficientes asientos disponibles. Sólo quedan ${availableSeats}`);
    }
    
    // Iniciar transacción para crear reservación y actualizar asientos
    return db.transaction(async (tx) => {
      // Crear reservación
      const [reservation] = await tx
        .insert(reservations)
        .values({
          tripId: tripMaster.id, // Referencia al viaje principal
          totalAmount: reservationData.totalAmount,
          email: reservationData.email,
          phone: reservationData.phone,
          notes: reservationData.notes,
          paymentMethod: reservationData.paymentMethod,
          status: reservationData.status || 'confirmed',
          paymentStatus: reservationData.paymentStatus || 'pendiente',
          advanceAmount: reservationData.advanceAmount || 0,
          advancePaymentMethod: reservationData.advancePaymentMethod || 'efectivo',
          createdBy: reservationData.createdBy,
          companyId: tripMaster.companyId,
          originStopIndex: reservationData.originStopIndex, // Nuevo campo para optimización
          destinationStopIndex: reservationData.destinationStopIndex // Nuevo campo para optimización
        })
        .returning();
      
      if (!reservation) {
        throw new Error("Error al crear la reservación");
      }
      
      // Registrar pasajeros
      for (const passenger of passengersData) {
        await tx
          .insert(passengers)
          .values({
            reservationId: reservation.id,
            firstName: passenger.firstName,
            lastName: passenger.lastName
          });
      }
      
      // Actualizar asientos disponibles en el viaje principal
      await tx
        .update(tripMasters)
        .set({
          availableSeats: tripMaster.availableSeats - numPassengers
        })
        .where(eq(tripMasters.id, tripMaster.id));
      
      // Información completa de la reservación
      return {
        ...reservation,
        passengers: passengersData,
        segment: tripSegment
      };
    });
  }
  
  /**
   * Obtiene un segmento específico para una reservación
   */
  async getSegmentForReservation(tripMasterId: number, originStopIndex: number, destinationStopIndex: number) {
    const [segment] = await db
      .select()
      .from(tripSegments)
      .where(
        and(
          eq(tripSegments.tripMasterId, tripMasterId),
          eq(tripSegments.originStopIndex, originStopIndex),
          eq(tripSegments.destinationStopIndex, destinationStopIndex)
        )
      );
    
    return segment;
  }
  
  /**
   * Obtiene todas las reservaciones para un viaje específico
   */
  async getReservationsForTrip(tripMasterId: number) {
    // Obtener reservaciones básicas
    const tripReservations = await db
      .select()
      .from(reservations)
      .where(eq(reservations.tripId, tripMasterId));
    
    // Enriquecer con información de pasajeros y creador
    const enrichedReservations = [];
    
    for (const reservation of tripReservations) {
      // Obtener pasajeros
      const reservationPassengers = await db
        .select()
        .from(passengers)
        .where(eq(passengers.reservationId, reservation.id));
      
      // Obtener información del usuario que creó la reservación
      let createdByUser = null;
      if (reservation.createdBy) {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, reservation.createdBy));
        
        if (user) {
          createdByUser = {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName
          };
        }
      }
      
      // Obtener información de quien pagó (si aplica)
      let paidByUser = null;
      if (reservation.paidBy) {
        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.id, reservation.paidBy));
        
        if (user) {
          paidByUser = {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName
          };
        }
      }
      
      // Obtener el segmento específico
      let segment = null;
      if ('originStopIndex' in reservation && 'destinationStopIndex' in reservation) {
        // @ts-ignore - Estos campos se agregarán a la tabla
        segment = await this.getSegmentForReservation(tripMasterId, reservation.originStopIndex, reservation.destinationStopIndex);
      }
      
      enrichedReservations.push({
        ...reservation,
        passengers: reservationPassengers,
        createdByUser,
        paidByUser,
        segment
      });
    }
    
    return enrichedReservations;
  }
}

// Exportamos una instancia para usar en las rutas
export const optimizedReservationStorage = new OptimizedReservationStorage();