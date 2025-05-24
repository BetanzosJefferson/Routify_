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
        
        // Crear objeto con todos los detalles relevantes para guardar
        
        // Depuración para verificar la estructura de item.trip
        console.log(`[createCutoff] DEPURACIÓN de item.trip para ítem ${item.id}:`, {
          tripExists: !!item.trip,
          tripKeys: item.trip ? Object.keys(item.trip) : [],
          segmentOrigin: item.trip?.segmentOrigin,
          segmentDestination: item.trip?.segmentDestination,
          hasRoute: !!item.trip?.route,
          routeOrigin: item.trip?.route?.origin,
          routeDestination: item.trip?.route?.destination,
          originFromItem: item.origin,
          destinationFromItem: item.destination
        });
        
        // Analizar la información de origen/destino correcta
        const tripData = item.trip || null;
        const hasSegments = tripData && tripData.segmentOrigin && tripData.segmentDestination;
        
        // Determinar la información de ruta apropiada (similar a la lógica del console.log)
        const originDestInfo = hasSegments 
          ? {
              origin: tripData.segmentOrigin,
              destination: tripData.segmentDestination,
              isSegment: true
            }
          : tripData && tripData.route
            ? {
                origin: tripData.route.origin,
                destination: tripData.route.destination,
                isSegment: false
              }
            : {
                origin: item.origin || '',
                destination: item.destination || '',
                isSegment: false
              };
        
        console.log(`[createCutoff] Procesando origen/destino para ítem ${item.id}:`, originDestInfo);
        
        const detailedInfo = {
          // Información básica
          id: item.id,
          type: isPackage ? 'package' : 'reservation',
          
          // Información de ruta/viaje
          tripId: item.tripId,
          tripName: item.tripName || (item.trip ? `${item.trip.route?.name || 'Ruta'} - ${new Date(item.trip?.departureDate).toLocaleDateString()}` : ''),
          
          // Almacenamos la información de trip para que podamos procesarla correctamente en el PDF
          tripInfo: {
            segmentOrigin: item.trip?.segmentOrigin || null,
            segmentDestination: item.trip?.segmentDestination || null,
            routeOrigin: item.trip?.route?.origin || null,
            routeDestination: item.trip?.route?.destination || null,
            // Añadir el resultado procesado para asegurar que se use correctamente
            processedOrigin: originDestInfo.origin,
            processedDestination: originDestInfo.destination,
            isSegment: originDestInfo.isSegment
          },
          
          // Actualizamos los campos principales con la información procesada
          origin: originDestInfo.origin,
          destination: originDestInfo.destination,
          departureDate: item.trip?.departureDate || '',
          departureTime: item.trip?.departureTime || '',
          
          // Información de pago
          amount: item.amount || item.totalAmount || 0,
          advanceAmount: item.advanceAmount || 0,
          paymentMethod: simplePaymentMethod, // Usar el método normalizado
          paymentMethodRaw: item.paymentMethod || '', // Guardar también el original para depuración
          paymentNote: item.paymentNote || (isPackage ? 'Paquetería' : (
            item.advanceAmount && item.totalAmount > item.advanceAmount ? 'Anticipo' : 'Pago completo'
          )),
          concept: isPackage ? 'Paquetería' : 'Reservación',
          
          // Información de pasajeros/paquetes
          passengerCount: item.passengerCount || (Array.isArray(item.passengers) ? item.passengers.length : 0),
          seatNumbers: item.seatNumbers || [],
          
          // Para paqueterías
          senderName: isPackage ? (item.senderName || '') : '',
          senderLastName: isPackage ? (item.senderLastName || '') : '',
          receiverName: isPackage ? (item.receiverName || '') : '',
          receiverLastName: isPackage ? (item.receiverLastName || '') : '',
          weight: isPackage ? (item.weight || '') : '',
          dimensions: isPackage ? (item.dimensions || '') : '',
          
          // Para reservaciones - capturar información de pasajeros correctamente
          passengers: Array.isArray(item.passengers) ? 
            item.passengers.map((p: any) => ({
              firstName: p.firstName || '',
              lastName: p.lastName || '',
              phone: p.phone || '',
              email: p.email || ''
            })) : 
            // Si no hay una lista de pasajeros explícita pero hay un contacto principal, usarlo
            (item.passengerName || item.firstName) ? 
              [{
                firstName: item.passengerName || item.firstName || '',
                lastName: item.passengerLastName || item.lastName || '',
                phone: item.phone || item.passengerPhone || '',
                email: item.email || item.passengerEmail || ''
              }] : [],
          
          // Metadatos
          companyId: item.companyId || item.trip?.companyId || '',
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