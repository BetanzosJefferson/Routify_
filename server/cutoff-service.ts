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
        const paymentMethod = item.paymentMethod || 'efectivo';
        
        totalAmount += amount;
        
        if (paymentMethod === 'efectivo') {
          totalCash += amount;
        } else {
          totalTransfer += amount;
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
        
        // Guardar en la tabla de elementos procesados
        await this.addProcessedItem({
          cutoffId: cutoff.id,
          itemType: isPackage ? 'package' : 'reservation',
          itemId: isPackage ? (item.originalPackageId || item.id) : item.id,
          amount: item.amount || item.totalAmount || 0,
          paymentMethod: item.paymentMethod || 'efectivo',
          concept: item.paymentNote || (isPackage ? 'Paquetería' : 'Reservación'),
          details: JSON.stringify({
            route: item.tripName || 'Sin ruta',
            passenger: isPackage ? 
              (item.sender || item.senderName || item.receiverName || 'Sin remitente') : 
              (Array.isArray(item.passengers) ? 
                item.passengers.map(p => `${String(p.firstName || '')} ${String(p.lastName || '')}`).join(', ') : 
                (item.name || item.passengerName || 'Sin pasajeros'))
          })
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