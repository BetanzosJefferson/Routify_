import { Express, Request, Response } from "express";
import * as schema from "@shared/schema";
import { UserRole } from "@shared/schema";

/**
 * Registra las rutas relacionadas con las transacciones
 * @param app - Instancia de Express
 * @param storage - Almacenamiento de datos
 */
export function registerTransactionsRoutes(app: Express, storage: any) {
  
  // Middleware para verificar autenticación
  function isAuthenticated(req: Request, res: Response, next: any) {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ message: "No autenticado" });
    }
    next();
  }
  
  // GET /api/transactions - Obtener transacciones del usuario actual
  app.get('/api/transactions', isAuthenticated, async (req, res) => {
    try {
      const { user } = req as any;
      const userId = user.id;
      
      // Obtener transacciones del usuario
      const transactions = await storage.getTransactions({ usuarioId: userId });
      
      res.json(transactions);
    } catch (error) {
      console.error(`[GET /transactions] Error al obtener transacciones:`, error);
      res.status(500).json({
        success: false,
        message: "Error al obtener transacciones"
      });
    }
  });
  
  // POST /api/transactions - Crear una nueva transacción manualmente
  app.post('/api/transactions', isAuthenticated, async (req, res) => {
    try {
      const { user } = req as any;
      const userId = user.id;
      const { details } = req.body;
      
      if (!details) {
        return res.status(400).json({
          success: false,
          message: "Los detalles de la transacción son requeridos"
        });
      }
      
      // Crear la transacción
      const transaction = await storage.createTransaction({
        details,
        usuarioId: userId
      });
      
      res.json({
        success: true,
        message: "Transacción creada exitosamente",
        transaction
      });
    } catch (error) {
      console.error(`[POST /transactions] Error al crear transacción:`, error);
      res.status(500).json({
        success: false,
        message: "Error al crear transacción"
      });
    }
  });
}