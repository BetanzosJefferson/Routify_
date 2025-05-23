import { Express, Request, Response } from "express";
import { UserRole } from "@shared/schema";
import { and, eq, gte, lte } from "drizzle-orm";
import * as schema from "@shared/schema";

/**
 * Registra las rutas relacionadas con el sistema de cajas
 * @param app - Instancia de Express
 * @param storage - Almacenamiento de datos
 */
export function registerCashboxRoutes(app: Express, storage: any) {
  
  // Middleware para verificar autenticación
  function isAuthenticated(req: Request, res: Response, next: any) {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ message: "No autenticado" });
    }
    next();
  }

  // Middleware para verificar roles con acceso a cajas
  function hasCashboxAccess(req: Request, res: Response, next: any) {
    const user = (req as any).user;
    
    if (!user) {
      return res.status(401).json({ message: "No autenticado" });
    }
    
    // Roles que pueden acceder a las cajas
    const CASHBOX_ACCESS_ROLES = [
      UserRole.SUPER_ADMIN,
      UserRole.ADMIN,
      UserRole.OWNER,
      UserRole.TICKET_OFFICE,
      "taquilla", // variante española
      "dueño"     // variante española
    ];
    
    if (!CASHBOX_ACCESS_ROLES.includes(user.role)) {
      return res.status(403).json({ message: "Acceso denegado" });
    }
    
    next();
  }

  // GET /api/cashboxes - Obtener todas las cajas de la compañía
  app.get("/api/cashboxes", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const companyId = user.companyId || user.company;
      
      if (!companyId && user.role !== UserRole.SUPER_ADMIN) {
        return res.status(400).json({
          success: false,
          message: "No se pudo determinar la compañía del usuario"
        });
      }
      
      // Si es superadmin y no se proporciona companyId, obtener todas las cajas
      const filters = user.role === UserRole.SUPER_ADMIN ? {} : { companyId };
      const cashboxes = await storage.getCashboxes(companyId);
      
      res.json(cashboxes);
    } catch (error) {
      console.error("Error al obtener cajas:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener cajas"
      });
    }
  });

  // GET /api/cashboxes/:id - Obtener una caja específica
  app.get("/api/cashboxes/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { user } = req as any;
      
      // Obtener la caja
      const cashbox = await storage.getCashbox(parseInt(id));
      
      if (!cashbox) {
        return res.status(404).json({
          success: false,
          message: "Caja no encontrada"
        });
      }
      
      // Verificar permisos (superadmin puede ver cualquier caja, otros solo las de su compañía)
      const userCompanyId = user.companyId || user.company;
      if (user.role !== UserRole.SUPER_ADMIN && cashbox.companyId !== userCompanyId) {
        return res.status(403).json({
          success: false,
          message: "No tiene permisos para ver esta caja"
        });
      }
      
      res.json(cashbox);
    } catch (error) {
      console.error(`Error al obtener caja:`, error);
      res.status(500).json({
        success: false,
        message: "Error al obtener caja"
      });
    }
  });

  // GET /api/cashboxes/:id/transactions - Obtener transacciones de una caja
  app.get("/api/cashboxes/:id/transactions", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { user } = req as any;
      const { startDate, endDate, type, source } = req.query;
      
      // Obtener la caja para verificar permisos
      const cashbox = await storage.getCashbox(parseInt(id));
      
      if (!cashbox) {
        return res.status(404).json({
          success: false,
          message: "Caja no encontrada"
        });
      }
      
      // Verificar permisos
      const userCompanyId = user.companyId || user.company;
      if (user.role !== UserRole.SUPER_ADMIN && cashbox.companyId !== userCompanyId) {
        return res.status(403).json({
          success: false,
          message: "No tiene permisos para ver esta caja"
        });
      }
      
      // Preparar filtros
      const filters: any = {};
      
      if (startDate) filters.startDate = new Date(startDate as string);
      if (endDate) filters.endDate = new Date(endDate as string);
      if (type) filters.type = type as string;
      if (source) filters.source = source as string;
      
      // Obtener transacciones
      const transactions = await storage.getCashboxTransactions(parseInt(id), filters);
      
      res.json(transactions);
    } catch (error) {
      console.error(`Error al obtener transacciones:`, error);
      res.status(500).json({
        success: false,
        message: "Error al obtener transacciones"
      });
    }
  });

  // GET /api/cashboxes/:id/cutoffs - Obtener cortes de una caja
  app.get("/api/cashboxes/:id/cutoffs", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { user } = req as any;
      
      // Obtener la caja para verificar permisos
      const cashbox = await storage.getCashbox(parseInt(id));
      
      if (!cashbox) {
        return res.status(404).json({
          success: false,
          message: "Caja no encontrada"
        });
      }
      
      // Verificar permisos
      const userCompanyId = user.companyId || user.company;
      if (user.role !== UserRole.SUPER_ADMIN && cashbox.companyId !== userCompanyId) {
        return res.status(403).json({
          success: false,
          message: "No tiene permisos para ver esta caja"
        });
      }
      
      // Obtener cortes
      const cutoffs = await storage.getCashboxCutoffs(parseInt(id));
      
      res.json(cutoffs);
    } catch (error) {
      console.error(`Error al obtener cortes:`, error);
      res.status(500).json({
        success: false,
        message: "Error al obtener cortes"
      });
    }
  });

  // GET /api/cashboxes/user - Obtener caja del usuario actual
  app.get("/api/cashboxes/user", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const userId = user.id;
      const companyId = user.companyId || user.company;
      
      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: "No se pudo determinar la compañía del usuario"
        });
      }
      
      // Obtener o crear caja para el usuario
      const cashbox = await storage.getUserCashbox(userId, companyId);
      
      if (!cashbox) {
        return res.status(500).json({
          success: false,
          message: "Error al obtener o crear caja para el usuario"
        });
      }
      
      res.json(cashbox);
    } catch (error) {
      console.error(`Error al obtener caja del usuario:`, error);
      res.status(500).json({
        success: false,
        message: "Error al obtener caja del usuario"
      });
    }
  });

  // POST /api/cashboxes/:id/cutoff - Realizar corte de caja
  app.post("/api/cashboxes/:id/cutoff", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { user } = req as any;
      const { notes } = req.body;
      
      // Obtener la caja para verificar permisos
      const cashbox = await storage.getCashbox(parseInt(id));
      
      if (!cashbox) {
        return res.status(404).json({
          success: false,
          message: "Caja no encontrada"
        });
      }
      
      // Verificar permisos
      const userCompanyId = user.companyId || user.company;
      if (user.role !== UserRole.SUPER_ADMIN && cashbox.companyId !== userCompanyId) {
        return res.status(403).json({
          success: false,
          message: "No tiene permisos para hacer corte en esta caja"
        });
      }
      
      // Verificar si el usuario es el operador de la caja u otro con permisos (admin, superadmin)
      const hasPermission = 
        user.id === cashbox.operatorId || 
        user.role === UserRole.SUPER_ADMIN || 
        user.role === UserRole.ADMIN || 
        user.role === "dueño" || 
        user.role === UserRole.OWNER;
      
      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: "Solo el operador de la caja o un administrador puede realizar cortes"
        });
      }
      
      // Realizar el corte
      const result = await storage.createCashboxCutoff(user.id, parseInt(id), notes);
      
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
      console.error(`Error al realizar corte:`, error);
      res.status(500).json({
        success: false,
        message: "Error al realizar corte"
      });
    }
  });

  // GET /api/cashboxes/:id/cutoffs/:cutoffId - Obtener detalles de un corte específico
  app.get("/api/cashboxes/:id/cutoffs/:cutoffId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id, cutoffId } = req.params;
      const { user } = req as any;
      
      // Obtener la caja para verificar permisos
      const cashbox = await storage.getCashbox(parseInt(id));
      
      if (!cashbox) {
        return res.status(404).json({
          success: false,
          message: "Caja no encontrada"
        });
      }
      
      // Verificar permisos
      const userCompanyId = user.companyId || user.company;
      if (user.role !== UserRole.SUPER_ADMIN && cashbox.companyId !== userCompanyId) {
        return res.status(403).json({
          success: false,
          message: "No tiene permisos para ver esta caja"
        });
      }
      
      // Obtener el corte
      const cutoff = await storage.getCashboxCutoff(parseInt(cutoffId));
      
      if (!cutoff || cutoff.cashboxId !== parseInt(id)) {
        return res.status(404).json({
          success: false,
          message: "Corte no encontrado o no pertenece a esta caja"
        });
      }
      
      // Obtener las transacciones asociadas a este corte
      const transactions = await storage.getCashboxTransactions(parseInt(id), { 
        cutoffId: parseInt(cutoffId) 
      });
      
      // Obtener información del operador
      const operator = await storage.getUserById(cutoff.operatorId);
      
      // Obtener información de la compañía
      const company = await storage.getCompanyById(cashbox.companyId);
      
      res.json({
        cutoff,
        transactions,
        cashbox,
        operator: operator ? {
          id: operator.id,
          name: `${operator.firstName} ${operator.lastName}`,
          role: operator.role
        } : null,
        company
      });
    } catch (error) {
      console.error(`Error al obtener detalles del corte:`, error);
      res.status(500).json({
        success: false,
        message: "Error al obtener detalles del corte"
      });
    }
  });

  // POST /api/cashboxes/:id/transactions - Crear transacción manual
  app.post("/api/cashboxes/:id/transactions", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { user } = req as any;
      const { type, amount, description, paymentMethod } = req.body;
      
      // Obtener la caja para verificar permisos
      const cashbox = await storage.getCashbox(parseInt(id));
      
      if (!cashbox) {
        return res.status(404).json({
          success: false,
          message: "Caja no encontrada"
        });
      }
      
      // Verificar permisos
      const userCompanyId = user.companyId || user.company;
      if (user.role !== UserRole.SUPER_ADMIN && cashbox.companyId !== userCompanyId) {
        return res.status(403).json({
          success: false,
          message: "No tiene permisos para esta caja"
        });
      }
      
      // Validar datos
      if (!type || !amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Datos inválidos para la transacción"
        });
      }
      
      // Crear la transacción
      const transaction = {
        cashboxId: parseInt(id),
        type,
        source: schema.TransactionSource.MANUAL,
        amount,
        description: description || "Transacción manual",
        createdBy: user.id,
        paymentMethod: paymentMethod || "Efectivo"
      };
      
      const newTransaction = await storage.createCashboxTransaction(transaction);
      
      res.json({
        success: true,
        message: "Transacción creada exitosamente",
        transaction: newTransaction
      });
    } catch (error) {
      console.error(`Error al crear transacción:`, error);
      res.status(500).json({
        success: false,
        message: "Error al crear transacción"
      });
    }
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
      const cashbox = await storage.getUserCashbox(userId, companyId);
      
      if (!cashbox) {
        return res.status(404).json({
          success: false,
          message: "No se encontró una caja asignada para el usuario"
        });
      }
      
      // Realizar el corte
      const result = await storage.createCashboxCutoff(userId, cashbox.id, notes);
      
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
  app.get("/api/cashboxes/:id/print/:cutoffId", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id, cutoffId } = req.params;
      const { user } = req as any;
      
      // Obtener la caja para verificar permisos
      const cashbox = await storage.getCashbox(parseInt(id));
      
      if (!cashbox) {
        return res.status(404).json({
          success: false,
          message: "Caja no encontrada"
        });
      }
      
      // Verificar permisos
      const userCompanyId = user.companyId || user.company;
      if (user.role !== UserRole.SUPER_ADMIN && cashbox.companyId !== userCompanyId) {
        return res.status(403).json({
          success: false,
          message: "No tiene permisos para ver esta caja"
        });
      }
      
      // Obtener el corte
      const cutoff = await storage.getCashboxCutoff(parseInt(cutoffId));
      
      if (!cutoff || cutoff.cashboxId !== parseInt(id)) {
        return res.status(404).json({
          success: false,
          message: "Corte no encontrado o no pertenece a esta caja"
        });
      }
      
      // Obtener las transacciones asociadas a este corte
      const transactions = await storage.getCashboxTransactions(parseInt(id), { 
        cutoffId: parseInt(cutoffId)
      });
      
      // Obtener información del operador
      const operator = await storage.getUserById(cutoff.operatorId);
      
      // Obtener información de la compañía
      const company = await storage.getCompanyById(cashbox.companyId);
      
      // Marcar el corte como impreso
      if (!cutoff.printedAt) {
        await storage.updateCashboxCutoff(parseInt(cutoffId), {
          printedAt: new Date()
        });
      }
      
      res.json({
        success: true,
        printData: {
          cutoff,
          transactions,
          cashbox,
          operator: operator ? {
            id: operator.id,
            name: `${operator.firstName} ${operator.lastName}`,
            role: operator.role
          } : null,
          company,
          printDate: new Date()
        }
      });
    } catch (error) {
      console.error(`Error al generar datos para impresión:`, error);
      res.status(500).json({
        success: false,
        message: "Error al generar datos para impresión"
      });
    }
  });
}