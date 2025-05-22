import express, { Request, Response } from "express";
import { IStorage } from "./storage";
import { UserRole } from "@shared/schema";
import type { User } from "@shared/schema";

export function registerFinancialRoutes(app: express.Express, storage: IStorage, apiRouter: (path: string) => string) {
  
  // Endpoint para obtener datos financieros de todos los viajes
  app.get(apiRouter("/trips/financials"), async (req: Request, res: Response) => {
    try {
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      if (!user) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      // Verificar permisos: solo dueños y administradores pueden ver esta información
      if (user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN && user.role !== "dueño") {
        console.log(`[GET /trips/financials] Acceso denegado para rol: ${user.role}`);
        return res.status(403).json({ message: "No autorizado" });
      }
      
      console.log(`[GET /trips/financials] Usuario: ${user.firstName} ${user.lastName}`);
      console.log(`[GET /trips/financials] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      
      // Obtener companyId del usuario
      const companyId = user.companyId || user.company;
      
      if (!companyId && user.role === "dueño") {
        console.log(`[GET /trips/financials] ADVERTENCIA: Usuario dueño sin compañía asignada`);
        return res.status(400).json({ message: "Datos incompletos: usuario sin compañía asignada" });
      }
      
      // Filtrar por compañía si el usuario es dueño
      const filterByCompany = user.role === "dueño" ? companyId : undefined;
      
      // Obtener todos los viajes (ya filtrados por compañía si es necesario)
      console.log(`[GET /trips/financials] Obteniendo viajes para ${filterByCompany ? `compañía ${filterByCompany}` : 'todas las compañías'}`);
      const trips = await storage.getTrips(filterByCompany ? { companyId: filterByCompany } : undefined);
      
      // Datos financieros a retornar
      const financialData = await Promise.all(trips.map(async (trip) => {
        const tripId = trip.id;
        
        // Obtener la ruta asociada al viaje
        const route = await storage.getRoute(trip.routeId);
        
        // Obtener vehículo y conductor
        let vehicle = null;
        let driver = null;
        
        if (trip.vehicleId) {
          vehicle = await storage.getVehicle(trip.vehicleId);
        }
        
        if (trip.driverId) {
          driver = await storage.getDriver(trip.driverId);
        }
        
        // Obtener todas las reservaciones del viaje
        const reservations = await storage.getReservations({ tripId });
        
        // Filtrar solo reservaciones pagadas para el cálculo de ventas
        const paidReservations = reservations.filter(reservation => 
          reservation.paymentStatus === 'paid'
        );
        
        // Calcular venta de boletos (solo de reservaciones pagadas)
        const ticketSales = paidReservations.reduce((total, reservation) => {
          return total + (reservation.totalAmount || 0);
        }, 0);
        
        // Obtener paqueterías del viaje
        const packages = await storage.getPackages({ tripId });
        
        // Calcular venta de paqueterías
        const packageSales = packages.reduce((total, pkg) => {
          return total + (pkg.price || 0);
        }, 0);
        
        // Calcular total de ventas
        const totalSales = ticketSales + packageSales;
        
        // Obtener gastos del viaje
        const expenses = await storage.getTripExpenses(tripId);
        
        // Calcular total de gastos
        const totalExpenses = expenses.reduce((total, expense) => {
          return total + (expense.amount || 0);
        }, 0);
        
        // Calcular ganancia
        const profit = totalSales - totalExpenses;
        
        // Construir objeto con datos financieros
        return {
          ...trip,
          route: route || { name: 'Ruta desconocida', origin: '', destination: '' },
          vehicle,
          driver,
          passengerCount: reservations.length,
          ticketSales,
          packageCount: packages.length,
          packageSales,
          totalSales,
          expenses: totalExpenses,
          profit
        };
      }));
      
      console.log(`[GET /trips/financials] Encontrados ${financialData.length} viajes con datos financieros`);
      res.json(financialData);
      
    } catch (error) {
      console.error("[GET /trips/financials] Error:", error);
      res.status(500).json({ message: "Error al obtener datos financieros" });
    }
  });
}