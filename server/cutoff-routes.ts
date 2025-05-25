import { Request, Response } from "express";
import { apiRouter } from "./api-router";
import { storage } from "./server";

export function setupCutoffRoutes(app: any) {
  // Endpoint para crear un corte de caja
  app.post(apiRouter("/transactions/cutoff"), async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }
      
      const { total_ingresos, total_efectivo, total_transferencias } = req.body;
      
      if (typeof total_ingresos !== 'number' || typeof total_efectivo !== 'number' || typeof total_transferencias !== 'number') {
        return res.status(400).json({ 
          error: "Datos incorrectos. Se requieren los campos total_ingresos, total_efectivo y total_transferencias como números" 
        });
      }
      
      const ahora = new Date();
      
      // Crear un nuevo corte de caja
      const newBoxCutoff = await storage.createBoxCutoff({
        fecha_inicio: ahora,
        fecha_fin: ahora,
        total_ingresos,
        total_efectivo,
        total_transferencias,
        user_id: user.id
      });
      
      console.log(`[POST /transactions/cutoff] Corte de caja creado con ID: ${newBoxCutoff.id} para usuario ${user.id}`);
      
      return res.status(201).json({
        id: newBoxCutoff.id,
        message: "Corte de caja creado correctamente",
        corte: newBoxCutoff
      });
    } catch (error) {
      console.error("Error al crear corte de caja:", error);
      return res.status(500).json({ error: "Error al crear corte de caja" });
    }
  });
  
  // Endpoint para obtener los cortes de caja del usuario actual
  app.get(apiRouter("/transactions/cutoffs"), async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      if (!user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }
      
      const cutoffs = await storage.getBoxCutoffs(user.id);
      
      console.log(`[GET /transactions/cutoffs] Encontrados ${cutoffs.length} cortes de caja para usuario ${user.id}`);
      
      return res.json(cutoffs);
    } catch (error) {
      console.error("Error al obtener cortes de caja:", error);
      return res.status(500).json({ error: "Error al obtener cortes de caja" });
    }
  });
}