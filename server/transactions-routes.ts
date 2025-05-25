import { Request, Response, Express } from "express";
import { IStorage } from "./storage";
import { InsertTransaction } from "../shared/schema";
import { z } from "zod";

const transactionSchema = z.object({
  details: z.record(z.any()),
  usuarioId: z.number(),
  corteId: z.number().nullable().optional(),
  createdAt: z.date().optional()
});

export function registerTransactionsRoutes(app: Express, storage: IStorage) {
  // API endpoint para obtener todas las transacciones
  app.get("/api/transactions", async (req: Request, res: Response) => {
    try {
      // Implementar filtros de búsqueda
      const { 
        startDate,
        endDate,
        usuarioId,
        tipo,
        corteId
      } = req.query;
      
      // Convertir parámetros de consulta a tipos adecuados
      const filters: any = {};
      
      if (startDate && endDate) {
        filters.dateRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        };
      }
      
      if (usuarioId) {
        filters.usuarioId = Number(usuarioId);
      }
      
      if (tipo) {
        filters.tipo = tipo as string;
      }
      
      if (corteId) {
        filters.corteId = Number(corteId);
      }
      
      const transactions = await storage.getTransactions(filters);
      res.json(transactions);
    } catch (error) {
      console.error("Error al obtener transacciones:", error);
      res.status(500).json({ error: "Error al obtener transacciones" });
    }
  });

  // API endpoint para obtener una transacción específica
  app.get("/api/transactions/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const transaction = await storage.getTransaction(id);
      
      if (!transaction) {
        return res.status(404).json({ error: "Transacción no encontrada" });
      }
      
      res.json(transaction);
    } catch (error) {
      console.error(`Error al obtener transacción ${req.params.id}:`, error);
      res.status(500).json({ error: "Error al obtener la transacción" });
    }
  });

  // API endpoint para crear una nueva transacción
  app.post("/api/transactions", async (req: Request, res: Response) => {
    try {
      // Validar datos de entrada
      const validationResult = transactionSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Datos de transacción inválidos",
          details: validationResult.error.format()
        });
      }
      
      const transactionData: InsertTransaction = {
        details: req.body.details,
        usuarioId: req.body.usuarioId,
        corteId: req.body.corteId || null,
        createdAt: req.body.createdAt || new Date()
      };
      
      const newTransaction = await storage.createTransaction(transactionData);
      res.status(201).json(newTransaction);
    } catch (error) {
      console.error("Error al crear transacción:", error);
      res.status(500).json({ error: "Error al crear la transacción" });
    }
  });

  // API endpoint para actualizar una transacción (para asociar a un corte)
  app.patch("/api/transactions/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { corteId } = req.body;
      
      if (corteId === undefined) {
        return res.status(400).json({ error: "Se requiere el ID del corte" });
      }
      
      const updatedTransaction = await storage.updateTransaction(id, { 
        corteId: corteId === null ? null : Number(corteId)
      });
      
      if (!updatedTransaction) {
        return res.status(404).json({ error: "Transacción no encontrada" });
      }
      
      res.json(updatedTransaction);
    } catch (error) {
      console.error(`Error al actualizar transacción ${req.params.id}:`, error);
      res.status(500).json({ error: "Error al actualizar la transacción" });
    }
  });

  // API endpoint para obtener un resumen de transacciones por tipo
  app.get("/api/transactions/summary/by-type", async (req: Request, res: Response) => {
    try {
      const { 
        startDate,
        endDate,
        usuarioId,
        corteId
      } = req.query;
      
      // Convertir parámetros de consulta a tipos adecuados
      const filters: any = {};
      
      if (startDate && endDate) {
        filters.dateRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        };
      }
      
      if (usuarioId) {
        filters.usuarioId = Number(usuarioId);
      }
      
      if (corteId) {
        filters.corteId = Number(corteId);
      }
      
      const transactions = await storage.getTransactions(filters);
      
      // Agrupar transacciones por tipo y calcular totales
      const summary = transactions.reduce((acc: Record<string, number>, transaction) => {
        const tipo = transaction.details.tipo || 'otros';
        const monto = Number(transaction.details.monto) || 0;
        
        if (!acc[tipo]) {
          acc[tipo] = 0;
        }
        
        acc[tipo] += monto;
        return acc;
      }, {});
      
      res.json(summary);
    } catch (error) {
      console.error("Error al obtener resumen de transacciones:", error);
      res.status(500).json({ error: "Error al obtener resumen de transacciones" });
    }
  });
  
  // API endpoint para asignar transacciones a un corte
  app.post("/api/transactions/assign-to-cutoff", async (req: Request, res: Response) => {
    try {
      const { transactionIds, corteId } = req.body;
      
      if (!Array.isArray(transactionIds) || !corteId) {
        return res.status(400).json({ 
          error: "Se requieren los IDs de transacciones y el ID del corte" 
        });
      }
      
      const results = await Promise.all(
        transactionIds.map(id => 
          storage.updateTransaction(id, { corteId: Number(corteId) })
        )
      );
      
      const updatedCount = results.filter(Boolean).length;
      
      res.json({ 
        success: true, 
        message: `${updatedCount} transacciones asignadas al corte ${corteId}` 
      });
    } catch (error) {
      console.error("Error al asignar transacciones a corte:", error);
      res.status(500).json({ error: "Error al asignar transacciones a corte" });
    }
  });
}