import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";

/**
 * Servicio para manejar operaciones de corte de caja y elementos procesados
 */
export class CutoffService {
  /**
   * Normaliza un método de pago al formato básico (efectivo o transferencia)
   */
  normalizePaymentMethod(method: string): string {
    if (!method || typeof method !== 'string') {
      return 'efectivo'; // Valor por defecto
    }
    
    const lowerMethod = method.trim().toLowerCase();
    let normalizedMethod = lowerMethod;
    
    // Extraer la parte relevante con el método real
    if (lowerMethod.includes('anticipo:')) {
      // En formato "Anticipo: efectivo / Resto: efectivo", tomar el método después de "Anticipo:"
      const parts = lowerMethod.split(':');
      if (parts.length > 1) {
        normalizedMethod = parts[1].trim();
        // Si tiene "/", quedarse solo con la primera parte
        if (normalizedMethod.includes('/')) {
          normalizedMethod = normalizedMethod.split('/')[0].trim();
        }
      }
    }
    
    // Normalizar a los dos tipos básicos
    if (normalizedMethod.includes('efectivo') || normalizedMethod === 'cash') {
      return 'efectivo';
    } else if (normalizedMethod.includes('transfer') || normalizedMethod === 'bank_transfer') {
      return 'transferencia';
    }
    
    // Verificar en la cadena original como respaldo
    if (lowerMethod.includes('efectivo') || lowerMethod === 'cash') {
      return 'efectivo';
    } else if (lowerMethod.includes('transfer') || lowerMethod === 'bank_transfer') {
      return 'transferencia';
    }
    
    // Valor por defecto si no se detecta un tipo específico
    return 'efectivo';
  }
  /**
   * Registra un elemento como procesado en un corte
   */
  async addProcessedItem(item: schema.InsertProcessedItem): Promise<schema.ProcessedItem> {
    try {
      console.log(`[addProcessedItem] Agregando elemento procesado al corte ${item.cutoffId}`);
      
      const [newItem] = await db
        .insert(schema.processedItems)
        .values(item)
        .returning();
      
      console.log(`[addProcessedItem] Elemento procesado creado con ID ${newItem.id}`);
      return newItem;
    } catch (error) {
      console.error(`[addProcessedItem] Error:`, error);
      throw new Error(`Error al agregar elemento procesado: ${error}`);
    }
  }
  
  /**
   * Verifica si un elemento ya ha sido procesado en algún corte
   */
  async isItemProcessed(itemType: string, itemId: number): Promise<boolean> {
    try {
      console.log(`[isItemProcessed] Verificando si el elemento ${itemType} ${itemId} ya ha sido procesado`);
      
      const items = await db
        .select()
        .from(schema.processedItems)
        .where(and(
          eq(schema.processedItems.itemType, itemType),
          eq(schema.processedItems.itemId, itemId)
        ));
      
      return items.length > 0;
    } catch (error) {
      console.error(`[isItemProcessed] Error:`, error);
      return false;
    }
  }
  
  /**
   * Obtiene los elementos procesados en un corte específico
   */
  async getProcessedItems(cutoffId: number): Promise<schema.ProcessedItem[]> {
    try {
      console.log(`[getProcessedItems] Obteniendo elementos procesados para el corte ${cutoffId}`);
      
      const items = await db
        .select()
        .from(schema.processedItems)
        .where(eq(schema.processedItems.cutoffId, cutoffId))
        .orderBy(desc(schema.processedItems.createdAt));
      
      return items;
    } catch (error) {
      console.error(`[getProcessedItems] Error:`, error);
      return [];
    }
  }
  
  /**
   * Obtiene detalles completos de un viaje incluyendo datos de la ruta
   */
  private async getDetailedTrip(tripId: number): Promise<any> {
    try {
      if (!tripId) return null;
      
      console.log(`[getDetailedTrip] Obteniendo información detallada del viaje ${tripId}`);
      
      // Consultar el viaje con su ruta asociada
      const trips = await db
        .select({
          trip: schema.trips,
          route: schema.routes
        })
        .from(schema.trips)
        .leftJoin(schema.routes, eq(schema.trips.routeId, schema.routes.id))
        .where(eq(schema.trips.id, tripId))
        .limit(1);
      
      if (trips.length === 0) {
        console.log(`[getDetailedTrip] No se encontró información para el viaje ${tripId}`);
        return null;
      }
      
      const result = trips[0];
      console.log(`[getDetailedTrip] Información obtenida para viaje ${tripId}:`, {
        id: result.trip.id,
        routeId: result.trip.routeId,
        routeName: result.route?.name,
        departureDate: result.trip.departureDate,
        departureTime: result.trip.departureTime,
        origin: result.route?.origin,
        destination: result.route?.destination
      });
      
      return result;
    } catch (error) {
      console.error(`[getDetailedTrip] Error al obtener detalles del viaje ${tripId}:`, error);
      return null;
    }
  }
  
  /**
   * Obtiene los pasajeros de una reservación
   */
  private async getReservationPassengers(reservationId: number): Promise<any[]> {
    try {
      if (!reservationId) return [];
      
      console.log(`[getReservationPassengers] Obteniendo pasajeros para reservación ${reservationId}`);
      
      const passengers = await db
        .select()
        .from(schema.passengers)
        .where(eq(schema.passengers.reservationId, reservationId));
      
      console.log(`[getReservationPassengers] ${passengers.length} pasajeros encontrados para reservación ${reservationId}`);
      return passengers;
    } catch (error) {
      console.error(`[getReservationPassengers] Error al obtener pasajeros:`, error);
      return [];
    }
  }

  /**
   * Crea un nuevo corte de caja con los elementos especificados
   */
  async createCutoff(operatorId: number, items: any[], notes?: string): Promise<{
    success: boolean;
    message?: string;
    cutoffId?: number;
  }> {
    try {
      console.log(`[createCutoff] Creando corte de caja para el operador ${operatorId} con ${items.length} elementos`);
      
      // Calcular totales
      let totalAmount = 0;
      let totalCash = 0;
      let totalTransfer = 0;
      const transactionCount = items.length;
      
      // Clasificar por método de pago
      for (const item of items) {
        const amount = item.amount || item.totalAmount || 0;
        
        // Usar la función centralizada para normalizar el método de pago
        const simplePaymentMethod = this.normalizePaymentMethod(item.paymentMethod || '');
        
        console.log(`[createCutoff] Procesando item: ID=${item.id}, Monto=${amount}, Método original=${item.paymentMethod}, Método normalizado=${simplePaymentMethod}`);
        
        totalAmount += amount;
        
        if (simplePaymentMethod === 'efectivo') {
          totalCash += amount;
        } else if (simplePaymentMethod === 'transferencia') {
          totalTransfer += amount;
        } else {
          // Para cualquier otro método no reconocido, asumirlo como efectivo por defecto
          console.warn(`[createCutoff] Método de pago no reconocido: "${simplePaymentMethod}", asumiendo efectivo`);
          totalCash += amount;
        }
      }
      
      // Buscar o crear una caja para el operador
      let cashboxId = 0;
      
      // Intentar encontrar una caja existente para el operador
      const existingCashboxes = await db
        .select()
        .from(schema.cashboxes)
        .where(eq(schema.cashboxes.operatorId, operatorId))
        .limit(1);
      
      if (existingCashboxes.length > 0) {
        cashboxId = existingCashboxes[0].id;
        console.log(`[createCutoff] Encontrada caja existente para el operador: ${cashboxId}`);
      } else {
        // Si no existe una caja para este operador, crearla
        const [newCashbox] = await db
          .insert(schema.cashboxes)
          .values({
            name: `Caja de Operador ${operatorId}`,
            description: 'Caja creada automáticamente',
            operatorId,
            companyId: 'bamo-936622', // Valor por defecto para la compañía
            balance: 0,
            isActive: true
          })
          .returning();
        
        cashboxId = newCashbox.id;
        console.log(`[createCutoff] Creada nueva caja para el operador: ${cashboxId}`);
      }
      
      // Crear el registro del corte
      const [cutoff] = await db
        .insert(schema.cashboxCutoffs)
        .values({
          cashboxId,
          operatorId,
          previousBalance: 0, // Se actualizará con cálculos más avanzados en el futuro
          totalIncome: totalAmount,
          totalExpenses: 0,
          finalBalance: totalAmount,
          totalCash,
          totalTransfer,
          transactionCount,
          notes: notes || null
        })
        .returning();
      
      // Registrar cada elemento como procesado
      for (const item of items) {
        // Determinar si es una reservación o un paquete de forma segura
        const isPackage = Boolean(item.originalPackageId !== undefined || 
                               item.type === 'package' || 
                               (item.senderName !== undefined && item.receiverName !== undefined));
        
        // Usar el método centralizado de normalización
        const simplePaymentMethod = this.normalizePaymentMethod(item.paymentMethod || '');
        
        console.log(`[createCutoff] Procesando método de pago - Original: "${item.paymentMethod}", Normalizado: "${simplePaymentMethod}"`);
        
        // Variables para almacenar la información completa obtenida de la BD
        let tripDetails = null;
        let passengersList = [];
        
        // Si es una reservación, obtener datos completos del viaje y pasajeros
        if (!isPackage) {
          // Obtener el ID del viaje (puede estar en diferentes lugares según el objeto)
          const tripId = item.tripId || (item.trip ? item.trip.id : null);
          
          if (tripId) {
            console.log(`[createCutoff] Consultando detalles del viaje ${tripId} desde la base de datos`);
            // Consultar datos completos del viaje incluyendo ruta
            tripDetails = await this.getDetailedTrip(tripId);
            
            if (tripDetails) {
              console.log(`[createCutoff] Viaje encontrado en BD: ${tripDetails.trip.id}, ruta: ${tripDetails.route?.name}`);
            }
          }
          
          // Obtener pasajeros de la reservación
          if (item.id) {
            passengersList = await this.getReservationPassengers(item.id);
            console.log(`[createCutoff] Pasajeros obtenidos de BD para reservación ${item.id}: ${passengersList.length}`);
          }
        }
        
        // Obtener datos del viaje (primero de la BD, si no del objeto item)
        const trip = tripDetails ? tripDetails.trip : (item.trip || {});
        const route = tripDetails ? tripDetails.route : (item.trip?.route || {});
        
        console.log(`[createCutoff] Datos finales del viaje para procesamiento:`, {
          tripId: trip.id,
          routeName: route.name,
          departureDate: trip.departureDate,
          departureTime: trip.departureTime,
          origin: route.origin,
          destination: route.destination
        });
        
        // Formatear fecha correctamente si existe
        let departureDate = '';
        if (trip.departureDate) {
          try {
            // Asegurarnos de tener una fecha válida en formato ISO
            const date = new Date(trip.departureDate);
            departureDate = date.toISOString();
          } catch (e) {
            console.error(`[createCutoff] Error al formatear fecha:`, e);
            departureDate = String(trip.departureDate);
          }
        }
        
        // Usar los pasajeros de la BD o los que vengan en el objeto item
        let passengers = passengersList.length > 0 ? 
                         passengersList : 
                         (Array.isArray(item.passengers) ? item.passengers : []);
        
        console.log(`[createCutoff] Procesando ${passengers.length} pasajeros para el item ${item.id}`);
        
        // Crear objeto con todos los detalles relevantes para guardar
        const detailedInfo = {
          // Información básica
          id: item.id,
          type: isPackage ? 'package' : 'reservation',
          
          // Información de ruta/viaje (priorizando datos de la BD)
          tripId: trip.id || item.tripId,
          tripName: route.name || item.tripName || '',
          
          // Origen y destino (priorizando datos de la BD)
          origin: route.origin || 
                 trip.segmentOrigin || 
                 item.origin || '',
                 
          destination: route.destination || 
                      trip.segmentDestination || 
                      item.destination || '',
          
          // Fecha y hora de salida
          departureDate: departureDate,
          departureTime: trip.departureTime || '',
          
          // Información de pago
          amount: item.amount || item.totalAmount || 0,
          advanceAmount: item.advanceAmount || 0,
          paymentMethod: simplePaymentMethod,
          paymentMethodRaw: item.paymentMethod || '',
          paymentNote: item.paymentNote || (isPackage ? 'Paquetería' : (
            item.advanceAmount && item.totalAmount > item.advanceAmount ? 'Anticipo' : 'Pago completo'
          )),
          concept: isPackage ? 'Paquetería' : 'Reservación',
          
          // Información de pasajeros/paquetes
          passengerCount: passengers.length,
          seatNumbers: item.seatNumbers || [],
          
          // Para paqueterías
          senderName: isPackage ? (item.senderName || '') : '',
          senderLastName: isPackage ? (item.senderLastName || '') : '',
          receiverName: isPackage ? (item.receiverName || '') : '',
          receiverLastName: isPackage ? (item.receiverLastName || '') : '',
          weight: isPackage ? (item.weight || '') : '',
          dimensions: isPackage ? (item.dimensions || '') : '',
          
          // Para reservaciones - usando los pasajeros obtenidos de la BD o el objeto
          passengers: passengers.map((p: any) => ({
            firstName: p.firstName || '',
            lastName: p.lastName || '',
            phone: p.phone || '',
            email: p.email || ''
          })),
          
          // Metadatos
          companyId: item.companyId || trip.companyId || '',
          companyName: item.companyInfo?.name || '',
          createdAt: item.createdAt || new Date().toISOString(),
          paidAt: item.paidAt || item.paymentAt || new Date().toISOString()
        };
        
        // Guardar en la tabla de elementos procesados con método de pago normalizado
        await this.addProcessedItem({
          cutoffId: cutoff.id,
          itemType: isPackage ? 'package' : 'reservation',
          itemId: isPackage ? (item.originalPackageId || item.id) : item.id,
          amount: item.amount || item.totalAmount || 0,
          paymentMethod: simplePaymentMethod, // Usar el método normalizado, no el original
          concept: item.paymentNote || (isPackage ? 'Paquetería' : 'Reservación'),
          details: JSON.stringify(detailedInfo)
        });
      }
      
      console.log(`[createCutoff] Corte creado exitosamente: ${cutoff.id}`);
      
      return {
        success: true,
        cutoffId: cutoff.id
      };
    } catch (error) {
      console.error(`[createCutoff] Error:`, error);
      return {
        success: false,
        message: `Error al crear el corte: ${error}`
      };
    }
  }
  
  /**
   * Obtiene todos los cortes de caja de un operador
   */
  async getCutoffsByOperator(operatorId: number): Promise<schema.CashboxCutoff[]> {
    try {
      console.log(`[getCutoffsByOperator] Obteniendo cortes para el operador ${operatorId}`);
      
      const cutoffs = await db
        .select()
        .from(schema.cashboxCutoffs)
        .where(eq(schema.cashboxCutoffs.operatorId, operatorId))
        .orderBy(desc(schema.cashboxCutoffs.createdAt));
      
      return cutoffs;
    } catch (error) {
      console.error(`[getCutoffsByOperator] Error:`, error);
      return [];
    }
  }
  
  /**
   * Obtiene el detalle completo de un corte
   */
  async getCutoffDetails(cutoffId: number): Promise<{
    cutoff: schema.CashboxCutoff | null;
    items: schema.ProcessedItem[];
  }> {
    try {
      console.log(`[getCutoffDetails] Obteniendo detalles del corte ${cutoffId}`);
      
      const [cutoff] = await db
        .select()
        .from(schema.cashboxCutoffs)
        .where(eq(schema.cashboxCutoffs.id, cutoffId));
      
      const items = await this.getProcessedItems(cutoffId);
      
      return {
        cutoff: cutoff || null,
        items
      };
    } catch (error) {
      console.error(`[getCutoffDetails] Error:`, error);
      return {
        cutoff: null,
        items: []
      };
    }
  }
}

// Exportar una instancia del servicio para usar en las rutas
export const cutoffService = new CutoffService();