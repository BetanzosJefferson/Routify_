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
        
        if (tripCompanyId !== userCompanyId) {
          console.log(`[GET /trips/${tripId}/budget] Acceso denegado: Usuario de ${userCompanyId} intentando acceder a viaje de ${tripCompanyId}`);
          return res.status(403).json({ message: "No tiene permisos para ver este presupuesto" });
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
        
        if (tripCompanyId !== userCompanyId) {
          console.log(`[POST /trips/${tripId}/budget] Acceso denegado: Usuario de ${userCompanyId} intentando acceder a viaje de ${tripCompanyId}`);
          return res.status(403).json({ message: "No tiene permisos para modificar este presupuesto" });
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
        
        if (tripCompanyId !== userCompanyId) {
          console.log(`[GET /trips/${tripId}/expenses] Acceso denegado: Usuario de ${userCompanyId} intentando acceder a viaje de ${tripCompanyId}`);
          return res.status(403).json({ message: "No tiene permisos para ver estos gastos" });
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
      const { category, description, amount } = req.body;
      if (!category || !description || isNaN(parseFloat(amount))) {
        return res.status(400).json({ 
          message: "Datos inválidos. Se requieren categoría, descripción y monto válido." 
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
        
        if (tripCompanyId !== userCompanyId) {
          console.log(`[POST /trips/${tripId}/expenses] Acceso denegado: Usuario de ${userCompanyId} intentando acceder a viaje de ${tripCompanyId}`);
          return res.status(403).json({ message: "No tiene permisos para añadir gastos a este viaje" });
        }
      }
      
      // Crear el nuevo gasto (adaptando category a type según el esquema de BD)
      const newExpense = {
        tripId,
        type: category, // Usar category como type para mantener compatibilidad
        description,
        amount: parseFloat(amount),
        companyId: trip.companyId, // Asegurar que el gasto tenga la misma compañía que el viaje
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
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
        
        if (tripCompanyId !== userCompanyId) {
          console.log(`[PATCH /trips/expenses/${expenseId}] Acceso denegado: Usuario de ${userCompanyId} intentando modificar gasto de viaje de ${tripCompanyId}`);
          return res.status(403).json({ message: "No tiene permisos para modificar este gasto" });
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
  
  // DELETE /api/trips/expenses/:id - Eliminar un gasto
  app.delete(apiRouter('/trips/expenses/:id'), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const expenseId = parseInt(req.params.id);
      if (isNaN(expenseId)) {
        return res.status(400).json({ message: "ID de gasto inválido" });
      }
      
      console.log(`[DELETE /trips/expenses/${expenseId}] Eliminando gasto`);
      
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
        const userCompany = req.user.company;
        if (trip.companyId !== userCompany) {
          console.log(`[DELETE /trips/expenses/${expenseId}] Acceso denegado: Usuario de ${userCompany} intentando eliminar gasto de viaje de ${trip.companyId}`);
          return res.status(403).json({ message: "No tiene permisos para eliminar este gasto" });
        }
      }
      
      // Eliminar el gasto
      const result = await storage.deleteTripExpense(expenseId);
      
      if (result) {
        console.log(`[DELETE /trips/expenses/${expenseId}] Gasto eliminado correctamente`);
        res.json({ success: true, message: "Gasto eliminado correctamente" });
      } else {
        console.log(`[DELETE /trips/expenses/${expenseId}] No se pudo eliminar el gasto`);
        res.status(500).json({ message: "No se pudo eliminar el gasto" });
      }
    } catch (error) {
      console.error(`[DELETE /trips/expenses/${req.params.id}] Error:`, error);
      res.status(500).json({ 
        message: "Error al eliminar el gasto",
        details: error instanceof Error ? error.message : "Error desconocido"
      });
    }
  });
}