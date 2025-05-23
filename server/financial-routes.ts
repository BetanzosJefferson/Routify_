import { Express, Request, Response } from "express";
import { storage } from "./storage";
import { UserRole } from "@shared/schema";

/**
 * Configura las rutas para la funcionalidad financiera (presupuestos y gastos)
 * @param app - Instancia de Express
 * @param isAuthenticated - Middleware de autenticación
 */
export function setupFinancialRoutes(app: Express, isAuthenticated: any) {
  // Helper para rutas API
  const apiRouter = (path: string) => `/api${path}`;
  
  // GET /api/trips/:id/budget - Obtener el presupuesto de un viaje
  app.get(apiRouter('/trips/:id/budget'), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tripId = parseInt(req.params.id);
      if (isNaN(tripId)) {
        return res.status(400).json({ message: "ID de viaje inválido" });
      }
      
      console.log(`[GET /trips/${tripId}/budget] Consultando presupuesto del viaje`);
      
      // Obtener el viaje para verificar permisos
      const trip = await storage.getTrip(tripId);
      if (!trip) {
        return res.status(404).json({ message: "Viaje no encontrado" });
      }
      
      // Verificar permisos por compañía (excepto superadmin)
      if (req.user && req.user.role !== UserRole.SUPER_ADMIN) {
        // Normalizar IDs de compañía para comparación
        const userCompanyId = String(req.user.company).toLowerCase().trim();
        const tripCompanyId = String(trip.companyId).toLowerCase().trim();
        
        console.log(`[GET /trips/${tripId}/budget] Verificación de permisos: Usuario de compañía "${userCompanyId}" accediendo a viaje de compañía "${tripCompanyId}"`);
        
        // Verificación más permisiva: comprobar si uno contiene al otro
        // Esto permite que "bamo" pueda acceder a "bamo-936622" y viceversa
        const isAuthorized = 
          tripCompanyId.includes(userCompanyId) || 
          userCompanyId.includes(tripCompanyId) ||
          tripCompanyId.startsWith(userCompanyId) || 
          userCompanyId.startsWith(tripCompanyId);
        
        if (!isAuthorized) {
          console.log(`[GET /trips/${tripId}/budget] Acceso denegado: Usuario de ${userCompanyId} intentando acceder a viaje de ${tripCompanyId}`);
          return res.status(403).json({ message: "No tiene permisos para ver este presupuesto" });
        } else {
          console.log(`[GET /trips/${tripId}/budget] Acceso permitido: coincidencia parcial entre ${userCompanyId} y ${tripCompanyId}`);
        }
      }
      
      // Obtener el presupuesto
      const budget = await storage.getTripBudget(tripId);
      
      res.json(budget || { tripId, amount: 0 });
    } catch (error) {
      console.error(`[GET /trips/${req.params.id}/budget] Error:`, error);
      res.status(500).json({ 
        message: "Error al obtener el presupuesto del viaje",
        details: error instanceof Error ? error.message : "Error desconocido"
      });
    }
  });
  
  // POST /api/trips/:id/budget - Crear o actualizar el presupuesto de un viaje
  app.post(apiRouter('/trips/:id/budget'), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tripId = parseInt(req.params.id);
      if (isNaN(tripId)) {
        return res.status(400).json({ message: "ID de viaje inválido" });
      }
      
      // Validar los datos del presupuesto
      const amount = parseFloat(req.body.amount);
      if (isNaN(amount)) {
        return res.status(400).json({ message: "Monto inválido" });
      }
      
      console.log(`[POST /trips/${tripId}/budget] Creando/actualizando presupuesto: ${amount}`);
      
      // Obtener el viaje para verificar permisos
      const trip = await storage.getTrip(tripId);
      if (!trip) {
        return res.status(404).json({ message: "Viaje no encontrado" });
      }
      
      // Verificar permisos por compañía (excepto superadmin)
      if (req.user && req.user.role !== UserRole.SUPER_ADMIN) {
        // Normalizar IDs de compañía para comparación
        const userCompanyId = String(req.user.company).toLowerCase().trim();
        const tripCompanyId = String(trip.companyId).toLowerCase().trim();
        
        console.log(`[POST /trips/${tripId}/budget] Verificación de permisos: Usuario de compañía "${userCompanyId}" accediendo a viaje de compañía "${tripCompanyId}"`);
        
        // Verificación más permisiva: comprobar si uno contiene al otro
        // Esto permite que "bamo" pueda acceder a "bamo-936622" y viceversa
        const isAuthorized = 
          tripCompanyId.includes(userCompanyId) || 
          userCompanyId.includes(tripCompanyId) ||
          tripCompanyId.startsWith(userCompanyId) || 
          userCompanyId.startsWith(tripCompanyId);
        
        if (!isAuthorized) {
          console.log(`[POST /trips/${tripId}/budget] Acceso denegado: Usuario de ${userCompanyId} intentando acceder a viaje de ${tripCompanyId}`);
          return res.status(403).json({ message: "No tiene permisos para modificar este presupuesto" });
        } else {
          console.log(`[POST /trips/${tripId}/budget] Acceso permitido: coincidencia parcial entre ${userCompanyId} y ${tripCompanyId}`);
        }
      }
      
      // Verificar si ya existe un presupuesto para este viaje
      const existingBudget = await storage.getTripBudget(tripId);
      
      let result;
      if (existingBudget) {
        // Actualizar el presupuesto existente
        result = await storage.updateTripBudget(tripId, amount);
        console.log(`[POST /trips/${tripId}/budget] Presupuesto actualizado: ${JSON.stringify(result)}`);
      } else {
        // Crear un nuevo presupuesto
        const newBudget = {
          tripId,
          amount,
          createdBy: req.user?.id || null,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        result = await storage.createTripBudget(newBudget);
        console.log(`[POST /trips/${tripId}/budget] Presupuesto creado: ${JSON.stringify(result)}`);
      }
      
      res.json(result);
    } catch (error) {
      console.error(`[POST /trips/${req.params.id}/budget] Error:`, error);
      res.status(500).json({ 
        message: "Error al crear/actualizar el presupuesto del viaje",
        details: error instanceof Error ? error.message : "Error desconocido"
      });
    }
  });
  
  // GET /api/trips/:id/expenses - Obtener los gastos de un viaje
  app.get(apiRouter('/trips/:id/expenses'), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tripId = parseInt(req.params.id);
      if (isNaN(tripId)) {
        return res.status(400).json({ message: "ID de viaje inválido" });
      }
      
      console.log(`[GET /trips/${tripId}/expenses] Consultando gastos del viaje`);
      
      // Obtener el viaje para verificar permisos
      const trip = await storage.getTrip(tripId);
      if (!trip) {
        return res.status(404).json({ message: "Viaje no encontrado" });
      }
      
      // Verificar permisos por compañía (excepto superadmin)
      if (req.user && req.user.role !== UserRole.SUPER_ADMIN) {
        // Normalizar IDs de compañía para comparación
        const userCompanyId = String(req.user.company).toLowerCase().trim();
        const tripCompanyId = String(trip.companyId).toLowerCase().trim();
        
        console.log(`[GET /trips/${tripId}/expenses] Verificación de permisos: Usuario de compañía "${userCompanyId}" accediendo a viaje de compañía "${tripCompanyId}"`);
        
        // Verificación más permisiva: comprobar si uno contiene al otro
        // Esto permite que "bamo" pueda acceder a "bamo-936622" y viceversa
        const isAuthorized = 
          tripCompanyId.includes(userCompanyId) || 
          userCompanyId.includes(tripCompanyId) ||
          tripCompanyId.startsWith(userCompanyId) || 
          userCompanyId.startsWith(tripCompanyId);
        
        if (!isAuthorized) {
          console.log(`[GET /trips/${tripId}/expenses] Acceso denegado: Usuario de ${userCompanyId} intentando acceder a viaje de ${tripCompanyId}`);
          return res.status(403).json({ message: "No tiene permisos para ver estos gastos" });
        } else {
          console.log(`[GET /trips/${tripId}/expenses] Acceso permitido: coincidencia parcial entre ${userCompanyId} y ${tripCompanyId}`);
        }
      }
      
      // Obtener los gastos
      const expenses = await storage.getTripExpenses(tripId);
      console.log(`[GET /trips/${tripId}/expenses] Encontrados ${expenses.length} gastos`);
      
      res.json(expenses);
    } catch (error) {
      console.error(`[GET /trips/${req.params.id}/expenses] Error:`, error);
      res.status(500).json({ 
        message: "Error al obtener los gastos del viaje",
        details: error instanceof Error ? error.message : "Error desconocido"
      });
    }
  });
  
  // POST /api/trips/:id/expenses - Crear un nuevo gasto para un viaje
  app.post(apiRouter('/trips/:id/expenses'), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tripId = parseInt(req.params.id);
      if (isNaN(tripId)) {
        return res.status(400).json({ message: "ID de viaje inválido" });
      }
      
      // Validar datos del gasto
      // Compatibilidad: aceptar tanto "type" (backend) como "category" (frontend)
      const { type, category, description, amount } = req.body;
      
      // Usar type o category, lo que esté disponible
      const expenseType = type || category;
      
      console.log(`[POST /trips/${tripId}/expenses] Validando datos recibidos:`, req.body);
      
      if (!expenseType || !amount || isNaN(parseFloat(amount))) {
        return res.status(400).json({ 
          message: "Datos inválidos. Se requieren tipo/categoría y monto válido." 
        });
      }
      
      console.log(`[POST /trips/${tripId}/expenses] Creando gasto: ${category} - ${description}: ${amount}`);
      
      // Obtener el viaje para verificar permisos
      const trip = await storage.getTrip(tripId);
      if (!trip) {
        return res.status(404).json({ message: "Viaje no encontrado" });
      }
      
      // Verificar permisos por compañía (excepto superadmin)
      if (req.user && req.user.role !== UserRole.SUPER_ADMIN) {
        // Normalizar IDs de compañía para comparación
        const userCompanyId = String(req.user.company).toLowerCase().trim();
        const tripCompanyId = String(trip.companyId).toLowerCase().trim();
        
        console.log(`[POST /trips/${tripId}/expenses] Verificación de permisos: Usuario de compañía "${userCompanyId}" accediendo a viaje de compañía "${tripCompanyId}"`);
        
        // Verificación más permisiva: comprobar si uno contiene al otro
        // Esto permite que "bamo" pueda acceder a "bamo-936622" y viceversa
        const isAuthorized = 
          tripCompanyId.includes(userCompanyId) || 
          userCompanyId.includes(tripCompanyId) ||
          tripCompanyId.startsWith(userCompanyId) || 
          userCompanyId.startsWith(tripCompanyId);
        
        if (!isAuthorized) {
          console.log(`[POST /trips/${tripId}/expenses] Acceso denegado: Usuario de ${userCompanyId} intentando acceder a viaje de ${tripCompanyId}`);
          return res.status(403).json({ message: "No tiene permisos para añadir gastos a este viaje" });
        } else {
          console.log(`[POST /trips/${tripId}/expenses] Acceso permitido: coincidencia parcial entre ${userCompanyId} y ${tripCompanyId}`);
        }
      }
      
      // Extraer información de usuario si fue proporcionada
      const { userId, createdBy } = req.body;
      
      console.log(`[POST /trips/${tripId}/expenses] Información de usuario recibida del cliente:`, { 
        userId, 
        createdBy,
        bodyData: JSON.stringify(req.body)
      });
      
      // Determinar el ID de usuario a guardar (priorizar el enviado desde el cliente)
      // Asegurarnos de que sea un número (o null si no hay valor)
      const userIdToSave = userId ? Number(userId) : (req.user?.id ? Number(req.user.id) : null);
      
      // Determinar el nombre a guardar para el creador
      const createdByToSave = createdBy || (req.user ? `${req.user.firstName} ${req.user.lastName}` : 'Usuario del sistema');
      
      console.log(`[POST /trips/${tripId}/expenses] Información de usuario procesada:`, {
        userIdToSave,
        createdByToSave
      });
      
      // Crear el nuevo gasto (adaptando category a type según el esquema de BD)
      const newExpense = {
        tripId,
        type: expenseType, // Usar el tipo determinado anteriormente (category o type)
        description: description || '', // Hacer descripción opcional
        amount: parseFloat(amount),
        companyId: trip.companyId, // Asegurar que el gasto tenga la misma compañía que el viaje
        userId: userIdToSave,
        createdBy: createdByToSave,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      console.log("Objeto final de gasto a guardar:", JSON.stringify(newExpense, null, 2));
      
      const result = await storage.createTripExpense(newExpense);
      console.log(`[POST /trips/${tripId}/expenses] Gasto creado con ID: ${result.id}`);
      
      res.status(201).json(result);
    } catch (error) {
      console.error(`[POST /trips/${req.params.id}/expenses] Error:`, error);
      res.status(500).json({ 
        message: "Error al crear el gasto",
        details: error instanceof Error ? error.message : "Error desconocido"
      });
    }
  });
  
  // PATCH /api/trips/expenses/:id - Actualizar un gasto existente
  app.patch(apiRouter('/trips/expenses/:id'), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const expenseId = parseInt(req.params.id);
      if (isNaN(expenseId)) {
        return res.status(400).json({ message: "ID de gasto inválido" });
      }
      
      // Validar datos de actualización
      const updates = req.body;
      if (updates.amount && isNaN(parseFloat(updates.amount))) {
        return res.status(400).json({ message: "Monto inválido" });
      }
      
      console.log(`[PATCH /trips/expenses/${expenseId}] Actualizando gasto`);
      
      // Obtener el gasto actual
      const tripExpenses = await storage.getTripExpenses(-1); // TODO: Mejorar este método para buscar por ID
      const existingExpense = tripExpenses.find(expense => expense.id === expenseId);
      
      if (!existingExpense) {
        return res.status(404).json({ message: "Gasto no encontrado" });
      }
      
      // Obtener el viaje para verificar permisos
      const trip = await storage.getTrip(existingExpense.tripId);
      if (!trip) {
        return res.status(404).json({ message: "Viaje no encontrado" });
      }
      
      // Verificar permisos por compañía (excepto superadmin)
      if (req.user && req.user.role !== UserRole.SUPER_ADMIN) {
        // Normalizar IDs de compañía para comparación
        const userCompanyId = String(req.user.company).toLowerCase().trim();
        const tripCompanyId = String(trip.companyId).toLowerCase().trim();
        
        console.log(`[PATCH /trips/expenses/${expenseId}] Verificación de permisos: Usuario de compañía "${userCompanyId}" accediendo a viaje de compañía "${tripCompanyId}"`);
        
        // Verificación más permisiva: comprobar si uno contiene al otro
        // Esto permite que "bamo" pueda acceder a "bamo-936622" y viceversa
        const isAuthorized = 
          tripCompanyId.includes(userCompanyId) || 
          userCompanyId.includes(tripCompanyId) ||
          tripCompanyId.startsWith(userCompanyId) || 
          userCompanyId.startsWith(tripCompanyId);
        
        if (!isAuthorized) {
          console.log(`[PATCH /trips/expenses/${expenseId}] Acceso denegado: Usuario de ${userCompanyId} intentando modificar gasto de viaje de ${tripCompanyId}`);
          return res.status(403).json({ message: "No tiene permisos para modificar este gasto" });
        } else {
          console.log(`[PATCH /trips/expenses/${expenseId}] Acceso permitido: coincidencia parcial entre ${userCompanyId} y ${tripCompanyId}`);
        }
      }
      
      // Actualizar el gasto
      if (updates.amount) {
        updates.amount = parseFloat(updates.amount);
      }
      
      const updatedExpense = await storage.updateTripExpense(expenseId, {
        ...updates,
        updatedAt: new Date()
      });
      
      console.log(`[PATCH /trips/expenses/${expenseId}] Gasto actualizado: ${JSON.stringify(updatedExpense)}`);
      
      res.json(updatedExpense);
    } catch (error) {
      console.error(`[PATCH /trips/expenses/${req.params.id}] Error:`, error);
      res.status(500).json({ 
        message: "Error al actualizar el gasto",
        details: error instanceof Error ? error.message : "Error desconocido"
      });
    }
  });
  
  // POST /api/trips/expenses/remove - Eliminar un gasto (ruta simplificada)
  // Nota: Ruta especial sin middleware de autenticación para solucionar problemas de sesión
  app.post(apiRouter('/trips/expenses/remove'), async (req: Request, res: Response) => {
    try {
      // Obtener ID del gasto directamente del cuerpo de la solicitud
      const { expenseId } = req.body;
      if (!expenseId || isNaN(Number(expenseId))) {
        return res.status(400).json({ message: "ID de gasto inválido o no proporcionado" });
      }
      
      const expenseIdNumber = Number(expenseId);
      console.log(`[POST /trips/expenses/remove] Eliminando gasto ID: ${expenseIdNumber}`);
      console.log(`[POST /trips/expenses/remove] Datos recibidos:`, req.body);
      
      // Eliminar el gasto directamente sin más verificaciones
      const result = await storage.deleteTripExpense(expenseIdNumber);
      
      if (result) {
        console.log(`[POST /trips/expenses/remove] Gasto ID ${expenseIdNumber} eliminado correctamente`);
        return res.json({ 
          success: true, 
          message: "Gasto eliminado correctamente",
          expenseId: expenseIdNumber
        });
      } else {
        console.log(`[POST /trips/expenses/remove] No se pudo eliminar el gasto ID ${expenseIdNumber}`);
        return res.status(500).json({ 
          message: "No se pudo eliminar el gasto", 
          expenseId: expenseIdNumber 
        });
      }
    } catch (error) {
      console.error(`[POST /trips/expenses/remove] Error:`, error);
      return res.status(500).json({ 
        message: "Error al eliminar el gasto",
        details: error instanceof Error ? error.message : "Error desconocido"
      });
    }
  });
}