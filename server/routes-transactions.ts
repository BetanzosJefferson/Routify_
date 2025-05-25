import { Express, Request, Response } from "express";
import { IStorage } from "./storage";
import authMiddleware from "./auth-middleware";

export function registerTransactionRoutes(app: Express, storage: IStorage) {
  // Ruta para obtener las transacciones pendientes (cutoffId === null) del usuario actual
  app.get("/api/transactions/pending", authMiddleware.authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "No autenticado" });
      }

      // Obtener todas las transacciones donde el creador es el usuario actual y cutoffId es NULL
      const transactions = await storage.getPendingTransactionsByUserId(userId);

      return res.status(200).json(transactions);
    } catch (error) {
      console.error("[GET /transactions/pending] Error:", error);
      return res.status(500).json({ message: "Error al obtener las transacciones pendientes" });
    }
  });
}