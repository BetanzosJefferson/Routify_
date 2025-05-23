import { Express, Request, Response } from "express";
import * as cajaFunctions from "./caja-functions";
import { db } from "./db";
import { UserRole } from "@shared/schema";

/**
 * Registra las rutas para el sistema de caja simplificado
 */
export function registrarCajaRoutes(app: Express, isAuthenticated: any) {
  // Crear tablas al iniciar
  const crearTablasNecesarias = async () => {
    try {
      console.log("Verificando/creando tablas del sistema de caja simplificado...");
      
      // Intentar ejecutar una consulta básica para verificar si las tablas existen
      try {
        await db.execute(`SELECT * FROM caja_transacciones LIMIT 1`);
        console.log("Las tablas del sistema de caja ya existen");
      } catch (error) {
        console.log("Creando tablas del sistema de caja...");
        
        // Crear tablas si no existen
        await db.execute(`
          CREATE TABLE IF NOT EXISTS caja_transacciones (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL,
            company_id TEXT NOT NULL,
            tipo TEXT NOT NULL,
            monto DOUBLE PRECISION NOT NULL,
            metodo_pago TEXT NOT NULL,
            estado TEXT NOT NULL DEFAULT 'sin-cortar',
            reservacion_id INTEGER,
            paqueteria_id INTEGER,
            corte_id INTEGER,
            descripcion TEXT,
            referencia TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE
          )
        `);
        
        await db.execute(`
          CREATE TABLE IF NOT EXISTS cortes_caja (
            id SERIAL PRIMARY KEY,
            usuario_id INTEGER NOT NULL,
            company_id TEXT NOT NULL,
            total_efectivo DOUBLE PRECISION NOT NULL,
            total_transferencia DOUBLE PRECISION NOT NULL,
            total_general DOUBLE PRECISION NOT NULL,
            cantidad_transacciones INTEGER NOT NULL,
            notas TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            impreso BOOLEAN DEFAULT FALSE
          )
        `);
        
        console.log("Tablas creadas correctamente");
      }
    } catch (error) {
      console.error("Error al inicializar tablas de caja:", error);
    }
  };
  
  // Ejecutar la creación de tablas
  crearTablasNecesarias();
  
  // GET /api/caja/transacciones - Obtener todas las transacciones sin cortar del usuario actual
  app.get("/api/caja/transacciones", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const userId = user.id;
      const companyId = user.companyId || user.company;
      
      if (!userId || !companyId) {
        return res.status(400).json({
          success: false,
          message: "Faltan datos de usuario o compañía"
        });
      }
      
      // Obtener todas las transacciones sin cortar del usuario
      const transacciones = await cajaFunctions.getTransaccionesSinCortar(userId, companyId);
      
      res.json(transacciones);
    } catch (error) {
      console.error("Error al obtener transacciones:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener las transacciones"
      });
    }
  });
  
  // GET /api/caja/todas-transacciones - Obtener todas las transacciones (incluyendo cortadas)
  app.get("/api/caja/todas-transacciones", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const userId = user.id;
      const companyId = user.companyId || user.company;
      
      if (!userId || !companyId) {
        return res.status(400).json({
          success: false,
          message: "Faltan datos de usuario o compañía"
        });
      }
      
      // Obtener todas las transacciones del usuario
      const transacciones = await cajaFunctions.getAllTransacciones(userId, companyId, true);
      
      res.json(transacciones);
    } catch (error) {
      console.error("Error al obtener todas las transacciones:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener las transacciones"
      });
    }
  });
  
  // POST /api/caja/gasto - Registrar un gasto
  app.post("/api/caja/gasto", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const { monto, descripcion } = req.body;
      
      if (!monto || !descripcion) {
        return res.status(400).json({
          success: false,
          message: "Faltan datos obligatorios (monto y descripción)"
        });
      }
      
      const userId = user.id;
      const companyId = user.companyId || user.company;
      
      // Registrar el gasto
      const transaccion = await cajaFunctions.registrarGasto(
        userId,
        companyId,
        monto,
        descripcion
      );
      
      if (!transaccion) {
        return res.status(500).json({
          success: false,
          message: "Error al registrar el gasto"
        });
      }
      
      res.json({
        success: true,
        message: "Gasto registrado correctamente",
        transaccion
      });
    } catch (error) {
      console.error("Error al registrar gasto:", error);
      res.status(500).json({
        success: false,
        message: "Error al registrar el gasto"
      });
    }
  });
  
  // POST /api/caja/corte - Realizar un corte de caja
  app.post("/api/caja/corte", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const { notas } = req.body;
      
      const userId = user.id;
      const companyId = user.companyId || user.company;
      
      // Realizar el corte
      const resultado = await cajaFunctions.realizarCorte(userId, companyId, notas);
      
      if (!resultado.success) {
        return res.status(400).json({
          success: false,
          message: resultado.message
        });
      }
      
      res.json({
        success: true,
        message: "Corte realizado correctamente",
        corte: resultado.corte
      });
    } catch (error) {
      console.error("Error al realizar corte:", error);
      res.status(500).json({
        success: false,
        message: "Error al realizar el corte de caja"
      });
    }
  });
  
  // GET /api/caja/historial-cortes - Obtener historial de cortes
  app.get("/api/caja/historial-cortes", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const userId = user.id;
      const companyId = user.companyId || user.company;
      
      // Obtener el historial de cortes
      const cortes = await cajaFunctions.getHistorialCortes(userId, companyId);
      
      res.json(cortes);
    } catch (error) {
      console.error("Error al obtener historial de cortes:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener el historial de cortes"
      });
    }
  });
  
  // GET /api/caja/transacciones-corte/:id - Obtener transacciones de un corte específico
  app.get("/api/caja/transacciones-corte/:id", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const corteId = parseInt(id);
      
      if (isNaN(corteId)) {
        return res.status(400).json({
          success: false,
          message: "ID de corte no válido"
        });
      }
      
      // Obtener las transacciones del corte
      const transacciones = await cajaFunctions.getTransaccionesCorte(corteId);
      
      res.json(transacciones);
    } catch (error) {
      console.error("Error al obtener transacciones del corte:", error);
      res.status(500).json({
        success: false,
        message: "Error al obtener las transacciones del corte"
      });
    }
  });
  
  // POST /api/caja/sincronizar - Sincronizar transacciones desde tablas existentes
  app.post("/api/caja/sincronizar", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN && user.role !== UserRole.OWNER) {
        return res.status(403).json({
          success: false,
          message: "No tiene permisos para realizar esta acción"
        });
      }
      
      const userId = user.id;
      
      // Sincronizar transacciones
      const resultado = await cajaFunctions.sincronizarTransaccionesUsuario(userId);
      
      if (!resultado.success) {
        return res.status(500).json({
          success: false,
          message: "Error al sincronizar transacciones",
          error: resultado.error
        });
      }
      
      res.json({
        success: true,
        message: `Sincronización completada. Se crearon ${resultado.count} transacciones`
      });
    } catch (error) {
      console.error("Error al sincronizar transacciones:", error);
      res.status(500).json({
        success: false,
        message: "Error al sincronizar transacciones"
      });
    }
  });
}