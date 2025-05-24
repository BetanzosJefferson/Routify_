import { eq, and, desc } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";

/**
 * Servicio para manejar operaciones de corte de caja y elementos procesados
 */
export class CutoffService {
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
        
        // Extraer y normalizar el método de pago básico (sin formato compuesto)
        let simplePaymentMethod = '';
        
        // Limpiar y normalizar el método de pago, extrayendo solo la parte principal
        if (typeof item.paymentMethod === 'string') {
          // Si contiene ":" o "/", extraer solo la primera parte relevante
          if (item.paymentMethod.includes(':')) {
            simplePaymentMethod = item.paymentMethod.split(':')[0].trim().toLowerCase();
          } else if (item.paymentMethod.includes('/')) {
            simplePaymentMethod = item.paymentMethod.split('/')[0].trim().toLowerCase();
          } else if (item.paymentMethod.includes('efectivo')) {
            simplePaymentMethod = 'efectivo';
          } else if (item.paymentMethod.includes('transfer')) {
            simplePaymentMethod = 'transferencia';
          } else {
            simplePaymentMethod = item.paymentMethod.trim().toLowerCase();
          }
        } else {
          // Valor por defecto si no hay método de pago o no es string
          simplePaymentMethod = 'efectivo';
        }
        
        // Corrección final para casos específicos
        if (simplePaymentMethod.includes('anticipo') || simplePaymentMethod.includes('resto')) {
          // Si contiene anticipo o resto, verificar el método real
          if (item.advancePaymentMethod) {
            simplePaymentMethod = item.advancePaymentMethod.toLowerCase().trim();
          } else {
            simplePaymentMethod = 'efectivo'; // Valor por defecto
          }
        }
        
        // Normalización final de métodos
        if (simplePaymentMethod.includes('efectivo') || simplePaymentMethod === 'cash') {
          simplePaymentMethod = 'efectivo';
        } else if (simplePaymentMethod.includes('transfer')) {
          simplePaymentMethod = 'transferencia';
        } else if (!simplePaymentMethod || simplePaymentMethod === 'undefined' || simplePaymentMethod === 'null') {
          simplePaymentMethod = 'efectivo'; // Valor por defecto si no hay método válido
        }
        
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
        
        // Extraer y normalizar el método de pago básico (sin formato compuesto)
        let simplePaymentMethod = '';
        
        // Limpiar y normalizar el método de pago, extrayendo solo la parte principal
        if (typeof item.paymentMethod === 'string') {
          // Si contiene ":" o "/", extraer solo la primera parte relevante
          if (item.paymentMethod.includes(':')) {
            simplePaymentMethod = item.paymentMethod.split(':')[0].trim().toLowerCase();
          } else if (item.paymentMethod.includes('/')) {
            simplePaymentMethod = item.paymentMethod.split('/')[0].trim().toLowerCase();
          } else if (item.paymentMethod.includes('efectivo')) {
            simplePaymentMethod = 'efectivo';
          } else if (item.paymentMethod.includes('transfer')) {
            simplePaymentMethod = 'transferencia';
          } else {
            simplePaymentMethod = item.paymentMethod.trim().toLowerCase();
          }
        } else {
          // Valor por defecto si no hay método de pago o no es string
          simplePaymentMethod = 'efectivo';
        }
        
        // Corrección final para casos específicos
        if (simplePaymentMethod.includes('anticipo') || simplePaymentMethod.includes('resto')) {
          // Si contiene anticipo o resto, verificar el método real
          if (item.advancePaymentMethod) {
            simplePaymentMethod = item.advancePaymentMethod.toLowerCase().trim();
          } else {
            simplePaymentMethod = 'efectivo'; // Valor por defecto
          }
        }
        
        // Normalización final de métodos
        if (simplePaymentMethod.includes('efectivo') || simplePaymentMethod === 'cash') {
          simplePaymentMethod = 'efectivo';
        } else if (simplePaymentMethod.includes('transfer')) {
          simplePaymentMethod = 'transferencia';
        } else if (!simplePaymentMethod || simplePaymentMethod === 'undefined' || simplePaymentMethod === 'null') {
          simplePaymentMethod = 'efectivo'; // Valor por defecto si no hay método válido
        }
        
        console.log(`[createCutoff] Procesando método de pago - Original: "${item.paymentMethod}", Normalizado: "${simplePaymentMethod}"`);
        
        // Crear objeto con todos los detalles relevantes para guardar
        const detailedInfo = {
          // Información básica
          id: item.id,
          type: isPackage ? 'package' : 'reservation',
          
          // Información de ruta/viaje
          tripId: item.tripId,
          tripName: item.tripName || (item.trip ? `${item.trip.route?.name || 'Ruta'} - ${new Date(item.trip?.departureDate).toLocaleDateString()}` : ''),
          origin: item.origin || item.trip?.segmentOrigin || item.trip?.route?.origin || '',
          destination: item.destination || item.trip?.segmentDestination || item.trip?.route?.destination || '',
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
          
          // Para reservaciones
          passengers: Array.isArray(item.passengers) ? 
            item.passengers.map((p: any) => ({
              firstName: p.firstName || '',
              lastName: p.lastName || '',
              phone: p.phone || '',
              email: p.email || ''
            })) : [],
          
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
          paymentMethod: simplePaymentMethod,
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