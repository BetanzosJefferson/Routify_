import { Router } from "express";
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { cashPayments, cashCuts, reservations, trips, routes, users } from "@shared/schema";
import { isAuthenticated } from "../middleware/auth";

const router = Router();

// Middleware de autenticación para todas las rutas
router.use(isAuthenticated);

// Verificar roles permitidos (chofer, taquilla, checador)
function checkCashierRole(role: string): boolean {
  const allowedRoles = ["chofer", "taquilla", "checador"];
  return allowedRoles.includes(role.toLowerCase());
}

// Obtener todos los pagos en efectivo pendientes de corte
router.get("/cash-payments", async (req, res) => {
  try {
    // Verificar que el usuario tiene un rol permitido
    if (!req.user || !checkCashierRole(req.user.role)) {
      return res.status(403).json({ error: "No tienes permiso para acceder a esta sección" });
    }

    const companyId = req.user.companyId;
    
    // Obtener pagos en efectivo que no han sido procesados en un corte
    const paymentsResult = await db.select({
      id: cashPayments.id,
      reservationId: cashPayments.reservationId,
      tripId: cashPayments.tripId,
      amount: cashPayments.amount,
      paymentDate: cashPayments.createdAt,
      collectedBy: users.firstName,
      // Unir información de la reserva, viaje y ruta para obtener origen/destino
      passengerName: reservations.passengerName,
      origin: sql<string>`COALESCE(${trips.segmentOrigin}, ${routes.origin})`,
      destination: sql<string>`COALESCE(${trips.segmentDestination}, ${routes.destination})`,
    })
    .from(cashPayments)
    .leftJoin(reservations, eq(cashPayments.reservationId, reservations.id))
    .leftJoin(trips, eq(reservations.tripId, trips.id))
    .leftJoin(routes, eq(trips.routeId, routes.id))
    .leftJoin(users, eq(cashPayments.collectedById, users.id))
    .where(
      and(
        eq(cashPayments.companyId, companyId),
        eq(cashPayments.processed, false),
        eq(cashPayments.paymentMethod, "efectivo")
      )
    );

    res.json(paymentsResult);
  } catch (error) {
    console.error("Error al obtener pagos en efectivo:", error);
    res.status(500).json({ error: "Error al cargar los pagos en efectivo" });
  }
});

// Realizar un corte de caja
router.post("/cash-payments/clear", async (req, res) => {
  try {
    // Verificar que el usuario tiene un rol permitido
    if (!req.user || !checkCashierRole(req.user.role)) {
      return res.status(403).json({ error: "No tienes permiso para realizar cortes de caja" });
    }

    const { amount, userId } = req.body;
    const companyId = req.user.companyId;
    
    // Iniciar transacción para garantizar integridad
    const result = await db.transaction(async (tx) => {
      // 1. Crear registro del corte
      const [cutRecord] = await tx.insert(cashCuts).values({
        amount,
        userId: userId || req.user.id,
        companyId
      }).returning();
      
      // 2. Marcar todos los pagos en efectivo como procesados
      await tx.update(cashPayments)
        .set({ 
          processed: true,
          cashCutId: cutRecord.id
        })
        .where(
          and(
            eq(cashPayments.companyId, companyId),
            eq(cashPayments.processed, false),
            eq(cashPayments.paymentMethod, "efectivo")
          )
        );
      
      return cutRecord;
    });
    
    res.status(200).json(result);
  } catch (error) {
    console.error("Error al realizar corte de caja:", error);
    res.status(500).json({ error: "Error al procesar el corte de caja" });
  }
});

export default router;