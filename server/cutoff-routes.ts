import { Express, Request, Response } from "express";
import { cutoffService } from "./cutoff-service";

/**
 * Middleware de autenticación
 */
function isAuthenticated(req: Request, res: Response, next: any) {
  if (!(req as any).user) {
    return res.status(401).json({ message: "No autenticado" });
  }
  next();
}

/**
 * Registra las rutas relacionadas con los cortes de caja
 */
export function registerCutoffRoutes(app: Express) {
  
  // POST /api/cutoffs - Crear un nuevo corte
  app.post('/api/cutoffs', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const { notes, items } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Se requiere al menos un elemento para realizar el corte"
        });
      }
      
      console.log(`[POST /cutoffs] Usuario ${user.firstName} ${user.lastName} realizando corte con ${items.length} elementos`);
      
      const result = await cutoffService.createCutoff(user.id, items, notes);
      
      if (result.success) {
        res.json({
          success: true,
          message: "Corte realizado con éxito",
          cutoffId: result.cutoffId
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.message || "Error al realizar el corte"
        });
      }
    } catch (error) {
      console.error(`[POST /cutoffs] Error:`, error);
      res.status(500).json({
        success: false,
        message: "Error al procesar la solicitud"
      });
    }
  });
  
  // GET /api/cutoffs - Obtener todos los cortes del usuario
  app.get('/api/cutoffs', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      console.log(`[GET /cutoffs] Usuario ${user.firstName} ${user.lastName} solicitando sus cortes`);
      
      const cutoffs = await cutoffService.getCutoffsByOperator(user.id);
      
      res.json(cutoffs);
    } catch (error) {
      console.error(`[GET /cutoffs] Error:`, error);
      res.status(500).json({
        success: false,
        message: "Error al obtener los cortes"
      });
    }
  });
  
  // GET /api/cutoffs/:id - Obtener un corte específico con sus elementos
  app.get('/api/cutoffs/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const cutoffId = parseInt(req.params.id);
      
      if (isNaN(cutoffId)) {
        return res.status(400).json({
          success: false,
          message: "ID de corte inválido"
        });
      }
      
      console.log(`[GET /cutoffs/${cutoffId}] Usuario ${user.firstName} ${user.lastName} solicitando detalles del corte`);
      
      const result = await cutoffService.getCutoffDetails(cutoffId);
      
      // Verificar que el corte exista
      if (!result.cutoff) {
        return res.status(404).json({
          success: false,
          message: "Corte no encontrado"
        });
      }
      
      // Verificar que el usuario sea el propietario del corte o tenga permisos administrativos
      if (result.cutoff.operatorId !== user.id && !['admin', 'superAdmin', 'dueño'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: "No tienes permiso para ver este corte"
        });
      }
      
      res.json(result);
    } catch (error) {
      console.error(`[GET /cutoffs/:id] Error:`, error);
      res.status(500).json({
        success: false,
        message: "Error al obtener los detalles del corte"
      });
    }
  });
  
  // GET /api/cash-register/check - Verificar si un elemento ya ha sido procesado
  app.get('/api/cash-register/check', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { itemType, itemId } = req.query;
      
      if (!itemType || !itemId) {
        return res.status(400).json({
          success: false,
          message: "Se requiere tipo y ID del elemento"
        });
      }
      
      const processed = await cutoffService.isItemProcessed(
        itemType as string,
        parseInt(itemId as string)
      );
      
      res.json({
        success: true,
        processed
      });
    } catch (error) {
      console.error(`[GET /cash-register/check] Error:`, error);
      res.status(500).json({
        success: false,
        message: "Error al verificar el elemento"
      });
    }
  });
}