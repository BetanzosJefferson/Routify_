import { db } from "./db";
import { eq, and, isNull, or, desc } from "drizzle-orm";
import * as schema from "@shared/schema";
import * as cajaSchema from "@shared/caja-schema";

// Obtener transacciones sin cortar para un usuario
export async function getTransaccionesSinCortar(usuarioId: number, companyId: string) {
  try {
    console.log(`[getTransaccionesSinCortar] Obteniendo transacciones para usuario ${usuarioId} en compañía ${companyId}`);
    
    const transacciones = await db
      .select()
      .from(cajaSchema.cajaTransacciones)
      .where(
        and(
          eq(cajaSchema.cajaTransacciones.usuarioId, usuarioId),
          eq(cajaSchema.cajaTransacciones.companyId, companyId),
          eq(cajaSchema.cajaTransacciones.estado, cajaSchema.TransactionStatus.SIN_CORTAR)
        )
      )
      .orderBy(desc(cajaSchema.cajaTransacciones.createdAt));
    
    console.log(`[getTransaccionesSinCortar] Encontradas ${transacciones.length} transacciones sin cortar`);
    return transacciones;
  } catch (error) {
    console.error(`[getTransaccionesSinCortar] Error:`, error);
    return [];
  }
}

// Obtener todas las transacciones (cortadas y sin cortar) para un usuario
export async function getAllTransacciones(usuarioId: number, companyId: string, incluirCortadas: boolean = false) {
  try {
    console.log(`[getAllTransacciones] Obteniendo todas las transacciones para usuario ${usuarioId}`);
    
    let query = db
      .select()
      .from(cajaSchema.cajaTransacciones)
      .where(
        and(
          eq(cajaSchema.cajaTransacciones.usuarioId, usuarioId),
          eq(cajaSchema.cajaTransacciones.companyId, companyId)
        )
      );
    
    // Si no se incluyen las cortadas, filtrar solo por sin-cortar
    if (!incluirCortadas) {
      query = query.where(eq(cajaSchema.cajaTransacciones.estado, cajaSchema.TransactionStatus.SIN_CORTAR));
    }
    
    const transacciones = await query.orderBy(desc(cajaSchema.cajaTransacciones.createdAt));
    
    console.log(`[getAllTransacciones] Encontradas ${transacciones.length} transacciones`);
    return transacciones;
  } catch (error) {
    console.error(`[getAllTransacciones] Error:`, error);
    return [];
  }
}

// Registrar una transacción para anticipo de reservación
export async function registrarAnticipo(
  usuarioId: number, 
  companyId: string, 
  reservacionId: number,
  monto: number, 
  metodoPago: string,
  nombrePasajero?: string
) {
  try {
    console.log(`[registrarAnticipo] Registrando anticipo de ${monto} para reservación ${reservacionId}`);
    
    const [transaccion] = await db
      .insert(cajaSchema.cajaTransacciones)
      .values({
        usuarioId,
        companyId,
        tipo: cajaSchema.TransactionType.ANTICIPO,
        monto,
        metodoPago,
        estado: cajaSchema.TransactionStatus.SIN_CORTAR,
        reservacionId,
        descripcion: `Anticipo de reservación #${reservacionId}`,
        referencia: nombrePasajero || `Reservación #${reservacionId}`,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    console.log(`[registrarAnticipo] Transacción registrada con ID ${transaccion?.id}`);
    return transaccion;
  } catch (error) {
    console.error(`[registrarAnticipo] Error:`, error);
    return null;
  }
}

// Registrar una transacción para pago restante de reservación
export async function registrarPagoRestante(
  usuarioId: number, 
  companyId: string, 
  reservacionId: number,
  monto: number, 
  metodoPago: string,
  nombrePasajero?: string
) {
  try {
    console.log(`[registrarPagoRestante] Registrando pago restante de ${monto} para reservación ${reservacionId}`);
    
    const [transaccion] = await db
      .insert(cajaSchema.cajaTransacciones)
      .values({
        usuarioId,
        companyId,
        tipo: cajaSchema.TransactionType.RESTANTE,
        monto,
        metodoPago,
        estado: cajaSchema.TransactionStatus.SIN_CORTAR,
        reservacionId,
        descripcion: `Pago restante de reservación #${reservacionId}`,
        referencia: nombrePasajero || `Reservación #${reservacionId}`,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    console.log(`[registrarPagoRestante] Transacción registrada con ID ${transaccion?.id}`);
    return transaccion;
  } catch (error) {
    console.error(`[registrarPagoRestante] Error:`, error);
    return null;
  }
}

// Registrar una transacción para pago de paquetería
export async function registrarPagoPaqueteria(
  usuarioId: number, 
  companyId: string, 
  paqueteriaId: number,
  monto: number, 
  metodoPago: string,
  nombreRemitente?: string
) {
  try {
    console.log(`[registrarPagoPaqueteria] Registrando pago de ${monto} para paquetería ${paqueteriaId}`);
    
    const [transaccion] = await db
      .insert(cajaSchema.cajaTransacciones)
      .values({
        usuarioId,
        companyId,
        tipo: cajaSchema.TransactionType.PAQUETERIA,
        monto,
        metodoPago,
        estado: cajaSchema.TransactionStatus.SIN_CORTAR,
        paqueteriaId,
        descripcion: `Pago de paquetería #${paqueteriaId}`,
        referencia: nombreRemitente || `Paquetería #${paqueteriaId}`,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    console.log(`[registrarPagoPaqueteria] Transacción registrada con ID ${transaccion?.id}`);
    return transaccion;
  } catch (error) {
    console.error(`[registrarPagoPaqueteria] Error:`, error);
    return null;
  }
}

// Registrar una transacción para gasto
export async function registrarGasto(
  usuarioId: number, 
  companyId: string, 
  monto: number, 
  descripcion: string
) {
  try {
    console.log(`[registrarGasto] Registrando gasto de ${monto} con descripción: ${descripcion}`);
    
    const [transaccion] = await db
      .insert(cajaSchema.cajaTransacciones)
      .values({
        usuarioId,
        companyId,
        tipo: cajaSchema.TransactionType.GASTO,
        monto,
        metodoPago: cajaSchema.PaymentMethods.EFECTIVO, // Los gastos generalmente son en efectivo
        estado: cajaSchema.TransactionStatus.SIN_CORTAR,
        descripcion,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    console.log(`[registrarGasto] Transacción registrada con ID ${transaccion?.id}`);
    return transaccion;
  } catch (error) {
    console.error(`[registrarGasto] Error:`, error);
    return null;
  }
}

// Realizar corte de caja
export async function realizarCorte(
  usuarioId: number, 
  companyId: string,
  notas?: string
) {
  try {
    console.log(`[realizarCorte] Iniciando corte para usuario ${usuarioId}`);
    
    // 1. Obtener todas las transacciones sin cortar
    const transacciones = await getTransaccionesSinCortar(usuarioId, companyId);
    
    if (transacciones.length === 0) {
      console.log(`[realizarCorte] No hay transacciones para corte`);
      return {
        success: false,
        message: "No hay transacciones para realizar un corte"
      };
    }
    
    // 2. Calcular totales
    let totalEfectivo = 0;
    let totalTransferencia = 0;
    
    for (const transaccion of transacciones) {
      // Los gastos restan, el resto suma
      const esGasto = transaccion.tipo === cajaSchema.TransactionType.GASTO;
      const monto = esGasto ? -transaccion.monto : transaccion.monto;
      
      if (transaccion.metodoPago === cajaSchema.PaymentMethods.EFECTIVO) {
        totalEfectivo += monto;
      } else if (transaccion.metodoPago === cajaSchema.PaymentMethods.TRANSFERENCIA) {
        totalTransferencia += monto;
      }
    }
    
    const totalGeneral = totalEfectivo + totalTransferencia;
    
    // 3. Crear el registro de corte
    const [corte] = await db
      .insert(cajaSchema.cortesCaja)
      .values({
        usuarioId,
        companyId,
        totalEfectivo,
        totalTransferencia,
        totalGeneral,
        cantidadTransacciones: transacciones.length,
        notas: notas || "",
        createdAt: new Date()
      })
      .returning();
    
    if (!corte) {
      return {
        success: false,
        message: "Error al crear el registro de corte"
      };
    }
    
    // 4. Actualizar todas las transacciones para marcarlas como "cortadas"
    for (const transaccion of transacciones) {
      await db
        .update(cajaSchema.cajaTransacciones)
        .set({
          estado: cajaSchema.TransactionStatus.CORTADO,
          corteId: corte.id,
          updatedAt: new Date()
        })
        .where(eq(cajaSchema.cajaTransacciones.id, transaccion.id));
    }
    
    console.log(`[realizarCorte] Corte realizado con ID ${corte.id}, ${transacciones.length} transacciones actualizadas`);
    
    return {
      success: true,
      message: "Corte realizado con éxito",
      corte
    };
  } catch (error) {
    console.error(`[realizarCorte] Error:`, error);
    return {
      success: false,
      message: "Error al realizar el corte"
    };
  }
}

// Obtener historial de cortes
export async function getHistorialCortes(usuarioId: number, companyId: string) {
  try {
    console.log(`[getHistorialCortes] Obteniendo historial de cortes para usuario ${usuarioId}`);
    
    const cortes = await db
      .select()
      .from(cajaSchema.cortesCaja)
      .where(
        and(
          eq(cajaSchema.cortesCaja.usuarioId, usuarioId),
          eq(cajaSchema.cortesCaja.companyId, companyId)
        )
      )
      .orderBy(desc(cajaSchema.cortesCaja.createdAt));
    
    console.log(`[getHistorialCortes] Encontrados ${cortes.length} cortes`);
    return cortes;
  } catch (error) {
    console.error(`[getHistorialCortes] Error:`, error);
    return [];
  }
}

// Obtener transacciones de un corte específico
export async function getTransaccionesCorte(corteId: number) {
  try {
    console.log(`[getTransaccionesCorte] Obteniendo transacciones para corte ${corteId}`);
    
    const transacciones = await db
      .select()
      .from(cajaSchema.cajaTransacciones)
      .where(eq(cajaSchema.cajaTransacciones.corteId, corteId))
      .orderBy(desc(cajaSchema.cajaTransacciones.createdAt));
    
    console.log(`[getTransaccionesCorte] Encontradas ${transacciones.length} transacciones`);
    return transacciones;
  } catch (error) {
    console.error(`[getTransaccionesCorte] Error:`, error);
    return [];
  }
}

// Función auxiliar para sincronizar transacciones desde tablas existentes
// Esta función debe ejecutarse para cada usuario después de crear las tablas
export async function sincronizarTransaccionesUsuario(usuarioId: number) {
  try {
    console.log(`[sincronizarTransaccionesUsuario] Sincronizando transacciones para usuario ${usuarioId}`);
    
    // 1. Obtener todas las reservaciones donde el usuario creó o marcó como pagado
    const reservaciones = await db
      .select()
      .from(schema.reservations)
      .where(
        or(
          eq(schema.reservations.createdBy, usuarioId),
          eq(schema.reservations.paidBy, usuarioId)
        )
      );
    
    console.log(`[sincronizarTransaccionesUsuario] Procesando ${reservaciones.length} reservaciones`);
    
    let contadorTransacciones = 0;
    
    // 2. Procesar cada reservación
    for (const reservacion of reservaciones) {
      const companyId = reservacion.companyId || "compania-desconocida";
      
      // 2.1. Registrar anticipo si existe y lo creó este usuario
      if (reservacion.createdBy === usuarioId && reservacion.advanceAmount && reservacion.advanceAmount > 0) {
        await registrarAnticipo(
          usuarioId,
          companyId,
          reservacion.id,
          reservacion.advanceAmount,
          reservacion.advancePaymentMethod || "efectivo",
          reservacion.passengerName
        );
        contadorTransacciones++;
      }
      
      // 2.2. Registrar pago restante si fue pagado por este usuario
      if (reservacion.paidBy === usuarioId) {
        const montoRestante = (reservacion.totalAmount || 0) - (reservacion.advanceAmount || 0);
        
        if (montoRestante > 0) {
          await registrarPagoRestante(
            usuarioId,
            companyId,
            reservacion.id,
            montoRestante,
            reservacion.paymentMethod || "efectivo",
            reservacion.passengerName
          );
          contadorTransacciones++;
        }
      }
    }
    
    // 3. Obtener y procesar paqueterías
    const paqueterias = await db
      .select()
      .from(schema.packages)
      .where(
        or(
          eq(schema.packages.createdBy, usuarioId),
          eq(schema.packages.paidBy, usuarioId)
        )
      );
    
    console.log(`[sincronizarTransaccionesUsuario] Procesando ${paqueterias.length} paqueterías`);
    
    // 4. Procesar cada paquetería
    for (const paqueteria of paqueterias) {
      if (paqueteria.price && paqueteria.price > 0) {
        const companyId = paqueteria.companyId || "compania-desconocida";
        
        await registrarPagoPaqueteria(
          usuarioId,
          companyId,
          paqueteria.id,
          paqueteria.price,
          paqueteria.paymentMethod || "efectivo",
          paqueteria.senderName
        );
        contadorTransacciones++;
      }
    }
    
    console.log(`[sincronizarTransaccionesUsuario] Sincronización completada. Se crearon ${contadorTransacciones} transacciones`);
    return {
      success: true,
      count: contadorTransacciones
    };
  } catch (error) {
    console.error(`[sincronizarTransaccionesUsuario] Error:`, error);
    return {
      success: false,
      error: String(error)
    };
  }
}