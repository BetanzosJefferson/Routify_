import { Request, Response } from "express";
import { db } from "../db";
import { cashCuts, cashPayments, reservations, trips } from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { isAuthenticated, hasRole } from "../middleware/auth";
import { UserRole } from "@shared/schema";

// Roles que pueden acceder a la funcionalidad de caja
const CASHIER_ROLES = [
  UserRole.SUPER_ADMIN, 
  UserRole.OWNER, 
  UserRole.ADMIN, 
  UserRole.DRIVER, 
  UserRole.TICKET_OFFICE, 
  UserRole.CHECKER
];

// Obtener pagos en efectivo no procesados (pendientes)
export async function getPendingCashPayments(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    // Filtrar por compañía del usuario
    const companyId = req.user.companyId;

    // Obtener pagos pendientes
    const payments = await db.query.cashPayments.findMany({
      where: and(
        eq(cashPayments.companyId, companyId),
        eq(cashPayments.processed, false)
      ),
      with: {
        reservation: true,
        trip: true
      }
    });

    // Enriquecer los datos con información de nombres de pasajeros y rutas
    const enrichedPayments = await Promise.all(payments.map(async (payment) => {
      // Obtener nombre del primer pasajero de la reservación
      const passengerData = await db.query.passengers.findFirst({
        where: eq(reservations.id, payment.reservationId)
      });

      // Obtener origen y destino del viaje
      const tripData = await db.query.trips.findFirst({
        where: eq(trips.id, payment.tripId),
        with: {
          route: true
        }
      });

      return {
        ...payment,
        passengerName: passengerData?.name || "Pasajero",
        origin: tripData?.route?.origin || "",
        destination: tripData?.route?.destination || ""
      };
    }));

    return res.json(enrichedPayments);
  } catch (error) {
    console.error("Error al obtener pagos pendientes:", error);
    return res.status(500).json({ message: "Error al obtener pagos pendientes" });
  }
}

// Realizar un corte de caja
export async function createCashCut(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    // Filtrar por compañía del usuario
    const companyId = req.user.companyId;
    const userId = req.user.id;

    // Obtener pagos pendientes
    const pendingPayments = await db.query.cashPayments.findMany({
      where: and(
        eq(cashPayments.companyId, companyId),
        eq(cashPayments.processed, false)
      )
    });

    // Si no hay pagos pendientes, no se puede hacer corte
    if (pendingPayments.length === 0) {
      return res.status(400).json({ message: "No hay pagos pendientes para realizar un corte de caja" });
    }

    // Calcular el monto total
    const totalAmount = pendingPayments.reduce((sum, payment) => sum + payment.amount, 0);

    // Crear el corte de caja
    const [cashCut] = await db.insert(cashCuts).values({
      amount: totalAmount,
      userId: userId,
      companyId: companyId,
      paymentsCount: pendingPayments.length
    }).returning();

    // Actualizar los pagos para marcarlos como procesados
    for (const payment of pendingPayments) {
      await db.update(cashPayments)
        .set({
          processed: true,
          cashCutId: cashCut.id
        })
        .where(eq(cashPayments.id, payment.id));
    }

    return res.status(201).json(cashCut);
  } catch (error) {
    console.error("Error al crear corte de caja:", error);
    return res.status(500).json({ message: "Error al crear corte de caja" });
  }
}

// Obtener historial de cortes de caja
export async function getCashCuts(req: Request, res: Response) {
  try {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "No autenticado" });
    }

    // Filtrar por compañía del usuario
    const companyId = req.user.companyId;

    // Obtener cortes de caja
    const cuts = await db.query.cashCuts.findMany({
      where: eq(cashCuts.companyId, companyId),
      orderBy: [sql`${cashCuts.createdAt} DESC`],
      with: {
        user: true
      }
    });

    return res.json(cuts);
  } catch (error) {
    console.error("Error al obtener cortes de caja:", error);
    return res.status(500).json({ message: "Error al obtener cortes de caja" });
  }
}

// Configurar rutas de caja
export function setupCashPaymentsRoutes(app: any) {
  // Rutas para pagos en efectivo
  app.get('/api/cash-payments', isAuthenticated, hasRole(CASHIER_ROLES), getPendingCashPayments);
  
  // Rutas para cortes de caja
  app.post('/api/cash-cuts', isAuthenticated, hasRole(CASHIER_ROLES), createCashCut);
  app.get('/api/cash-cuts', isAuthenticated, hasRole(CASHIER_ROLES), getCashCuts);
}