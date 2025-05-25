import { Request, Response, Express } from "express";
import { IStorage } from "./storage";
import { getAuthMiddleware } from "./auth-session";

/**
 * Registra las rutas relacionadas con transacciones
 * @param app - Instancia de Express
 * @param storage - Instancia de IStorage
 */
export function registerTransactionRoutes(app: Express, storage: IStorage) {
  // Helper para rutas API
  const apiRouter = (path: string) => `/api${path}`;
  
  // Obtenemos el middleware de autenticación
  const isAuthenticated = getAuthMiddleware();
  
  // GET /api/transactions/pending - Obtener transacciones pendientes del usuario actual
  app.get(
    apiRouter("/transactions/pending"), 
    isAuthenticated, 
    async (req: Request, res: Response) => {
      try {
        // Verificar que el usuario está autenticado
        if (!req.user) {
          return res.status(401).json({ message: "No autenticado" });
        }
        
        // Obtener ID del usuario actual
        const userId = req.user.id;
        
        console.log(`[GET /transactions/pending] Consultando transacciones pendientes para usuario ${userId}`);
        
        // Obtener transacciones pendientes para el usuario
        const transactions = await storage.getPendingTransactionsByUserId(userId);
        
        console.log(`[GET /transactions/pending] Encontradas ${transactions.length} transacciones pendientes`);
        
        // Retornar las transacciones
        return res.json(transactions);
      } catch (error) {
        console.error("[GET /transactions/pending] Error:", error);
        return res.status(500).json({ 
          message: "Error al obtener transacciones pendientes",
          error: String(error)
        });
      }
    }
  );
}