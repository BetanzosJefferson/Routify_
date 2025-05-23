import express, { Request, Response } from "express";
import * as schema from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import * as cashboxFunctions from "./cashbox-functions";

export function registerCashboxRoutes(app: express.Express) {
  // POST /api/cashbox/cutoff - Realizar corte de caja para el usuario actual
  app.post("/api/cashbox/cutoff", async (req: Request, res: Response) => {
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

  // GET /api/cashboxes/:id/print/:cutoffId - Generar datos para impresión de ticket
  app.get("/api/cashboxes/:id/print/:cutoffId", async (req: Request, res: Response) => {
    try {
      const { id, cutoffId } = req.params;
      const { user } = req as any;
      
      // Obtener la caja para verificar permisos
      const cashbox = await cashboxFunctions.getCashbox(parseInt(id));
      
      if (!cashbox) {
        return res.status(404).json({
          success: false,
          message: "Caja no encontrada"
        });
      }
      
      // Verificar permisos
      const userCompanyId = user.companyId || user.company;
      if (user.role !== "super-admin" && cashbox.companyId !== userCompanyId) {
        return res.status(403).json({
          success: false,
          message: "No tiene permisos para ver esta caja"
        });
      }
      
      // Obtener el corte
      const cutoff = await cashboxFunctions.getCashboxCutoff(parseInt(cutoffId));
      
      if (!cutoff || cutoff.cashboxId !== parseInt(id)) {
        return res.status(404).json({
          success: false,
          message: "Corte no encontrado o no pertenece a esta caja"
        });
      }
      
      // Obtener información del operador
      const [operator] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, cutoff.operatorId as number));
      
      // Datos de impresión
      const printData = {
        success: true,
        cutoff: {
          ...cutoff,
          createdAt: cutoff.createdAt ? cutoff.createdAt.toLocaleString('es-MX') : new Date().toLocaleString('es-MX')
        },
        cashbox: {
          id: cashbox.id,
          name: cashbox.name,
          companyId: cashbox.companyId,
        },
        operator: operator ? {
          id: operator.id,
          name: `${operator.firstName} ${operator.lastName}`,
        } : null,
        company: {
          id: cashbox.companyId,
          name: "Tu empresa" // Esto debe ser reemplazado por el nombre real de la empresa
        },
        totalCash: cutoff.totalIncome, // Esto debe ajustarse con datos reales
        totalTransfer: 0, // Esto debe ajustarse con datos reales
        transactionCount: 0, // Esto debe ajustarse con datos reales
        totalAmount: cutoff.totalIncome
      };
      
      // Marcar el corte como impreso si no se ha hecho ya
      if (cutoff && !cutoff.printedAt) {
        await db
          .update(schema.cashboxCutoffs)
          .set({
            printedAt: new Date()
          })
          .where(eq(schema.cashboxCutoffs.id, parseInt(cutoffId)));
      }
      
      res.json(printData);
    } catch (error) {
      console.error(`Error al generar datos para impresión de ticket:`, error);
      res.status(500).json({
        success: false,
        message: "Error al generar datos para impresión"
      });
    }
  });
}