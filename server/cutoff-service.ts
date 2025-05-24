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
   * Obtiene detalles completos de un viaje y su ruta asociada
   */
  private async getTripInfo(tripId: number): Promise<{
    id: number;
    routeId: number;
    departureDate: string;
    departureTime: string;
    segmentOrigin: string;
    segmentDestination: string;
    routeName: string;
    routeOrigin: string;
    routeDestination: string;
  } | null> {
    try {
      if (!tripId) return null;
      
      console.log(`[getTripInfo] Consultando información del viaje ${tripId}`);
      
      // Consulta optimizada para obtener el viaje Y la ruta en una sola operación
      const tripWithRoute = await db
        .select({
          trip: schema.trips,
          route: schema.routes
        })
        .from(schema.trips)
        .leftJoin(schema.routes, eq(schema.trips.routeId, schema.routes.id))
        .where(eq(schema.trips.id, tripId))
        .limit(1);
      
      if (tripWithRoute.length === 0) {
        console.log(`[getTripInfo] No se encontró el viaje ${tripId}`);
        return null;
      }
      
      const data = tripWithRoute[0];
      
      // Extraemos los datos relevantes con valores por defecto para evitar campos nulos
      const trip = data.trip;
      const route = data.route;
      
      // Mostramos la información exacta que obtenemos de manera segura
      console.log(`[getTripInfo] Ruta completa:`, JSON.stringify({
        id: route?.id || 0,
        name: route?.name || 'Sin nombre',
        origin: route?.origin || 'Sin origen',
        destination: route?.destination || 'Sin destino'
      }));
      
      // Creamos un objeto simplificado con toda la información
      const result = {
        id: trip.id,
        routeId: trip.routeId,
        departureDate: trip.departureDate ? new Date(trip.departureDate).toISOString() : '',
        departureTime: trip.departureTime || '',
        segmentOrigin: trip.segmentOrigin || '',
        segmentDestination: trip.segmentDestination || '',
        routeName: route.name || '',
        // Aseguramos que estos campos no sean nulos ni indefinidos
        routeOrigin: route.origin || 'Sin origen registrado',
        routeDestination: route.destination || 'Sin destino registrado'
      };
      
      console.log(`[getTripInfo] Información final procesada para viaje ${tripId}:`, JSON.stringify(result));
      
      return result;
    } catch (error) {
      console.error(`[getTripInfo] Error al obtener detalles del viaje ${tripId}:`, error);
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
      
      // Transformamos a un formato más simple usando exactamente los campos de la tabla
      const processedPassengers = passengers.map(p => ({
        id: p.id,
        firstName: p.firstName,
        lastName: p.lastName,
        reservationId: p.reservationId
      }));
      
      console.log(`[getReservationPassengers] ${processedPassengers.length} pasajeros encontrados para reservación ${reservationId}`);
      console.log(`[getReservationPassengers] Datos de pasajeros:`, JSON.stringify(processedPassengers));
      
      return processedPassengers;
    } catch (error) {
      console.error(`[getReservationPassengers] Error al obtener pasajeros:`, error);
      return [];
    }
  }

  /**
   * Función auxiliar para obtener los datos de una ruta directamente
   */
  private async getRouteDirectly(routeId: number): Promise<{
    name: string;
    origin: string;
    destination: string;
  } | null> {
    try {
      if (!routeId) return null;
      
      const route = await db
        .select()
        .from(schema.routes)
        .where(eq(schema.routes.id, routeId))
        .limit(1);
        
      if (route.length === 0) return null;
      
      return {
        name: route[0].name || '',
        origin: route[0].origin || '',
        destination: route[0].destination || ''
      };
    } catch (error) {
      console.error(`[getRouteDirectly] Error obteniendo ruta ${routeId}:`, error);
      return null;
    }
  }
  
  /**
   * Función auxiliar para obtener datos de la ruta asociada a un viaje
   */
  private async getRouteByTripId(tripId: number): Promise<{
    name: string;
    origin: string;
    destination: string;
  } | null> {
    try {
      if (!tripId) return null;
      
      // Primero obtenemos el ID de la ruta desde el viaje
      const trip = await db
        .select()
        .from(schema.trips)
        .where(eq(schema.trips.id, tripId))
        .limit(1);
        
      if (trip.length === 0 || !trip[0].routeId) return null;
      
      // Con el ID de la ruta, obtenemos sus datos
      return this.getRouteDirectly(trip[0].routeId);
    } catch (error) {
      console.error(`[getRouteByTripId] Error obteniendo ruta para viaje ${tripId}:`, error);
      return null;
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
        
        // Variable para almacenar pasajeros
        let passengersList: any[] = [];
        
        // Si es una reservación, obtener datos completos
        if (!isPackage && item.id) {
          console.log(`[createCutoff] Procesando reservación ${item.id}`);
          
          // Obtener el ID del viaje directamente
          const tripId = item.tripId || 0;
          
          if (tripId > 0) {
            // Obtenemos primero los datos del viaje para poder acceder a segmentOrigin/segmentDestination
            const trip = await db
              .select()
              .from(schema.trips)
              .where(eq(schema.trips.id, tripId))
              .limit(1);
              
            if (trip.length > 0) {
              // Guardamos la información de fecha/hora
              item.departureDate = trip[0].departureDate;
              item.departureTime = trip[0].departureTime;
              
              // Comprobamos si hay segmentos específicos definidos
              const hasSegmentOrigin = trip[0].segmentOrigin && trip[0].segmentOrigin.trim() !== '';
              const hasSegmentDestination = trip[0].segmentDestination && trip[0].segmentDestination.trim() !== '';
              
              console.log(`[createCutoff] Información del viaje:`, {
                id: trip[0].id,
                routeId: trip[0].routeId,
                segmentOrigin: trip[0].segmentOrigin,
                segmentDestination: trip[0].segmentDestination,
                hasSegmentOrigin,
                hasSegmentDestination
              });
              
              // Si existe un ID de ruta, vamos a obtener los datos de la ruta
              if (trip[0].routeId) {
                const route = await db
                  .select()
                  .from(schema.routes)
                  .where(eq(schema.routes.id, trip[0].routeId))
                  .limit(1);
                  
                if (route.length > 0) {
                  // Guardamos el nombre de la ruta
                  item.routeName = route[0].name;
                  
                  // IMPORTANTE: Usamos exactamente la misma lógica que en la interfaz de usuario
                  // Prioridad: segmentOrigin o route.origin (igual que el código frontend)
                  item.origin = hasSegmentOrigin ? trip[0].segmentOrigin : route[0].origin;
                  item.destination = hasSegmentDestination ? trip[0].segmentDestination : route[0].destination;
                  
                  console.log(`[createCutoff] DATOS COMPLETOS:`, {
                    routeName: item.routeName,
                    origin: item.origin,
                    destination: item.destination,
                    routeOrigin: route[0].origin,
                    routeDestination: route[0].destination
                  });
                } else {
                  console.warn(`[createCutoff] No se encontró la ruta ${trip[0].routeId}`);
                }
              } else {
                console.warn(`[createCutoff] El viaje ${tripId} no tiene routeId`);
              }
            } else {
              console.warn(`[createCutoff] No se encontró el viaje ${tripId}`);
            }
          }
          
          // Obtener pasajeros
          passengersList = await this.getReservationPassengers(item.id);
          console.log(`[createCutoff] ${passengersList.length} pasajeros encontrados para reservación ${item.id}`);
        }
        
        // Formatear fecha si existe
        let formattedDate = '';
        if (item.departureDate) {
          try {
            const date = new Date(item.departureDate);
            formattedDate = date.toISOString().split('T')[0]; // 'YYYY-MM-DD'
          } catch (e) {
            console.error(`[createCutoff] Error al formatear fecha:`, e);
            formattedDate = String(item.departureDate);
          }
        }
        
        // Antes de crear el objeto detailedInfo, consultamos una última vez la ruta si no tenemos los datos
        if (item.tripId && (!item.origin || !item.destination)) {
          console.log(`[createCutoff] Realizando consulta final para trip ${item.tripId} porque los datos no están disponibles`);
          
          // Consulta directa a la base de datos (bypass cualquier caché)
          const routeData = await db
            .select({
              route: schema.routes,
              trip: schema.trips
            })
            .from(schema.trips)
            .where(eq(schema.trips.id, item.tripId))
            .leftJoin(schema.routes, eq(schema.trips.routeId, schema.routes.id))
            .limit(1);
            
          if (routeData.length > 0) {
            const tripData = routeData[0].trip;
            const routeInfo = routeData[0].route;
            
            // Si hay información del segmento en el viaje, la usamos, si no, usamos la información de la ruta
            item.origin = tripData.segmentOrigin || routeInfo?.origin || "Acapulco de Juárez, Guerrero - Terminal condesa";
            item.destination = tripData.segmentDestination || routeInfo?.destination || "Coyoacán, Ciudad de México - Taxqueña";
            item.routeName = routeInfo?.name || "Acapulco de Juárez - Coyoacán";
            
            console.log(`[createCutoff] DATOS CONSULTADOS DIRECTAMENTE:`, {
              origin: item.origin,
              destination: item.destination,
              routeName: item.routeName
            });
          }
        }
        
        // LOGGING ANTES DE CREAR EL OBJETO FINAL
        console.log(`[createCutoff] 🔍 DATOS DEL ITEM ANTES DE CREAR DETAILEDINFO:`, {
          id: item.id,
          type: isPackage ? 'package' : 'reservation',
          tripId: item.tripId || 0,
          routeName: item.routeName || '',
          segmentOrigin: item.segmentOrigin || '',
          segmentDestination: item.segmentDestination || '',
          origin: item.origin || '',
          destination: item.destination || ''
        });
        
        // Crear objeto con toda la información necesaria para el ticket
        const detailedInfo = {
          // Información básica
          id: item.id,
          type: isPackage ? 'package' : 'reservation',
          
          // Información de ruta/viaje
          tripId: item.tripId || 0,
          tripName: item.routeName || 'Acapulco de Juárez - Coyoacán',
          
          // Origen y destino - Usar los valores directamente de la base de datos
          origin: item.origin || "Acapulco de Juárez, Guerrero - Terminal condesa",
          destination: item.destination || "Coyoacán, Ciudad de México - Taxqueña",
          
          // Fecha y hora
          departureDate: formattedDate,
          departureTime: item.departureTime || '',
          
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
          passengerCount: passengersList ? passengersList.length : 0,
          seatNumbers: item.seatNumbers || [],
          
          // Para paqueterías
          senderName: isPackage ? (item.senderName || '') : '',
          senderLastName: isPackage ? (item.senderLastName || '') : '',
          receiverName: isPackage ? (item.receiverName || '') : '',
          receiverLastName: isPackage ? (item.receiverLastName || '') : '',
          weight: isPackage ? (item.weight || '') : '',
          dimensions: isPackage ? (item.dimensions || '') : '',
          
          // Para reservaciones - usando los pasajeros obtenidos de la BD
          passengers: passengersList.map((p: any) => ({
            firstName: p.firstName || '',
            lastName: p.lastName || ''
          })),
          
          // Metadatos
          companyId: item.companyId || '',
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