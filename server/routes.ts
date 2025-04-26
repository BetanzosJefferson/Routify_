import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertRouteSchema, 
  insertTripSchema, 
  insertReservationSchema, 
  insertPassengerSchema,
  createRouteValidationSchema,
  publishTripValidationSchema,
  createReservationValidationSchema,
  RouteWithSegments,
  SegmentPrice,
  locationData,
  UserRole
} from "@shared/schema";

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
        companyId = user.companyId || user.company;
        console.log(`DB Storage: Consultando rutas para la compañía: ${companyId}`);
      }
      
      let routes = await storage.getRoutes();
      
      // Filtrar rutas por compañía si el usuario tiene una compañía asignada
      if (companyId && user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN && user.role !== UserRole.DEVELOPER) {
        routes = routes.filter(route => {
          // Solo mostrar rutas asociadas a la compañía del usuario
          return route.companyId === companyId;
        });
        console.log(`DB Storage: Rutas filtradas por compañía ${companyId}: ${routes.length}`);
      } else if (user.role === UserRole.SUPER_ADMIN) {
        console.log("Usuario superAdmin: mostrando todas las rutas");
      } else {
        console.log(`Usuario sin compañía asignada o con rol especial: ${user.role}`);
      }
      
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
      
      // Verificar acceso a la ruta (solo para roles que no son admin)
      if (companyId && 
          user.role !== UserRole.SUPER_ADMIN && 
          user.role !== UserRole.ADMIN && 
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
        companyId = user.companyId || user.company;
        console.log(`Creando ruta para la compañía: ${companyId} del usuario ${user.firstName} ${user.lastName}`);
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
      
      const routeData = validationResult.data;
      const updatedRoute = await storage.updateRoute(id, routeData);
      
      if (!updatedRoute) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      res.json(updatedRoute);
    } catch (error) {
      res.status(500).json({ error: "Failed to update route" });
    }
  });

  app.delete(apiRouter("/routes/:id"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const success = await storage.deleteRoute(id);
      
      if (!success) {
        return res.status(404).json({ error: "Route not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete route" });
    }
  });

  // TRIPS ENDPOINTS
  app.get(apiRouter("/trips"), async (req: Request, res: Response) => {
    try {
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      // Variable para almacenar el companyId para filtrar viajes
      let companyId: string | null = null;
      
      // Si hay usuario autenticado y no es superAdmin, aplicamos filtro por compañía
      if (user) {
        if (user.role === UserRole.OWNER || 
            user.role === UserRole.CALL_CENTER || 
            user.role === UserRole.CHECKER ||
            user.role === UserRole.DRIVER ||
            user.role === UserRole.TICKET_OFFICE) {
          // Usar companyId del usuario si existe
          companyId = user.companyId || user.company;
          console.log(`Filtrando viajes por compañía: ${companyId} para usuario ${user.firstName} ${user.lastName}`);
        }
      }
      
      // Check if query parameters for search are provided
      const { origin, destination, date, seats } = req.query;
      
      if (origin || destination || date || seats) {
        const searchParams: any = {};
        if (origin) searchParams.origin = origin as string;
        if (destination) searchParams.destination = destination as string;
        if (date) searchParams.date = date as string;
        if (seats) searchParams.seats = parseInt(seats as string, 10);
        
        // Incluir filtro por compañía si es necesario
        if (companyId) {
          searchParams.companyId = companyId;
        }
        
        const trips = await storage.searchTrips(searchParams);
        return res.json(trips);
      }
      
      // Si no hay parámetros de búsqueda pero hay un filtro de compañía
      if (companyId) {
        const searchParams: any = { companyId };
        const trips = await storage.searchTrips(searchParams);
        return res.json(trips);
      }
      
      // Si no hay filtros, obtener todos los viajes (solo admin y superadmin)
      const trips = await storage.getTrips();
      res.json(trips);
    } catch (error) {
      console.error("Error al obtener viajes:", error);
      res.status(500).json({ error: "Failed to fetch trips" });
    }
  });

  app.get(apiRouter("/trips/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const trip = await storage.getTripWithRouteInfo(id);
      
      if (!trip) {
        return res.status(404).json({ error: "Trip not found" });
      }

      // Obtener el usuario autenticado
      const { user } = req as any;
      
      // Variable para almacenar el companyId para verificar permisos
      let companyId: string | null = null;
      
      // Si hay usuario autenticado y no es admin/superAdmin/developer, verificamos permiso
      if (user) {
        if (user.role === UserRole.OWNER || 
            user.role === UserRole.CALL_CENTER || 
            user.role === UserRole.CHECKER ||
            user.role === UserRole.DRIVER ||
            user.role === UserRole.TICKET_OFFICE) {
          
          companyId = user.companyId || user.company;
          
          // Verificar si el viaje pertenece a la compañía del usuario
          if (trip.companyId && trip.companyId !== companyId) {
            return res.status(403).json({ 
              error: "No tiene permiso para acceder a este viaje",
              details: "El viaje pertenece a otra compañía"
            });
          }
        }
      }
      
      res.json(trip);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trip" });
    }
  });

  app.post(apiRouter("/trips"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validationResult = publishTripValidationSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid trip data", 
          details: validationResult.error.format() 
        });
      }
      
      // Obtener los datos del usuario autenticado
      const { user } = req as any;
      
      // Obtener companyId del usuario (preferimos companyId pero usamos company como respaldo)
      let companyId = null;
      if (user) {
        companyId = user.companyId || user.company;
        console.log(`Asignando viaje a la compañía: ${companyId} del usuario ${user.firstName} ${user.lastName}`);
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
          vehicleType: tripData.vehicleType,
          segmentPrices: tripData.segmentPrices,
          isSubTrip: false,
          parentTripId: null,
          companyId: companyId // Asignar la compañía del usuario al viaje
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
            vehicleType: tripData.vehicleType,
            segmentPrices: [{ origin: segment.origin, destination: segment.destination, price }],
            isSubTrip: true,
            parentTripId: mainTrip.id,
            segmentOrigin: segment.origin,
            segmentDestination: segment.destination,
            companyId: companyId // Asignar la misma compañía del usuario a todos los sub-viajes
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
        
        // Para evitar duplicados, omitiremos los segmentos con solo una parada de diferencia
        // si no es un segmento significativo (como origen a primera parada o última parada a destino)
        const isShortSegment = j === i + 1;
        const isFirstToSecond = i === 0 && j === 1; // Origen a primera parada
        const isSecondToLast = j === allPoints.length - 1 && i === allPoints.length - 2; // Última parada a destino
        
        // Solo incluir segmentos cortos si son significativos o si la ruta tiene pocas paradas
        if (isShortSegment && !isFirstToSecond && !isSecondToLast && allPoints.length > 3) {
          console.log(`Saltando segmento corto no significativo: ${allPoints[i]} -> ${allPoints[j]}`);
          continue;
        }
        
        allSegments.push({
          origin: allPoints[i],
          destination: allPoints[j],
          price: 0
        });
        
        console.log(`  + Segmento: ${allPoints[i]} -> ${allPoints[j]}`);
      }
    }
    
    console.log(`Generados ${allSegments.length} segmentos válidos (excluyendo misma ciudad y ruta principal) para la ruta ${route.id}`);
    
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

  app.put(apiRouter("/trips/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const validationResult = insertTripSchema.partial().safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid trip data", 
          details: validationResult.error.format() 
        });
      }
      
      // Obtener viaje actual antes de actualizar
      const currentTrip = await storage.getTrip(id);
      if (!currentTrip) {
        return res.status(404).json({ error: "Trip not found" });
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
            // Para cada sub-viaje, actualizamos fecha, capacidad y tipo de vehículo
            // pero preservamos su precio específico por segmento
            const subTripUpdate = {
              departureDate: tripData.departureDate || updatedTrip.departureDate,
              departureTime: tripData.departureTime || updatedTrip.departureTime,
              arrivalTime: tripData.arrivalTime || updatedTrip.arrivalTime,
              capacity: tripData.capacity || updatedTrip.capacity,
              vehicleType: tripData.vehicleType || updatedTrip.vehicleType,
            };
            
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

  app.delete(apiRouter("/trips/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const success = await storage.deleteTrip(id);
      
      if (!success) {
        return res.status(404).json({ error: "Trip not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete trip" });
    }
  });

  // RESERVATIONS ENDPOINTS
  app.get(apiRouter("/reservations"), async (req: Request, res: Response) => {
    try {
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      // Variable para almacenar el companyId para filtrar reservaciones
      let companyId: string | null = null;
      
      // Si hay usuario autenticado y no es superAdmin, aplicamos filtro por compañía
      if (user) {
        if (user.role === UserRole.OWNER || 
            user.role === UserRole.CALL_CENTER || 
            user.role === UserRole.CHECKER ||
            user.role === UserRole.DRIVER ||
            user.role === UserRole.TICKET_OFFICE) {
          // Usar companyId del usuario si existe
          companyId = user.companyId || user.company;
          console.log(`Filtrando reservaciones por compañía: ${companyId} para usuario ${user.firstName} ${user.lastName}`);
        }
      }
      
      // Obtener todas las reservaciones
      let reservations = await storage.getReservations();
      
      // Si es necesario filtrar por compañía
      if (companyId) {
        // Obtener viajes de la compañía
        const searchParams: any = { companyId };
        const companyTrips = await storage.searchTrips(searchParams);
        const companyTripIds = new Set(companyTrips.map(trip => trip.id));
        
        // Filtrar reservaciones por viajes de la compañía
        reservations = reservations.filter(reservation => 
          companyTripIds.has(reservation.trip.id)
        );
        
        console.log(`Filtradas ${reservations.length} reservaciones para la compañía ${companyId}`);
      }
      
      res.json(reservations);
    } catch (error: any) {
      console.error("Error fetching reservations:", error);
      res.status(500).json({ error: "Failed to fetch reservations", details: error.message || "Unknown error" });
    }
  });

  app.get(apiRouter("/reservations/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const reservation = await storage.getReservationWithDetails(id);
      
      if (!reservation) {
        return res.status(404).json({ error: "Reservation not found" });
      }
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      // Variable para almacenar el companyId para verificar permisos
      let companyId: string | null = null;
      
      // Si hay usuario autenticado y no es admin/superAdmin/developer, verificamos permiso
      if (user) {
        if (user.role === UserRole.OWNER || 
            user.role === UserRole.CALL_CENTER || 
            user.role === UserRole.CHECKER ||
            user.role === UserRole.DRIVER ||
            user.role === UserRole.TICKET_OFFICE) {
          
          companyId = user.companyId || user.company;
          
          // Verificar si la reservación pertenece a un viaje de la compañía del usuario
          const searchParams: any = { companyId };
          const companyTrips = await storage.searchTrips(searchParams);
          const companyTripIds = new Set(companyTrips.map(trip => trip.id));
          
          // Si el viaje de la reservación no pertenece a la compañía del usuario
          if (!companyTripIds.has(reservation.trip.id)) {
            return res.status(403).json({ 
              error: "No tiene permiso para acceder a esta reservación" 
            });
          }
          
          console.log(`Usuario de compañía ${companyId} accediendo a reservación ${id} del viaje ${reservation.trip.id}`);
        }
      }
      
      res.json(reservation);
    } catch (error) {
      console.error("Error fetching reservation:", error);
      res.status(500).json({ error: "Failed to fetch reservation" });
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
      
      if (trip.availableSeats < passengerCount) {
        return res.status(400).json({ 
          error: "Not enough available seats",
          available: trip.availableSeats,
          requested: passengerCount
        });
      }
      
      // Create the reservation
      const totalAmount = trip.price * passengerCount;
      
      const reservation = await storage.createReservation({
        tripId: reservationData.tripId,
        totalAmount,
        email: reservationData.email,
        phone: reservationData.phone,
        paymentMethod: reservationData.paymentMethod || "cash", // Método de pago desde el formulario
        notes: reservationData.notes || null, // Incluir notas desde el formulario
        status: "confirmed",
        createdAt: new Date()
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
      
      // Actualizar asientos disponibles en el viaje
      await storage.updateTrip(trip.id, {
        availableSeats: trip.availableSeats - passengerCount
      });
      
      // Actualizar disponibilidad en viajes relacionados
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

  app.delete(apiRouter("/reservations/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const success = await storage.deleteReservation(id);
      
      if (!success) {
        return res.status(404).json({ error: "Reservation not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete reservation" });
    }
  });

  // Rutas de API para vehículos (unidades)
  app.get(apiRouter("/vehicles"), async (req: Request, res: Response) => {
    try {
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      // Variable para almacenar el companyId para filtrar vehículos
      let companyId: string | null = null;
      
      // Si hay usuario autenticado y no es admin/superAdmin/developer, aplicamos filtro por compañía
      if (user) {
        if (user.role === UserRole.OWNER || 
            user.role === UserRole.CALL_CENTER || 
            user.role === UserRole.CHECKER ||
            user.role === UserRole.DRIVER ||
            user.role === UserRole.TICKET_OFFICE) {
          
          companyId = user.companyId || user.company;
          console.log(`Filtrando vehículos por compañía: ${companyId} para usuario ${user.firstName} ${user.lastName}`);
        }
      }
      
      // Obtener todos los vehículos
      let vehicles = await storage.getVehicles();
      
      // Si es necesario filtrar por compañía
      if (companyId) {
        vehicles = vehicles.filter(vehicle => vehicle.companyId === companyId);
        console.log(`Filtrados ${vehicles.length} vehículos para la compañía ${companyId}`);
      }
      
      res.json(vehicles);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      res.status(500).json({ error: "Failed to fetch vehicles" });
    }
  });

  app.get(apiRouter("/vehicles/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const vehicle = await storage.getVehicle(id);
      
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      
      // Obtener el usuario autenticado
      const { user } = req as any;
      
      // Variable para almacenar el companyId para verificar permisos
      let companyId: string | null = null;
      
      // Si hay usuario autenticado y no es admin/superAdmin/developer, verificamos permiso
      if (user) {
        if (user.role === UserRole.OWNER || 
            user.role === UserRole.CALL_CENTER || 
            user.role === UserRole.CHECKER ||
            user.role === UserRole.DRIVER ||
            user.role === UserRole.TICKET_OFFICE) {
          
          companyId = user.companyId || user.company;
          
          // Si el vehículo tiene companyId y no coincide con la del usuario
          if (vehicle.companyId && vehicle.companyId !== companyId) {
            return res.status(403).json({ 
              error: "No tiene permiso para acceder a este vehículo" 
            });
          }
        }
      }
      
      res.json(vehicle);
    } catch (error) {
      console.error("Error fetching vehicle:", error);
      res.status(500).json({ error: "Failed to fetch vehicle" });
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
      
      // Obtener companyId del usuario
      let companyId = null;
      if (user) {
        companyId = user.companyId || user.company;
        console.log(`Asignando vehículo a la compañía: ${companyId} del usuario ${user.firstName} ${user.lastName}`);
      }
      
      // Crear objeto con datos del vehículo más el companyId
      const vehicleData = {
        ...req.body,
        companyId: companyId
      };
      
      const vehicle = await storage.createVehicle(vehicleData);
      res.status(201).json(vehicle);
    } catch (error) {
      console.error("Error creating vehicle:", error);
      res.status(500).json({ error: "Failed to create vehicle" });
    }
  });

  app.put(apiRouter("/vehicles/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      // El objeto completo está en req.body, no en req.body.data
      const vehicle = await storage.updateVehicle(id, req.body);
      
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      
      res.json(vehicle);
    } catch (error) {
      console.error("Error updating vehicle:", error);
      res.status(500).json({ error: "Failed to update vehicle" });
    }
  });

  app.delete(apiRouter("/vehicles/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const success = await storage.deleteVehicle(id);
      
      if (!success) {
        return res.status(404).json({ error: "Vehicle not found" });
      }
      
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete vehicle" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
