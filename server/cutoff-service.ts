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
    
    // Siempre revisar primero si es transferencia, para dar prioridad a este método
    // Esto garantiza que cualquier método de pago que incluya 'transferencia' se considere como tal
    const lowerMethod = method.trim().toLowerCase();
    
    // Verificar si en CUALQUIER parte de la cadena se menciona transferencia
    if (lowerMethod.includes('transfer') || lowerMethod.includes('transferencia') || 
        lowerMethod.includes('bank_transfer') || lowerMethod.includes('tarjeta')) {
      console.log(`[normalizePaymentMethod] Método '${method}' identificado como TRANSFERENCIA`);
      return 'transferencia';
    }
    
    // Si llegamos aquí, no es transferencia, probablemente es efectivo
    console.log(`[normalizePaymentMethod] Método '${method}' identificado como EFECTIVO por defecto`);
    return 'efectivo';
  }
  /**
   * Registra un elemento como procesado en un corte
   * Versión mejorada con validación adicional del tipo de ítem
   */
  async addProcessedItem(item: schema.InsertProcessedItem): Promise<schema.ProcessedItem> {
    try {
      // Validación explícita del tipo de ítem
      if (item.itemType !== 'package' && item.itemType !== 'reservation') {
        console.error(`[addProcessedItem] TIPO INVÁLIDO: "${item.itemType}" - Debe ser 'package' o 'reservation'`);
        throw new Error(`Tipo de ítem inválido: ${item.itemType}`);
      }
      
      console.log(`[addProcessedItem] Agregando elemento procesado al corte ${item.cutoffId} de tipo "${item.itemType}"`);
      
      // Verificación adicional para asegurar que los detalles coincidan con el tipo
      const detailsObj = typeof item.details === 'string' ? JSON.parse(item.details) : item.details;
      
      if (detailsObj && typeof detailsObj === 'object') {
        // Asegurarse que el tipo en los detalles coincida con itemType
        if (item.itemType === 'package' && detailsObj.type !== 'package') {
          console.log(`[addProcessedItem] CORRIGIENDO tipo en detalles para paquetería ID=${item.itemId}`);
          detailsObj.type = 'package';
          item.details = JSON.stringify(detailsObj);
        } else if (item.itemType === 'reservation' && detailsObj.type !== 'reservation') {
          console.log(`[addProcessedItem] CORRIGIENDO tipo en detalles para reservación ID=${item.itemId}`);
          detailsObj.type = 'reservation';
          item.details = JSON.stringify(detailsObj);
        }
      }
      
      // Agregar el registro a la base de datos
      const [newItem] = await db
        .insert(schema.processedItems)
        .values(item)
        .returning();
      
      console.log(`[addProcessedItem] Elemento procesado creado con ID ${newItem.id} de tipo "${newItem.itemType}"`);
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
        // ========== SISTEMA MEJORADO DE DETECCIÓN DE PAQUETERÍAS ==========
        // Enfoque por niveles para identificar correctamente el tipo de ítem
        
        // Inicialización
        let isPackage = false;
        let detectionMethod = '';
        
        // ===== NIVEL 1: Indicadores explícitos (mayor confianza) =====
        if (item.type === 'package') {
          isPackage = true;
          detectionMethod = 'tipo explícito (item.type)';
        } 
        else if (item.itemType === 'package') {
          isPackage = true;
          detectionMethod = 'tipo explícito (item.itemType)';
        }
        else if (typeof item.cashItemId === 'string' && item.cashItemId.startsWith('paquete-')) {
          isPackage = true;
          detectionMethod = 'ID de caja con prefijo "paquete-"';
        }
        else if (item.originalPackageId !== undefined) {
          isPackage = true;
          detectionMethod = 'tiene originalPackageId';
        }
        
        // ===== NIVEL 2: Campos característicos (confianza media-alta) =====
        else if (item.packageDescription) {
          // Si tiene descripción de paquete y NO tiene pasajeros
          if (!(item.passengers && Array.isArray(item.passengers) && item.passengers.length > 0)) {
            isPackage = true;
            detectionMethod = 'tiene packageDescription sin pasajeros';
          }
        }
        else if (item.senderName && item.recipientName) {
          // Si tiene remitente Y destinatario
          isPackage = true;
          detectionMethod = 'tiene remitente y destinatario';
        }
        
        // ===== NIVEL 3: Otros indicadores específicos (confianza media) =====
        else if (item.deliveryStatus !== undefined) {
          isPackage = true;
          detectionMethod = 'tiene estado de entrega (deliveryStatus)';
        }
        else if (item.deliveredBy !== undefined || item.deliveredAt !== undefined) {
          isPackage = true;
          detectionMethod = 'tiene información de entrega (deliveredBy/At)';
        }
        else if (item.concept === 'Paquetería' || item.paymentNote === 'Paquetería') {
          isPackage = true;
          detectionMethod = 'concepto o nota de pago indica paquetería';
        }
        
        // ===== NIVEL 4: Verificación negativa (exclusión) =====
        // Si llegamos aquí sin decisión y tiene campos exclusivos de reservación, es definitivamente una reservación
        else if (item.passengers && Array.isArray(item.passengers) && item.passengers.length > 0) {
          isPackage = false;
          detectionMethod = 'tiene lista de pasajeros (definitivamente una reservación)';
        }
        else if (item.passengerId) {
          isPackage = false;
          detectionMethod = 'tiene ID de pasajero (definitivamente una reservación)';
        }
        
        // ===== REGISTRO DETALLADO PARA DEPURACIÓN =====
        console.log(`[createCutoff] ⚠️ CLASIFICACIÓN FINAL - Ítem #${item.id}: ${isPackage ? 'PAQUETERÍA' : 'RESERVACIÓN'}`);
        console.log(`[createCutoff] ⚠️ MÉTODO DE DETECCIÓN: ${detectionMethod}`);
        
        // Registro de campos clave para verificación
        console.log(`[createCutoff] ⚠️ CAMPOS CLAVE:`, {
          id: item.id,
          type: item.type,
          itemType: item.itemType,
          cashItemId: item.cashItemId,
          originalPackageId: item.originalPackageId,
          senderName: !!item.senderName,
          recipientName: !!item.recipientName,
          packageDescription: !!item.packageDescription,
          deliveryStatus: item.deliveryStatus,
          hasPassengers: !!(item.passengers && Array.isArray(item.passengers) && item.passengers.length > 0),
          passengerId: item.passengerId
        });
        
        
        // Registrar información de depuración sobre la identificación del tipo
        console.log(`[createCutoff] Identificación de ítem #${item.id}: ${isPackage ? 'PAQUETERÍA' : 'RESERVACIÓN'}`);
        console.log(`[createCutoff] Criterios de identificación para ítem #${item.id}:`, {
          originalPackageId: item.originalPackageId,
          type: item.type,
          itemType: item.itemType,
          concept: item.concept,
          paymentNote: item.paymentNote,
          hasSenderInfo: Boolean(item.senderName),
          hasReceiverInfo: Boolean(item.receiverName || item.recipientName),
          hasPackageDesc: Boolean(item.packageDescription),
          hasDeliveryStatus: Boolean(item.deliveryStatus),
          cashItemId: item.cashItemId
        });
        
        // Usar el método centralizado de normalización
        const simplePaymentMethod = this.normalizePaymentMethod(item.paymentMethod || '');
        
        console.log(`[createCutoff] Procesando método de pago - Original: "${item.paymentMethod}", Normalizado: "${simplePaymentMethod}"`);
        
        // Crear objeto con todos los detalles relevantes para guardar
        
        // Extraer información del pasajero/remitente
        let personName = 'No disponible';
        
        // Si el ítem tiene detalles específicos (enviados desde el frontend)
        if (item.details) {
          try {
            // Si ya vienen como objeto, usarlos directamente
            const details = typeof item.details === 'object' ? item.details : JSON.parse(item.details);
            if (details.passengerName) {
              personName = details.passengerName;
              console.log(`[createCutoff] Nombre del pasajero/remitente extraído de los detalles: ${personName}`);
            }
          } catch (e) {
            console.error(`[createCutoff] Error al procesar detalles del ítem:`, e);
          }
        } else if (isPackage) {
          // Si es paquete, usar senderName
          personName = item.senderName || 'Remitente sin nombre';
        } else if (item.passengers && Array.isArray(item.passengers) && item.passengers.length > 0) {
          // Si tiene pasajeros, usar el primero
          const passenger = item.passengers[0];
          personName = `${passenger.firstName || ''} ${passenger.lastName || ''}`.trim() || 'Pasajero sin nombre';
        }
        
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
          destinationFromItem: item.destination,
          passengerName: personName
        });
        
        // Procesar información de origen/destino de manera consistente
        const originDestInfo = await this.processOriginDestination(item);
        
        // CREAR REGISTRO EN BASE DE DATOS CON TIPO EXPLÍCITO
        // ===================================================
        
        // Importante: Usamos 'package' o 'reservation' de manera explícita y clara
        const itemTypeToSave = isPackage ? 'package' : 'reservation';
        
        // Detalle completo que se guardará en JSON según el tipo identificado
        const detailedInfo = isPackage ? {
          // Para PAQUETERÍAS - Usar campos específicos de paquetes
          type: 'package', // Explícitamente marcado como paquete
          id: item.id,
          originalPackageId: item.originalPackageId || item.id,
          
          // Información de origen/destino procesada
          origin: originDestInfo.origin,
          destination: originDestInfo.destination,
          
          // Información de viaje y ruta
          tripId: item.tripId,
          tripInfo: {
            processedOrigin: originDestInfo.origin,
            processedDestination: originDestInfo.destination,
            isSegment: originDestInfo.isSegment,
            routeInfo: item.trip?.route ? `${item.trip.route.origin} → ${item.trip.route.destination}` : null
          },
          
          // Información de pago
          amount: item.amount || item.totalAmount || 0,
          paymentMethod: item.paymentMethod || 'efectivo',
          simplePaymentMethod: simplePaymentMethod,
          
          // Información de remitente/destinatario
          senderName: item.senderName || '',
          senderLastName: item.senderLastName || '',
          recipientName: item.recipientName || '',
          recipientLastName: item.recipientLastName || '',
          
          // Información del paquete
          packageDescription: item.packageDescription || '',
          
          // Fechas relevantes
          createdAt: item.createdAt || new Date().toISOString(),
          paidAt: item.paidAt || item.paymentAt || new Date().toISOString()
        } : {
          // Para RESERVACIONES - Usar campos específicos de reservas
          type: 'reservation', // Explícitamente marcado como reservación
          id: item.id,
          
          // Información de origen/destino procesada
          origin: originDestInfo.origin,
          destination: originDestInfo.destination,
          
          // Información de viaje y ruta
          tripId: item.tripId,
          tripInfo: {
            processedOrigin: originDestInfo.origin,
            processedDestination: originDestInfo.destination,
            isSegment: originDestInfo.isSegment,
            routeInfo: item.trip?.route ? `${item.trip.route.origin} → ${item.trip.route.destination}` : null
          },
          
          // Información de pago
          amount: item.amount || item.totalAmount || 0,
          paymentMethod: item.paymentMethod || 'efectivo',
          simplePaymentMethod: simplePaymentMethod,
          
          // Información del pasajero
          passengers: item.passengers || [],
          passengerName: personName,
          
          // Fechas relevantes
          createdAt: item.createdAt || new Date().toISOString(),
          paidAt: item.paidAt || item.paymentAt || new Date().toISOString()
        };
        
        // Verificación FINAL importante
        console.log(`[createCutoff] ⚠️ GUARDANDO EN BD: Item #${item.id} como ${itemTypeToSave.toUpperCase()}`);
        
        // Usar la función mejorada de addProcessedItem para guardar con validación de tipo
        await this.addProcessedItem({
          cutoffId: cutoff.id,
          itemType: itemTypeToSave,
          itemId: isPackage ? (item.originalPackageId || item.id) : item.id,
          amount: item.amount || item.totalAmount || 0,
          paymentMethod: simplePaymentMethod,
          concept: isPackage ? 'Paquetería' : (item.paymentNote || 'Reservación'),
          details: JSON.stringify(detailedInfo)
        });
        
        // Analizar la información de origen/destino correcta
        const tripData = item.trip || null;
        
        // PUNTO CRÍTICO: Verificar si la información directa en item (origin/destination) tiene prioridad
        if (item.origin && item.destination) {
          console.log(`[createCutoff] Item ${item.id} tiene origen/destino directo:`, item.origin, item.destination);
        }
        
        // Verificar si hay información de segmento disponible (tiene prioridad)
        const hasSegments = tripData && tripData.segmentOrigin && tripData.segmentDestination;
        
        // Determinar la información de ruta apropiada con prioridad clara
        const originDestInfo = hasSegments 
          ? {
              // Prioridad 1: Información de segmento de viaje
              origin: tripData.segmentOrigin,
              destination: tripData.segmentDestination,
              isSegment: true
            }
          : tripData && tripData.route && tripData.route.origin && tripData.route.destination
            ? {
                // Prioridad 2: Información de ruta completa
                origin: tripData.route.origin,
                destination: tripData.route.destination,
                isSegment: false
              }
            : item.origin && item.destination
              ? {
                  // Prioridad 3: Información directa del ítem
                  origin: item.origin,
                  destination: item.destination,
                  isSegment: false
                }
              : {
                  // Fallback: Valores por defecto
                  origin: 'Origen pendiente de especificar',
                  destination: 'Destino pendiente de especificar',
                  isSegment: false
                };
                
        // Extraer nombre del viaje desde tripData o ítem
        const tripName = item.tripName || 
                      (tripData && tripData.route && tripData.route.name) || 
                      (isPackage ? "Paquetería" : "Sin ruta");
        
        console.log(`[createCutoff] Procesando origen/destino para ítem ${item.id}:`, originDestInfo);
        
        // Primero creamos un objeto base con propiedades comunes
        const baseInfo = {
          // Información básica
          id: item.id,
          
          // Información de ruta/viaje
          tripId: item.tripId,
          tripName: tripName || (item.trip ? `${item.trip.route?.name || 'Ruta'} - ${new Date(item.trip?.departureDate).toLocaleDateString()}` : ''),
          
          // Información de origen/destino
          origin: originDestInfo.origin,
          destination: originDestInfo.destination,
          departureDate: item.trip?.departureDate || '',
          departureTime: item.trip?.departureTime || '',
          
          // Información de pago
          amount: item.amount || item.totalAmount || 0,
          advanceAmount: item.advanceAmount || 0,
          paymentMethod: simplePaymentMethod,
          paymentMethodRaw: item.paymentMethod || '',
          
          // Información de viaje para PDF
          tripInfo: {
            segmentOrigin: item.trip?.segmentOrigin || null,
            segmentDestination: item.trip?.segmentDestination || null,
            routeOrigin: item.trip?.route?.origin || null,
            routeDestination: item.trip?.route?.destination || null,
            itemOrigin: item.origin,
            itemDestination: item.destination,
            processedOrigin: originDestInfo.origin,
            processedDestination: originDestInfo.destination,
            isSegment: originDestInfo.isSegment
          },
          
          // Metadatos
          companyId: item.companyId || item.trip?.companyId || '',
          companyName: item.companyInfo?.name || '',
          createdAt: item.createdAt || new Date().toISOString(),
          paidAt: item.paidAt || item.paymentAt || new Date().toISOString()
        };
        
        // Luego añadimos propiedades específicas según el tipo
        const detailedInfo = isPackage ? {
          ...baseInfo,
          // Tipo explícito para paqueterías
          type: 'package',
          concept: 'Paquetería',
          paymentNote: 'Paquetería',
          
          // Datos específicos de paqueterías
          sender: item.senderName ? `${item.senderName || ''} ${item.senderLastName || ''}`.trim() : personName,
          recipient: item.recipientName ? `${item.recipientName || ''} ${item.recipientLastName || ''}`.trim() : '',
          senderName: item.senderName || '',
          senderLastName: item.senderLastName || '',
          receiverName: item.recipientName || '',
          receiverLastName: item.recipientLastName || '',
          packageDescription: item.packageDescription || '',
          weight: item.weight || '',
          dimensions: item.dimensions || '',
          deliveryStatus: item.deliveryStatus || '',
          
          // Incluir el campo passengers como array vacío para mantener estructura consistente
          passengers: [],
          passengerCount: 0
        } : {
          ...baseInfo,
          // Tipo explícito para reservaciones
          type: 'reservation',
          concept: 'Reservación',
          paymentNote: item.isAdvancePayment ? 'Anticipo' : 'Pago completo',
          
          // Datos específicos de reservaciones
          passengerName: personName,
          passengerCount: item.passengerCount || (Array.isArray(item.passengers) ? item.passengers.length : 0),
          seatNumbers: item.seatNumbers || [],
          
          // Campos de pasajeros
          passengers: Array.isArray(item.passengers) ? 
            item.passengers.map((p: any) => ({
              firstName: p.firstName || '',
              lastName: p.lastName || '',
              phone: p.phone || '',
              email: p.email || ''
            })) : 
            (item.passengerName || item.firstName) ? 
              [{
                firstName: item.passengerName || item.firstName || '',
                lastName: item.passengerLastName || item.lastName || '',
                phone: item.phone || item.passengerPhone || '',
                email: item.email || item.passengerEmail || ''
              }] : [],
              
          // Incluir campos vacíos de paqueterías para mantener estructura consistente
          sender: '',
          recipient: '',
          senderName: '',
          senderLastName: '',
          receiverName: '',
          receiverLastName: '',
          packageDescription: '',
          weight: '',
          dimensions: '',
          deliveryStatus: ''
        };
          
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
        
        // PUNTO CRÍTICO: Guardar en la tabla de elementos procesados
        // Verificación DOBLE para asegurar que se guarde correctamente el tipo
        const itemTypeToSave = isPackage ? 'package' : 'reservation';
        
        // Verifica EXPLÍCITAMENTE que se use el tipo correcto
        console.log(`[createCutoff] GUARDANDO elemento ID=${item.id} con tipo "${itemTypeToSave}" (isPackage=${isPackage})`);
        
        // IMPORTANTE: Si se trata de una paquetería, asegurarnos que detailedInfo.type sea 'package'
        if (isPackage && detailedInfo.type !== 'package') {
          console.log(`[createCutoff] CORRIGIENDO tipo en detailedInfo para paquetería ID=${item.id}`);
          detailedInfo.type = 'package';
        }
        
        // Guardamos el elemento procesado
        await this.addProcessedItem({
          cutoffId: cutoff.id,
          itemType: itemTypeToSave, // Usando variable explícita para mayor claridad
          itemId: isPackage ? (item.originalPackageId || item.id) : item.id,
          amount: item.amount || item.totalAmount || 0,
          paymentMethod: simplePaymentMethod, // Usar el método normalizado, no el original
          concept: isPackage ? 'Paquetería' : (item.paymentNote || 'Reservación'),
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