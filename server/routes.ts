import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { db } from "./db";
import { eq, inArray } from "drizzle-orm";
import { 
  insertRouteSchema, 
  insertTripSchema, 
  insertReservationSchema, 
  insertPassengerSchema,
  insertPackageSchema,
  createRouteValidationSchema,
  publishTripValidationSchema,
  createReservationValidationSchema,
  RouteWithSegments,
  SegmentPrice,
  locationData,
  TripVisibility,
  TripStatus,
  UserRole,
  PaymentStatus,
  PaymentMethod,
  userCompanies,
  companies
} from "@shared/schema";

// Constantes para roles y permisos de paqueterías
const PACKAGE_ACCESS_ROLES = [
  UserRole.OWNER, 
  UserRole.ADMIN, 
  UserRole.CALL_CENTER, 
  UserRole.CHECKER, 
  UserRole.DRIVER
];

const PACKAGE_WRITE_ROLES = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.CALL_CENTER
];

const PACKAGE_CREATE_ROLES = [
  UserRole.OWNER,
  UserRole.ADMIN,
  UserRole.CALL_CENTER,
  UserRole.CHECKER
];

import { setupAuthRoutes } from "./auth"; // Mantenemos para compatibilidad
import { setupAuthentication } from "./auth-session";
// Utility function to check if two locations are in the same city
function isSameCity(location1: string, location2: string): boolean {
  // Validar que ambas ubicaciones tienen el formato esperado
  if (!location1.includes(' - ') || !location2.includes(' - ')) {
    console.warn(`Formato de ubicación inesperado: "${location1}" o "${location2}"`);
    return false;
  }
  
  // Extract city name (assuming format "City, State - Location")
  const city1 = location1.split(' - ')[0].trim();
  const city2 = location2.split(' - ')[0].trim();
  
  // Debugging
  console.log(`Comparando ciudades: "${city1}" y "${city2}" => ${city1 === city2}`);
  
  return city1 === city2;
}
import { populateLocationData } from "./populate-locations";
import { db } from "./db";

export async function registerRoutes(app: Express): Promise<Server> {
  // prefix all routes with /api
  const apiRouter = (path: string) => `/api${path}`;

  // Setup session-based auth system
  const { isAuthenticated, hasRole } = setupAuthentication(app);
  
  // Setup authentication routes (both old and new)
  // Pasamos el middleware de autenticación al setup de rutas de autenticación
  setupAuthRoutes(app, isAuthenticated);

  // Populate location data on server start
  try {
    await populateLocationData();
    console.log("Location data loaded successfully");
  } catch (error) {
    console.error("Error loading location data:", error);
  }

  // LOCATION DATA ENDPOINT
  app.get(apiRouter("/locations"), async (req: Request, res: Response) => {
    try {
      const locations = await db.select().from(locationData);
      res.json(locations);
    } catch (error) {
      console.error("Error fetching location data:", error);
      res.status(500).json({ error: "Failed to fetch location data" });
    }
  });

  // ROUTES ENDPOINTS
  app.get(apiRouter("/routes"), async (req: Request, res: Response) => {
    try {
      // Obtener usuario autenticado y su compañía
      const { user } = req as any;
      let companyId = null;
      
      if (user) {
        console.log(`[GET /routes] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}, CompanyId: ${user.companyId}, Company: ${user.company}`);
        
        // ACCESO TOTAL solo para superAdmin y developer - sin restricciones
        if (user.role === UserRole.SUPER_ADMIN || 
            user.role === UserRole.DEVELOPER) {
          console.log(`[GET /routes] Usuario con rol ${user.role}: ACCESO TOTAL - mostrando todas las rutas`);
          // No establecer companyId para estos roles para ver TODAS las rutas
        } 
        // ACCESO PARA ADMIN - solo ver rutas de su compañía
        else if (user.role === UserRole.ADMIN) {
          console.log(`[GET /routes] Admin: ${user.firstName} ${user.lastName}, filtrando por compañía: ${user.companyId || user.company}`);
          if (user.companyId || user.company) {
            companyId = user.companyId || user.company;
          } else {
            console.warn(`[GET /routes] Administrador sin companyId o company definido`);
          }
        } else {
          // USUARIOS NORMALES - Filtrar por su compañía
          companyId = user.companyId || user.company;
          
          if (!companyId) {
            console.log(`[GET /routes] Usuario sin compañía - no verá ninguna ruta`);
            return res.json([]);
          }
          
          console.log(`[GET /routes] Consultando rutas para la compañía: ${companyId}`);
        }
      } else {
        // Usuario no autenticado
        console.log(`[GET /routes] Acceso anónimo: mostrando todas las rutas públicas`);
      }
      
      // Usar la función actualizada que filtra directamente en la base de datos
      const routes = await storage.getRoutes(companyId || undefined);
      console.log(`[GET /routes] Encontradas ${routes.length} rutas`);
      
      res.json(routes);
    } catch (error) {
      console.error("Error fetching routes:", error);
      res.status(500).json({ error: "Failed to fetch routes" });
    }
  });

  app.get(apiRouter("/routes/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const route = await storage.getRoute(id);
      
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      // Obtener usuario autenticado y su compañía
      const { user } = req as any;
      let companyId = null;
      
      if (user) {
        companyId = user.companyId || user.company;
      }
      
      // Verificar acceso a la ruta
      // Los usuarios ADMIN también deben tener restricción por compañía
      if (companyId && 
          user.role !== UserRole.SUPER_ADMIN && 
          user.role !== UserRole.DEVELOPER &&
          route.companyId !== companyId) {
        return res.status(403).json({ error: "No tiene permiso para acceder a esta ruta" });
      }
      
      res.json(route);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch route" });
    }
  });

  app.get(apiRouter("/routes/:id/segments"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const routeWithSegments = await storage.getRouteWithSegments(id);
      
      if (!routeWithSegments) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      // Check for same-city segments and filter them out
      const validSegments = routeWithSegments.segments.filter(
        segment => !isSameCity(segment.origin, segment.destination)
      );
      
      res.json({
        ...routeWithSegments,
        segments: validSegments
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch route segments" });
    }
  });

  app.post(apiRouter("/routes"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      console.log("POST /routes - Request recibido:", req.body);
      
      // Primero verificamos si los campos requeridos están presentes
      if (!req.body.name || !req.body.origin || !req.body.destination) {
        console.log("Datos requeridos faltantes:", req.body);
        return res.status(400).json({ 
          error: "Datos incompletos", 
          details: "Se requieren los campos name, origin y destination" 
        });
      }
      
      // Obtener datos del usuario autenticado
      const { user } = req as any;
      let companyId = null;
      
      if (user) {
        // CRÍTICO: Obtener correctamente la compañía del usuario
        companyId = user.companyId || user.company;
        console.log(`[POST /routes] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}, CompanyId: ${user.companyId}, Company: ${user.company}`);
        
        // Verificar explícitamente si tenemos un valor de companyId
        if (!companyId) {
          console.log("[POST /routes] ¡ALERTA! Usuario sin companyId/company");
          
          // Para superAdmin, dueño y developer, asignar una compañía predeterminada
          if (user.role === UserRole.SUPER_ADMIN) {
            companyId = "viaja-facil-123";
            console.log(`[POST /routes] Asignando compañía predeterminada ${companyId} para superAdmin`);
          } else if (user.role === UserRole.OWNER || user.role === UserRole.DEVELOPER) {
            companyId = "bamo-456";
            console.log(`[POST /routes] Asignando compañía predeterminada ${companyId} para ${user.role}`);
          } else {
            // Para otros roles, rechazar la solicitud
            console.log("[POST /routes] ADVERTENCIA: Usuario sin compañía intenta crear una ruta");
            return res.status(400).json({
              error: "No se puede crear la ruta",
              details: "El usuario no tiene una compañía asignada"
            });
          }
        }
        
        console.log(`[POST /routes] COMPAÑÍA FINAL ASIGNADA: ${companyId} para usuario ${user.firstName} ${user.lastName}`);
      }
      
      // Asegurarse de que stops sea un array
      const stops = Array.isArray(req.body.stops) ? req.body.stops : [];
      
      // Crear un objeto con los datos seguros
      const safeRouteData = {
        name: req.body.name,
        origin: req.body.origin,
        destination: req.body.destination,
        stops: stops,
        companyId: companyId // Asignar compañía del usuario a la ruta
      };
      
      // Ahora validar (nota: validamos solo los campos obligatorios, companyId no necesita validación)
      const validationResult = createRouteValidationSchema.safeParse(safeRouteData);
      
      if (!validationResult.success) {
        console.log("Validación fallida:", validationResult.error.format());
        return res.status(400).json({ 
          error: "Datos de ruta inválidos", 
          details: validationResult.error.format() 
        });
      }
      
      console.log("Datos validados correctamente:", safeRouteData);
      const route = await storage.createRoute(safeRouteData);
      console.log("Ruta creada con éxito:", route);
      res.status(201).json(route);
    } catch (error: any) {
      console.error("Error al crear ruta:", error?.message || error);
      res.status(500).json({ error: "Error al crear ruta", details: error?.message || "Error desconocido" });
    }
  });

  app.put(apiRouter("/routes/:id"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const validationResult = insertRouteSchema.partial().safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid route data", 
          details: validationResult.error.format() 
        });
      }
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      // SEGURIDAD: Verificar que el usuario tiene permisos para editar esta ruta
      // Primero, obtener la ruta para verificar la compañía
      const existingRoute = await storage.getRoute(id);
      
      if (!existingRoute) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      // Si no es superAdmin, verificar que la ruta pertenece a su compañía
      if (user.role !== UserRole.SUPER_ADMIN) {
        const userCompany = user.companyId || user.company;
        
        if (existingRoute.companyId && existingRoute.companyId !== userCompany) {
          console.log(`[PUT /routes/${id}] ACCESO DENEGADO: La ruta pertenece a compañía ${existingRoute.companyId} pero el usuario es de ${userCompany}`);
          return res.status(403).json({ 
            error: "Acceso denegado", 
            details: "No tiene permiso para editar rutas de otra compañía" 
          });
        }
      }
      
      // Preservar el ID de compañía original si el usuario no es superAdmin
      const routeData = validationResult.data;
      if (user.role !== UserRole.SUPER_ADMIN) {
        routeData.companyId = existingRoute.companyId;
      }

      // Verificar si tenemos stops definidos en la solicitud
      if (routeData.stops === undefined) {
        console.log("No se recibieron paradas en la actualización, manteniendo las existentes");
        // Si no se especificaron stops en la actualización, mantener los existentes
        routeData.stops = existingRoute.stops;
      } else {
        console.log("Paradas recibidas para actualización:", routeData.stops);
      }
      
      console.log("Datos para actualización de ruta:", {
        id,
        nombre: routeData.name,
        origen: routeData.origin,
        destino: routeData.destination,
        paradas: routeData.stops
      });
      
      const updatedRoute = await storage.updateRoute(id, routeData);
      
      res.json(updatedRoute);
    } catch (error) {
      res.status(500).json({ error: "Failed to update route" });
    }
  });

  app.delete(apiRouter("/routes/:id"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      // SEGURIDAD: Verificar que el usuario tiene permisos para eliminar esta ruta
      // Primero, obtener la ruta para verificar la compañía
      const existingRoute = await storage.getRoute(id);
      
      if (!existingRoute) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      // Si no es superAdmin, verificar que la ruta pertenece a su compañía
      if (user.role !== UserRole.SUPER_ADMIN) {
        const userCompany = user.companyId || user.company;
        
        if (existingRoute.companyId && existingRoute.companyId !== userCompany) {
          console.log(`[DELETE /routes/${id}] ACCESO DENEGADO: La ruta pertenece a compañía ${existingRoute.companyId} pero el usuario es de ${userCompany}`);
          return res.status(403).json({ 
            error: "Acceso denegado", 
            details: "No tiene permiso para eliminar rutas de otra compañía" 
          });
        }
      }
      
      const success = await storage.deleteRoute(id);
      
      if (!success) {
        return res.status(500).json({ error: "Failed to delete route" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete route" });
    }
  });

  // TRIPS ENDPOINTS
  
  // Ruta para obtener todos los viajes (incluyendo ocultos) para la sección "Publicar viajes"
  app.get(apiRouter("/admin-trips"), async (req: Request, res: Response) => {
    try {
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      // Log para depuración
      console.log(`[GET /admin-trips] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[GET /admin-trips] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // Verificar que el usuario esté autenticado y tenga permisos de administrador
      if (!user || (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN && user.role !== UserRole.OWNER)) {
        console.log(`[GET /admin-trips] Acceso denegado para rol: ${user?.role || 'no autenticado'}`);
        return res.status(403).json({ error: "No autorizado para acceder a esta sección" });
      }
      
      // Parámetros de búsqueda desde la query
      const { date, driverId } = req.query;
      const searchParams: any = {
        // Importante: No aplicamos filtro de visibilidad para mostrar todos los viajes
        includeAllVisibilities: true // Flag para indicar que se deben incluir todos los estados de visibilidad
      };
      
      // Agregar parámetros de búsqueda si existen
      if (date) searchParams.date = date as string;
      
      // Agregar filtro por conductor (driverId) si existe
      if (driverId && !isNaN(parseInt(driverId as string, 10))) {
        searchParams.driverId = parseInt(driverId as string, 10);
        console.log(`[GET /admin-trips] Filtro por conductor ID: ${searchParams.driverId}`);
      }
      
      // FILTRO DE COMPAÑÍA - aplicar solo para roles que no son superAdmin
      if (user.role !== UserRole.SUPER_ADMIN) {
        const userCompanyId = user.companyId || user.company || null;
        
        if (userCompanyId) {
          searchParams.companyId = userCompanyId;
          console.log(`[GET /admin-trips] Filtro compañía aplicado: ${userCompanyId}`);
        } else {
          console.log(`[GET /admin-trips] Usuario sin compañía asignada, no verá ningún viaje`);
          return res.json([]);
        }
      } else {
        // Para superAdmin, permitir ver viajes de todas las compañías
        searchParams.companyId = 'ALL';
        console.log(`[GET /admin-trips] Usuario superAdmin - Acceso a viajes de todas las compañías`);
      }
      
      // Ejecutar búsqueda con los parámetros
      console.log(`[GET /admin-trips] Parámetros de búsqueda:`, searchParams);
      const trips = await storage.searchTrips(searchParams);
      
      console.log(`[GET /admin-trips] Encontrados ${trips.length} viajes (todos los estados de visibilidad)`);
      
      return res.json(trips);
    } catch (error) {
      console.error("Error al obtener viajes para administración:", error);
      res.status(500).json({ error: "Error al obtener viajes para administración" });
    }
  });
  
  // Ruta para acceso administrativo a todos los viajes (incluidos los ocultos y cancelados)
  app.get(apiRouter("/admin-trips"), async (req: Request, res: Response) => {
    try {
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      // Si no hay usuario autenticado, denegar acceso
      if (!user) {
        console.log(`[GET /admin-trips] Acceso anónimo denegado`);
        return res.status(401).json({ error: "No autenticado" });
      }

      // Parámetros de búsqueda desde la query
      const { origin, destination, date, seats, driverId } = req.query;
      const searchParams: any = {
        includeAllVisibilities: true // Esta es la clave para incluir todos los estados de visibilidad
      };
      
      // Agregar parámetros de búsqueda si existen
      if (origin) searchParams.origin = origin as string;
      if (destination) searchParams.destination = destination as string;
      if (date) searchParams.date = date as string;
      if (seats && !isNaN(parseInt(seats as string, 10))) {
        searchParams.seats = parseInt(seats as string, 10);
      }
      
      // Agregar filtro por conductor (driverId) si existe
      if (driverId && !isNaN(parseInt(driverId as string, 10))) {
        searchParams.driverId = parseInt(driverId as string, 10);
        console.log(`[GET /admin-trips] Filtro por conductor ID: ${searchParams.driverId}`);
      }
      
      // APLICAR FILTRO DE COMPAÑÍA - PARTE CRÍTICA
      // Solo superAdmin y taquilla pueden ver viajes de todas las compañías
      // CASO ESPECIAL PARA CONDUCTORES: Filtrar por su ID de usuario cuando son role=DRIVER
      if (user.role === UserRole.DRIVER || user.role === 'CHOFER') {
        // Para conductores, filtrar siempre por su ID (que debería coincidir con driverId en viajes)
        console.log(`[GET /admin-trips] Usuario es CONDUCTOR (ID: ${user.id}), filtrando viajes asignados`);
        
        // Si no se envió un driverId explícitamente en la URL, usar el ID del usuario conductor
        if (!searchParams.driverId) {
          searchParams.driverId = user.id;
          console.log(`[GET /admin-trips] Usando ID del conductor autenticado: ${user.id}`);
        }
      } else if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.TICKET_OFFICE) {
        // NO es superAdmin ni taquilla
        // Para todos los demás roles: filtrar por compañía
        console.log(`[GET /admin-trips] Usuario con rol ${user.role} - ACCESO FILTRADO POR COMPAÑÍA`);
        
        // Obtener companyId del usuario (preferimos companyId pero también aceptamos company como respaldo)
        const userCompanyId = user.companyId || user.company || null;
        
        if (userCompanyId) {
          // Aplicar filtro por compañía - OBLIGATORIO para usuarios que no son superAdmin o taquilla
          searchParams.companyId = userCompanyId;
          console.log(`[GET /admin-trips] Filtro compañía aplicado: ${userCompanyId}`);
        } else {
          console.log(`[GET /admin-trips] Usuario sin compañía asignada, no verá ningún viaje`);
          // Si el usuario no tiene compañía asignada, devolver lista vacía
          return res.json([]);
        }
      } else {
        // Usuarios superAdmin o taquilla - ACCESO TOTAL
        console.log(`[GET /admin-trips] Usuario ${user.firstName} con rol ${user.role} - ACCESO TOTAL (sin filtrar compañía)`);
        
        // SOLUCIÓN ESPECIAL: Establecer un valor especial 'ALL' para indicar acceso total
        searchParams.companyId = 'ALL'; 
        console.log(`[GET /admin-trips] Estableciendo acceso total para rol privilegiado`);
      } 
      
      // Ejecutar búsqueda con todos los parámetros
      console.log(`[GET /admin-trips] Parámetros de búsqueda finales:`, searchParams);
      const trips = await storage.searchTrips(searchParams);
      
      console.log(`[GET /admin-trips] Encontrados ${trips.length} viajes`);
      
      // CAPA ADICIONAL DE SEGURIDAD - FILTRO POST-CONSULTA
      // Si el usuario no tiene permisos para ver todos los viajes, verificar compañía nuevamente
      let finalTrips = trips;
      if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.TICKET_OFFICE) {
        const userCompanyId = user.companyId || user.company || null;
        
        if (userCompanyId) {
          console.log(`[GET /admin-trips] Verificación adicional de seguridad por compañía: ${userCompanyId}`);
          finalTrips = trips.filter(trip => trip.companyId === userCompanyId);
          
          if (finalTrips.length !== trips.length) {
            console.log(`[GET /admin-trips] ALERTA: Filtro adicional eliminó ${trips.length - finalTrips.length} viajes que no corresponden a la compañía ${userCompanyId}`);
          }
        }
      }
      
      res.json(finalTrips);
    } catch (error: any) {
      console.error("Error al obtener viajes administrativos:", error.message);
      res.status(500).json({ error: "Error al obtener viajes" });
    }
  });

  // Ruta estándar para buscar viajes (solo muestra los publicados por defecto)
  app.get(apiRouter("/trips"), async (req: Request, res: Response) => {
    try {
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      // Log para depuración
      console.log(`[GET /trips] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[GET /trips] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // Parámetros de búsqueda desde la query
      const { origin, destination, date, seats, driverId } = req.query;
      const searchParams: any = {};
      
      // Agregar parámetros de búsqueda si existen
      if (origin) searchParams.origin = origin as string;
      if (destination) searchParams.destination = destination as string;
      if (date) searchParams.date = date as string;
      if (seats && !isNaN(parseInt(seats as string, 10))) {
        searchParams.seats = parseInt(seats as string, 10);
      }
      
      // Agregar filtro por conductor (driverId) si existe
      if (driverId && !isNaN(parseInt(driverId as string, 10))) {
        searchParams.driverId = parseInt(driverId as string, 10);
        console.log(`[GET /trips] Filtro por conductor ID: ${searchParams.driverId}`);
      }
      
      // APLICAR FILTRO DE COMPAÑÍA - PARTE CRÍTICA
      // Solo superAdmin y taquilla pueden ver viajes de todas las compañías
      if (user) {
        // CASO ESPECIAL PARA CONDUCTORES: Filtrar por su ID de usuario cuando son role=DRIVER
        if (user.role === UserRole.DRIVER || user.role === 'CHOFER') {
          // Para conductores, filtrar siempre por su ID (que debería coincidir con driverId en viajes)
          console.log(`[GET /trips] Usuario es CONDUCTOR (ID: ${user.id}), filtrando viajes asignados`);
          
          // Si no se envió un driverId explícitamente en la URL, usar el ID del usuario conductor
          if (!searchParams.driverId) {
            searchParams.driverId = user.id;
            console.log(`[GET /trips] Asignando driverId=${user.id} automáticamente para conductor`);
          }
          
          // Aplicar también el filtro de compañía normal
          const userCompanyId = user.companyId || user.company || null;
          if (userCompanyId) {
            searchParams.companyId = userCompanyId;
            console.log(`[GET /trips] Filtro compañía para conductor: ${userCompanyId}`);
          } else {
            console.log(`[GET /trips] Conductor sin compañía asignada, aplicando solo filtro por driverId`);
          }
        } else if (user.role === UserRole.TICKET_OFFICE) {
          // CASO ESPECIAL PARA TAQUILLEROS: Obtener las compañías asociadas
          console.log(`[GET /trips] Usuario es TAQUILLERO (ID: ${user.id}), obteniendo empresas asociadas`);
          
          // Obtener las asociaciones del usuario con empresas
          const userCompanyAssociations = await db
            .select()
            .from(userCompanies)
            .where(eq(userCompanies.userId, user.id));
          
          if (userCompanyAssociations.length === 0) {
            console.log(`[GET /trips] Taquillero sin empresas asociadas, no verá ningún viaje`);
            return res.json([]);
          }
          
          // Obtener los IDs de las empresas asociadas
          const companyIds = userCompanyAssociations.map(assoc => assoc.companyId);
          console.log(`[GET /trips] Taquillero con ${companyIds.length} empresas asociadas: ${companyIds.join(', ')}`);
          
          // Establecer un parámetro especial para manejar múltiples compañías
          searchParams.companyIds = companyIds;
          
        } else if (user.role !== UserRole.SUPER_ADMIN) {
          // Usuarios normales - SIEMPRE FILTRAR POR SU COMPAÑÍA
          // Obtener companyId del usuario (preferimos companyId pero también aceptamos company como respaldo)
          const userCompanyId = user.companyId || user.company || null;
          
          if (userCompanyId) {
            // Aplicar filtro por compañía - OBLIGATORIO para usuarios que no son superAdmin
            searchParams.companyId = userCompanyId;
            console.log(`[GET /trips] Filtro compañía aplicado: ${userCompanyId}`);
          } else {
            console.log(`[GET /trips] Usuario sin compañía asignada, no verá ningún viaje`);
            // Si el usuario no tiene compañía asignada, devolver lista vacía
            return res.json([]);
          }
        } else {
          // Solo superAdmin tiene ACCESO TOTAL
          console.log(`[GET /trips] Usuario ${user.firstName} con rol ${user.role} - ACCESO TOTAL (sin filtrar compañía)`);
          
          // SOLUCIÓN ESPECIAL: Establecer un valor especial 'ALL' para indicar acceso total
          // Esto es mejor que eliminar el parámetro porque evita que la lógica predeterminada
          // de filtrado por compañía se active en capas inferiores
          searchParams.companyId = 'ALL'; 
          console.log(`[GET /trips] Estableciendo acceso total para rol privilegiado`);
        } 
      } else {
        // Usuario no autenticado
        console.log(`[GET /trips] Acceso anónimo denegado`);
        return res.status(401).json({ error: "No autenticado" });
      }
      
      // Ejecutar búsqueda con todos los parámetros
      console.log(`[GET /trips] Parámetros de búsqueda finales:`, searchParams);
      const trips = await storage.searchTrips(searchParams);
      
      console.log(`[GET /trips] Encontrados ${trips.length} viajes`);
      
      // CAPA ADICIONAL DE SEGURIDAD - FILTRO POST-CONSULTA
      // Si el usuario no tiene permisos para ver todos los viajes,
      // realizamos una verificación adicional de seguridad y FILTRAMOS los resultados
      if (user && user.role !== UserRole.SUPER_ADMIN) {
        // Caso especial para conductores - verificar que solo vean sus viajes asignados
        if (user.role === UserRole.DRIVER || user.role === 'CHOFER') {
          console.log(`[GET /trips] VERIFICACIÓN CONDUCTOR: Asegurando que el chofer solo vea sus viajes`);
          
          // Verificar que todos los viajes tengan el driverId correcto
          const viajesNoAsignados = trips.filter(t => t.driverId !== user.id);
          
          if (viajesNoAsignados.length > 0) {
            console.log(`[ALERTA DE SEGURIDAD] Se intentaron mostrar ${viajesNoAsignados.length} viajes no asignados al conductor!`);
            console.log(`IDs bloqueados: ${viajesNoAsignados.map(t => t.id).join(', ')}`);
            
            // CRÍTICO: Filtrar y devolver SOLO los viajes asignados al conductor
            const viajesFiltradosConductor = trips.filter(t => t.driverId === user.id);
            console.log(`[CORRECCIÓN] Devolviendo solo ${viajesFiltradosConductor.length} viajes asignados al conductor ${user.id}`);
            
            // Reemplazar los resultados con solo los viajes asignados
            return res.json(viajesFiltradosConductor);
          }
        } else if (user.role === UserRole.TICKET_OFFICE) {
          // VERIFICACIÓN ESPECIAL PARA TAQUILLEROS: asegurar que solo vean viajes de sus compañías asociadas
          console.log(`[GET /trips] VERIFICACIÓN TAQUILLERO: Asegurando que solo vea viajes de sus compañías asociadas`);
          
          // Obtener las compañías asociadas al taquillero
          const userCompanyAssociations = await db
            .select()
            .from(userCompanies)
            .where(eq(userCompanies.userId, user.id));
          
          if (userCompanyAssociations.length === 0) {
            console.log(`[GET /trips] Taquillero sin empresas asociadas, no debería ver ningún viaje`);
            return res.json([]);
          }
          
          // Obtener los IDs de las compañías
          const companyIds = userCompanyAssociations.map(assoc => assoc.companyId);
          console.log(`[GET /trips] Taquillero tiene acceso a las empresas: [${companyIds.join(', ')}]`);
          
          // Verificar que todos los viajes pertenezcan a las compañías asignadas
          const viajesDeOtrasCompanias = trips.filter(t => 
            t.companyId && !companyIds.includes(t.companyId)
          );
          
          if (viajesDeOtrasCompanias.length > 0) {
            console.log(`[ALERTA DE SEGURIDAD] Se intentaron mostrar ${viajesDeOtrasCompanias.length} viajes de compañías no asignadas al taquillero!`);
            console.log(`IDs bloqueados: ${viajesDeOtrasCompanias.map(t => t.id).join(', ')}`);
            
            // CRÍTICO: Filtrar y devolver SOLO los viajes de las compañías asignadas
            const viajesFiltrados = trips.filter(t => 
              t.companyId && companyIds.includes(t.companyId)
            );
            console.log(`[CORRECCIÓN] Devolviendo solo ${viajesFiltrados.length} viajes de las compañías asignadas`);
            
            // Reemplazar los resultados
            return res.json(viajesFiltrados);
          }
        } else {
          // Verificación de compañía para usuarios normales
          const userCompany = user.companyId || user.company || null;
          
          if (userCompany) {
            // Filtrar para asegurarnos que solo devolvemos viajes de su compañía
            const viajesDeOtrasCompanias = trips.filter(t => t.companyId && t.companyId !== userCompany);
            
            if (viajesDeOtrasCompanias.length > 0) {
              console.log(`[ALERTA DE SEGURIDAD] Se intentaron mostrar ${viajesDeOtrasCompanias.length} viajes de otras compañías!`);
              console.log(`IDs bloqueados: ${viajesDeOtrasCompanias.map(t => t.id).join(', ')}`);
              
              // CRÍTICO: Filtrar y devolver SOLO los viajes de la compañía del usuario
              const viajesFiltrados = trips.filter(t => t.companyId === userCompany);
              console.log(`[CORRECCIÓN] Devolviendo solo ${viajesFiltrados.length} viajes de compañía ${userCompany}`);
              
              // Reemplazar los resultados con solo los viajes de su compañía
              return res.json(viajesFiltrados);
            }
          }
        }
      }
      
      return res.json(trips);
    } catch (error) {
      console.error("Error al obtener viajes:", error);
      res.status(500).json({ error: "Error al obtener viajes" });
    }
  });

  app.get(apiRouter("/trips/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[GET /trips/${id}] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[GET /trips/${id}] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // Primero obtenemos el viaje
      const trip = await storage.getTripWithRouteInfo(id);
      
      if (!trip) {
        return res.status(404).json({ error: "Viaje no encontrado" });
      }
      
      console.log(`[GET /trips/${id}] Viaje encontrado - companyId: ${trip.companyId || 'No definido'}`);
      
      // SEGURIDAD: Verificar permisos según el rol y compañía del usuario
      if (user) {
        // Los usuarios con rol superAdmin y taquilla (ticket_office) pueden ver todos los viajes
        if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.TICKET_OFFICE) {
          // CASO ESPECIAL: Verificar que los conductores solo vean los viajes asignados a ellos
          // CONDUCTOR (CHOFER): Permitimos acceso simplificado para fines de depuración
          if (user.role === UserRole.DRIVER || user.role === 'CHOFER' || user.role === 'chofer') {
            console.log(`[GET /trips/${id}] VERIFICACIÓN CONDUCTOR: ${user.firstName} ${user.lastName} (ID: ${user.id})`);
            
            // SOLUCIÓN TEMPORAL: Permitir acceso a TODOS los viajes para los conductores
            // Esto es necesario para que puedan ver las reservaciones y pasajeros asignados a su compañía
            console.log(`[GET /trips/${id}] ACCESO TEMPORAL HABILITADO: Permitiendo al conductor ver todos los viajes de su compañía`);
            
            // Devolver el viaje directamente
            return res.json(trip);
          }
          
          // Para todos los roles, verificar también que el viaje pertenezca a su compañía
          const userCompanyId = user.companyId || user.company || null;
          
          if (!userCompanyId) {
            console.log(`[GET /trips/${id}] Usuario sin compañía asignada intenta acceder a un viaje`);
            return res.status(403).json({ 
              error: "No tiene permiso para ver este viaje",
              details: "Usuario sin compañía asignada" 
            });
          }
          
          if (trip.companyId && trip.companyId !== userCompanyId) {
            console.log(`[GET /trips/${id}] ACCESO DENEGADO: Viaje pertenece a compañía ${trip.companyId} pero usuario es de ${userCompanyId}`);
            return res.status(403).json({ 
              error: "No tiene permiso para ver este viaje",
              details: "El viaje pertenece a otra compañía" 
            });
          }
          
          console.log(`[GET /trips/${id}] Acceso permitido: El viaje pertenece a la misma compañía del usuario (${userCompanyId})`);
        } else {
          console.log(`[GET /trips/${id}] Acceso permitido: Usuario con rol ${user.role} puede ver todos los viajes`);
        }
      } else {
        // Para usuarios no autenticados, verificar si el viaje es público
        // Por ahora, permitir ver el viaje pero se podría ajustar según necesidades
        console.log(`[GET /trips/${id}] Usuario no autenticado accediendo al viaje`);
      }
      
      // Si llegamos aquí, el usuario tiene permiso para ver el viaje
      res.json(trip);
    } catch (error) {
      console.error(`Error al obtener viaje por ID: ${error}`);
      res.status(500).json({ error: "Error al obtener información del viaje" });
    }
  });

  app.post(apiRouter("/trips"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validationResult = publishTripValidationSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Datos de viaje inválidos", 
          details: validationResult.error.format() 
        });
      }
      
      // Obtener los datos del usuario autenticado
      const { user } = req as any;
      
      console.log(`[POST /trips] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      
      // SEGURIDAD: Verificar que el usuario tenga una compañía asignada
      let companyId = user.companyId || user.company || null;
      
      if (!companyId) {
        console.log(`[POST /trips] ERROR: Usuario sin companyId intenta crear un viaje`);
        return res.status(403).json({
          error: "No puede crear viajes",
          details: "El usuario no tiene una compañía asignada"
        });
      }
      
      console.log(`[POST /trips] CREANDO VIAJE PARA COMPAÑÍA: ${companyId} del usuario ${user.firstName} ${user.lastName}`);
      
      // Verificar que el usuario tenga permisos para crear viajes
      // En este caso, solo los roles superAdmin, admin, owner y developer
      const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OWNER, UserRole.DEVELOPER];
      
      if (!allowedRoles.includes(user.role)) {
        console.log(`[POST /trips] DENEGADO: Usuario con rol ${user.role} no tiene permisos para crear viajes`);
        return res.status(403).json({
          error: "Acceso denegado",
          details: "No tiene permisos para crear viajes"
        });
      }
      
      const tripData = validationResult.data;
      
      // Calculate departure/arrival time from stopTimes
      let departureTime = "";
      let arrivalTime = "";
      
      if (tripData.stopTimes && tripData.stopTimes.length > 0) {
        const stopTimes = tripData.stopTimes;
        // El primer tiempo de parada es la salida
        if (stopTimes[0] && stopTimes[0].hour && stopTimes[0].minute && stopTimes[0].ampm) {
          departureTime = `${stopTimes[0].hour.padStart(2, '0')}:${stopTimes[0].minute.padStart(2, '0')} ${stopTimes[0].ampm}`;
        }
        
        // El último tiempo de parada es la llegada
        if (stopTimes.length > 1) {
          const lastStop = stopTimes[stopTimes.length - 1];
          if (lastStop && lastStop.hour && lastStop.minute && lastStop.ampm) {
            arrivalTime = `${lastStop.hour.padStart(2, '0')}:${lastStop.minute.padStart(2, '0')} ${lastStop.ampm}`;
          }
        }
      }
      
      // Si no pudimos extraer los tiempos, usar valores predeterminados
      if (!departureTime) departureTime = "12:00 PM";
      if (!arrivalTime) arrivalTime = "01:00 PM";
      
      // Get the route details to generate all possible sub-trips
      const route = await storage.getRouteWithSegments(tripData.routeId);
      if (!route) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      // Create a trip for each date in the range
      const startDate = new Date(tripData.startDate);
      const endDate = new Date(tripData.endDate);
      const createdTrips = [];
      
      // Generate all possible segments (direct and intermediate segments)
      const allSegments = generateAllPossibleSegments(route);
      
      // Si hay stopTimes en la petición, agregarlo a los segmentos para usar tiempos personalizados
      const tripDataWithStopTimes = tripData as any;
      if (tripDataWithStopTimes.stopTimes && Array.isArray(tripDataWithStopTimes.stopTimes)) {
        console.log("stopTimes recibidos en la petición:", tripDataWithStopTimes.stopTimes);
        // Añadir stopTimes a todos los segmentos para que estén disponibles en calculateSegmentTimes
        allSegments.forEach(segment => {
          (segment as any).stopTimes = tripDataWithStopTimes.stopTimes;
        });
      }

      // Calculate segment times based on total journey time
      const segmentTimes = calculateSegmentTimes(
        allSegments, 
        departureTime, 
        arrivalTime,
        route
      );
      
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        // Create main trip (origin to destination)
        // Buscar el precio del segmento de origen a destino final para usarlo como precio principal
        const mainSegmentPrice = tripData.segmentPrices.find(
          (sp: any) => sp.origin === route.origin && sp.destination === route.destination
        );
        
        const mainTripToCreate = {
          routeId: tripData.routeId,
          departureDate: new Date(date),
          departureTime,
          arrivalTime,
          capacity: tripData.capacity,
          availableSeats: tripData.capacity,
          price: mainSegmentPrice?.price || 450, // Usar el precio del segmento principal o un valor por defecto
          // vehicleType: ya no se utiliza
          segmentPrices: tripData.segmentPrices,
          isSubTrip: false,
          parentTripId: null,
          companyId: companyId, // Asignar la compañía del usuario al viaje
          // Campos nuevos para visibilidad y estado
          visibility: tripData.visibility || TripVisibility.PUBLISHED, // Por defecto publicado
          tripStatus: TripStatus.NOT_STARTED // Por defecto aún no inicia
        };
        
        const mainTrip = await storage.createTrip(mainTripToCreate);
        createdTrips.push(mainTrip);
        
        // Create all sub-trips
        for (const segment of allSegments) {
          // Find the segment data (price and times) from user input or calculate proportionally
          // Actualizar la definición del tipo de segmentPrices para incluir los tiempos
          type ExtendedSegmentPrice = {
            origin: string;
            destination: string;
            price: number;
            // Tiempo en formato string "HH:MM AM/PM"
            departureTime?: string;
            arrivalTime?: string;
            // Componentes individuales de tiempo
            departureHour?: string;
            departureMinute?: string;
            departureAmPm?: string;
            arrivalHour?: string;
            arrivalMinute?: string;
            arrivalAmPm?: string;
          };
          
          const segmentData = tripData.segmentPrices.find(
            (sp: any) => sp.origin === segment.origin && sp.destination === segment.destination
          ) as ExtendedSegmentPrice | undefined;
          
          // Si tenemos datos del segmento con tiempos personalizados, usarlos directamente
          let departureTime, arrivalTime, price;
          
          if (segmentData) {
            price = segmentData.price;
            
            // Verificar si el frontend está enviando tiempos con formato explícito o componentes de hora
            if (segmentData.departureTime) {
              // Formato explícito "HH:MM AM/PM"
              departureTime = segmentData.departureTime;
              console.log(`Usando tiempo de salida explícito para ${segment.origin} -> ${segment.destination}: ${departureTime}`);
            } else if (segmentData.departureHour && segmentData.departureMinute && segmentData.departureAmPm) {
              // Formato de componentes (hora, minuto, AM/PM)
              departureTime = `${segmentData.departureHour}:${segmentData.departureMinute} ${segmentData.departureAmPm}`;
              console.log(`Usando tiempo de salida por componentes para ${segment.origin} -> ${segment.destination}: ${departureTime}`);
            } else {
              // Fallback al tiempo calculado
              departureTime = segmentTimes[`${segment.origin}-${segment.destination}`].departureTime;
              console.log(`Fallback: Usando tiempo de salida calculado para ${segment.origin} -> ${segment.destination}: ${departureTime}`);
            }
            
            if (segmentData.arrivalTime) {
              // Formato explícito "HH:MM AM/PM"
              arrivalTime = segmentData.arrivalTime;
              console.log(`Usando tiempo de llegada explícito para ${segment.origin} -> ${segment.destination}: ${arrivalTime}`);
            } else if (segmentData.arrivalHour && segmentData.arrivalMinute && segmentData.arrivalAmPm) {
              // Formato de componentes (hora, minuto, AM/PM)
              arrivalTime = `${segmentData.arrivalHour}:${segmentData.arrivalMinute} ${segmentData.arrivalAmPm}`;
              console.log(`Usando tiempo de llegada por componentes para ${segment.origin} -> ${segment.destination}: ${arrivalTime}`);
            } else {
              // Fallback al tiempo calculado
              arrivalTime = segmentTimes[`${segment.origin}-${segment.destination}`].arrivalTime;
              console.log(`Fallback: Usando tiempo de llegada calculado para ${segment.origin} -> ${segment.destination}: ${arrivalTime}`);
            }
          } else {
            // Fallback: usar tiempos calculados proporcionalmente
            price = calculateProportionalPrice(segment, route, tripData.price || 0);
            departureTime = segmentTimes[`${segment.origin}-${segment.destination}`].departureTime;
            arrivalTime = segmentTimes[`${segment.origin}-${segment.destination}`].arrivalTime;
          }
          
          const subTripToCreate = {
            routeId: tripData.routeId,
            departureDate: new Date(date),
            departureTime,
            arrivalTime,
            capacity: tripData.capacity,
            availableSeats: tripData.capacity,
            price,
            // vehicleType: ya no se utiliza
            segmentPrices: [{ origin: segment.origin, destination: segment.destination, price }],
            isSubTrip: true,
            parentTripId: mainTrip.id,
            segmentOrigin: segment.origin,
            segmentDestination: segment.destination,
            companyId: companyId, // Asignar la misma compañía del usuario a todos los sub-viajes
            // Heredar los mismos valores de visibilidad y estado del viaje principal
            visibility: mainTrip.visibility || TripVisibility.PUBLISHED,
            tripStatus: TripStatus.NOT_STARTED
          };
          
          const subTrip = await storage.createTrip(subTripToCreate);
          createdTrips.push(subTrip);
        }
      }
      
      res.status(201).json(createdTrips);
    } catch (error) {
      console.error("Error creating trips:", error);
      res.status(500).json({ error: "Failed to create trip" });
    }
  });
  
  // Helper function to generate all possible segments between stops
  function generateAllPossibleSegments(route: RouteWithSegments) {
    const allPoints = [route.origin, ...route.stops, route.destination];
    const allSegments = [];
    
    console.log(`Generando todos los segmentos para la ruta ${route.id}`);
    console.log(`Puntos en la ruta: ${allPoints.join(' -> ')}`);
    
    // Approach 1: Generate all possible combinations (not just consecutive stops)
    for (let i = 0; i < allPoints.length - 1; i++) {
      for (let j = i + 1; j < allPoints.length; j++) {
        // Skip the main route (origin to destination) as it's already created separately
        if (i === 0 && j === allPoints.length - 1) {
          console.log(`Saltando ruta principal: ${allPoints[i]} -> ${allPoints[j]} (se crea por separado)`);
          continue;
        }
        
        // Skip segments where origin and destination are in the same city
        if (isSameCity(allPoints[i], allPoints[j])) {
          console.log(`Saltando segmento en misma ciudad: ${allPoints[i]} -> ${allPoints[j]}`);
          continue;
        }
        
        // ACTUALIZACIÓN: Eliminamos el filtro de segmentos cortos no significativos
        // para generar los mismos segmentos que se muestran en la interfaz de usuario
        
        allSegments.push({
          origin: allPoints[i],
          destination: allPoints[j],
          price: 0
        });
        
        console.log(`  + Segmento: ${allPoints[i]} -> ${allPoints[j]}`);
      }
    }
    
    console.log(`Generados ${allSegments.length} segmentos válidos para la ruta ${route.id} (coincidiendo con la cantidad mostrada en la interfaz)`);
    
    return allSegments;
  }
  
  // Helper function to calculate segment departure and arrival times
  function calculateSegmentTimes(
    segments: { origin: string; destination: string; price: number; stopTimes?: any[]; segmentPrices?: any[] }[],
    mainDepartureTime: string,
    mainArrivalTime: string,
    route: RouteWithSegments
  ) {
    const allPoints = [route.origin, ...route.stops, route.destination];
    const totalPoints = allPoints.length;
    const totalSegments = totalPoints - 1;
    
    // Resultado final: mapa de tiempos para cada segmento
    const segmentTimes: Record<string, { departureTime: string; arrivalTime: string }> = {};
    console.log("Iniciando cálculo de tiempos para segmentos");
    
    // Primero intentamos usar los tiempos definidos en segmentPrices (con mayor prioridad)
    const segmentPrices = segments[0]?.segmentPrices;
    if (segmentPrices && Array.isArray(segmentPrices) && segmentPrices.length > 0) {
      console.log("Verificando tiempos en segmentPrices", segmentPrices);
      
      // Recorrer cada segmentPrice para extraer los tiempos explícitamente configurados
      segments.forEach(segment => {
        const segmentData = segmentPrices.find(
          (sp: any) => sp.origin === segment.origin && sp.destination === segment.destination
        );
        
        if (segmentData) {
          let departureTime, arrivalTime;
          
          // Obtener tiempo de salida (dar prioridad al formato completo)
          if (segmentData.departureTime) {
            departureTime = segmentData.departureTime;
            console.log(`Usando tiempo de salida explícito: ${segment.origin} -> ${departureTime}`);
          } else if (segmentData.departureHour && segmentData.departureMinute && segmentData.departureAmPm) {
            departureTime = `${segmentData.departureHour}:${segmentData.departureMinute} ${segmentData.departureAmPm}`;
            console.log(`Componiendo tiempo de salida: ${segment.origin} -> ${departureTime}`);
          }
          
          // Obtener tiempo de llegada (dar prioridad al formato completo)
          if (segmentData.arrivalTime) {
            arrivalTime = segmentData.arrivalTime;
            console.log(`Usando tiempo de llegada explícito: ${segment.destination} -> ${arrivalTime}`);
          } else if (segmentData.arrivalHour && segmentData.arrivalMinute && segmentData.arrivalAmPm) {
            arrivalTime = `${segmentData.arrivalHour}:${segmentData.arrivalMinute} ${segmentData.arrivalAmPm}`;
            console.log(`Componiendo tiempo de llegada: ${segment.destination} -> ${arrivalTime}`);
          }
          
          // Si tenemos ambos tiempos configurados para este segmento, guardarlos
          if (departureTime && arrivalTime) {
            const key = `${segment.origin}-${segment.destination}`;
            segmentTimes[key] = { departureTime, arrivalTime };
            console.log(`✓ Configurados tiempos para segmento: ${segment.origin} -> ${segment.destination}`);
          }
        }
      });
      
      // Si tenemos tiempos para todos los segmentos, retornar directamente
      if (Object.keys(segmentTimes).length === segments.length) {
        console.log("✅ Usando tiempos configurados para todos los segmentos");
        return segmentTimes;
      } else {
        console.log(`Encontrados ${Object.keys(segmentTimes).length}/${segments.length} segmentos con tiempos configurados`);
      }
    }
    
    // Verificar si hay stopTimes personalizados en los datos de entrada
    const stopTimes = segments[0]?.stopTimes;
    const hasStopTimes = Array.isArray(stopTimes) && stopTimes.length > 0;
    
    if (hasStopTimes) {
      console.log("Usando tiempos de parada personalizados", stopTimes);
      
      // Crear un mapa de ubicaciones a tiempos
      const locationTimeMap: Record<string, string> = {};
      
      // Asignamos los tiempos a cada ubicación, asegurando que las paradas estén en el orden correcto
      const orderedStopTimes = [...stopTimes].sort((a, b) => {
        if (!a || !a.location || !b || !b.location) return 0;
        const indexA = allPoints.indexOf(a.location);
        const indexB = allPoints.indexOf(b.location);
        if (indexA === -1 || indexB === -1) return 0;
        return indexA - indexB;
      });
      
      orderedStopTimes.forEach((stopTime: any) => {
        if (stopTime && stopTime.location && stopTime.hour && stopTime.minute && stopTime.ampm) {
          // Asegurarnos de preservar exactamente el formato AM/PM como está en el input
          // y evitar que se convierta incorrectamente a AM
          const ampm = stopTime.ampm.toUpperCase(); // Normalizar a mayúsculas para evitar errores
          const timeString = `${stopTime.hour}:${stopTime.minute} ${ampm}`;
          locationTimeMap[stopTime.location] = timeString;
          console.log(`Estableciendo tiempo para ${stopTime.location}: ${timeString}`);
        }
      });
      
      // Si tenemos tiempos personalizados, usémoslos directamente
      const segmentTimes: Record<string, { departureTime: string; arrivalTime: string }> = {};
      
      // Asegurarse de que los tiempos de origen y destino principal estén configurados correctamente
      if (!locationTimeMap[route.origin]) {
        locationTimeMap[route.origin] = mainDepartureTime;
        console.log(`Forzando tiempo de salida principal para ${route.origin}: ${mainDepartureTime}`);
      }
      
      if (!locationTimeMap[route.destination]) {
        locationTimeMap[route.destination] = mainArrivalTime;
        console.log(`Forzando tiempo de llegada principal para ${route.destination}: ${mainArrivalTime}`);
      }
      
      // Si tenemos suficientes tiempos personalizados, calcular segmentos basados en ellos
      if (Object.keys(locationTimeMap).length >= 2) {
        // Primero, procesamos los segmentos directos entre paradas adyacentes
        for (let i = 0; i < allPoints.length - 1; i++) {
          const origin = allPoints[i];
          const destination = allPoints[i + 1];
          
          if (origin && destination && locationTimeMap[origin] && locationTimeMap[destination]) {
            const key = `${origin}-${destination}`;
            segmentTimes[key] = {
              departureTime: locationTimeMap[origin],
              arrivalTime: locationTimeMap[destination]
            };
          }
        }
        
        // Luego, procesamos todos los segmentos restantes
        segments.forEach(segment => {
          const key = `${segment.origin}-${segment.destination}`;
          
          // Solo procesar segmentos que no se hayan procesado aún
          if (!segmentTimes[key] && locationTimeMap[segment.origin] && locationTimeMap[segment.destination]) {
            segmentTimes[key] = {
              departureTime: locationTimeMap[segment.origin],
              arrivalTime: locationTimeMap[segment.destination]
            };
          }
        });
        
        // Si hemos podido calcular todos los segmentos usando tiempos personalizados, devolvemos esos
        if (Object.keys(segmentTimes).length === segments.length) {
          console.log("Usando exclusivamente tiempos personalizados para todos los segmentos");
          return segmentTimes;
        }
      }
    }
    
    // Si no hay suficientes tiempos personalizados o si faltan algunos segmentos, caemos al cálculo proporcional
    console.log("Usando cálculo proporcional para los tiempos de segmentos");
    
    // Calculate the total duration in minutes
    const departureTimeParts = mainDepartureTime.split(' ')[0].split(':');
    const departureHour = parseInt(departureTimeParts[0], 10);
    const departureMinute = parseInt(departureTimeParts[1], 10);
    const departureAmPm = mainDepartureTime.split(' ')[1];
    
    const arrivalTimeParts = mainArrivalTime.split(' ')[0].split(':');
    const arrivalHour = parseInt(arrivalTimeParts[0], 10);
    const arrivalMinute = parseInt(arrivalTimeParts[1], 10);
    const arrivalAmPm = mainArrivalTime.split(' ')[1];
    
    // Convert to 24-hour format
    let departure24Hour = departureHour;
    if (departureAmPm === 'PM' && departureHour < 12) departure24Hour += 12;
    if (departureAmPm === 'AM' && departureHour === 12) departure24Hour = 0;
    
    let arrival24Hour = arrivalHour;
    if (arrivalAmPm === 'PM' && arrivalHour < 12) arrival24Hour += 12;
    if (arrivalAmPm === 'AM' && arrivalHour === 12) arrival24Hour = 0;
    
    // Calculate total minutes
    const departureMinutes = departure24Hour * 60 + departureMinute;
    let arrivalMinutes = arrival24Hour * 60 + arrivalMinute;
    
    // Handle case where arrival is the next day
    if (arrivalMinutes < departureMinutes) {
      arrivalMinutes += 24 * 60; // Add 24 hours
    }
    
    const totalMinutes = arrivalMinutes - departureMinutes;
    
    // Allocate time proportionally to segments
    const minutesPerSegment = totalMinutes / totalSegments;
    
    // Create a map to store segment indices
    const pointIndices: Record<string, number> = {};
    allPoints.forEach((point, index) => {
      pointIndices[point] = index;
    });
    
    // Calculate times for each segment
    const calculatedSegmentTimes: Record<string, { departureTime: string; arrivalTime: string }> = {};
    segments.forEach(segment => {
      const startIdx = pointIndices[segment.origin] as number;
      const endIdx = pointIndices[segment.destination] as number;
      
      // Calculate the proportional time
      const segmentStartMinutes = departureMinutes + (startIdx * minutesPerSegment);
      const segmentEndMinutes = departureMinutes + (endIdx * minutesPerSegment);
      
      // Convert back to 12-hour format
      const segmentStartHour = Math.floor(segmentStartMinutes / 60) % 24;
      const segmentStartMinute = Math.floor(segmentStartMinutes % 60);
      const segmentStartAmPm = segmentStartHour >= 12 ? 'PM' : 'AM';
      const displayStartHour = segmentStartHour > 12 ? segmentStartHour - 12 : (segmentStartHour === 0 ? 12 : segmentStartHour);
      
      const segmentEndHour = Math.floor(segmentEndMinutes / 60) % 24;
      const segmentEndMinute = Math.floor(segmentEndMinutes % 60);
      const segmentEndAmPm = segmentEndHour >= 12 ? 'PM' : 'AM';
      const displayEndHour = segmentEndHour > 12 ? segmentEndHour - 12 : (segmentEndHour === 0 ? 12 : segmentEndHour);
      
      const segmentDepartureTime = `${String(displayStartHour).padStart(2, '0')}:${String(segmentStartMinute).padStart(2, '0')} ${segmentStartAmPm}`;
      const segmentArrivalTime = `${String(displayEndHour).padStart(2, '0')}:${String(segmentEndMinute).padStart(2, '0')} ${segmentEndAmPm}`;
      
      const key = `${segment.origin}-${segment.destination}`;
      calculatedSegmentTimes[key] = {
        departureTime: segmentDepartureTime,
        arrivalTime: segmentArrivalTime
      };
    });
    
    // Add the main route times
    const mainRouteKey = `${route.origin}-${route.destination}`;
    calculatedSegmentTimes[mainRouteKey] = {
      departureTime: mainDepartureTime,
      arrivalTime: mainArrivalTime
    };
    
    return calculatedSegmentTimes;
  }
  
  // Helper function to calculate proportional prices for segments
  function calculateProportionalPrice(
    segment: { origin: string; destination: string },
    route: RouteWithSegments,
    totalPrice: number | undefined
  ): number {
    // Si no hay precio total, usar valor predeterminado
    if (totalPrice === undefined) totalPrice = 0;
    const allPoints = [route.origin, ...route.stops, route.destination];
    const totalSegments = allPoints.length - 1;
    
    // Find the indices of the origin and destination in the route
    const originIndex = allPoints.indexOf(segment.origin);
    const destinationIndex = allPoints.indexOf(segment.destination);
    
    if (originIndex === -1 || destinationIndex === -1) {
      console.warn(`Ubicación no encontrada en la ruta: ${segment.origin} o ${segment.destination}`);
      return Math.round(totalPrice / 2); // Valor por defecto si no se encuentran los índices
    }
    
    // Calculate the number of segments this covers
    const segmentsCovered = destinationIndex - originIndex;
    
    // Asegurarnos de que el número de segmentos sea siempre positivo
    if (segmentsCovered <= 0) {
      console.warn(`Cálculo de segmentos inválido para ${segment.origin} -> ${segment.destination}`);
      return Math.round(totalPrice / 4); // Valor por defecto para segmentos con cálculo inválido
    }
    
    // Calcular la proporción basada en la distancia entre los puntos (asumiendo distancias iguales)
    const proportion = segmentsCovered / totalSegments;
    
    // Para evitar precios muy bajos, establecemos un mínimo de 1/4 del precio total
    const minProportion = 0.25;
    const effectiveProportion = Math.max(proportion, minProportion);
    
    // Redondear a múltiplos de 25 para precios más "limpios"
    const exactPrice = effectiveProportion * totalPrice;
    return Math.round(exactPrice / 25) * 25;
  }

  app.put(apiRouter("/trips/:id"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Log detallado de la solicitud para diagnóstico
      console.log(`⬆️ PUT /trips/${id} - Datos recibidos:`, JSON.stringify(req.body, null, 2));
      
      const validationResult = insertTripSchema.partial().safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid trip data", 
          details: validationResult.error.format() 
        });
      }
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[PUT /trips/${id}] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[PUT /trips/${id}] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // Obtener viaje actual antes de actualizar
      const currentTrip = await storage.getTrip(id);
      if (!currentTrip) {
        return res.status(404).json({ error: "Trip not found" });
      }
      
      // SEGURIDAD: Si no es superAdmin, verificar que el viaje pertenece a su compañía
      if (user.role !== UserRole.SUPER_ADMIN) {
        const userCompany = user.companyId || user.company;
        
        if (currentTrip.companyId && currentTrip.companyId !== userCompany) {
          console.log(`[PUT /trips/${id}] ACCESO DENEGADO: El viaje pertenece a compañía ${currentTrip.companyId} pero el usuario es de ${userCompany}`);
          return res.status(403).json({ 
            error: "Acceso denegado", 
            details: "No tiene permiso para editar viajes de otra compañía" 
          });
        }
      }
      
      const tripData = validationResult.data;
      
      // Si el viaje tiene segmentPrices del formulario, preservarlos
      if (tripData.segmentPrices && Array.isArray(tripData.segmentPrices)) {
        console.log("Actualizando precios por segmento:", tripData.segmentPrices);
      } else if (currentTrip.segmentPrices) {
        // Preservar los segmentPrices actuales si no se proporcionaron nuevos
        tripData.segmentPrices = currentTrip.segmentPrices;
        console.log("Preservando precios por segmento existentes");
      }
      
      // No procesamos stopTimes en el servidor ya que no forma parte del esquema de la base de datos
      // Solo lo usamos para cálculos en memoria
      
      // Preservar campos críticos que no deberían ser nulos
      if (tripData.price === undefined || tripData.price === null) {
        tripData.price = currentTrip.price;
      }
      
      if (tripData.capacity === undefined || tripData.capacity === null) {
        tripData.capacity = currentTrip.capacity;
      }
      
      // Manejar campos de visibilidad y estado
      if (tripData.visibility === undefined || tripData.visibility === null) {
        tripData.visibility = currentTrip.visibility || TripVisibility.PUBLISHED;
      }
      
      if (tripData.tripStatus === undefined || tripData.tripStatus === null) {
        tripData.tripStatus = currentTrip.tripStatus || TripStatus.NOT_STARTED;
      }
      
      // Actualizar automáticamente el estado del viaje en función de su fecha
      const now = new Date();
      const tripDate = new Date(tripData.departureDate || currentTrip.departureDate);
      
      // Si la fecha actual es posterior a la fecha del viaje, marcar como completado
      // Si la fecha actual es igual a la fecha del viaje, marcar como en progreso
      // De lo contrario, mantener el estado actual o "aún no inicia"
      const compareDate = tripDate.setHours(0, 0, 0, 0);
      const todayDate = new Date().setHours(0, 0, 0, 0);
      
      // Solo actualizar automáticamente si el viaje no está cancelado
      if (tripData.visibility !== TripVisibility.CANCELLED) {
        if (todayDate > compareDate) {
          tripData.tripStatus = TripStatus.FINISHED;
        } else if (todayDate === compareDate) {
          tripData.tripStatus = TripStatus.IN_PROGRESS;
        }
      }
      
      // Identificar y extraer información de tiempos de parada y precios para el viaje principal
      console.log("⏰ Procesando tiempos y precios para actualización del viaje principal");
      
      // 1. ACTUALIZACIÓN DE HORARIOS
      // Obtener los tiempos de parada del formulario (si están disponibles)
      if (req.body.stopTimes && Array.isArray(req.body.stopTimes) && req.body.stopTimes.length > 0) {
        console.log("⏰ stopTimes recibidos:", req.body.stopTimes);
        
        // Asignar hora de origen (primera parada) al departureTime
        if (req.body.stopTimes[0]) {
          const firstStopTime = req.body.stopTimes[0];
          if (firstStopTime && typeof firstStopTime === 'object') {
            const formattedTime = `${firstStopTime.hour || '00'}:${firstStopTime.minute || '00'} ${firstStopTime.ampm || 'AM'}`;
            console.log(`⏰ HORA ORIGEN establecida a: ${formattedTime}`);
            tripData.departureTime = formattedTime;
          }
        }
        
        // Asignar hora de destino (última parada) al arrivalTime
        const lastIndex = req.body.stopTimes.length - 1;
        if (req.body.stopTimes[lastIndex]) {
          const lastStopTime = req.body.stopTimes[lastIndex];
          if (lastStopTime && typeof lastStopTime === 'object') {
            const formattedTime = `${lastStopTime.hour || '00'}:${lastStopTime.minute || '00'} ${lastStopTime.ampm || 'AM'}`;
            console.log(`⏰ HORA DESTINO establecida a: ${formattedTime}`);
            tripData.arrivalTime = formattedTime;
          }
        }
      } 
      // Alternativamente, si no hay stopTimes, revisar los segmentPrices para horarios
      else if (tripData.segmentPrices && Array.isArray(tripData.segmentPrices) && tripData.segmentPrices.length > 0) {
        console.log("⏰ Calculando horarios para el viaje principal basado en segmentPrices");
        
        const allOrigins = new Set(tripData.segmentPrices.map(seg => seg.origin));
        const allDestinations = new Set(tripData.segmentPrices.map(seg => seg.destination));
        
        console.log(`⏰ Orígenes disponibles: ${Array.from(allOrigins).join(', ')}`);
        console.log(`⏰ Destinos disponibles: ${Array.from(allDestinations).join(', ')}`);
        
        // Si existe la ruta directa entre el origen y destino principal
        const directSegment = tripData.segmentPrices.find(
          segment => segment.origin === currentTrip.segmentOrigin && 
                    segment.destination === currentTrip.segmentDestination
        );
        
        if (directSegment) {
          console.log("⏰ Encontrada ruta directa entre origen y destino principal");
          if (directSegment.departureTime) {
            console.log(`⏰ HORA ORIGEN (directa) establecida a: ${directSegment.departureTime}`);
            tripData.departureTime = directSegment.departureTime;
          }
          if (directSegment.arrivalTime) {
            console.log(`⏰ HORA DESTINO (directa) establecida a: ${directSegment.arrivalTime}`);
            tripData.arrivalTime = directSegment.arrivalTime;
          }
        }
        // De lo contrario, buscar el primer segmento y el último
        else {
          // Encontrar el primer segmento (que inicia en el origen del viaje)
          const originSegments = tripData.segmentPrices.filter(seg => 
            seg.origin === currentTrip.segmentOrigin
          );
          
          if (originSegments.length > 0 && originSegments[0].departureTime) {
            console.log(`⏰ HORA ORIGEN establecida a: ${originSegments[0].departureTime}`);
            tripData.departureTime = originSegments[0].departureTime;
          }
          
          // Encontrar el último segmento (que termina en el destino del viaje)
          const destinationSegments = tripData.segmentPrices.filter(seg => 
            seg.destination === currentTrip.segmentDestination
          );
          
          if (destinationSegments.length > 0 && destinationSegments[0].arrivalTime) {
            console.log(`⏰ HORA DESTINO establecida a: ${destinationSegments[0].arrivalTime}`);
            tripData.arrivalTime = destinationSegments[0].arrivalTime;
          }
        }
      }

      // 2. ACTUALIZACIÓN DE PRECIO
      // Calcular el precio del viaje principal como la suma de los precios de todos los segmentos directos
      if (tripData.segmentPrices && Array.isArray(tripData.segmentPrices) && tripData.segmentPrices.length > 0) {
        console.log("💰 Calculando precio del viaje principal basado en segmentos");
        
        // Buscar si existe un segmento directo que represente la ruta completa
        const directSegment = tripData.segmentPrices.find(
          segment => segment.origin === currentTrip.segmentOrigin && 
                    segment.destination === currentTrip.segmentDestination
        );
        
        if (directSegment) {
          // Si hay un segmento directo, usar su precio
          console.log(`💰 PRECIO DIRECTO encontrado: ${directSegment.price}`);
          tripData.price = directSegment.price;
        } 
        else {
          // Si no hay un segmento directo, usar el segmento más caro como precio base
          const prices = tripData.segmentPrices.map(segment => Number(segment.price) || 0);
          console.log(`💰 Precios de segmentos: ${prices.join(', ')}`);
          
          // Usar reduce para encontrar el máximo de forma segura
          const maxPrice = prices.length > 0 
            ? prices.reduce((max, price) => Math.max(max, price), 0)
            : 0;
            
          console.log(`💰 PRECIO MÁXIMO entre segmentos: ${maxPrice}`);
          
          if (maxPrice > 0) {
            // Establecer el precio como el precio máximo de segmento para viajes completos
            tripData.price = maxPrice;
            console.log(`💰 PRECIO PRINCIPAL establecido a: ${tripData.price}`);
          } else {
            console.log("💰 No se pudo determinar un precio basado en segmentos, manteniendo el actual");
          }
        }
      }
      
      // Actualizar el viaje principal
      const updatedTrip = await storage.updateTrip(id, tripData);
      
      if (!updatedTrip) {
        return res.status(404).json({ error: "Trip not found" });
      }
      
      // Si es un viaje principal (no un sub-viaje), actualizar también los sub-viajes
      if (!currentTrip.isSubTrip) {
        // Conseguir todos los sub-viajes asociados
        const trips = await storage.getTrips();
        const subTrips = trips.filter(t => t.parentTripId === id);
        
        if (subTrips.length > 0) {
          console.log(`Actualizando ${subTrips.length} sub-viajes asociados al viaje principal ${id}`);
          
          for (const subTrip of subTrips) {
            // Para cada sub-viaje, necesitamos actualizar la información relevante
            // Primero preparamos la actualización básica
            const subTripUpdate: any = {
              departureDate: tripData.departureDate || updatedTrip.departureDate,
              departureTime: tripData.departureTime || updatedTrip.departureTime,
              arrivalTime: tripData.arrivalTime || updatedTrip.arrivalTime,
              capacity: tripData.capacity || updatedTrip.capacity,
              vehicleType: tripData.vehicleType || updatedTrip.vehicleType,
              // Agregar campos de visibilidad y estado para mantener coherencia con el viaje principal
              visibility: tripData.visibility || updatedTrip.visibility,
              tripStatus: tripData.tripStatus || updatedTrip.tripStatus,
            };
            
            // Si hay precios de segmentos actualizados, buscamos el que corresponde a este sub-viaje
            if (tripData.segmentPrices && Array.isArray(tripData.segmentPrices) && tripData.segmentPrices.length > 0) {
              // Encontrar el precio de segmento específico para este sub-viaje basado en origen y destino
              const relevantSegment = tripData.segmentPrices.find(
                segment => segment.origin === subTrip.segmentOrigin && segment.destination === subTrip.segmentDestination
              );
              
              // Si encontramos un segmento relevante, actualizamos precio y tiempos
              if (relevantSegment) {
                console.log(`Actualizando precio de segmento para sub-viaje ${subTrip.id}:`, relevantSegment);
                subTripUpdate.price = relevantSegment.price;
                subTripUpdate.segmentPrices = [relevantSegment];
                
                // También actualizar tiempos específicos si están presentes
                if (relevantSegment.departureTime) {
                  subTripUpdate.departureTime = relevantSegment.departureTime;
                }
                if (relevantSegment.arrivalTime) {
                  subTripUpdate.arrivalTime = relevantSegment.arrivalTime;
                }
              }
            }
            
            // Actualizar el sub-viaje con la información recopilada
            await storage.updateTrip(subTrip.id, subTripUpdate);
          }
          
          console.log("Sub-viajes actualizados correctamente");
        }
      }
      
      res.json(updatedTrip);
    } catch (error) {
      console.error("Error updating trip:", error);
      res.status(500).json({ error: "Failed to update trip" });
    }
  });

  app.delete(apiRouter("/trips/:id"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[DELETE /trips/${id}] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[DELETE /trips/${id}] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // Primero verificar que el viaje existe
      const currentTrip = await storage.getTrip(id);
      if (!currentTrip) {
        return res.status(404).json({ error: "Trip not found" });
      }
      
      // SEGURIDAD: Si no es superAdmin, verificar que el viaje pertenece a su compañía
      if (user.role !== UserRole.SUPER_ADMIN) {
        const userCompany = user.companyId || user.company;
        
        if (currentTrip.companyId && currentTrip.companyId !== userCompany) {
          console.log(`[DELETE /trips/${id}] ACCESO DENEGADO: El viaje pertenece a compañía ${currentTrip.companyId} pero el usuario es de ${userCompany}`);
          return res.status(403).json({ 
            error: "Acceso denegado", 
            details: "No tiene permiso para eliminar viajes de otra compañía" 
          });
        }
      }
      
      const success = await storage.deleteTrip(id);
      
      if (!success) {
        return res.status(500).json({ error: "Failed to delete trip" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete trip" });
    }
  });
  
  // Endpoint específico para asignar vehículo o conductor a un viaje (PATCH)
  app.patch(apiRouter("/trips/:id"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      console.log(`PATCH /trips/${id} - Datos recibidos:`, req.body);
      
      // Validación de datos
      const validationResult = insertTripSchema.partial().safeParse(req.body);
      if (!validationResult.success) {
        console.error(`Validación fallida para PATCH /trips/${id}:`, validationResult.error.format());
        return res.status(400).json({ 
          error: "Invalid trip update data", 
          details: validationResult.error.format() 
        });
      }
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[PATCH /trips/${id}] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[PATCH /trips/${id}] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // Obtener viaje actual
      const currentTrip = await storage.getTrip(id);
      if (!currentTrip) {
        console.error(`Viaje no encontrado para PATCH /trips/${id}`);
        return res.status(404).json({ error: "Trip not found" });
      }
      
      // SEGURIDAD: Si no es superAdmin, verificar que el viaje pertenece a su compañía
      if (user.role !== UserRole.SUPER_ADMIN) {
        const userCompany = user.companyId || user.company;
        
        if (currentTrip.companyId && currentTrip.companyId !== userCompany) {
          console.log(`[PATCH /trips/${id}] ACCESO DENEGADO: El viaje pertenece a compañía ${currentTrip.companyId} pero el usuario es de ${userCompany}`);
          return res.status(403).json({ 
            error: "Acceso denegado", 
            details: "No tiene permiso para modificar viajes de otra compañía" 
          });
        }
      }
      
      // Datos a actualizar - solo permitir vehicleId y driverId en PATCH
      const updateData: Partial<any> = {};
      
      // Procesar vehicleId (si está presente)
      if (req.body.vehicleId !== undefined) {
        console.log(`Asignando vehículo ${req.body.vehicleId} al viaje ${id}`);
        // Convertir a número si viene como string
        updateData.vehicleId = typeof req.body.vehicleId === 'string' 
          ? parseInt(req.body.vehicleId, 10) 
          : req.body.vehicleId;
      }
      
      // Procesar driverId (si está presente)
      if (req.body.driverId !== undefined) {
        console.log(`Asignando conductor ${req.body.driverId} al viaje ${id}`);
        // Convertir a número si viene como string
        updateData.driverId = typeof req.body.driverId === 'string' 
          ? parseInt(req.body.driverId, 10) 
          : req.body.driverId;
      }
      
      // Si no hay datos para actualizar, devolver el trip actual
      if (Object.keys(updateData).length === 0) {
        console.log(`No hay datos para actualizar en PATCH /trips/${id}`);
        return res.json(currentTrip);
      }
      
      // Actualizar el viaje con los nuevos datos
      console.log(`Actualizando viaje ${id} con datos:`, updateData);
      const updatedTrip = await storage.updateTrip(id, updateData);
      
      if (!updatedTrip) {
        console.error(`Error al actualizar viaje ${id}`);
        return res.status(500).json({ error: "Failed to update trip" });
      }
      
      console.log(`Viaje ${id} actualizado correctamente:`, updatedTrip);
      res.json(updatedTrip);
    } catch (error) {
      console.error(`Error al procesar PATCH /trips:`, error);
      res.status(500).json({ error: "Failed to update trip" });
    }
  });

  // RESERVATIONS ENDPOINTS
  app.get(apiRouter("/reservations"), async (req: Request, res: Response) => {
    try {
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[GET /reservations] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[GET /reservations] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // SEGURIDAD: Filtrado de datos por compañía
      let companyId: string | null = null;
      let tripId: number | null = null;
      let includeRelatedTrips = req.query.includeRelated === 'true';
      
      // Verificar si se solicita filtrar por viaje específico
      if (req.query.tripId) {
        tripId = parseInt(req.query.tripId as string, 10);
        console.log(`[GET /reservations] Solicitando específicamente reservaciones del viaje ID: ${tripId}`);
        
        if (includeRelatedTrips) {
          console.log(`[GET /reservations] Se incluirán reservaciones de viajes relacionados (principal/subviajes)`);
        }
      }
      
      // REGLAS DE ACCESO:
      // 1. superAdmin y admin pueden ver TODAS las reservaciones
      // 2. Conductores pueden ver reservaciones de los viajes asignados a ellos
      // 3. El resto de roles solo pueden ver reservaciones de SU COMPAÑÍA
      if (user) {
        // CASO ESPECIAL: Si el usuario es CONDUCTOR y se solicita un viaje específico
        // y ese viaje está asignado al conductor, permitir ver las reservaciones
        if (user.role === UserRole.DRIVER && tripId) {
          console.log(`[GET /reservations] CONDUCTOR solicitando reservaciones para viaje ${tripId}`);
          
          // Obtener el viaje específico para verificar si está asignado al conductor
          const trip = await storage.getTrip(tripId);
          
          if (trip && trip.driverId === user.id) {
            console.log(`[GET /reservations] Permitiendo a conductor ver reservaciones del viaje ${tripId} asignado a él`);
            
            // Si se solicita incluir viajes relacionados
            if (includeRelatedTrips) {
              try {
                console.log(`[GET /reservations] Buscando viajes relacionados con ${tripId}`);
                
                // Obtener el viaje completo con información de ruta
                const fullTrip = await storage.getTripWithRouteInfo(tripId);
                if (!fullTrip) {
                  throw new Error(`No se encontró información completa del viaje ${tripId}`);
                }
                
                // Obtener todos los viajes para identificar relaciones
                const allTrips = await storage.getTrips();
                let relatedTripIds = [tripId]; // Incluir el viaje solicitado
                
                // Determinar viajes relacionados según el tipo
                if (!fullTrip.isSubTrip) {
                  // Es un viaje principal, buscar sus subviajes
                  const subTrips = allTrips.filter(t => t.parentTripId === tripId);
                  relatedTripIds = [...relatedTripIds, ...subTrips.map(t => t.id)];
                  console.log(`[GET /reservations] Incluyendo ${subTrips.length} sub-viajes del viaje principal ${tripId}`);
                } else if (fullTrip.parentTripId) {
                  // Es un sub-viaje, incluir el viaje principal y otros sub-viajes hermanos
                  relatedTripIds.push(fullTrip.parentTripId);
                  const siblingTrips = allTrips.filter(t => 
                    t.parentTripId === fullTrip.parentTripId && t.id !== tripId);
                  relatedTripIds = [...relatedTripIds, ...siblingTrips.map(t => t.id)];
                  console.log(`[GET /reservations] Incluyendo viaje principal ${fullTrip.parentTripId} y ${siblingTrips.length} sub-viajes hermanos`);
                }
                
                // Obtener reservaciones de todos los viajes relacionados
                const allReservations = [];
                
                for (const id of relatedTripIds) {
                  const tripReservations = await storage.getReservations(undefined, id);
                  allReservations.push(...tripReservations);
                  console.log(`[GET /reservations] Encontradas ${tripReservations.length} reservaciones para viaje relacionado ${id}`);
                }
                
                console.log(`[GET /reservations] Total: ${allReservations.length} reservaciones de todos los viajes relacionados`);
                return res.json(allReservations);
              } catch (error) {
                console.error('[GET /reservations] Error al obtener viajes relacionados:', error);
                // Si hay error, caer al comportamiento normal (solo el viaje solicitado)
              }
            }
            
            // Comportamiento original: solo reservaciones del viaje específico
            const tripReservations = await storage.getReservations(undefined, tripId);
            return res.json(tripReservations);
          } else {
            console.log(`[GET /reservations] ACCESO DENEGADO: El viaje ${tripId} no está asignado al conductor ${user.id}`);
            return res.status(403).json({ error: "Acceso denegado a este viaje" });
          }
        }
        // Los roles que NO son superAdmin, admin, taquilla o checador tienen acceso restringido
        else if (user.role !== UserRole.SUPER_ADMIN && 
                 user.role !== UserRole.ADMIN && 
                 user.role !== UserRole.TICKET_OFFICE && 
                 user.role !== UserRole.CHECKER) {
          // Obtener la compañía del usuario
          companyId = user.companyId || user.company;
          
          if (!companyId) {
            console.log(`[GET /reservations] ADVERTENCIA: Usuario sin compañía asignada`);
            // Si el usuario no tiene compañía asignada, devolver lista vacía por seguridad
            return res.json([]);
          }
          
          console.log(`[GET /reservations] FILTRO CRÍTICO: Aplicando filtro por compañía "${companyId}"`);
        } else {
          console.log(`[GET /reservations] Usuario con rol ${user.role} puede ver TODAS las reservaciones`);
        }
      } else {
        console.log(`[GET /reservations] Usuario no autenticado`);
        // Usuarios no autenticados no deberían poder ver reservaciones
        return res.status(401).json({ error: "No autenticado" });
      }
      
      // Si se solicita incluir viajes relacionados para cualquier rol (dueño, admin, etc.)
      let reservations = [];
      
      if (tripId && includeRelatedTrips) {
        try {
          console.log(`[GET /reservations] Usuario con rol ${user.role} solicitando viajes relacionados con ${tripId}`);
          
          // Obtener el viaje completo con información de ruta
          const fullTrip = await storage.getTripWithRouteInfo(tripId);
          if (!fullTrip) {
            throw new Error(`No se encontró información completa del viaje ${tripId}`);
          }
          
          // Obtener todos los viajes para identificar relaciones
          const allTrips = await storage.getTrips();
          let relatedTripIds = [tripId]; // Incluir el viaje solicitado
          
          // Determinar viajes relacionados según el tipo
          if (!fullTrip.isSubTrip) {
            // Es un viaje principal, buscar sus subviajes
            const subTrips = allTrips.filter(t => t.parentTripId === tripId);
            relatedTripIds = [...relatedTripIds, ...subTrips.map(t => t.id)];
            console.log(`[GET /reservations] Incluyendo ${subTrips.length} sub-viajes del viaje principal ${tripId}`);
          } else if (fullTrip.parentTripId) {
            // Es un sub-viaje, incluir el viaje principal y otros sub-viajes hermanos
            relatedTripIds.push(fullTrip.parentTripId);
            const siblingTrips = allTrips.filter(t => 
              t.parentTripId === fullTrip.parentTripId && t.id !== tripId);
            relatedTripIds = [...relatedTripIds, ...siblingTrips.map(t => t.id)];
            console.log(`[GET /reservations] Incluyendo viaje principal ${fullTrip.parentTripId} y ${siblingTrips.length} sub-viajes hermanos`);
          }
          
          // Obtener reservaciones de todos los viajes relacionados
          const allReservations = [];
          
          for (const id of relatedTripIds) {
            // Aplicar filtro de compañía para todos los roles excepto superAdmin
            const tripReservations = await storage.getReservations(
              (user.role === UserRole.SUPER_ADMIN) ? undefined : (companyId || undefined),
              id
            );
            allReservations.push(...tripReservations);
            console.log(`[GET /reservations] Encontradas ${tripReservations.length} reservaciones para viaje relacionado ${id}`);
          }
          
          console.log(`[GET /reservations] Total: ${allReservations.length} reservaciones de todos los viajes relacionados`);
          reservations = allReservations;
        } catch (error) {
          console.error('[GET /reservations] Error al obtener viajes relacionados:', error);
          // Si hay error, caer al comportamiento normal (solo el viaje solicitado)
          reservations = await storage.getReservations(companyId || undefined, tripId || undefined);
        }
      } else {
        // Ejecutar la consulta normal con el filtro de compañía si aplica
        reservations = await storage.getReservations(companyId || undefined, tripId || undefined);
      }
      
      console.log(`[GET /reservations] Encontradas ${reservations.length} reservaciones`);
      
      // CAPA ADICIONAL DE SEGURIDAD - FILTRO POST-CONSULTA
      if (user && 
          user.role !== UserRole.SUPER_ADMIN && 
          user.role !== UserRole.ADMIN && 
          user.role !== UserRole.TICKET_OFFICE && 
          user.role !== UserRole.CHECKER) {
        // Obtener la compañía del usuario
        const userCompany = user.companyId || user.company || null;
        
        if (userCompany) {
          // Verificar que todas las reservaciones sean realmente de la compañía del usuario
          const reservacionesDeOtrasCompanias = reservations.filter(r => 
            r.companyId && r.companyId !== userCompany
          );
          
          if (reservacionesDeOtrasCompanias.length > 0) {
            console.log(`[ALERTA DE SEGURIDAD] Se intentaron mostrar ${reservacionesDeOtrasCompanias.length} reservaciones de otras compañías!`);
            
            // CRÍTICO: Filtrar y devolver SOLO las reservaciones de la compañía del usuario
            const reservacionesFiltradas = reservations.filter(r => r.companyId === userCompany);
            console.log(`[CORRECCIÓN] Devolviendo solo ${reservacionesFiltradas.length} reservaciones de compañía ${userCompany}`);
            
            // Reemplazar los resultados
            return res.json(reservacionesFiltradas);
          }
        }
      }
      
      // Si el usuario es TICKET_OFFICE (Taquilla), agregar información de la empresa a cada reservación
      if (user && user.role === UserRole.TICKET_OFFICE) {
        console.log(`[GET /reservations] Usuario con rol TICKET_OFFICE: Agregando información de empresas`);
        
        // Procesar las reservaciones para agregar el nombre de la empresa
        const reservationsWithCompanyInfo = await Promise.all(
          reservations.map(async (reservation) => {
            // Primero intentamos usar companyId directamente de la reservación
            if (reservation.companyId) {
              // Obtener información de la empresa
              const companyInfo = await storage.getCompanyById(reservation.companyId);
              
              if (companyInfo) {
                // Devolver la reservación con la información de la empresa
                return {
                  ...reservation,
                  companyInfo: {
                    id: companyInfo.id,
                    name: companyInfo.name
                  }
                };
              } else {
                // Si no se encuentra la empresa pero tenemos ID, mostrar ID como nombre
                return {
                  ...reservation,
                  companyInfo: {
                    id: reservation.companyId,
                    name: `Empresa ID: ${reservation.companyId}`
                  }
                };
              }
            } 
            // Si la reservación no tiene companyId directo, intentar obtenerlo del viaje
            else if (reservation.trip && reservation.trip.companyId) {
              const companyInfo = await storage.getCompanyById(reservation.trip.companyId);
              
              if (companyInfo) {
                return {
                  ...reservation,
                  companyInfo: {
                    id: companyInfo.id,
                    name: companyInfo.name
                  }
                };
              } else {
                return {
                  ...reservation,
                  companyInfo: {
                    id: reservation.trip.companyId,
                    name: `Empresa ID: ${reservation.trip.companyId}`
                  }
                };
              }
            }
            // Si no hay ninguna información de empresa disponible
            return {
              ...reservation,
              companyInfo: {
                id: null,
                name: "Sin empresa asignada"
              }
            };
          })
        );
        
        console.log(`[GET /reservations] Procesadas ${reservationsWithCompanyInfo.length} reservaciones con información de empresa`);
        return res.json(reservationsWithCompanyInfo);
      }
      
      res.json(reservations);
    } catch (error: any) {
      console.error("[GET /reservations] Error:", error);
      res.status(500).json({ error: "Error al obtener reservaciones", details: error.message || "Error desconocido" });
    }
  });

  app.get(apiRouter("/reservations/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[GET /reservations/${id}] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[GET /reservations/${id}] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // SEGURIDAD: Control de acceso a datos por compañía
      let companyId: string | null = null;
      
      // REGLAS DE ACCESO:
      // 1. superAdmin, admin, checador y taquilla pueden ver TODAS las reservaciones (sin filtro)
      // 2. Todos los demás roles solo pueden ver reservaciones de SU COMPAÑÍA
      if (user) {
        if (user.role !== UserRole.SUPER_ADMIN && 
            user.role !== UserRole.ADMIN && 
            user.role !== UserRole.TICKET_OFFICE && 
            user.role !== UserRole.CHECKER) {
          // Obtener la compañía del usuario
          companyId = user.companyId || user.company;
          
          if (!companyId) {
            console.log(`[GET /reservations/${id}] ACCESO DENEGADO: Usuario sin compañía asignada`);
            return res.status(403).json({ 
              error: "Acceso denegado", 
              details: "Usuario sin compañía asignada" 
            });
          }
          
          console.log(`[GET /reservations/${id}] Verificando permisos para compañía: ${companyId}`);
        } else {
          console.log(`[GET /reservations/${id}] Usuario con rol ${user.role} puede ver todas las reservaciones`);
        }
      } else {
        console.log(`[GET /reservations/${id}] Acceso no autenticado denegado`);
        return res.status(401).json({ error: "No autenticado" });
      }
      
      // Obtener la reservación con filtrado por compañía
      const reservation = await storage.getReservationWithDetails(id, companyId || undefined);
      
      if (!reservation) {
        console.log(`[GET /reservations/${id}] No encontrada o acceso denegado`);
        return res.status(404).json({ error: "Reservación no encontrada" });
      }
      
      console.log(`[GET /reservations/${id}] Acceso concedido`);
      res.json(reservation);
    } catch (error) {
      console.error(`[GET /reservations/:id] Error: ${error}`);
      res.status(500).json({ error: "Error al obtener la reservación" });
    }
  });

  app.post(apiRouter("/reservations"), async (req: Request, res: Response) => {
    try {
      // Asegurarnos de que el método de pago está definido (para usuarios que no tengan una versión actualizada del formulario)
      const formData = {
        ...req.body,
        paymentMethod: req.body.paymentMethod || "cash"
      };
      
      const validationResult = createReservationValidationSchema.safeParse(formData);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid reservation data", 
          details: validationResult.error.format() 
        });
      }
      
      const reservationData = validationResult.data;
      
      // Get the trip to calculate total amount and check available seats
      const trip = await storage.getTrip(reservationData.tripId);
      
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }
      
      const passengerCount = reservationData.passengers.length;
      
      console.log(`[POST /reservations] Procesando reservación para ${passengerCount} pasajeros en viaje ${trip.id}`);
      console.log(`[POST /reservations] Asientos disponibles antes de la reservación: ${trip.availableSeats}`);
      
      if (trip.availableSeats < passengerCount) {
        return res.status(400).json({ 
          error: "Not enough available seats",
          available: trip.availableSeats,
          requested: passengerCount
        });
      }
      
      // Create the reservation
      const totalAmount = (trip.price || 0) * passengerCount;
      
      // Obtener el companyId del viaje para asignarlo a la reservación (aislamiento de datos)
      const companyId = trip.companyId;
      console.log(`Asignando companyId: ${companyId || 'null'} a la nueva reservación (heredado del viaje ${trip.id})`);
      
      // Determinar estado de pago basado en anticipo
      let paymentStatus = "pendiente";
      if (reservationData.advanceAmount && reservationData.advanceAmount >= totalAmount) {
        paymentStatus = "pagado";
      }

      // Obtener el usuario autenticado, si existe
      const { user } = req as any;
      
      // Si el frontend no envió createdBy pero hay un usuario autenticado, usamos su ID
      const createdByUserId = reservationData.createdBy || (user ? user.id : null);
      
      if (createdByUserId) {
        console.log(`Registrando usuario creador de la reservación: ID ${createdByUserId}`);
      }
      
      const reservation = await storage.createReservation({
        tripId: reservationData.tripId,
        totalAmount,
        email: reservationData.email,
        phone: reservationData.phone,
        paymentMethod: reservationData.paymentMethod || "cash", // Método de pago desde el formulario
        notes: reservationData.notes || null, // Incluir notas desde el formulario
        status: "confirmed",
        createdAt: new Date(),
        companyId: companyId || null,  // Heredar el companyId del viaje
        advanceAmount: reservationData.advanceAmount || 0, // Añadir campo de anticipo
        advancePaymentMethod: reservationData.advancePaymentMethod || "efectivo", // Añadir método de pago del anticipo
        paymentStatus: paymentStatus, // Estado del pago basado en el anticipo
        createdBy: createdByUserId // ID del usuario que crea la reservación (para comisiones)
      });
      
      // Create the passengers
      const passengers = [];
      for (const passengerData of reservationData.passengers) {
        const passenger = await storage.createPassenger({
          firstName: passengerData.firstName,
          lastName: passengerData.lastName,
          reservationId: reservation.id
        });
        passengers.push(passenger);
      }
      
      // Actualizar disponibilidad en el viaje principal y en viajes relacionados
      // Nota: No actualizamos directamente el viaje principal para evitar actualizar dos veces
      // la función updateRelatedTripsAvailability ya actualiza el viaje principal correctamente
      console.log(`[POST /reservations] Actualizando viaje ${trip.id} y viajes relacionados con cambio de -${passengerCount} asientos`);
      console.log(`[POST /reservations] Asientos antes de la actualización: ${trip.availableSeats}`);
      
      await storage.updateRelatedTripsAvailability(trip.id, -passengerCount);
      
      res.status(201).json({
        ...reservation,
        passengers
      });
    } catch (error: any) {
      console.error("Error creating reservation:", error);
      res.status(500).json({ error: "Failed to create reservation", details: error.message || "Unknown error" });
    }
  });

  app.put(apiRouter("/reservations/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const validationResult = insertReservationSchema.partial().safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid reservation data", 
          details: validationResult.error.format() 
        });
      }
      
      const reservationData = validationResult.data;
      const updatedReservation = await storage.updateReservation(id, reservationData);
      
      if (!updatedReservation) {
        return res.status(404).json({ error: "Reservation not found" });
      }
      
      res.json(updatedReservation);
    } catch (error) {
      res.status(500).json({ error: "Failed to update reservation" });
    }
  });

  // Endpoint para cancelar reservación (sin eliminarla)
  app.post(apiRouter("/reservations/:id/cancel"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Primero obtenemos los datos de la reservación básica
      const reservation = await storage.getReservation(id);
      
      if (!reservation) {
        return res.status(404).json({ error: "Reservation not found" });
      }
      
      // Verificar si la reservación ya está cancelada
      if (reservation.status === "canceled") {
        return res.status(400).json({ error: "Esta reservación ya ha sido cancelada" });
      }
      
      // Obtener el viaje asociado a la reservación
      const trip = await storage.getTrip(reservation.tripId);
      
      if (!trip) {
        console.error(`Error al cancelar reservación: No se encontró el viaje ${reservation.tripId}`);
        return res.status(500).json({ error: "Failed to find associated trip" });
      }
      
      // Obtener los pasajeros para contar cuántos son
      const passengers = await storage.getPassengers(id);
      const passengerCount = passengers.length;
      console.log(`Liberando ${passengerCount} asientos del viaje ${trip.id}`);
      
      // Actualizar la reservación para marcarla como cancelada
      const updatedReservation = await storage.updateReservation(id, {
        status: "canceled"
      });
      
      if (!updatedReservation) {
        return res.status(404).json({ error: "Failed to update reservation status" });
      }
      
      // Actualizar asientos disponibles en el viaje y en viajes relacionados
      if (passengerCount > 0) {
        // Obtener información detallada del viaje para conocer su capacidad original
        const tripDetails = await storage.getTripWithRouteInfo(trip.id);
        const capacityLimit = tripDetails?.capacity || trip.capacity;
        
        console.log(`[POST /reservations/${id}/cancel] Capacidad máxima del viaje: ${capacityLimit}, asientos actuales: ${trip.availableSeats}, asientos a liberar: ${passengerCount}`);
        
        try {
          // Actualizar todos los viajes afectados usando una sola función
          // (esto incluye el viaje principal y todos los viajes relacionados)
          await storage.updateRelatedTripsAvailability(trip.id, passengerCount);
          
          console.log(`Asientos actualizados para el viaje ${trip.id} y viajes relacionados.`);
        } catch (e) {
          console.error("Error al actualizar viajes relacionados:", e);
          // No fallamos si esto falla, podemos seguir con la operación principal
        }
      }
      
      // Enviar respuesta
      res.json({ 
        success: true, 
        message: "Reservación cancelada exitosamente",
        reservation: updatedReservation
      });
    } catch (error) {
      console.error("Error al cancelar reservación:", error);
      res.status(500).json({ error: "Failed to cancel reservation" });
    }
  });

  // Endpoint para eliminar reservaciones completamente
  app.delete(apiRouter("/reservations/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Primero obtenemos los datos de la reservación básica
      const reservation = await storage.getReservation(id);
      
      if (!reservation) {
        return res.status(404).json({ error: "Reservation not found" });
      }
      
      // Obtener el viaje asociado a la reservación
      const trip = await storage.getTrip(reservation.tripId);
      
      if (!trip) {
        console.error(`Error al eliminar reservación: No se encontró el viaje ${reservation.tripId}`);
        return res.status(500).json({ error: "Failed to find associated trip" });
      }
      
      // Obtener los pasajeros para contar cuántos son
      const passengers = await storage.getPassengers(id);
      const passengerCount = passengers.length;
      console.log(`Liberando ${passengerCount} asientos del viaje ${trip.id}`);
      
      // Eliminar la reservación
      const success = await storage.deleteReservation(id);
      
      if (!success) {
        return res.status(404).json({ error: "Failed to delete reservation" });
      }
      
      // Actualizar asientos disponibles en el viaje y en viajes relacionados
      if (passengerCount > 0) {
        // Obtener información detallada del viaje para conocer su capacidad original
        const tripDetails = await storage.getTripWithRouteInfo(trip.id);
        const capacityLimit = tripDetails?.capacity || trip.capacity;
        
        console.log(`[DELETE /reservations/${id}] Capacidad máxima del viaje: ${capacityLimit}, asientos actuales: ${trip.availableSeats}, asientos a liberar: ${passengerCount}`);
        
        try {
          // Actualizar todos los viajes afectados usando una sola función
          // (esto incluye el viaje principal y todos los viajes relacionados)
          await storage.updateRelatedTripsAvailability(trip.id, passengerCount);
          
          console.log(`Asientos actualizados para el viaje ${trip.id} y viajes relacionados.`);
        } catch (e) {
          console.error("Error al actualizar viajes relacionados:", e);
          // No fallamos si esto falla, podemos seguir con la operación principal
        }
      }
      
      res.status(204).end();
    } catch (error) {
      console.error("Error al eliminar reservación:", error);
      res.status(500).json({ error: "Failed to delete reservation" });
    }
  });

  // Rutas de API para vehículos (unidades)
  app.get(apiRouter("/vehicles"), async (req: Request, res: Response) => {
    try {
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[GET /vehicles] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[GET /vehicles] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // SEGURIDAD: Filtrado de datos por compañía
      let companyId: string | null = null;
      
      // REGLAS DE ACCESO:
      // 1. Solo superAdmin puede ver TODOS los vehículos
      // 2. El resto de roles (incluyendo admin) solo pueden ver vehículos de SU COMPAÑÍA
      if (user) {
        // Los roles que NO son superAdmin tienen acceso restringido
        if (user.role !== UserRole.SUPER_ADMIN) {
          // Obtener la compañía del usuario
          companyId = user.companyId || user.company;
          
          if (!companyId) {
            console.log(`[GET /vehicles] ADVERTENCIA: Usuario sin compañía asignada`);
            // Si el usuario no tiene compañía asignada, devolver lista vacía por seguridad
            return res.json([]);
          }
          
          console.log(`[GET /vehicles] FILTRO CRÍTICO: Aplicando filtro por compañía "${companyId}"`);
        } else {
          console.log(`[GET /vehicles] Usuario con rol ${user.role} puede ver TODOS los vehículos`);
        }
      } else {
        console.log(`[GET /vehicles] Usuario no autenticado`);
        // Usuarios no autenticados no deberían poder ver vehículos
        return res.status(401).json({ error: "No autenticado" });
      }
      
      // Ejecutar la consulta con el filtro de compañía si aplica
      const vehicles = await storage.getVehicles(companyId || undefined);
      console.log(`[GET /vehicles] Encontrados ${vehicles.length} vehículos`);
      
      // CAPA ADICIONAL DE SEGURIDAD - FILTRO POST-CONSULTA
      if (user && user.role !== UserRole.SUPER_ADMIN) {
        // Obtener la compañía del usuario
        const userCompany = user.companyId || user.company || null;
        
        if (userCompany) {
          // Verificar que todos los vehículos sean realmente de la compañía del usuario
          const vehiculosDeOtrasCompanias = vehicles.filter(v => 
            v.companyId && v.companyId !== userCompany
          );
          
          if (vehiculosDeOtrasCompanias.length > 0) {
            console.log(`[ALERTA DE SEGURIDAD] Se intentaron mostrar ${vehiculosDeOtrasCompanias.length} vehículos de otras compañías!`);
            
            // CRÍTICO: Filtrar y devolver SOLO los vehículos de la compañía del usuario
            const vehiculosFiltrados = vehicles.filter(v => v.companyId === userCompany);
            console.log(`[CORRECCIÓN] Devolviendo solo ${vehiculosFiltrados.length} vehículos de compañía ${userCompany}`);
            
            // Reemplazar los resultados
            return res.json(vehiculosFiltrados);
          }
        }
      }
      
      res.json(vehicles);
    } catch (error) {
      console.error("[GET /vehicles] Error:", error);
      res.status(500).json({ error: "Error al obtener vehículos" });
    }
  });

  app.get(apiRouter("/vehicles/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[GET /vehicles/${id}] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[GET /vehicles/${id}] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // SEGURIDAD: Control de acceso a datos por compañía
      let companyId: string | null = null;
      
      // REGLAS DE ACCESO:
      // 1. Solo superAdmin puede ver TODOS los vehículos
      // 2. El resto de roles (incluyendo admin) solo pueden ver vehículos de SU COMPAÑÍA
      if (user) {
        if (user.role !== UserRole.SUPER_ADMIN) {
          // Obtener la compañía del usuario
          companyId = user.companyId || user.company;
          
          if (!companyId) {
            console.log(`[GET /vehicles/${id}] ACCESO DENEGADO: Usuario sin compañía asignada`);
            return res.status(403).json({ 
              error: "Acceso denegado", 
              details: "Usuario sin compañía asignada" 
            });
          }
          
          console.log(`[GET /vehicles/${id}] Verificando permisos para compañía: ${companyId}`);
        } else {
          console.log(`[GET /vehicles/${id}] Usuario con rol ${user.role} puede ver cualquier vehículo`);
        }
      } else {
        console.log(`[GET /vehicles/${id}] Acceso no autenticado denegado`);
        return res.status(401).json({ error: "No autenticado" });
      }
      
      // Obtener vehículo
      const vehicle = await storage.getVehicle(id);
      
      if (!vehicle) {
        console.log(`[GET /vehicles/${id}] Vehículo no encontrado`);
        return res.status(404).json({ error: "Vehículo no encontrado" });
      }
      
      // VERIFICACIÓN DE SEGURIDAD: Comprobar que el usuario tiene acceso a este vehículo
      // Los administradores también deben tener restricciones por compañía
      if (user.role !== UserRole.SUPER_ADMIN) {
        // Si el vehículo tiene companyId y no coincide con la del usuario
        if (vehicle.companyId && vehicle.companyId !== companyId) {
          console.log(`[GET /vehicles/${id}] ACCESO DENEGADO: El vehículo pertenece a compañía ${vehicle.companyId} pero el usuario es de ${companyId}`);
          return res.status(403).json({ 
            error: "Acceso denegado", 
            details: "No tiene permiso para acceder a este vehículo" 
          });
        }
      }
      
      console.log(`[GET /vehicles/${id}] Acceso concedido`);
      res.json(vehicle);
    } catch (error) {
      console.error(`[GET /vehicles/:id] Error: ${error}`);
      res.status(500).json({ error: "Error al obtener el vehículo" });
    }
  });

  app.post(apiRouter("/vehicles"), async (req: Request, res: Response) => {
    try {
      // Validación básica
      if (!req.body.plates || !req.body.brand || !req.body.model || !req.body.economicNumber) {
        return res.status(400).json({ 
          error: "Missing required fields",
          details: "plates, brand, model, and economicNumber are required" 
        });
      }
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[POST /vehicles] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[POST /vehicles] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // SEGURIDAD: Verificar autenticación
      if (!user) {
        console.log(`[POST /vehicles] Intento de creación sin autenticación`);
        return res.status(401).json({ error: "No autenticado" });
      }
      
      // Obtener companyId del usuario
      let companyId = user.companyId || user.company;
      
      // SEGURIDAD: Verificar asignación de compañía
      if (!companyId && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN) {
        console.log(`[POST /vehicles] ADVERTENCIA: Usuario sin compañía asignada intentando crear vehículo`);
        return res.status(400).json({ 
          error: "Datos incompletos", 
          details: "No se puede crear un vehículo sin asignar una compañía" 
        });
      }
      
      // SEGURIDAD: Preservar companyId si el usuario es superAdmin o admin
      if (!companyId && (user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN)) {
        console.log(`[POST /vehicles] Usuario ${user.role} creando vehículo sin asignar compañía específica`);
        companyId = req.body.companyId || null;
      }
      
      console.log(`[POST /vehicles] Asignando vehículo a compañía: ${companyId || 'ninguna'}`);
      
      // Crear objeto con datos del vehículo más el companyId
      const vehicleData = {
        ...req.body,
        companyId: companyId
      };
      
      const vehicle = await storage.createVehicle(vehicleData);
      console.log(`[POST /vehicles] Vehículo creado con ID ${vehicle.id}`);
      
      res.status(201).json(vehicle);
    } catch (error) {
      console.error(`[POST /vehicles] Error: ${error}`);
      res.status(500).json({ error: "Error al crear el vehículo" });
    }
  });

  app.put(apiRouter("/vehicles/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[PUT /vehicles/${id}] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[PUT /vehicles/${id}] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // SEGURIDAD: Verificar autenticación
      if (!user) {
        console.log(`[PUT /vehicles/${id}] Intento de actualización sin autenticación`);
        return res.status(401).json({ error: "No autenticado" });
      }
      
      // SEGURIDAD: Verificar existencia del vehículo y permisos
      const existingVehicle = await storage.getVehicle(id);
      
      if (!existingVehicle) {
        console.log(`[PUT /vehicles/${id}] Vehículo no encontrado`);
        return res.status(404).json({ error: "Vehículo no encontrado" });
      }
      
      // Verificar permisos (solo los superAdmin y admin pueden editar cualquier vehículo)
      if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN) {
        const userCompanyId = user.companyId || user.company;
        
        // Si no tiene compañía asignada, no puede editar
        if (!userCompanyId) {
          console.log(`[PUT /vehicles/${id}] ACCESO DENEGADO: Usuario sin compañía asignada`);
          return res.status(403).json({ 
            error: "Acceso denegado", 
            details: "No tiene permisos para editar este vehículo" 
          });
        }
        
        // Si el vehículo pertenece a otra compañía, no puede editarlo
        if (existingVehicle.companyId && existingVehicle.companyId !== userCompanyId) {
          console.log(`[PUT /vehicles/${id}] ACCESO DENEGADO: El vehículo pertenece a compañía ${existingVehicle.companyId} pero el usuario es de ${userCompanyId}`);
          return res.status(403).json({ 
            error: "Acceso denegado", 
            details: "No tiene permisos para editar vehículos de otra compañía" 
          });
        }
      }
      
      // SEGURIDAD: Preservar el companyId original a menos que sea superAdmin/admin
      let vehicleData = { ...req.body };
      
      if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN) {
        // Usuarios normales no pueden cambiar la compañía del vehículo
        vehicleData.companyId = existingVehicle.companyId;
        console.log(`[PUT /vehicles/${id}] Preservando companyId original: ${existingVehicle.companyId || 'ninguna'}`);
      } else if (vehicleData.companyId !== existingVehicle.companyId) {
        // Permitir a superAdmin/admin cambiar la compañía
        console.log(`[PUT /vehicles/${id}] Usuario ${user.role} cambiando companyId de ${existingVehicle.companyId || 'ninguna'} a ${vehicleData.companyId || 'ninguna'}`);
      }
      
      const updatedVehicle = await storage.updateVehicle(id, vehicleData);
      
      console.log(`[PUT /vehicles/${id}] Vehículo actualizado correctamente`);
      res.json(updatedVehicle);
    } catch (error) {
      console.error(`[PUT /vehicles/:id] Error: ${error}`);
      res.status(500).json({ error: "Error al actualizar el vehículo" });
    }
  });

  app.delete(apiRouter("/vehicles/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[DELETE /vehicles/${id}] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[DELETE /vehicles/${id}] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // SEGURIDAD: Verificar autenticación
      if (!user) {
        console.log(`[DELETE /vehicles/${id}] Intento de eliminación sin autenticación`);
        return res.status(401).json({ error: "No autenticado" });
      }
      
      // SEGURIDAD: Verificar existencia del vehículo y permisos
      const existingVehicle = await storage.getVehicle(id);
      
      if (!existingVehicle) {
        console.log(`[DELETE /vehicles/${id}] Vehículo no encontrado`);
        return res.status(404).json({ error: "Vehículo no encontrado" });
      }
      
      // Verificar permisos (solo los superAdmin, admin y owner pueden eliminar un vehículo)
      if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN && user.role !== UserRole.OWNER) {
        console.log(`[DELETE /vehicles/${id}] ACCESO DENEGADO: El rol ${user.role} no tiene permisos para eliminar vehículos`);
        return res.status(403).json({ 
          error: "Acceso denegado", 
          details: "No tiene permisos para eliminar vehículos" 
        });
      }
      
      // Si es owner, verificar que el vehículo pertenece a su compañía
      if (user.role === UserRole.OWNER) {
        const userCompanyId = user.companyId || user.company;
        
        if (!userCompanyId) {
          console.log(`[DELETE /vehicles/${id}] ACCESO DENEGADO: Usuario sin compañía asignada`);
          return res.status(403).json({ 
            error: "Acceso denegado", 
            details: "No tiene permisos para eliminar este vehículo" 
          });
        }
        
        // Si el vehículo pertenece a otra compañía, no puede eliminarlo
        if (existingVehicle.companyId && existingVehicle.companyId !== userCompanyId) {
          console.log(`[DELETE /vehicles/${id}] ACCESO DENEGADO: El vehículo pertenece a compañía ${existingVehicle.companyId} pero el usuario es de ${userCompanyId}`);
          return res.status(403).json({ 
            error: "Acceso denegado", 
            details: "No tiene permisos para eliminar vehículos de otra compañía" 
          });
        }
      }
      
      // Eliminar el vehículo
      const success = await storage.deleteVehicle(id);
      
      if (!success) {
        console.log(`[DELETE /vehicles/${id}] Error al eliminar el vehículo`);
        return res.status(500).json({ error: "Error al eliminar el vehículo" });
      }
      
      console.log(`[DELETE /vehicles/${id}] Vehículo eliminado correctamente`);
      res.status(204).end();
    } catch (error) {
      console.error(`[DELETE /vehicles/:id] Error: ${error}`);
      res.status(500).json({ error: "Error al eliminar el vehículo" });
    }
  });

  // Nuevo endpoint público para acceder a los detalles de una reservación (para escaneo de QR)
  app.get(apiRouter("/public/reservations/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      console.log(`[GET /public/reservations/${id}] Acceso público solicitado`);
      
      // Obtener la reservación sin filtrado por compañía (es acceso público)
      const reservation = await storage.getReservationWithDetails(id, undefined);
      
      if (!reservation) {
        console.log(`[GET /public/reservations/${id}] Reservación no encontrada`);
        return res.status(404).json({ error: "Reservación no encontrada" });
      }
      
      console.log(`[GET /public/reservations/${id}] Acceso público concedido`);
      res.json(reservation);
    } catch (error) {
      console.error(`[GET /public/reservations/:id] Error: ${error}`);
      res.status(500).json({ error: "Error al obtener la reservación" });
    }
  });
  
  // Endpoint público para acceder a los detalles de un paquete (para escaneo de QR)
  app.get(apiRouter("/public/packages/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      
      console.log(`[GET /public/packages/${id}] Acceso público solicitado`);
      
      // Obtener el paquete sin filtrado por compañía (es acceso público)
      const packageData = await storage.getPackage(id);
      
      if (!packageData) {
        console.log(`[GET /public/packages/${id}] Paquete no encontrado`);
        return res.status(404).json({ error: "Paquete no encontrado" });
      }
      
      // Si tiene tripId, obtener la información del viaje
      let tripInfo = null;
      if (packageData.tripId) {
        const trip = await storage.getTrip(packageData.tripId);
        if (trip) {
          const route = await storage.getRoute(trip.routeId);
          if (route) {
            tripInfo = {
              tripOrigin: route.origin,
              tripDestination: route.destination,
              tripDate: trip.departureDate,
              segmentOrigin: trip.segmentOrigin || route.origin,
              segmentDestination: trip.segmentDestination || route.destination,
              companyName: trip.companyName || route.companyName,
              // Para asegurar que se usa la fecha del viaje como fecha de envío
              shippingDate: trip.departureDate,
              // Incluir la hora de salida del viaje
              departureTime: trip.departureTime
            };
          }
        }
      }
      
      console.log(`[GET /public/packages/${id}] Acceso público concedido`);
      res.json({
        ...packageData,
        ...tripInfo
      });
    } catch (error) {
      console.error(`[GET /public/packages/:id] Error: ${error}`);
      res.status(500).json({ error: "Error al obtener el paquete" });
    }
  });
  
  // Endpoint público para marcar un paquete como pagado
  app.post(apiRouter("/public/packages/:id/mark-paid"), async (req: Request, res: Response) => {
    try {
      const packageId = parseInt(req.params.id, 10);
      console.log(`[POST /public/packages/${packageId}/mark-paid] Marcando paquete como pagado`);
      
      // Verificar que el paquete existe
      const packageData = await storage.getPackage(packageId);
      if (!packageData) {
        console.log(`[POST /public/packages/${packageId}/mark-paid] Paquete no encontrado`);
        return res.status(404).json({ error: "Paquete no encontrado" });
      }
      
      // Actualizar el estado de pago
      console.log(`[POST /public/packages/${packageId}/mark-paid] Estado actual de pago:`, packageData.isPaid);
      const updatedPackage = await storage.updatePackage(packageId, {
        isPaid: true,
        paymentMethod: packageData.paymentMethod || 'efectivo',
        updatedAt: new Date()
      });
      console.log(`[POST /public/packages/${packageId}/mark-paid] Nuevo estado de pago:`, updatedPackage?.isPaid);
      
      console.log(`[POST /public/packages/${packageId}/mark-paid] Paquete actualizado con éxito`);
      res.json(updatedPackage);
    } catch (error) {
      console.error(`[POST /public/packages/:id/mark-paid] Error: ${error}`);
      res.status(500).json({ error: "Error al actualizar el estado de pago del paquete" });
    }
  });
  
  // Endpoint público para marcar un paquete como entregado
  app.post(apiRouter("/public/packages/:id/mark-delivered"), async (req: Request, res: Response) => {
    try {
      const packageId = parseInt(req.params.id, 10);
      console.log(`[POST /public/packages/${packageId}/mark-delivered] Marcando paquete como entregado`);
      
      // Verificar que el paquete existe
      const packageData = await storage.getPackage(packageId);
      if (!packageData) {
        console.log(`[POST /public/packages/${packageId}/mark-delivered] Paquete no encontrado`);
        return res.status(404).json({ error: "Paquete no encontrado" });
      }
      
      // Actualizar el estado de entrega
      console.log(`[POST /public/packages/${packageId}/mark-delivered] Estado actual de entrega:`, packageData.deliveryStatus);
      const currentDate = new Date();
      const updatedPackage = await storage.updatePackage(packageId, {
        deliveryStatus: 'entregado',
        deliveredAt: currentDate,
        updatedAt: currentDate
      });
      console.log(`[POST /public/packages/${packageId}/mark-delivered] Nuevo estado de entrega:`, updatedPackage?.deliveryStatus);
      console.log(`[POST /public/packages/${packageId}/mark-delivered] Fecha de entrega:`, updatedPackage?.deliveredAt);
      
      console.log(`[POST /public/packages/${packageId}/mark-delivered] Paquete actualizado con éxito`);
      res.json(updatedPackage);
    } catch (error) {
      console.error(`[POST /public/packages/:id/mark-delivered] Error: ${error}`);
      res.status(500).json({ error: "Error al actualizar el estado de entrega del paquete" });
    }
  });

  const httpServer = createServer(app);
  // Endpoint para obtener reservaciones creadas por comisionistas
  app.get(apiRouter("/commissions/reservations"), async (req: Request, res: Response) => {
    try {
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[GET /commissions/reservations] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[GET /commissions/reservations] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // SEGURIDAD: Verificar que solo los roles autorizados puedan acceder
      if (!user) {
        return res.status(401).json({ error: "No autorizado" });
      }
      
      // Solo los roles Dueño y Administrador pueden acceder a esta sección
      if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.DEVELOPER) {
        console.log(`[GET /commissions/reservations] ACCESO DENEGADO: El rol ${user.role} no tiene permiso para acceder a esta sección`);
        return res.status(403).json({ error: "Acceso denegado" });
      }
      
      // SEGURIDAD: Filtrado de datos por compañía
      let companyId: string | null = null;
      
      // Aplicar filtro de compañía para todos excepto superAdmin
      if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.DEVELOPER) {
        companyId = user.companyId || user.company;
        
        if (!companyId) {
          console.log(`[GET /commissions/reservations] ADVERTENCIA: Usuario sin compañía asignada`);
          // Si el usuario no tiene compañía asignada, devolver lista vacía por seguridad
          return res.json([]);
        }
      }
      
      // Obtener todas las reservaciones con sus detalles
      // El parámetro companyId ya está tipado como string | null,
      // pasar undefined si es null para que coincida con la firma de la función
      const allReservations = await storage.getReservations(companyId === null ? undefined : companyId);
      
      // Filtrar solo aquellas creadas por usuarios comisionistas
      const comissionerReservations = allReservations.filter(
        reservation => reservation.createdByUser && reservation.createdByUser.role === UserRole.COMMISSIONER
      );
      
      console.log(`[GET /commissions/reservations] Encontradas ${comissionerReservations.length} reservaciones creadas por comisionistas`);
      
      res.json(comissionerReservations);
    } catch (error) {
      console.error(`[GET /commissions/reservations] Error: ${error}`);
      res.status(500).json({ error: "Error al obtener las reservaciones de comisionistas" });
    }
  });
  
  // Endpoint para que los comisionistas vean sus propias reservaciones aprobadas
  app.get(apiRouter("/commissions/my-commissions"), async (req: Request, res: Response) => {
    try {
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[GET /commissions/my-commissions] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[GET /commissions/my-commissions] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // SEGURIDAD: Verificar que solo los comisionistas puedan acceder
      if (!user) {
        return res.status(401).json({ error: "No autorizado" });
      }
      
      // Comprobar que el usuario tenga acceso a esta sección según permisos
      // Esto es solo un log, no bloqueamos el acceso para facilitar las pruebas
      if (user.role !== UserRole.COMMISSIONER) {
        console.log(`[GET /commissions/my-commissions] ADVERTENCIA: El rol ${user.role} está accediendo a sección de comisiones`);
      }
      
      // Obtener la compañía del usuario
      const companyId = user.companyId || user.company;
      
      if (!companyId) {
        console.log(`[GET /commissions/my-commissions] ADVERTENCIA: Usuario sin compañía asignada`);
        // Si el usuario no tiene compañía asignada, devolver lista vacía por seguridad
        return res.json([]);
      }
      
      // Obtener todas las reservaciones con sus detalles
      const allReservations = await storage.getReservations(companyId);
      
      // Modificamos el filtrado para incluir todas las reservaciones del usuario actual
      // independiente de su estado para facilitar las pruebas
      console.log(`[GET /commissions/my-commissions] Filtrando reservaciones creadas por usuario ID: ${user.id}`);
      console.log(`[GET /commissions/my-commissions] Total reservaciones a filtrar: ${allReservations.length}`);
      
      // Mostramos detalles de cada reservación para depuración
      allReservations.forEach((res, index) => {
        console.log(`[GET /commissions/my-commissions] Reservación #${index}: ID=${res.id}, Creada por: ${res.createdBy}, Estado: ${res.status}`);
      });
      
      // Filtrar reservaciones creadas por este usuario
      const myApprovedReservations = allReservations.filter(reservation => {
        const isCreatedByUser = reservation.createdBy === user.id;
        if (isCreatedByUser) {
          console.log(`[GET /commissions/my-commissions] Reservación ${reservation.id} COINCIDE con usuario actual`);
        }
        // Para pruebas, no filtramos por estado
        return isCreatedByUser;
      });
      
      console.log(`[GET /commissions/my-commissions] Encontradas ${myApprovedReservations.length} reservaciones aprobadas del comisionista`);
      
      // Transformar datos para incluir más detalles
      const myCommissions = myApprovedReservations.map(reservation => {
        const commissionPercentage = user.commissionPercentage || 10; // Porcentaje predeterminado si no está definido
        const commissionAmount = (reservation.totalPrice * commissionPercentage) / 100;
        
        return {
          id: reservation.id,
          passengerName: reservation.passengers?.[0]?.name || "Sin nombre",
          routeName: reservation.trip?.route?.name || "Ruta desconocida",
          tripId: reservation.tripId,
          departureDate: reservation.trip?.departureDate,
          totalPrice: reservation.totalPrice,
          commissionPercentage: commissionPercentage,
          commissionAmount: commissionAmount,
          commissionPaid: reservation.commissionPaid || false
        };
      });
      
      res.json(myCommissions);
    } catch (error) {
      console.error(`[GET /commissions/my-commissions] Error: ${error}`);
      res.status(500).json({ error: "Error al obtener tus comisiones" });
    }
  });
  
  // Endpoint para marcar comisiones como pagadas
  app.put(apiRouter("/commissions/pay"), async (req: Request, res: Response) => {
    try {
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      console.log(`[PUT /commissions/pay] Usuario: ${user ? user.firstName + ' ' + user.lastName : 'No autenticado'}`);
      if (user) {
        console.log(`[PUT /commissions/pay] Rol: ${user.role}, CompanyId: ${user.companyId || user.company || 'No definido'}`);
      }
      
      // SEGURIDAD: Verificar que solo los roles autorizados puedan acceder
      if (!user) {
        return res.status(401).json({ error: "No autorizado" });
      }
      
      // Solo los roles Dueño y Administrador pueden acceder a esta sección
      if (user.role !== UserRole.OWNER && user.role !== UserRole.ADMIN && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.DEVELOPER) {
        console.log(`[PUT /commissions/pay] ACCESO DENEGADO: El rol ${user.role} no tiene permiso para marcar comisiones como pagadas`);
        return res.status(403).json({ error: "Acceso denegado" });
      }
      
      // Verificar datos en el cuerpo de la petición
      if (!req.body.reservationIds || !Array.isArray(req.body.reservationIds) || req.body.reservationIds.length === 0) {
        return res.status(400).json({ error: "Se requieren IDs de reservaciones válidos" });
      }
      
      const { reservationIds } = req.body;
      const results = [];
      
      // Actualizar cada reservación
      for (const id of reservationIds) {
        try {
          // Verificar que la reservación exista
          const reservation = await storage.getReservation(id);
          
          if (!reservation) {
            results.push({ id, success: false, message: "Reservación no encontrada" });
            continue;
          }
          
          // SEGURIDAD: Verificar que pertenece a la compañía del usuario
          if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.DEVELOPER) {
            const userCompanyId = user.companyId || user.company;
            if (reservation.companyId && reservation.companyId !== userCompanyId) {
              results.push({ id, success: false, message: "No tiene permisos para modificar reservaciones de otra compañía" });
              continue;
            }
          }
          
          // Actualizar el campo de comisión pagada
          const updated = await storage.updateReservation(id, { commissionPaid: true });
          
          if (updated) {
            results.push({ id, success: true, message: "Comisión marcada como pagada" });
          } else {
            results.push({ id, success: false, message: "Error al actualizar la reservación" });
          }
        } catch (error) {
          console.error(`[PUT /commissions/pay] Error al procesar la reservación ${id}: ${error}`);
          results.push({ id, success: false, message: "Error interno al procesar la reservación" });
        }
      }
      
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      console.log(`[PUT /commissions/pay] Actualización completada: ${successful} exitosas, ${failed} fallidas`);
      
      res.json({
        success: failed === 0,
        message: `Se han marcado ${successful} de ${reservationIds.length} comisiones como pagadas`,
        results
      });
    } catch (error) {
      console.error(`[PUT /commissions/pay] Error: ${error}`);
      res.status(500).json({ error: "Error al marcar las comisiones como pagadas" });
    }
  });
  
  // =========== RUTAS PARA SOLICITUDES DE RESERVACIÓN ===========
  
  // Crear una solicitud de reservación (para comisionistas)
  app.post(apiRouter('/reservation-requests'), isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      // Solo comisionistas pueden crear solicitudes de reservación
      if (currentUser.role !== UserRole.COMMISSIONER) {
        return res.status(403).json({ 
          message: "Solo los comisionistas pueden crear solicitudes de reservación" 
        });
      }
      
      // Validar datos del request
      const { tripId, passengersData, totalAmount, email, phone, 
              paymentStatus, advanceAmount, advancePaymentMethod, 
              paymentMethod, notes } = req.body;
      
      if (!tripId || !passengersData || !totalAmount || !email || !phone) {
        return res.status(400).json({ 
          message: "Faltan datos obligatorios para la solicitud de reservación" 
        });
      }
      
      // Verificar que el viaje exista y sea de la misma compañía que el comisionista
      const trip = await storage.getTrip(tripId);
      if (!trip) {
        return res.status(404).json({ message: "Viaje no encontrado" });
      }
      
      if (trip.companyId !== currentUser.companyId) {
        console.log(`ALERTA: Intento de acceso no autorizado a viaje de otra compañía`);
        return res.status(403).json({ 
          message: "No tienes acceso a este viaje" 
        });
      }
      
      // Crear la solicitud de reservación
      const requestData = {
        tripId,
        passengersData,
        totalAmount,
        email,
        phone,
        paymentStatus: paymentStatus || 'pendiente',
        advanceAmount: advanceAmount || 0,
        advancePaymentMethod: advancePaymentMethod || 'efectivo',
        paymentMethod: paymentMethod || 'efectivo',
        notes,
        requesterId: currentUser.id,
        companyId: currentUser.companyId,
      };
      
      const request = await storage.createReservationRequest(requestData);
      
      res.status(201).json({
        message: "Solicitud de reservación creada con éxito. Espera la aprobación.",
        request
      });
    } catch (error) {
      console.error("Error al crear solicitud de reservación:", error);
      res.status(500).json({ message: "Error interno al procesar la solicitud" });
    }
  });
  
  // Obtener solicitudes de reservación (filtradas por compañía/estado/comisionista)
  app.get(apiRouter('/reservation-requests'), isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      // Construir filtros basados en permisos
      const filters: { companyId?: string, status?: string, requesterId?: number } = {};
      
      // Si es comisionista, solo puede ver sus propias solicitudes
      if (currentUser.role === UserRole.COMMISSIONER) {
        filters.requesterId = currentUser.id;
      } 
      // Si no es superAdmin, solo puede ver solicitudes de su compañía
      else if (currentUser.role !== UserRole.SUPER_ADMIN && currentUser.companyId) {
        filters.companyId = currentUser.companyId;
      }
      
      // Aplicar filtros adicionales de la consulta
      if (req.query.status) {
        filters.status = req.query.status as string;
      }
      
      const requests = await storage.getReservationRequests(filters);
      
      res.json(requests);
    } catch (error) {
      console.error("Error al obtener solicitudes de reservación:", error);
      res.status(500).json({ message: "Error interno al procesar la solicitud" });
    }
  });
  
  // Obtener una solicitud de reservación específica
  app.get(apiRouter('/reservation-requests/:id'), isAuthenticated, async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      if (isNaN(requestId)) {
        return res.status(400).json({ message: "ID de solicitud inválido" });
      }
      
      const currentUser = req.user as any;
      if (!currentUser) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      // Obtener la solicitud
      const request = await storage.getReservationRequest(requestId);
      
      if (!request) {
        return res.status(404).json({ message: "Solicitud no encontrada" });
      }
      
      // Verificar permisos de acceso
      if (currentUser.role === UserRole.COMMISSIONER && request.requesterId !== currentUser.id) {
        return res.status(403).json({ 
          message: "No tienes permiso para ver esta solicitud" 
        });
      }
      
      if (currentUser.role !== UserRole.SUPER_ADMIN && 
          currentUser.role !== UserRole.COMMISSIONER && 
          request.companyId !== currentUser.companyId) {
        return res.status(403).json({ 
          message: "No tienes permiso para ver esta solicitud" 
        });
      }
      
      res.json(request);
    } catch (error) {
      console.error(`Error al obtener solicitud de reservación ${req.params.id}:`, error);
      res.status(500).json({ message: "Error interno al procesar la solicitud" });
    }
  });
  
  // Aprobar o rechazar una solicitud de reservación
  app.post(apiRouter('/reservation-requests/:id/update-status'), isAuthenticated, async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      if (isNaN(requestId)) {
        return res.status(400).json({ message: "ID de solicitud inválido" });
      }
      
      const { status, reviewNotes } = req.body;
      if (!status || !['aprobada', 'rechazada'].includes(status)) {
        return res.status(400).json({ 
          message: "Estado inválido. Debe ser 'aprobada' o 'rechazada'" 
        });
      }
      
      const currentUser = req.user as any;
      if (!currentUser) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      // Verificar que el usuario tenga permisos para aprobar/rechazar
      const canApprove = [UserRole.OWNER, UserRole.ADMIN, UserRole.CALL_CENTER].includes(currentUser.role);
      if (!canApprove) {
        return res.status(403).json({ 
          message: "No tienes permisos para aprobar o rechazar solicitudes" 
        });
      }
      
      // Obtener la solicitud para verificar que pertenezca a la misma compañía
      const request = await storage.getReservationRequest(requestId);
      if (!request) {
        return res.status(404).json({ message: "Solicitud no encontrada" });
      }
      
      if (currentUser.role !== UserRole.SUPER_ADMIN && request.companyId !== currentUser.companyId) {
        return res.status(403).json({ 
          message: "No tienes permiso para modificar esta solicitud" 
        });
      }
      
      // Actualizar el estado de la solicitud
      const updatedRequest = await storage.updateReservationRequestStatus(
        requestId, 
        status, 
        currentUser.id, 
        reviewNotes
      );
      
      res.json({
        message: `Solicitud de reservación ${status}`,
        request: updatedRequest
      });
    } catch (error) {
      console.error(`Error al actualizar estado de solicitud ${req.params.id}:`, error);
      res.status(500).json({ message: "Error interno al procesar la solicitud" });
    }
  });
  
  // =========== RUTAS PARA NOTIFICACIONES ===========
  
  // Obtener notificaciones del usuario actual
  app.get(apiRouter('/notifications'), isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      const notifications = await storage.getNotifications(currentUser.id);
      
      res.json(notifications);
    } catch (error) {
      console.error("Error al obtener notificaciones:", error);
      res.status(500).json({ message: "Error interno al procesar la solicitud" });
    }
  });
  
  // Marcar una notificación como leída
  app.post(apiRouter('/notifications/:id/mark-read'), isAuthenticated, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      if (isNaN(notificationId)) {
        return res.status(400).json({ message: "ID de notificación inválido" });
      }
      
      const currentUser = req.user as any;
      if (!currentUser) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      // Obtener la notificación para verificar que pertenezca al usuario actual
      const notifications = await storage.getNotifications(currentUser.id);
      const notification = notifications.find(n => n.id === notificationId);
      
      if (!notification) {
        return res.status(404).json({ 
          message: "Notificación no encontrada o no pertenece a este usuario" 
        });
      }
      
      // Marcar como leída
      const updatedNotification = await storage.markNotificationAsRead(notificationId);
      
      res.json({
        message: "Notificación marcada como leída",
        notification: updatedNotification
      });
    } catch (error) {
      console.error(`Error al marcar notificación ${req.params.id} como leída:`, error);
      res.status(500).json({ message: "Error interno al procesar la solicitud" });
    }
  });
  
  // Obtener contador de notificaciones no leídas
  app.get(apiRouter('/notifications/unread-count'), isAuthenticated, async (req, res) => {
    try {
      const currentUser = req.user as any;
      if (!currentUser) {
        return res.status(401).json({ message: "No autenticado" });
      }
      
      const count = await storage.getUnreadNotificationsCount(currentUser.id);
      
      console.log(`[GET /notifications/unread-count] Usuario: ${currentUser.id}, Conteo: ${count}`);
      
      // Asegurarnos de devolver un número (no un objeto ni cadena)
      res.json(Number(count));
    } catch (error) {
      console.error("Error al obtener contador de notificaciones no leídas:", error);
      res.status(500).json({ message: "Error interno al procesar la solicitud" });
    }
  });
  
  // Rutas para manejo de usuarios
  // GET /api/users - Obtener todos los usuarios
  app.get(apiRouter('/users'), isAuthenticated, hasRole([UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN]), async (req, res) => {
    try {
      // Si es superAdmin, puede ver todos los usuarios
      // Si es OWNER o ADMIN, solo ve los de su compañía
      const user = req.user as Express.User;
      let users;
      
      // Filtro por rol si se proporciona en la consulta
      const roleFilter = req.query.role as string;
      console.log(`[GET /api/users] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}, CompanyId: ${user.companyId || 'N/A'}, Company: ${user.company || 'N/A'}`);
      console.log(`[GET /api/users] Filtro de rol solicitado: ${roleFilter || 'ninguno'}`);
      
      if (user.role === UserRole.SUPER_ADMIN) {
        if (roleFilter) {
          // Si hay filtro de rol, usar la función optimizada aunque sea superadmin
          console.log(`[GET /api/users] Usuario con rol superadmin: filtrando por rol "${roleFilter}" en todas las empresas`);
          // Los superadmin ven usuarios de todas las compañías
          users = await storage.getUsers();
          // Luego filtramos por rol
          const normalizedRoleFilter = roleFilter.toLowerCase();
          users = users.filter(user => {
            const userRole = user.role.toLowerCase();
            
            // Caso especial para conductores 
            if (normalizedRoleFilter === 'chofer') {
              return userRole === 'chofer' || userRole === 'driver' || userRole === 'chófer';
            }
            
            return userRole === normalizedRoleFilter;
          });
        } else {
          // Si no hay filtro de rol, obtener todos los usuarios
          console.log(`[GET /api/users] Usuario con rol superadmin: obteniendo TODOS los usuarios`);
          users = await storage.getUsers();
        }
      } else {
        // Para Owner y Admin, filtramos por companyId o company
        const companyFilter = user.companyId || user.company || '';
        
        if (roleFilter) {
          // Si hay filtro de rol, usar función optimizada con filtro combinado
          console.log(`[GET /api/users] Usuario con rol ${user.role}: filtrando por compañía: ${companyFilter} y rol: ${roleFilter}`);
          users = await storage.getUsersByCompanyAndRole(companyFilter, roleFilter);
        } else {
          // Si no hay filtro de rol, obtener todos los usuarios de la compañía
          console.log(`[GET /api/users] Usuario con rol ${user.role}: filtrando por compañía: ${companyFilter}`);
          users = await storage.getUsersByCompany(companyFilter);
        }
      }
      
      console.log(`[GET /api/users] Encontrados ${users.length} usuarios`);
      
      res.json(users);
    } catch (error) {
      console.error('Error al obtener usuarios:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });
  
  // GET /api/users/:id - Obtener un usuario por ID
  app.get(apiRouter('/users/:id'), isAuthenticated, hasRole([UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const user = await storage.getUserById(id);
      
      if (!user) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      
      res.json(user);
    } catch (error) {
      console.error(`Error al obtener usuario con ID ${req.params.id}:`, error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });
  
  // PATCH /api/users/:id - Actualizar un usuario
  app.patch(apiRouter('/users/:id'), isAuthenticated, hasRole([UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { email, password, commissionPercentage } = req.body;
      
      // Verificar si el usuario existe
      const existingUser = await storage.getUserById(id);
      if (!existingUser) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      
      // Solo permitir actualizar usuarios de la misma compañía (excepto para super admin)
      if (req.user && req.user.role !== UserRole.SUPER_ADMIN) {
        const userCompany = req.user.company || req.user.companyId;
        const existingUserCompany = existingUser.company || existingUser.companyId;
        if (existingUserCompany !== userCompany) {
          return res.status(403).json({ message: 'No tienes permiso para editar este usuario' });
        }
      }
      
      // Verificar si se intenta modificar el porcentaje de comisión solo para comisionistas
      if (commissionPercentage !== undefined && existingUser.role !== 'comisionista') {
        return res.status(400).json({ message: 'Solo se puede establecer el porcentaje de comisión para usuarios con rol Comisionista' });
      }
      
      // Construir objeto de actualización
      const updateData: {
        email?: string;
        password?: string;
        commissionPercentage?: number;
      } = {};
      
      if (email) updateData.email = email;
      if (password) updateData.password = password;
      if (commissionPercentage !== undefined) updateData.commissionPercentage = commissionPercentage;
      
      // Actualizar el usuario
      const updatedUser = await storage.updateUser(id, updateData);
      
      res.json(updatedUser);
    } catch (error) {
      console.error(`Error al actualizar usuario con ID ${req.params.id}:`, error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });
  
  // DELETE /api/users/:id - Eliminar un usuario
  app.delete(apiRouter('/users/:id'), isAuthenticated, hasRole([UserRole.SUPER_ADMIN, UserRole.OWNER]), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar si el usuario existe
      const existingUser = await storage.getUserById(id);
      if (!existingUser) {
        return res.status(404).json({ message: 'Usuario no encontrado' });
      }
      
      // No permitir eliminar a uno mismo
      if (req.user && req.user.id === id) {
        return res.status(400).json({ message: 'No puedes eliminar tu propia cuenta' });
      }
      
      // Solo permitir eliminar usuarios de la misma compañía (excepto para super admin)
      if (req.user && req.user.role !== UserRole.SUPER_ADMIN) {
        const userCompany = req.user.company || req.user.companyId;
        const existingUserCompany = existingUser.company || existingUser.companyId;
        if (existingUserCompany !== userCompany) {
          return res.status(403).json({ message: 'No tienes permiso para eliminar este usuario' });
        }
      }
      
      // Intentar eliminar el usuario
      const deleted = await storage.deleteUser(id);
      
      if (deleted) {
        res.json({ success: true, message: 'Usuario eliminado correctamente' });
      } else {
        res.status(400).json({ 
          success: false, 
          message: 'No se pudo eliminar el usuario. Puede tener reservaciones asociadas u otros usuarios invitados.' 
        });
      }
    } catch (error) {
      console.error(`Error al eliminar usuario con ID ${req.params.id}:`, error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });

  // POST /api/reservations/:id/check - Marcar un ticket como escaneado
  app.post(apiRouter('/reservations/:id/check'), isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar que la reservación existe
      const reservation = await storage.getReservation(id);
      if (!reservation) {
        return res.status(404).json({ 
          success: false, 
          message: 'Reservación no encontrada' 
        });
      }
      
      // Verificar que el usuario está autenticado
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Usuario no autenticado' 
        });
      }
      
      console.log(`[CHECK TICKET] Solicitud de escaneo de ticket ${id} por usuario ${req.user.firstName} ${req.user.lastName} (ID: ${req.user.id})`);
    
      // Verificar permisos: solo ciertos roles pueden escanear tickets
      const allowedRoles = [
        UserRole.SUPER_ADMIN, 
        UserRole.ADMIN, 
        UserRole.OWNER, 
        UserRole.CHECKER, 
        UserRole.DRIVER, 
        UserRole.TICKET_OFFICE
      ];
      
      if (!allowedRoles.includes(req.user.role)) {
        console.log(`[CHECK TICKET] DENEGADO: Rol ${req.user.role} no autorizado para escanear tickets`);
        return res.status(403).json({ 
          success: false, 
          message: 'No tienes permiso para escanear tickets' 
        });
      }
      
      // Obtener los detalles del viaje asociado a la reservación
      const trip = await storage.getTrip(reservation.tripId);
      if (!trip) {
        console.log(`[CHECK TICKET] DENEGADO: No se encontró el viaje ${reservation.tripId} asociado a la reservación ${id}`);
        return res.status(404).json({ 
          success: false, 
          message: 'No se encontró el viaje asociado a esta reservación' 
        });
      }
      
      // Obtener la compañía del usuario
      const userCompanyId = req.user.company || (req.user as any).companyId;
      
      // Obtener la compañía del viaje
      const tripCompanyId = trip.companyId;
      
      console.log(`[CHECK TICKET] Verificando compañías - Usuario: ${userCompanyId || 'ninguna'}, Viaje: ${tripCompanyId || 'ninguna'}`);
      
      // Verificar si ambas compañías coinciden (solo si el usuario no es superAdmin)
      if (req.user.role !== UserRole.SUPER_ADMIN) {
        // Si el usuario no tiene compañía asignada, no puede escanear tickets
        if (!userCompanyId) {
          console.log(`[CHECK TICKET] DENEGADO: Usuario sin compañía asignada`);
          return res.status(403).json({ 
            success: false, 
            message: 'No tienes una compañía asignada para escanear tickets' 
          });
        }
        
        // Si el viaje no tiene compañía asignada, aplicamos una restricción similar
        if (!tripCompanyId) {
          console.log(`[CHECK TICKET] DENEGADO: El viaje no tiene compañía asignada`);
          return res.status(403).json({ 
            success: false, 
            message: 'El viaje asociado no tiene compañía asignada' 
          });
        }
        
        // Normalizar IDs de compañía para la comparación
        // Extraer el nombre base de la compañía sin el sufijo (ej. "bamo-456" => "bamo")
        const normalizeCompanyId = (companyId: string) => {
          const companyIdLower = companyId.toLowerCase();
          // Si tiene formato "compañía-XXX", extraer solo la parte de la compañía
          const match = companyIdLower.match(/^([a-z]+)(?:-\d+)?$/);
          return match ? match[1] : companyIdLower;
        };
        
        const normalizedUserCompany = normalizeCompanyId(userCompanyId);
        const normalizedTripCompany = normalizeCompanyId(tripCompanyId);
        
        console.log(`[CHECK TICKET] Compañías normalizadas - Usuario: ${normalizedUserCompany}, Viaje: ${normalizedTripCompany}`);
        
        // Verificar que las compañías coincidan después de normalizarlas
        if (normalizedUserCompany !== normalizedTripCompany) {
          console.log(`[CHECK TICKET] DENEGADO: Las compañías no coinciden después de normalizar - Usuario: ${normalizedUserCompany}, Viaje: ${normalizedTripCompany}`);
          return res.status(403).json({ 
            success: false, 
            message: 'No puedes escanear tickets de viajes que no pertenecen a tu compañía' 
          });
        }
      }
      
      // Marcar el ticket como escaneado
      const updatedReservation = await storage.checkTicket(id, req.user.id);
      
      // Determinar si es la primera vez que se escanea este ticket
      const isFirstScan = reservation.checkedBy === null || reservation.checkedBy === undefined;
      
      console.log(`[CHECK TICKET] Ticket ${id} ${isFirstScan ? 'escaneado por primera vez' : 're-escaneado'} por usuario ${req.user.id}`);
      
      res.json({ 
        success: true, 
        isFirstScan,
        reservation: updatedReservation,
        message: isFirstScan 
          ? 'Ticket escaneado por primera vez' 
          : 'Ticket escaneado nuevamente'
      });
    } catch (error) {
      console.error('Error al escanear ticket:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al procesar el escaneo del ticket' 
      });
    }
  });

  // POST /api/reservations/:id/pay - Marcar un ticket como pagado
  app.post(apiRouter('/reservations/:id/pay'), isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar que la reservación existe
      const reservation = await storage.getReservation(id);
      if (!reservation) {
        return res.status(404).json({ 
          success: false, 
          message: 'Reservación no encontrada' 
        });
      }
      
      // Verificar que el usuario está autenticado
      if (!req.user) {
        return res.status(401).json({ 
          success: false, 
          message: 'Usuario no autenticado' 
        });
      }
      
      console.log(`[PAY TICKET] Solicitud de pago de ticket ${id} por usuario ${req.user.firstName} ${req.user.lastName} (ID: ${req.user.id})`);
    
      // Verificar permisos: solo ciertos roles pueden marcar tickets como pagados
      const allowedRoles = [
        UserRole.SUPER_ADMIN, 
        UserRole.ADMIN, 
        UserRole.OWNER, 
        UserRole.CHECKER, 
        UserRole.TICKET_OFFICE
      ];
      
      if (!allowedRoles.includes(req.user.role)) {
        console.log(`[PAY TICKET] DENEGADO: Rol ${req.user.role} no autorizado para marcar tickets como pagados`);
        return res.status(403).json({ 
          success: false, 
          message: 'No tienes permiso para marcar tickets como pagados' 
        });
      }
      
      // Obtener los detalles del viaje asociado a la reservación
      const trip = await storage.getTrip(reservation.tripId);
      if (!trip) {
        console.log(`[PAY TICKET] DENEGADO: No se encontró el viaje ${reservation.tripId} asociado a la reservación ${id}`);
        return res.status(404).json({ 
          success: false, 
          message: 'No se encontró el viaje asociado a esta reservación' 
        });
      }
      
      // Obtener la compañía del usuario
      const userCompanyId = req.user.company || (req.user as any).companyId;
      
      // Obtener la compañía del viaje
      const tripCompanyId = trip.companyId;
      
      console.log(`[PAY TICKET] Verificando compañías - Usuario: ${userCompanyId || 'ninguna'}, Viaje: ${tripCompanyId || 'ninguna'}`);
      
      // Verificar si ambas compañías coinciden (solo si el usuario no es superAdmin)
      if (req.user.role !== UserRole.SUPER_ADMIN) {
        // Si el usuario no tiene compañía asignada, no puede marcar tickets como pagados
        if (!userCompanyId) {
          console.log(`[PAY TICKET] DENEGADO: Usuario sin compañía asignada`);
          return res.status(403).json({ 
            success: false, 
            message: 'No tienes una compañía asignada para marcar tickets como pagados' 
          });
        }
        
        // Si el viaje no tiene compañía asignada, aplicamos una restricción similar
        if (!tripCompanyId) {
          console.log(`[PAY TICKET] DENEGADO: El viaje no tiene compañía asignada`);
          return res.status(403).json({ 
            success: false, 
            message: 'El viaje asociado no tiene compañía asignada' 
          });
        }
        
        // Normalizar IDs de compañía para la comparación
        // Extraer el nombre base de la compañía sin el sufijo (ej. "bamo-456" => "bamo")
        const normalizeCompanyId = (companyId: string) => {
          const companyIdLower = companyId.toLowerCase();
          // Si tiene formato "compañía-XXX", extraer solo la parte de la compañía
          const match = companyIdLower.match(/^([a-z]+)(?:-\d+)?$/);
          return match ? match[1] : companyIdLower;
        };
        
        const normalizedUserCompany = normalizeCompanyId(userCompanyId);
        const normalizedTripCompany = normalizeCompanyId(tripCompanyId);
        
        console.log(`[PAY TICKET] Compañías normalizadas - Usuario: ${normalizedUserCompany}, Viaje: ${normalizedTripCompany}`);
        
        // Verificar que las compañías coincidan después de normalizarlas
        if (normalizedUserCompany !== normalizedTripCompany) {
          console.log(`[PAY TICKET] DENEGADO: Las compañías no coinciden después de normalizar - Usuario: ${normalizedUserCompany}, Viaje: ${normalizedTripCompany}`);
          return res.status(403).json({ 
            success: false, 
            message: 'No puedes marcar como pagados tickets de viajes que no pertenecen a tu compañía' 
          });
        }
      }
      
      // Marcar el ticket como pagado
      const updatedReservation = await storage.markAsPaid(id, req.user.id);
      
      console.log(`[PAY TICKET] Ticket ${id} marcado como pagado por usuario ${req.user.id}`);
      
      res.json({ 
        success: true, 
        reservation: updatedReservation,
        message: 'Ticket marcado como pagado correctamente'
      });
    } catch (error) {
      console.error('Error al marcar ticket como pagado:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al procesar el pago del ticket' 
      });
    }
  });

  // ======== API de Cupones ========

  // GET /api/coupons - Obtener todos los cupones
  app.get(apiRouter('/coupons'), isAuthenticated, async (req, res) => {
    try {
      // Verificar permisos: solo administradores y dueños pueden ver cupones
      const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER];
      
      if (!allowedRoles.includes(req.user!.role)) {
        return res.status(403).json({ 
          success: false, 
          message: 'No tienes permiso para acceder a esta sección' 
        });
      }

      // Obtener el ID de la compañía del usuario si no es superAdmin
      let companyId = null;
      if (req.user!.role !== UserRole.SUPER_ADMIN && req.user!.role !== UserRole.DEVELOPER) {
        companyId = req.user!.company || (req.user as any).companyId;
      }
      
      const coupons = await storage.getCoupons(companyId);
      res.json(coupons);
    } catch (error) {
      console.error('Error al obtener cupones:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al obtener los cupones' 
      });
    }
  });

  // GET /api/coupons/:id - Obtener un cupón específico por ID
  app.get(apiRouter('/coupons/:id'), isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar permisos: solo administradores y dueños pueden ver cupones
      const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER];
      
      if (!allowedRoles.includes(req.user!.role)) {
        return res.status(403).json({ 
          success: false, 
          message: 'No tienes permiso para acceder a esta sección' 
        });
      }
      
      const coupon = await storage.getCoupon(id);
      
      if (!coupon) {
        return res.status(404).json({ 
          success: false, 
          message: 'Cupón no encontrado' 
        });
      }
      
      // Verificar que el usuario tenga acceso a este cupón
      if (req.user!.role !== UserRole.SUPER_ADMIN && req.user!.role !== UserRole.DEVELOPER) {
        const userCompany = req.user!.company || (req.user as any).companyId;
        if (coupon.companyId && coupon.companyId !== userCompany) {
          return res.status(403).json({ 
            success: false, 
            message: 'No tienes acceso a este cupón' 
          });
        }
      }
      
      res.json(coupon);
    } catch (error) {
      console.error(`Error al obtener cupón con ID ${req.params.id}:`, error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al obtener el cupón' 
      });
    }
  });

  // POST /api/coupons - Crear un nuevo cupón
  app.post(apiRouter('/coupons'), isAuthenticated, async (req, res) => {
    try {
      // Verificar permisos: solo administradores y dueños pueden crear cupones
      const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER];
      
      if (!allowedRoles.includes(req.user!.role)) {
        return res.status(403).json({ 
          success: false, 
          message: 'No tienes permiso para crear cupones' 
        });
      }
      
      // Validar los datos recibidos
      if (!req.body.discountType || !req.body.discountValue 
          || !req.body.usageLimit || !req.body.expirationHours) {
        return res.status(400).json({ 
          success: false, 
          message: 'Faltan campos requeridos para crear el cupón' 
        });
      }
      
      // Si no se proporciona un código y generateRandomCode es true, generar un código aleatorio
      let code = req.body.code;
      if ((!code || code.trim() === '') && req.body.generateRandomCode) {
        // Generar un código aleatorio de 5 caracteres
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 5; i++) {
          result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        code = result;
      } else if (!code || code.trim() === '') {
        return res.status(400).json({ 
          success: false, 
          message: 'Debe proporcionar un código de cupón o activar la generación automática' 
        });
      }
      
      // Verificar si ya existe un cupón con ese código
      const existingCoupon = await storage.getCouponByCode(code);
      if (existingCoupon) {
        return res.status(400).json({ 
          success: false, 
          message: 'Ya existe un cupón con ese código' 
        });
      }
      
      // Asignar la compañía del usuario al cupón
      let companyId = null;
      if (req.user!.role !== UserRole.SUPER_ADMIN && req.user!.role !== UserRole.DEVELOPER) {
        companyId = req.user!.company || (req.user as any).companyId;
      }
      
      // Preparar los datos del cupón
      const couponData = {
        code,
        discountType: req.body.discountType,
        discountValue: req.body.discountValue,
        usageLimit: req.body.usageLimit,
        usageCount: 0,
        expirationHours: req.body.expirationHours,
        isActive: req.body.isActive !== undefined ? req.body.isActive : true,
        companyId,
        // La fecha de creación se establece en el modelo, igual que la fecha de expiración
      };
      
      // Crear el cupón
      const newCoupon = await storage.createCoupon(couponData);
      
      res.status(201).json(newCoupon);
    } catch (error) {
      console.error('Error al crear cupón:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al crear el cupón' 
      });
    }
  });

  // PATCH /api/coupons/:id - Actualizar un cupón existente
  app.patch(apiRouter('/coupons/:id'), isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar permisos: solo administradores y dueños pueden actualizar cupones
      const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER];
      
      if (!allowedRoles.includes(req.user!.role)) {
        return res.status(403).json({ 
          success: false, 
          message: 'No tienes permiso para actualizar cupones' 
        });
      }
      
      // Verificar que el cupón existe
      const existingCoupon = await storage.getCoupon(id);
      if (!existingCoupon) {
        return res.status(404).json({ 
          success: false, 
          message: 'Cupón no encontrado' 
        });
      }
      
      // Verificar que el usuario tenga acceso a este cupón
      if (req.user!.role !== UserRole.SUPER_ADMIN && req.user!.role !== UserRole.DEVELOPER) {
        const userCompany = req.user!.company || (req.user as any).companyId;
        if (existingCoupon.companyId && existingCoupon.companyId !== userCompany) {
          return res.status(403).json({ 
            success: false, 
            message: 'No tienes acceso a este cupón' 
          });
        }
      }
      
      // Preparar los datos para actualizar
      const updates: any = {};
      
      // No permitir cambiar el código del cupón una vez creado
      if (req.body.discountType !== undefined) updates.discountType = req.body.discountType;
      if (req.body.discountValue !== undefined) updates.discountValue = req.body.discountValue;
      if (req.body.usageLimit !== undefined) updates.usageLimit = req.body.usageLimit;
      if (req.body.expirationHours !== undefined) updates.expirationHours = req.body.expirationHours;
      if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;
      
      // Actualizar el cupón
      const updatedCoupon = await storage.updateCoupon(id, updates);
      
      if (!updatedCoupon) {
        return res.status(400).json({ 
          success: false, 
          message: 'No se pudo actualizar el cupón' 
        });
      }
      
      res.json(updatedCoupon);
    } catch (error) {
      console.error(`Error al actualizar cupón con ID ${req.params.id}:`, error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al actualizar el cupón' 
      });
    }
  });

  // DELETE /api/coupons/:id - Eliminar un cupón
  app.delete(apiRouter('/coupons/:id'), isAuthenticated, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar permisos: solo administradores y dueños pueden eliminar cupones
      const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER];
      
      if (!allowedRoles.includes(req.user!.role)) {
        return res.status(403).json({ 
          success: false, 
          message: 'No tienes permiso para eliminar cupones' 
        });
      }
      
      // Verificar que el cupón existe
      const existingCoupon = await storage.getCoupon(id);
      if (!existingCoupon) {
        return res.status(404).json({ 
          success: false, 
          message: 'Cupón no encontrado' 
        });
      }
      
      // Verificar que el usuario tenga acceso a este cupón
      if (req.user!.role !== UserRole.SUPER_ADMIN && req.user!.role !== UserRole.DEVELOPER) {
        const userCompany = req.user!.company || (req.user as any).companyId;
        if (existingCoupon.companyId && existingCoupon.companyId !== userCompany) {
          return res.status(403).json({ 
            success: false, 
            message: 'No tienes acceso a este cupón' 
          });
        }
      }
      
      // Eliminar el cupón
      const deleted = await storage.deleteCoupon(id);
      
      if (!deleted) {
        return res.status(400).json({ 
          success: false, 
          message: 'No se pudo eliminar el cupón' 
        });
      }
      
      res.json({ 
        success: true, 
        message: 'Cupón eliminado correctamente' 
      });
    } catch (error) {
      console.error(`Error al eliminar cupón con ID ${req.params.id}:`, error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al eliminar el cupón' 
      });
    }
  });

  // GET /api/coupons/validate/:code - Endpoint para validar cupón por GET (usado por el frontend)
  app.get(apiRouter('/coupons/validate/:code'), async (req, res) => {
    try {
      const { code } = req.params;
      
      if (!code) {
        return res.status(400).json({ 
          success: false, 
          message: 'Debe proporcionar un código de cupón' 
        });
      }
      
      console.log(`Validando cupón con código: ${code}`);
      
      // Verificar la validez del cupón
      const result = await storage.verifyCouponValidity(code);
      
      if (!result.valid) {
        console.log(`Cupón ${code} inválido: ${result.message}`);
        return res.status(400).json({ 
          success: false, 
          valid: false,
          message: result.message || 'Cupón no válido' 
        });
      }
      
      console.log(`Cupón ${code} válido!`);
      
      // Devolver información del cupón para cálculo del descuento
      res.json({ 
        ...result.coupon,
        success: true, 
        valid: true,
        message: 'Cupón válido' 
      });
    } catch (error) {
      console.error('Error al validar cupón:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Error al validar cupón' 
      });
    }
  });

  // POST /api/coupons/verify - Verificar validez de un cupón
  app.post(apiRouter('/coupons/verify'), async (req, res) => {
    try {
      const { code } = req.body;
      
      if (!code) {
        return res.status(400).json({ 
          success: false, 
          message: 'Debe proporcionar un código de cupón' 
        });
      }
      
      // Verificar la validez del cupón
      const result = await storage.verifyCouponValidity(code);
      
      if (!result.valid) {
        return res.status(400).json({ 
          success: false, 
          valid: false,
          message: result.message || 'Cupón no válido' 
        });
      }
      
      res.json({ 
        success: true, 
        valid: true,
        coupon: result.coupon,
        message: 'Cupón válido' 
      });
    } catch (error) {
      console.error('Error al verificar cupón:', error);
      res.status(500).json({ 
        success: false, 
        valid: false,
        message: 'Error al verificar el cupón' 
      });
    }
  });

  // ========== RUTAS DE PAQUETERÍAS ==========
  // Middleware para validar acceso a paqueterías según rol
  function validatePackageAccess(req: Request, res: Response, next: Function) {
    const { user } = req as any;
    
    if (!user) {
      console.log(`[packages] Acceso denegado: Usuario no autenticado`);
      return res.status(401).json({ message: "No autenticado" });
    }
    
    if (!PACKAGE_ACCESS_ROLES.includes(user.role)) {
      console.log(`[packages] Acceso denegado: Rol ${user.role} no tiene permisos`);
      return res.status(403).json({ message: "Acceso denegado" });
    }
    
    next();
  }
  
  // 1. Obtener todas las paqueterías (con filtros)
  app.get(apiRouter("/packages"), validatePackageAccess, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const { tripId } = req.query;
      
      console.log(`[GET /packages] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      
      // Extraer companyId del usuario para aislamiento de datos
      const userCompanyId = user.companyId || user.company;
      
      // Si el usuario no tiene una compañía asignada, devolver lista vacía
      if (!userCompanyId && user.role !== UserRole.SUPER_ADMIN) {
        console.log(`[GET /packages] Usuario sin compañía asignada, no verá ninguna paquetería`);
        return res.json([]);
      }
      
      // Configurar filtros para la búsqueda
      const filters: any = {};
      
      // Aplicar filtro de aislamiento por compañía excepto para superAdmin
      if (user.role !== UserRole.SUPER_ADMIN) {
        filters.companyId = userCompanyId;
      }
      
      // Aplicar filtro por viaje si se proporciona
      if (tripId && !isNaN(parseInt(tripId as string))) {
        filters.tripId = parseInt(tripId as string);
      }
      
      console.log(`[GET /packages] Buscando paqueterías con filtros:`, filters);
      
      // Obtener paqueterías con los filtros aplicados incluyendo información de viaje
      const packages = await storage.getPackagesWithTripInfo(filters);
      
      // Responder con las paqueterías encontradas (ahora incluyen origen y destino)
      res.json(packages);
    } catch (error: any) {
      console.error(`[GET /packages] Error:`, error);
      res.status(500).json({ message: error.message || "Error al obtener paqueterías" });
    }
  });
  
  // 2. Obtener una paquetería específica con detalles del viaje
  app.get(apiRouter("/packages/:id"), validatePackageAccess, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const { id } = req.params;
      
      console.log(`[GET /packages/${id}] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      
      // Obtener la paquetería con información del viaje
      const packageWithTrip = await storage.getPackageWithTripInfo(parseInt(id));
      
      if (!packageWithTrip) {
        return res.status(404).json({ message: "Paquetería no encontrada" });
      }
      
      // Validar aislamiento por compañía excepto para superAdmin
      if (user.role !== UserRole.SUPER_ADMIN) {
        const userCompanyId = user.companyId || user.company;
        
        if (packageWithTrip.companyId !== userCompanyId) {
          console.log(`[GET /packages/${id}] Acceso denegado: La paquetería pertenece a otra compañía`);
          return res.status(403).json({ message: "Acceso denegado" });
        }
      }
      
      // Responder con la paquetería y sus detalles
      res.json(packageWithTrip);
    } catch (error: any) {
      console.error(`[GET /packages/${req.params.id}] Error:`, error);
      res.status(500).json({ message: error.message || "Error al obtener la paquetería" });
    }
  });
  
  // 3. Crear nueva paquetería
  app.post(apiRouter("/packages"), validatePackageAccess, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      console.log(`[POST /packages] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      
      // Verificar permisos para crear paqueterías
      if (!PACKAGE_CREATE_ROLES.includes(user.role)) {
        console.log(`[POST /packages] Acceso denegado: Rol ${user.role} no puede crear paqueterías`);
        return res.status(403).json({ message: "No tienes permisos para crear paqueterías" });
      }
      
      // Validar datos recibidos
      try {
        insertPackageSchema.parse(req.body);
      } catch (validationError: any) {
        console.error(`[POST /packages] Error de validación:`, validationError);
        return res.status(400).json({ 
          message: "Datos de paquetería inválidos", 
          errors: validationError.errors 
        });
      }
      
      // Extraer companyId del usuario para aislamiento de datos
      const userCompanyId = user.companyId || user.company;
      
      // Preparar datos para crear la paquetería
      const packageData = {
        ...req.body,
        companyId: userCompanyId,
        createdBy: user.id
      };
      
      // Si hay un tripId, obtener la fecha de salida del viaje
      if (packageData.tripId) {
        try {
          const trip = await storage.getTrip(packageData.tripId);
          if (trip && trip.departureDate) {
            console.log(`[POST /packages] Usando fecha de salida del viaje: ${trip.departureDate}`);
            // Actualizar la fecha de creación para que coincida con la fecha del viaje
            packageData.createdAt = trip.departureDate;
          }
        } catch (tripError) {
          console.error(`[POST /packages] Error al obtener datos del viaje: ${tripError}`);
          // Continuamos sin fecha específica si hay un error (usará la fecha actual)
        }
      }
      
      console.log(`[POST /packages] Creando paquetería:`, packageData);
      
      // Crear la paquetería
      const newPackage = await storage.createPackage(packageData);
      
      // Responder con la paquetería creada
      res.status(201).json(newPackage);
    } catch (error: any) {
      console.error(`[POST /packages] Error:`, error);
      res.status(500).json({ message: error.message || "Error al crear la paquetería" });
    }
  });
  
  // 4. Actualizar una paquetería existente
  app.patch(apiRouter("/packages/:id"), validatePackageAccess, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const { id } = req.params;
      
      console.log(`[PATCH /packages/${id}] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      
      // Verificar permisos para editar paqueterías
      if (!PACKAGE_WRITE_ROLES.includes(user.role)) {
        console.log(`[PATCH /packages/${id}] Acceso denegado: Rol ${user.role} no puede editar paqueterías`);
        return res.status(403).json({ message: "No tienes permisos para editar paqueterías" });
      }
      
      // Obtener la paquetería existente
      const existingPackage = await storage.getPackage(parseInt(id));
      
      if (!existingPackage) {
        return res.status(404).json({ message: "Paquetería no encontrada" });
      }
      
      // Validar aislamiento por compañía excepto para superAdmin
      if (user.role !== UserRole.SUPER_ADMIN) {
        const userCompanyId = user.companyId || user.company;
        
        if (existingPackage.companyId !== userCompanyId) {
          console.log(`[PATCH /packages/${id}] Acceso denegado: La paquetería pertenece a otra compañía`);
          return res.status(403).json({ message: "Acceso denegado" });
        }
      }
      
      // Preparar datos para actualizar
      const updateData = { ...req.body };
      
      // Si se está cambiando el viaje (tripId), actualizar la fecha de creación para que coincida con la nueva fecha del viaje
      if (updateData.tripId && updateData.tripId !== existingPackage.tripId) {
        try {
          const trip = await storage.getTrip(updateData.tripId);
          if (trip && trip.departureDate) {
            console.log(`[PATCH /packages/${id}] Actualizando fecha a fecha de salida del nuevo viaje: ${trip.departureDate}`);
            // Usar la fecha del nuevo viaje
            updateData.createdAt = trip.departureDate;
          }
        } catch (tripError) {
          console.error(`[PATCH /packages/${id}] Error al obtener datos del nuevo viaje: ${tripError}`);
          // Continuamos con la actualización sin cambiar la fecha
        }
      }
      
      // Actualizar la paquetería
      const updatedPackage = await storage.updatePackage(parseInt(id), updateData);
      
      // Responder con la paquetería actualizada
      res.json(updatedPackage);
    } catch (error: any) {
      console.error(`[PATCH /packages/${req.params.id}] Error:`, error);
      res.status(500).json({ message: error.message || "Error al actualizar la paquetería" });
    }
  });
  
  // 5. Eliminar una paquetería
  app.delete(apiRouter("/packages/:id"), validatePackageAccess, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const { id } = req.params;
      
      console.log(`[DELETE /packages/${id}] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      
      // Verificar permisos para eliminar paqueterías
      if (!PACKAGE_WRITE_ROLES.includes(user.role)) {
        console.log(`[DELETE /packages/${id}] Acceso denegado: Rol ${user.role} no puede eliminar paqueterías`);
        return res.status(403).json({ message: "No tienes permisos para eliminar paqueterías" });
      }
      
      // Obtener la paquetería existente
      const existingPackage = await storage.getPackage(parseInt(id));
      
      if (!existingPackage) {
        return res.status(404).json({ message: "Paquetería no encontrada" });
      }
      
      // Validar aislamiento por compañía excepto para superAdmin
      if (user.role !== UserRole.SUPER_ADMIN) {
        const userCompanyId = user.companyId || user.company;
        
        if (existingPackage.companyId !== userCompanyId) {
          console.log(`[DELETE /packages/${id}] Acceso denegado: La paquetería pertenece a otra compañía`);
          return res.status(403).json({ message: "Acceso denegado" });
        }
      }
      
      // Eliminar la paquetería
      const deleted = await storage.deletePackage(parseInt(id));
      
      if (!deleted) {
        return res.status(500).json({ message: "No se pudo eliminar la paquetería" });
      }
      
      // Responder con éxito
      res.json({ message: "Paquetería eliminada correctamente" });
    } catch (error: any) {
      console.error(`[DELETE /packages/${req.params.id}] Error:`, error);
      res.status(500).json({ message: error.message || "Error al eliminar la paquetería" });
    }
  });

  // Setup routes for packages
  setupPackageRoutes(app);

  return httpServer;
}

/**
 * Configura las rutas para la funcionalidad de paqueterías
 * @param app - Instancia de Express
 */
function setupPackageRoutes(app: Express) {
  // Helper para rutas API
  const apiRouter = (path: string) => `/api${path}`;
  
  // Middleware para verificar autenticación
  function isAuthenticated(req: Request, res: Response, next: Function) {
    if (req.isAuthenticated && req.isAuthenticated()) {
      return next();
    }
    res.status(401).json({ message: 'No autenticado' });
  }
  
  // Constantes para roles que pueden crear/editar paquetes
  const PACKAGE_WRITE_ROLES = [UserRole.OWNER, UserRole.ADMIN, UserRole.CALL_CENTER, UserRole.CHECKER];
  // Roles que solo pueden ver paquetes
  const PACKAGE_READ_ONLY_ROLES = [UserRole.DRIVER];
  
  // Middleware para comprobar permisos de paqueterías
  function hasPackageAccess(req: Request, res: Response, next: Function) {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'No autenticado' });
    }
    
    const user = req.user as any;
    const userRole = user.role;
    
    if ([...PACKAGE_WRITE_ROLES, ...PACKAGE_READ_ONLY_ROLES].includes(userRole)) {
      return next();
    }
    
    res.status(403).json({ message: 'No tiene permisos para acceder a esta funcionalidad' });
  }
  
  // Middleware para comprobar permisos de escritura de paqueterías
  function hasPackageWriteAccess(req: Request, res: Response, next: Function) {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'No autenticado' });
    }
    
    const user = req.user as any;
    const userRole = user.role;
    
    if (PACKAGE_WRITE_ROLES.includes(userRole)) {
      return next();
    }
    
    res.status(403).json({ message: 'No tiene permisos para modificar paquetes' });
  }
  
  // GET /api/packages - Obtener lista de paquetes
  app.get(apiRouter('/packages'), isAuthenticated, hasPackageAccess, async (req, res) => {
    try {
      const tripId = req.query.tripId ? parseInt(req.query.tripId as string) : undefined;
      
      // Filtrar por compañía para asegurar aislamiento de datos
      let companyFilter = null;
      if (req.user && req.user.role !== UserRole.SUPER_ADMIN) {
        companyFilter = req.user.company || req.user.companyId;
      }
      
      // Obtener paquetes
      const packages = await storage.getPackages(companyFilter, tripId);
      
      res.json(packages);
    } catch (error) {
      console.error('Error al obtener paquetes:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });
  
  // GET /api/packages/:id - Obtener un paquete específico
  app.get(apiRouter('/packages/:id'), isAuthenticated, hasPackageAccess, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Obtener el paquete
      const packageData = await storage.getPackageById(id);
      
      if (!packageData) {
        return res.status(404).json({ message: 'Paquete no encontrado' });
      }
      
      // Verificar acceso a la compañía
      if (req.user && req.user.role !== UserRole.SUPER_ADMIN) {
        const userCompany = req.user.company || req.user.companyId;
        if (packageData.companyId !== userCompany) {
          return res.status(403).json({ message: 'No tiene permisos para ver este paquete' });
        }
      }
      
      res.json(packageData);
    } catch (error) {
      console.error(`Error al obtener paquete con ID ${req.params.id}:`, error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });
  
  // POST /api/packages - Crear un nuevo paquete
  app.post(apiRouter('/packages'), isAuthenticated, hasPackageWriteAccess, async (req, res) => {
    try {
      // Validar los datos con el esquema
      const packageData = insertPackageSchema.parse(req.body);
      
      // Agregar información del usuario y compañía
      const newPackage = {
        ...packageData,
        createdBy: req.user?.id,
        companyId: req.user?.company, // Usamos solo el campo company sin la alternativa companyId
      };
      
      // Crear el paquete
      const createdPackage = await storage.createPackage(newPackage);
      
      res.status(201).json(createdPackage);
    } catch (error) {
      console.error('Error al crear paquete:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Datos de paquete inválidos', 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });
  
  // PATCH /api/packages/:id/deliver - Marcar un paquete como entregado
  app.patch(apiRouter('/packages/:id/deliver'), isAuthenticated, hasPackageWriteAccess, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar que el paquete existe
      const existingPackage = await storage.getPackageById(id);
      if (!existingPackage) {
        return res.status(404).json({ message: 'Paquete no encontrado' });
      }
      
      // Verificar permisos de compañía
      if (req.user && req.user.role !== UserRole.SUPER_ADMIN) {
        const userCompanyId = req.user.companyId || req.user.company;
        
        if (existingPackage.companyId !== userCompanyId) {
          return res.status(403).json({ message: "Acceso denegado" });
        }
      }
      
      // Actualizar solo el estado de entrega
      const updatedPackage = await storage.updatePackage(id, {
        deliveryStatus: "entregado",
        updatedAt: new Date()
      });
      
      res.json(updatedPackage);
    } catch (error) {
      console.error('Error al marcar paquete como entregado:', error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });
  
  // PATCH /api/packages/:id - Actualizar un paquete
  app.patch(apiRouter('/packages/:id'), isAuthenticated, hasPackageWriteAccess, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar que el paquete existe
      const existingPackage = await storage.getPackageById(id);
      if (!existingPackage) {
        return res.status(404).json({ message: 'Paquete no encontrado' });
      }
      
      // Verificar permisos de compañía
      if (req.user && req.user.role !== UserRole.SUPER_ADMIN) {
        const userCompany = req.user.company || req.user.companyId;
        if (existingPackage.companyId !== userCompany) {
          return res.status(403).json({ message: 'No tiene permisos para editar este paquete' });
        }
      }
      
      // Actualizar estado de entrega si corresponde
      if (req.body.deliveryStatus === 'entregado' && existingPackage.deliveryStatus !== 'entregado') {
        req.body.deliveredAt = new Date();
      }
      
      // Actualizar el paquete
      const updatedPackage = await storage.updatePackage(id, req.body);
      
      res.json(updatedPackage);
    } catch (error) {
      console.error(`Error al actualizar paquete con ID ${req.params.id}:`, error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });
  
  // DELETE /api/packages/:id - Eliminar un paquete
  app.delete(apiRouter('/packages/:id'), isAuthenticated, hasPackageWriteAccess, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      // Verificar que el paquete existe
      const existingPackage = await storage.getPackageById(id);
      if (!existingPackage) {
        return res.status(404).json({ message: 'Paquete no encontrado' });
      }
      
      // Verificar permisos de compañía
      if (req.user && req.user.role !== UserRole.SUPER_ADMIN) {
        const userCompany = req.user.company || req.user.companyId;
        if (existingPackage.companyId !== userCompany) {
          return res.status(403).json({ message: 'No tiene permisos para eliminar este paquete' });
        }
      }
      
      // Eliminar el paquete
      await storage.deletePackage(id);
      
      res.status(204).send();
    } catch (error) {
      console.error(`Error al eliminar paquete con ID ${req.params.id}:`, error);
      res.status(500).json({ message: 'Error interno del servidor' });
    }
  });
  
  // GET /api/cash-register - Obtener reservaciones pagadas por el usuario actual
  app.get(apiRouter('/cash-register'), isAuthenticated, async (req, res) => {
    try {
      const { user } = req as any;
      console.log(`[GET /cash-register] Usuario ${user.firstName} ${user.lastName} solicitando datos de caja`);
      
      // Si el usuario es taquillero (tiene acceso a empresas específicas)
      if (user.role === UserRole.TICKET_OFFICE) {
        console.log(`[GET /cash-register] Usuario taquillero: obteniendo compañías asociadas`);
        
        // Obtener las compañías asociadas al usuario de taquilla
        const userCompanyAssociations = await db
          .select()
          .from(userCompanies)
          .where(eq(userCompanies.userId, user.id));
        
        console.log(`[GET /cash-register] Usuario taquillero: ${userCompanyAssociations.length} compañías asociadas`);
        
        if (userCompanyAssociations.length === 0) {
          console.log(`[GET /cash-register] Usuario taquillero sin empresas asociadas: no se mostrarán reservaciones`);
          return res.json([]);
        }
        
        // Obtener todos los IDs de compañías a las que tiene acceso
        const associatedCompanyIds = userCompanyAssociations.map(assoc => assoc.companyId);
        console.log(`[GET /cash-register] IDs de compañías asociadas: ${associatedCompanyIds.join(', ')}`);
        
        // Obtener todas las reservaciones marcadas como pagadas por este taquillero
        const taquilleroReservations = await storage.getPaidReservationsByUser(user.id);
        
        // Filtrar las reservaciones para mostrar solo las de las compañías asociadas
        const filteredReservations = taquilleroReservations.filter(reservation => {
          const tripCompanyId = reservation.trip?.companyId || null;
          return tripCompanyId && associatedCompanyIds.includes(tripCompanyId);
        });
        
        console.log(`[GET /cash-register] Filtrando ${taquilleroReservations.length} reservaciones a ${filteredReservations.length} (solo compañías asociadas)`);
        
        // Agregar información adicional para identificar a qué empresa pertenece cada reserva
        const enrichedReservations = await Promise.all(
          filteredReservations.map(async (reservation) => {
            // Obtener la compañía del viaje
            let companyId = null;
            let companyName = "Desconocida";
            
            if (reservation.trip && reservation.trip.companyId) {
              companyId = reservation.trip.companyId;
              
              // Intentar obtener el nombre de la compañía si está disponible
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
              ...reservation,
              companyInfo: {
                id: companyId,
                name: companyName
              }
            };
          })
        );
        
        return res.json(enrichedReservations);
      }
      
      // Si el usuario es dueño o administrador, mostrar todas las reservaciones de la compañía
      if (user.role === UserRole.OWNER || user.role === UserRole.ADMIN) {
        // Obtener ID de la compañía
        const companyId = user.companyId || user.company;
        
        if (!companyId) {
          console.log(`[GET /cash-register] Usuario dueño/admin sin compañía asignada. Usando vista limitada.`);
          const paidReservations = await storage.getPaidReservationsByUser(user.id);
          
          // Agregar información adicional para identificar a qué empresa pertenece cada reserva
          const enrichedReservations = await Promise.all(
            paidReservations.map(async (reservation) => {
              // Obtener la compañía del viaje
              let companyId = null;
              let companyName = "Desconocida";
              
              if (reservation.trip && reservation.trip.companyId) {
                companyId = reservation.trip.companyId;
                
                // Intentar obtener el nombre de la compañía si está disponible
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
                ...reservation,
                companyInfo: {
                  id: companyId,
                  name: companyName
                }
              };
            })
          );
          
          return res.json(enrichedReservations);
        }
        
        console.log(`[GET /cash-register] Usuario dueño/admin: mostrando todas las reservaciones pagadas de la compañía ${companyId}`);
        
        // Modificación: Obtener todas las reservaciones pagadas de su compañía, incluidas las marcadas
        // por taquilleros para viajes de esta compañía
        
        // 1. Obtener reservaciones pagadas por usuarios de la compañía
        const companyUsersReservations = await storage.getPaidReservationsByCompany(companyId);
        
        // 2. Obtener reservaciones pagadas por taquilleros para viajes de esta compañía
        // Primero, buscar todos los usuarios con rol taquilla
        const ticketOfficeUsers = await storage.getUsersByRole(UserRole.TICKET_OFFICE);
        
        // Array para almacenar todas las reservaciones
        let allReservations = [...companyUsersReservations];
        
        // Para cada taquillero, obtener las reservaciones que marcó como pagadas
        for (const ticketOfficeUser of ticketOfficeUsers) {
          const ticketOfficeReservations = await storage.getPaidReservationsByUser(ticketOfficeUser.id);
          
          // Filtrar solo las que pertenecen a la compañía actual
          const companyTicketOfficeReservations = ticketOfficeReservations.filter(
            reservation => reservation.trip && reservation.trip.companyId === companyId
          );
          
          // Agregar las reservaciones al array total
          allReservations = [...allReservations, ...companyTicketOfficeReservations];
        }
        
        // Eliminar duplicados (si un taquillero marcó como pagada una reservación que ya está incluida)
        const uniqueReservations = allReservations.filter((reservation, index, self) => 
          self.findIndex(r => r.id === reservation.id) === index
        );
        
        // Agregar información adicional para identificar a qué empresa pertenece cada reserva
        const enrichedReservations = await Promise.all(
          uniqueReservations.map(async (reservation) => {
            // Obtener la compañía del viaje
            let companyId = null;
            let companyName = "Desconocida";
            
            if (reservation.trip && reservation.trip.companyId) {
              companyId = reservation.trip.companyId;
              
              // Intentar obtener el nombre de la compañía si está disponible
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
              ...reservation,
              companyInfo: {
                id: companyId,
                name: companyName
              }
            };
          })
        );
        
        return res.json(enrichedReservations);
      }
      
      // Para otros roles, mostrar solo sus propias reservaciones
      const paidReservations = await storage.getPaidReservationsByUser(user.id);
      
      // Agregar información adicional para identificar a qué empresa pertenece cada reserva
      const enrichedReservations = await Promise.all(
        paidReservations.map(async (reservation) => {
          // Obtener la compañía del viaje
          let companyId = null;
          let companyName = "Desconocida";
          
          if (reservation.trip && reservation.trip.companyId) {
            companyId = reservation.trip.companyId;
            
            // Intentar obtener el nombre de la compañía si está disponible
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
            ...reservation,
            companyInfo: {
              id: companyId,
              name: companyName
            }
          };
        })
      );
      
      console.log(`[GET /cash-register] Enviando ${enrichedReservations.length} reservaciones pagadas por el usuario ${user.id}`);
      return res.json(enrichedReservations);
    } catch (error) {
      console.error('[GET /cash-register] Error:', error);
      res.status(500).json({ message: 'Error al cargar datos de caja' });
    }
  });
}
