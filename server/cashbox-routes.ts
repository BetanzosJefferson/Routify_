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
  
  // GET /api/cashbox/:id/transactions - Obtener transacciones de una caja específica (para admins y dueños)
  app.get('/api/cashbox/:id/transactions', isAuthenticated, async (req, res) => {
    try {
      const { user } = req as any;
      const cashboxId = parseInt(req.params.id);
      
      // Verificar permisos - solo dueños y admins pueden ver cajas de otros
      if (user.role !== "dueño" && user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN) {
        return res.status(403).json({
          success: false,
          message: "No tiene permisos para acceder a esta información"
        });
      }
      
      // Importar el servicio de cortes para verificar elementos procesados
      const { cutoffService } = await import('./cutoff-service');
      
      // Obtener todas las reservaciones
      const allReservations = await storage.getReservations();
      
      // Obtener información de la caja
      const cashbox = await storage.getCashboxById(cashboxId);
      if (!cashbox) {
        return res.status(404).json({
          success: false,
          message: "Caja no encontrada"
        });
      }
      
      // Verificar que la caja pertenezca a la misma compañía que el usuario
      const userCompanyId = user.companyId || user.company;
      if (cashbox.companyId !== userCompanyId) {
        return res.status(403).json({
          success: false,
          message: "No tiene permisos para acceder a esta caja"
        });
      }
      
      // Obtener el operador de la caja
      const operatorId = cashbox.operatorId;
      
      console.log(`[GET /cashbox/${cashboxId}/transactions] Usuario ${user.firstName} ${user.lastName} solicitando datos de la caja ${cashboxId} (operador: ${operatorId})`);
      
      // Array para almacenar los ítems de caja (anticipos y restantes)
      let cashboxItems: any[] = [];
      
      // Recorrer todas las reservaciones
      for (const reservation of allReservations) {
        // Verificar si esta reservación ya ha sido procesada en algún corte
        const isProcessed = await cutoffService.isItemProcessed('reservation', reservation.id);
        
        // Si ya está procesada, omitirla
        if (isProcessed) {
          console.log(`[GET /cashbox/${cashboxId}/transactions] Reserva ${reservation.id} ya procesada en un corte anterior, omitiendo`);
          continue;
        }
        
        // 1. Anticipos: Si el operador creó la reservación y tiene anticipo
        if (reservation.createdBy === operatorId && reservation.advanceAmount && reservation.advanceAmount > 0) {
          console.log(`[GET /cashbox/${cashboxId}/transactions] Anticipo de ${reservation.advanceAmount} de reserva ${reservation.id}`);
          
          // Crear un ítem de caja para el anticipo
          cashboxItems.push({
            ...reservation,
            totalAmount: reservation.advanceAmount, // Solo monto del anticipo
            paymentNote: "Anticipo", // Indicamos que es un anticipo
            paymentMethod: reservation.advancePaymentMethod,
            paymentDate: reservation.createdAt,
            cashItemId: `anticipo-${reservation.id}`,
            originalReservationId: reservation.id
          });
        }
        
        // 2. Pagos restantes: Si el operador marcó como pagado el restante
        if (reservation.paidBy === operatorId) {
          const restanteAmount = (reservation.totalAmount || 0) - (reservation.advanceAmount || 0);
          
          // Solo incluir si hay monto restante
          if (restanteAmount > 0) {
            console.log(`[GET /cashbox/${cashboxId}/transactions] Restante de ${restanteAmount} de reserva ${reservation.id}`);
            
            // Crear un ítem de caja para el pago restante
            cashboxItems.push({
              ...reservation,
              totalAmount: restanteAmount, // Solo monto del restante
              paymentNote: "Restante", // Indicamos que es un restante
              paymentMethod: reservation.paymentMethod,
              paymentDate: reservation.paidAt,
              cashItemId: `restante-${reservation.id}`,
              originalReservationId: reservation.id
            });
          }
        }
      }
      
      // Procesar paqueterías
      try {
        const allPackages = await storage.getPackages();
        
        for (const packageItem of allPackages) {
          // Verificar si esta paquetería ya ha sido procesada en algún corte
          const isProcessed = await cutoffService.isItemProcessed('package', packageItem.id);
          
          // Si ya está procesada, omitirla
          if (isProcessed) {
            console.log(`[GET /cashbox/${cashboxId}/transactions] Paquetería ${packageItem.id} ya procesada en un corte anterior, omitiendo`);
            continue;
          }
          
          // Verificar si el paquete fue registrado por el operador de la caja
          if (packageItem.createdBy === operatorId) {
            console.log(`[GET /cashbox/${cashboxId}/transactions] Paquetería ${packageItem.id} registrada por operador ${operatorId}`);
            
            // Crear un ítem de caja para la paquetería
            cashboxItems.push({
              ...packageItem,
              totalAmount: packageItem.price,
              paymentNote: "Paquetería", 
              paymentMethod: packageItem.paymentMethod || "efectivo",
              paymentDate: packageItem.paidAt || packageItem.createdAt,
              cashItemId: `paquete-${packageItem.id}`,
              originalPackageId: packageItem.id
            });
          }
        }
      } catch (error) {
        console.error(`[GET /cashbox/${cashboxId}/transactions] Error al procesar paqueterías:`, error);
      }
      
      console.log(`[GET /cashbox/${cashboxId}/transactions] Se encontraron ${cashboxItems.length} ítems para la caja ${cashboxId}`);
      
      // Enriquecer con información de compañía
      const enrichedItems = await Promise.all(
        cashboxItems.map(async (item) => {
          // Obtener la compañía del viaje
          let companyId = null;
          let companyName = "Desconocida";
          
          if (item.trip && item.trip.companyId) {
            companyId = item.trip.companyId;
            
            try {
              const company = await storage.getCompanyById(companyId);
              if (company) {
                companyName = company.name || companyId;
              }
            } catch (err) {
              console.error(`Error al obtener información de la compañía ${companyId}:`, err);
            }
          }
          
          return {
            ...item,
            companyInfo: {
              id: companyId,
              name: companyName
            }
          };
        })
      );
      
      res.json(enrichedItems);
    } catch (error) {
      console.error(`[GET /cashbox/:id/transactions] Error:`, error);
      res.status(500).json({ error: "Error al obtener transacciones de la caja" });
    }
  });
  
  // GET /api/cashbox/transactions - Obtener anticipos y pagos restantes registrados por el usuario
  app.get('/api/cashbox/transactions', isAuthenticated, async (req, res) => {
    try {
      const { user } = req as any;
      console.log(`[GET /cashbox/transactions] Usuario ${user.firstName} ${user.lastName} solicitando datos de caja`);
      
      // Importar el servicio de cortes para verificar elementos procesados
      const { cutoffService } = await import('./cutoff-service');
      
      // Obtener todas las reservaciones para procesarlas (incluyendo las del usuario actual)
      const allReservations = await storage.getReservations(undefined, undefined, user.id);
      console.log(`[GET /cashbox/transactions] Analizando ${allReservations.length} reservaciones para la caja del usuario ${user.id}`);
      
      // Array para almacenar los ítems de caja (anticipos y restantes)
      let cashboxItems: any[] = [];
      
      // Recorrer todas las reservaciones
      for (const reservation of allReservations) {
        // Verificar si esta reservación ya ha sido procesada en algún corte
        const isProcessed = await cutoffService.isItemProcessed('reservation', reservation.id);
        
        // Si ya está procesada, omitirla
        if (isProcessed) {
          console.log(`[GET /cashbox/transactions] Reserva ${reservation.id} ya procesada en un corte anterior, omitiendo`);
          continue;
        }
        
        // 1. Anticipos: Si el usuario creó la reservación y tiene anticipo
        if (reservation.createdBy === user.id && reservation.advanceAmount && reservation.advanceAmount > 0) {
          console.log(`[GET /cashbox/transactions] Anticipo de ${reservation.advanceAmount} de reserva ${reservation.id}`);
          
          // Crear un ítem de caja para el anticipo
          cashboxItems.push({
            ...reservation,
            totalAmount: reservation.advanceAmount, // Solo monto del anticipo
            paymentNote: "Anticipo", // Indicamos que es un anticipo
            paymentMethod: reservation.advancePaymentMethod,
            paymentDate: reservation.createdAt,
            cashItemId: `anticipo-${reservation.id}`,
            originalReservationId: reservation.id
          });
        }
        
        // 2. Pagos restantes: Si el usuario marcó como pagado el restante
        if (reservation.paidBy === user.id) {
          const restanteAmount = (reservation.totalAmount || 0) - (reservation.advanceAmount || 0);
          
          // Solo incluir si hay monto restante
          if (restanteAmount > 0) {
            console.log(`[GET /cashbox/transactions] Restante de ${restanteAmount} de reserva ${reservation.id}`);
            
            // Crear un ítem de caja para el pago restante
            cashboxItems.push({
              ...reservation,
              totalAmount: restanteAmount, // Solo monto del restante
              paymentNote: "Restante", // Indicamos que es un restante
              paymentMethod: reservation.paymentMethod,
              paymentDate: reservation.paidAt,
              cashItemId: `restante-${reservation.id}`,
              originalReservationId: reservation.id
            });
          }
        }
      }
      
      // Obtener todas las paqueterías para añadirlas a la caja
      try {
        const allPackages = await storage.getPackages();
        
        // Recorrer todas las paqueterías
        for (const packageItem of allPackages) {
          // Verificar si esta paquetería ya ha sido procesada en algún corte
          const isProcessed = await cutoffService.isItemProcessed('package', packageItem.id);
          
          // Si ya está procesada, omitirla
          if (isProcessed) {
            console.log(`[GET /cashbox/transactions] Paquetería ${packageItem.id} ya procesada en un corte anterior, omitiendo`);
            continue;
          }
          
          // Si el usuario creó o procesó el pago de la paquetería
          if (packageItem.createdBy === user.id || packageItem.paidBy === user.id) {
            console.log(`[GET /cashbox/transactions] Paquetería ${packageItem.id} registrada por usuario ${user.id}`);
            
            // Crear un ítem de caja para la paquetería
            cashboxItems.push({
              ...packageItem,
              totalAmount: packageItem.price,
              paymentNote: "Paquetería", 
              paymentMethod: packageItem.paymentMethod || "efectivo",
              paymentDate: packageItem.paidAt || packageItem.createdAt,
              cashItemId: `paquete-${packageItem.id}`,
              originalPackageId: packageItem.id
            });
          }
        }
      } catch (error) {
        console.error('[GET /cashbox/transactions] Error al procesar paqueterías:', error);
      }
      
      console.log(`[GET /cashbox/transactions] Se encontraron ${cashboxItems.length} ítems para el usuario ${user.id}`);
      
      // Enriquecer con información de compañía para usuarios especiales
      if ([UserRole.TICKET_OFFICE, UserRole.OWNER, UserRole.ADMIN, "dueño"].includes(user.role)) {
        const enrichedItems = await Promise.all(
          cashboxItems.map(async (item) => {
            // Obtener la compañía del viaje
            let companyId = null;
            let companyName = "Desconocida";
            
            if (item.trip && item.trip.companyId) {
              companyId = item.trip.companyId;
              
              try {
                const company = await storage.getCompanyById(companyId);
                if (company) {
                  companyName = company.name || companyId;
                }
              } catch (err) {
                console.error(`Error al obtener información de la compañía ${companyId}:`, err);
              }
            }
            
            return {
              ...item,
              companyInfo: {
                id: companyId,
                name: companyName
              }
            };
          })
        );
        
        return res.json(enrichedItems);
      }
      
      // Para usuarios normales
      return res.json(cashboxItems);
    } catch (error) {
      console.error('[GET /cashbox/transactions] Error:', error);
      res.status(500).json({ error: "Error al obtener transacciones de caja" });
    }
  });

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

  // GET /api/cashboxes/company/with-transactions - Obtener cajas de la compañía que tienen transacciones
  app.get("/api/cashboxes/company/with-transactions", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      // Solo permitir acceso a usuarios con rol DUEÑO o ADMIN
      if (user.role !== "dueño" && user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN) {
        return res.status(403).json({
          success: false,
          message: "No tiene permisos para acceder a esta información"
        });
      }
      
      const companyId = user.companyId || user.company;
      
      if (!companyId) {
        return res.status(400).json({
          success: false,
          message: "No se pudo determinar la compañía del usuario"
        });
      }
      
      // Obtener cajas con transacciones
      const cashboxes = await storage.getCashboxesWithTransactions(companyId);
      
      res.json(cashboxes);
    } catch (error) {
      console.error("Error al obtener cajas con transacciones:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener cajas con transacciones"
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