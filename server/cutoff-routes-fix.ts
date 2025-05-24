/**
 * Ruta adicional para solucionar el problema del modal de corte
 */
import { Express, Request, Response } from "express";
import { isAuthenticated } from "./middleware/auth";
import { storage } from "./storage";

export function registerCutoffFixRoutes(app: Express) {
  // Endpoint para obtener transacciones frescas para el corte
  app.get("/api/cashbox/transactions/fresh", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Usuario no autenticado"
        });
      }
      
      console.log(`[GET /cashbox/transactions/fresh] Solicitando transacciones frescas para ${user.firstName} ${user.lastName}`);
      
      // Obtener todas las transacciones de la caja del usuario
      const transactions = await storage.getCashboxTransactions(user.cashboxId || user.id);
      
      // Filtrar solo las transacciones que aún no han sido procesadas en un corte
      const activeTransactions = transactions.filter(t => !t.cutoffId);
      
      console.log(`[GET /cashbox/transactions/fresh] Se encontraron ${activeTransactions.length} transacciones activas para el usuario ${user.id}`);
      
      res.json(activeTransactions);
    } catch (error) {
      console.error("Error al obtener transacciones frescas:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener transacciones"
      });
    }
  });
}