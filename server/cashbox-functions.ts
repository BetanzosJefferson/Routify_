import { db } from "./db";
import { eq, and, isNull, gt, isNotNull, desc } from "drizzle-orm";
import * as schema from "@shared/schema";

// Función para actualizar un corte
export async function updateCashboxCutoff(id: number, update: Partial<schema.CashboxCutoff>): Promise<schema.CashboxCutoff | undefined> {
  try {
    const [updatedCutoff] = await db
      .update(schema.cashboxCutoffs)
      .set({
        ...update,
        updatedAt: new Date()
      })
      .where(eq(schema.cashboxCutoffs.id, id))
      .returning();
    
    return updatedCutoff;
  } catch (error) {
    console.error(`[updateCashboxCutoff] Error al actualizar corte ${id}:`, error);
    return undefined;
  }
}

// Obtener la caja asignada a un usuario
export async function getUserCashbox(userId: number, companyId: string): Promise<schema.Cashbox | undefined> {
  try {
    console.log(`[getUserCashbox] Buscando caja para usuario ${userId} en compañía ${companyId}`);
    
    // Buscar caja donde el operador sea este usuario
    const [cashbox] = await db
      .select()
      .from(schema.cashboxes)
      .where(
        and(
          eq(schema.cashboxes.operatorId, userId),
          eq(schema.cashboxes.companyId, companyId),
          eq(schema.cashboxes.isActive, true)
        )
      );
    
    if (cashbox) {
      console.log(`[getUserCashbox] Caja encontrada: (ID: ${cashbox.id})`);
      return cashbox;
    }
    
    // Si no hay caja asignada al usuario, crear una automáticamente
    console.log(`[getUserCashbox] No se encontró caja para el usuario ${userId}. Creando una automáticamente.`);
    
    // Obtener información del usuario para el nombre de la caja
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId));
    
    if (!user) {
      console.error(`[getUserCashbox] No se encontró el usuario ${userId}`);
      return undefined;
    }
    
    // Crear nueva caja para el usuario
    const newCashbox: schema.InsertCashbox = {
      companyId,
      name: `Caja de ${user.firstName} ${user.lastName}`,
      description: `Caja automática para ${user.firstName} ${user.lastName}`,
      balance: 0,
      operatorId: userId,
      isActive: true
    };
    
    // Insertar la nueva caja
    const [createdCashbox] = await db
      .insert(schema.cashboxes)
      .values(newCashbox)
      .returning();
    
    if (createdCashbox) {
      console.log(`[getUserCashbox] Nueva caja creada con ID: ${createdCashbox.id}`);
      return createdCashbox;
    }
    
    return undefined;
  } catch (error) {
    console.error(`[getUserCashbox] Error al buscar/crear caja para usuario ${userId}:`, error);
    return undefined;
  }
}

// Obtener todas las cajas de una compañía
export async function getCashboxes(companyId: string): Promise<schema.Cashbox[]> {
  try {
    console.log(`[getCashboxes] Obteniendo cajas para la compañía ${companyId}`);
    
    const cashboxes = await db
      .select()
      .from(schema.cashboxes)
      .where(eq(schema.cashboxes.companyId, companyId))
      .orderBy(desc(schema.cashboxes.createdAt));
    
    console.log(`[getCashboxes] Se encontraron ${cashboxes.length} cajas para la compañía ${companyId}`);
    return cashboxes;
  } catch (error) {
    console.error(`[getCashboxes] Error al obtener cajas para compañía ${companyId}:`, error);
    return [];
  }
}

// Obtener una caja específica por ID
export async function getCashbox(id: number): Promise<schema.Cashbox | undefined> {
  try {
    console.log(`[getCashbox] Buscando caja con ID ${id}`);
    
    const [cashbox] = await db
      .select()
      .from(schema.cashboxes)
      .where(eq(schema.cashboxes.id, id));
    
    if (!cashbox) {
      console.log(`[getCashbox] No se encontró la caja con ID ${id}`);
      return undefined;
    }
    
    console.log(`[getCashbox] Caja encontrada: ${cashbox.name} (ID: ${cashbox.id})`);
    return cashbox;
  } catch (error) {
    console.error(`[getCashbox] Error al buscar caja con ID ${id}:`, error);
    return undefined;
  }
}

// Actualizar una caja
export async function updateCashbox(id: number, update: Partial<schema.Cashbox>): Promise<schema.Cashbox | undefined> {
  try {
    console.log(`[updateCashbox] Actualizando caja con ID ${id}`);
    
    const [updatedCashbox] = await db
      .update(schema.cashboxes)
      .set({
        ...update,
        updatedAt: new Date()
      })
      .where(eq(schema.cashboxes.id, id))
      .returning();
    
    if (!updatedCashbox) {
      console.log(`[updateCashbox] No se encontró la caja con ID ${id}`);
      return undefined;
    }
    
    console.log(`[updateCashbox] Caja actualizada: ${updatedCashbox.name} (ID: ${updatedCashbox.id})`);
    return updatedCashbox;
  } catch (error) {
    console.error(`[updateCashbox] Error al actualizar caja ${id}:`, error);
    return undefined;
  }
}

// Crear un corte de caja
export async function createCashboxCutoff(userId: number, cashboxId: number, notes?: string): Promise<{
  success: boolean;
  message: string;
  cutoff?: schema.CashboxCutoff;
}> {
  try {
    console.log(`[createCashboxCutoff] Creando corte para la caja ${cashboxId} por el usuario ${userId}`);
    
    // 1. Verificar que la caja exista y pertenezca al usuario
    const cashbox = await getCashbox(cashboxId);
    if (!cashbox) {
      return {
        success: false,
        message: "No se encontró la caja especificada"
      };
    }
    
    if (cashbox.operatorId !== userId) {
      return {
        success: false,
        message: "No tienes permiso para realizar un corte en esta caja"
      };
    }
    
    // 2. Calcular totales para el corte (efectivo y transferencia)
    let totalCash = 0;
    let totalTransfer = 0;
    let transactionCount = 0;
    
    // Obtener las reservaciones pagadas por este usuario que no están en un corte previo
    const reservations = await db
      .select()
      .from(schema.reservations)
      .where(
        and(
          eq(schema.reservations.paidBy, userId),
          eq(schema.reservations.paymentStatus, "paid"),
          isNotNull(schema.reservations.advanceAmount)
        )
      );
    
    // Calcular totales de las reservaciones
    for (const reservation of reservations) {
      const amount = reservation.advanceAmount || 0;
      if (reservation.paymentMethod === "efectivo") {
        totalCash += amount;
      } else if (reservation.paymentMethod === "transferencia") {
        totalTransfer += amount;
      }
      transactionCount++;
    }
    
    // Obtener los paquetes pagados por este usuario
    const packages = await db
      .select()
      .from(schema.packages)
      .where(
        and(
          eq(schema.packages.createdBy, userId),
          eq(schema.packages.isPaid, true)
        )
      );
    
    // Calcular totales de los paquetes
    for (const pkg of packages) {
      const amount = pkg.price || 0;
      if (pkg.paymentMethod === "efectivo") {
        totalCash += amount;
      } else if (pkg.paymentMethod === "transferencia") {
        totalTransfer += amount;
      }
      transactionCount++;
    }
    
    const totalAmount = totalCash + totalTransfer;
    
    // 3. Crear el registro de corte
    const [cutoff] = await db.insert(schema.cashboxCutoffs).values({
      cashboxId,
      operatorId: userId,
      previousBalance: cashbox.balance || 0,
      totalIncome: totalAmount,
      totalExpenses: 0,
      finalBalance: (cashbox.balance || 0) + totalAmount,
      notes: notes || "",
      createdAt: new Date()
    }).returning();
    
    if (!cutoff) {
      return {
        success: false,
        message: "Error al crear el registro de corte"
      };
    }
    
    // 4. Actualizar la caja
    await updateCashbox(cashboxId, {
      lastCutoffAt: new Date(),
      balance: (cashbox.balance || 0) + totalAmount
    });
    
    return {
      success: true,
      message: "Corte realizado exitosamente",
      cutoff
    };
  } catch (error) {
    console.error("[createCashboxCutoff] Error:", error);
    return {
      success: false,
      message: "Error interno al crear el corte de caja"
    };
  }
}

// Obtener los cortes de una caja específica
export async function getCashboxCutoffs(cashboxId: number): Promise<schema.CashboxCutoff[]> {
  try {
    const cutoffs = await db
      .select()
      .from(schema.cashboxCutoffs)
      .where(eq(schema.cashboxCutoffs.cashboxId, cashboxId))
      .orderBy(desc(schema.cashboxCutoffs.createdAt));
    
    return cutoffs;
  } catch (error) {
    console.error(`[getCashboxCutoffs] Error al obtener cortes de caja ${cashboxId}:`, error);
    return [];
  }
}

// Obtener un corte específico
export async function getCashboxCutoff(id: number): Promise<schema.CashboxCutoff | undefined> {
  try {
    const [cutoff] = await db
      .select()
      .from(schema.cashboxCutoffs)
      .where(eq(schema.cashboxCutoffs.id, id));
    
    return cutoff;
  } catch (error) {
    console.error(`[getCashboxCutoff] Error al obtener corte ${id}:`, error);
    return undefined;
  }
}

// Obtener las transacciones de una caja
export async function getCashboxTransactions(cashboxId: number): Promise<any[]> {
  try {
    console.log(`[getCashboxTransactions] Obteniendo transacciones para caja ${cashboxId}`);
    
    const transactions = [];
    
    // 1. Obtener reservaciones que pertenecen a esta caja
    const cashbox = await getCashbox(cashboxId);
    if (!cashbox) return [];
    
    const operatorId = cashbox.operatorId;
    
    // Obtener reservaciones pagadas por este operador
    const reservations = await db
      .select()
      .from(schema.reservations)
      .where(
        and(
          eq(schema.reservations.paidBy, operatorId),
          eq(schema.reservations.paymentStatus, "paid")
        )
      );
    
    console.log(`[getCashboxTransactions] Encontradas ${reservations.length} reservaciones pagadas por operador ${operatorId}`);
    
    // Convertir reservaciones a transacciones
    for (const reservation of reservations) {
      // 1. Registrar el anticipo si existe
      if (reservation.advanceAmount && reservation.advanceAmount > 0) {
        transactions.push({
          id: `adv-${reservation.id}`,
          type: 'reservation',
          source: 'advance',
          description: `Anticipo de reservación #${reservation.id}`,
          amount: reservation.advanceAmount,
          paymentMethod: reservation.advancePaymentMethod || reservation.paymentMethod,
          createdAt: reservation.createdAt,
          reservationId: reservation.id,
          passengerName: reservation.passengerName
        });
      }
      
      // 2. Registrar el pago restante (la diferencia entre total y anticipo)
      const remainingAmount = (reservation.totalAmount || 0) - (reservation.advanceAmount || 0);
      if (remainingAmount > 0) {
        transactions.push({
          id: `rem-${reservation.id}`,
          type: 'reservation',
          source: 'remaining',
          description: `Pago restante de reservación #${reservation.id}`,
          amount: remainingAmount,
          paymentMethod: reservation.paymentMethod,
          createdAt: reservation.paidAt || reservation.updatedAt || reservation.createdAt,
          reservationId: reservation.id,
          passengerName: reservation.passengerName
        });
      }
    }
    
    // También obtener reservaciones donde el usuario registró el anticipo pero otro usuario registró el pago final
    const advanceReservations = await db
      .select()
      .from(schema.reservations)
      .where(
        and(
          eq(schema.reservations.createdBy, operatorId),
          isNotNull(schema.reservations.advanceAmount),
          gt(schema.reservations.advanceAmount, 0)
        )
      );
    
    console.log(`[getCashboxTransactions] Encontradas ${advanceReservations.length} reservaciones con anticipos registrados por operador ${operatorId}`);
    
    // Registrar solo los anticipos de estas reservaciones
    for (const reservation of advanceReservations) {
      // Evitar duplicados (si el mismo usuario registró anticipo y pago completo)
      if (reservation.paidBy === operatorId) {
        continue;
      }
      
      transactions.push({
        id: `adv-${reservation.id}`,
        type: 'reservation',
        source: 'advance',
        description: `Anticipo de reservación #${reservation.id}`,
        amount: reservation.advanceAmount || 0,
        paymentMethod: reservation.advancePaymentMethod || 'efectivo',
        createdAt: reservation.createdAt,
        reservationId: reservation.id,
        passengerName: reservation.passengerName
      });
    }
    
    // 2. Obtener paquetes creados o pagados por este operador
    const packages = await db
      .select()
      .from(schema.packages)
      .where(
        and(
          eq(schema.packages.createdBy, operatorId),
          eq(schema.packages.isPaid, true)
        )
      );
    
    console.log(`[getCashboxTransactions] Encontrados ${packages.length} paquetes registrados por operador ${operatorId}`);
    
    // Convertir paquetes a transacciones
    for (const pkg of packages) {
      transactions.push({
        id: `pkg-${pkg.id}`,
        type: 'package',
        source: 'payment',
        description: `Pago de paquete #${pkg.id}`,
        amount: pkg.price || 0,
        paymentMethod: pkg.paymentMethod || 'efectivo',
        createdAt: pkg.createdAt,
        packageId: pkg.id,
        senderName: pkg.senderName
      });
    }
    
    // Ordenar por fecha
    const sortedTransactions = transactions.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    console.log(`[getCashboxTransactions] Total transacciones encontradas: ${sortedTransactions.length}`);
    return sortedTransactions;
  } catch (error) {
    console.error(`[getCashboxTransactions] Error al obtener transacciones para caja ${cashboxId}:`, error);
    return [];
  }
}