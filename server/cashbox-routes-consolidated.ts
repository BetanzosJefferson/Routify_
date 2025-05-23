import { Express, Request, Response, NextFunction } from "express";
import { UserRole } from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import * as schema from "@shared/schema";
import * as cashboxFunctions from "./cashbox-functions";

/**
 * Registra las rutas relacionadas con el sistema de cajas (versión consolidada)
 * @param app - Instancia de Express
 * @param isAuthenticated - Middleware de autenticación
 */
export function registerCashboxRoutes(app: Express, isAuthenticated: (req: Request, res: Response, next: NextFunction) => void) {
  // Middleware para obtener el usuario de la sesión
  app.use("/api/cashbox", (req: Request, res: Response, next: NextFunction) => {
    // Si existe una sesión con usuario autenticado, guardarla en req.user
    if (req.session && (req.session as any).passport && (req.session as any).passport.user) {
      (req as any).user = (req.session as any).passport.user;
    }
    next();
  });

  // POST /api/cashbox/cutoff - Realizar corte de caja para el usuario actual
  app.post("/api/cashbox/cutoff", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const { notes } = req.body;
      
      // Verificar que el usuario tiene una caja asignada
      const userId = user.id;
      const companyId = user.companyId || user.company;
      
      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: "No se pudo determinar la compañía del usuario"
        });
      }
      
      // Obtener la caja del usuario
      const cashbox = await cashboxFunctions.getUserCashbox(userId, companyId);
      
      if (!cashbox) {
        return res.status(404).json({
          success: false,
          message: "No se encontró una caja asignada para el usuario"
        });
      }
      
      // Realizar el corte
      const result = await cashboxFunctions.createCashboxCutoff(userId, cashbox.id, notes);
      
      if (!result.success) {
        return res.status(400).json({
          success: false,
          message: result.message
        });
      }
      
      res.json({
        success: true,
        message: "Corte realizado exitosamente",
        cutoff: result.cutoff
      });
    } catch (error) {
      console.error(`Error al realizar corte de caja del usuario:`, error);
      res.status(500).json({
        success: false,
        message: "Error al realizar corte de caja"
      });
    }
  });

  // GET /api/cashbox/transactions - Obtener transacciones de la caja del usuario actual
  app.get("/api/cashbox/transactions", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const userId = user.id;
      const companyId = user.companyId || user.company;
      
      // Obtener la caja del usuario
      const cashbox = await cashboxFunctions.getUserCashbox(userId, companyId);
      
      if (!cashbox) {
        return res.json([]);
      }
      
      // Obtener transacciones
      const transactions = await cashboxFunctions.getCashboxTransactions(cashbox.id);
      
      res.json(transactions);
    } catch (error) {
      console.error(`Error al obtener transacciones:`, error);
      res.status(500).json({
        success: false,
        message: "Error al obtener las transacciones de la caja"
      });
    }
  });
}