import { Express, Request, Response, NextFunction } from "express";
import * as cashboxFunctions from "./cashbox-functions";

/**
 * Registra las rutas relacionadas con el sistema de cajas (versión mínima)
 * @param app - Instancia de Express
 * @param isAuthenticated - Middleware de autenticación
 */
export function registerCashboxRoutes(app: Express, isAuthenticated: any) {
  // Middleware para obtener el usuario de la sesión
  app.use("/api/cashbox", function(req: Request, res: Response, next: NextFunction) {
    if (req.session && (req.session as any).passport && (req.session as any).passport.user) {
      (req as any).user = (req.session as any).passport.user;
    }
    next();
  });

  // POST /api/cashbox/cutoff - Realizar corte de caja para el usuario actual
  app.post("/api/cashbox/cutoff", isAuthenticated, function(req: Request, res: Response) {
    const user = (req as any).user;
    const notes = req.body.notes || "";
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Usuario no autenticado"
      });
    }
    
    const userId = user.id;
    const companyId = user.companyId || user.company;
    
    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "No se pudo determinar la compañía del usuario"
      });
    }
    
    // Ejecutar la función asíncrona en una función separada
    cashboxFunctions.getUserCashbox(userId, companyId)
      .then(cashbox => {
        if (!cashbox) {
          return res.status(404).json({
            success: false,
            message: "No se encontró una caja asignada para el usuario"
          });
        }
        
        return cashboxFunctions.createCashboxCutoff(userId, cashbox.id, notes);
      })
      .then(result => {
        if (!result || !result.success) {
          return res.status(400).json({
            success: false,
            message: result ? result.message : "Error al crear el corte de caja"
          });
        }
        
        res.json({
          success: true,
          message: "Corte realizado exitosamente",
          cutoff: result.cutoff
        });
      })
      .catch(error => {
        console.error(`Error al realizar corte de caja del usuario:`, error);
        res.status(500).json({
          success: false,
          message: "Error al realizar corte de caja"
        });
      });
  });

  // GET /api/cashbox/transactions - Obtener transacciones de la caja del usuario actual
  app.get("/api/cashbox/transactions", isAuthenticated, function(req: Request, res: Response) {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Usuario no autenticado"
      });
    }
    
    const userId = user.id;
    const companyId = user.companyId || user.company;
    
    // Ejecutar la función asíncrona en una función separada
    cashboxFunctions.getUserCashbox(userId, companyId)
      .then(cashbox => {
        if (!cashbox) {
          return res.json([]);
        }
        
        return cashboxFunctions.getCashboxTransactions(cashbox.id);
      })
      .then(transactions => {
        res.json(transactions || []);
      })
      .catch(error => {
        console.error(`Error al obtener transacciones:`, error);
        res.status(500).json({
          success: false,
          message: "Error al obtener las transacciones de la caja"
        });
      });
  });
}