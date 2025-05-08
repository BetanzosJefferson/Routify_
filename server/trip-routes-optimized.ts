import { Express, Request, Response } from 'express';
import { isAuthenticated } from './authMiddleware';
import { optimizedTripStorage } from './trip-storage-optimized';
import { UserRole, publishTripValidationSchema } from '@shared/schema';
import { calculateProportionalPrice, calculateSegmentTimes, generateAllPossibleSegments, isSameCity } from './trip-utils';

/**
 * Registrar rutas optimizadas para la gestión de viajes
 * Esta implementación reduce la cantidad de registros en la base de datos
 */
export function registerOptimizedTripRoutes(app: Express, apiRouter: (path: string) => string) {
  // Endpoint para crear viajes optimizados (menos registros)
  app.post(apiRouter("/trips-optimized"), isAuthenticated, async (req: Request, res: Response) => {
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
      
      console.log(`[POST /trips-optimized] Usuario: ${user.firstName} ${user.lastName}, Rol: ${user.role}`);
      
      // SEGURIDAD: Verificar que el usuario tenga una compañía asignada
      let companyId = user.companyId || user.company || null;
      
      if (!companyId) {
        console.log(`[POST /trips-optimized] ERROR: Usuario sin companyId intenta crear un viaje`);
        return res.status(403).json({
          error: "No puede crear viajes",
          details: "El usuario no tiene una compañía asignada"
        });
      }
      
      console.log(`[POST /trips-optimized] CREANDO VIAJE PARA COMPAÑÍA: ${companyId} del usuario ${user.firstName} ${user.lastName}`);
      
      // Verificar que el usuario tenga permisos para crear viajes
      const allowedRoles = [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.OWNER, UserRole.DEVELOPER];
      
      if (!allowedRoles.includes(user.role)) {
        console.log(`[POST /trips-optimized] DENEGADO: Usuario con rol ${user.role} no tiene permisos para crear viajes`);
        return res.status(403).json({
          error: "Acceso denegado",
          details: "No tiene permisos para crear viajes"
        });
      }
      
      const tripData = validationResult.data;
      
      // Obtener la ruta completa para determinar la secuencia de paradas
      const stopSequence = await optimizedTripStorage.getRouteStopSequence(tripData.routeId);
      
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
      if (!departureTime) departureTime = "08:00 AM";
      if (!arrivalTime) arrivalTime = "02:00 PM";
      
      // Create a trip for each date in the range
      const startDate = new Date(tripData.startDate);
      const endDate = new Date(tripData.endDate);
      const createdTrips = [];
      
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        // Buscar el precio del segmento de origen a destino final para usarlo como precio principal
        const mainSegmentPrice = tripData.segmentPrices.find(
          (sp: any) => sp.origin === stopSequence[0] && sp.destination === stopSequence[stopSequence.length - 1]
        );
        
        // Crear viaje principal
        const tripMasterData = {
          routeId: tripData.routeId,
          departureDate: new Date(date),
          capacity: tripData.capacity,
          availableSeats: tripData.capacity,
          price: mainSegmentPrice?.price || 450, // Usar el precio del segmento principal o un valor por defecto
          departureTime,
          arrivalTime,
          companyId,
          vehicleId: tripData.vehicleId || null,
          driverId: tripData.driverId || null
        };
        
        // Generar los segmentos
        const segmentsToCreate = [];
        
        // 1. Primero agregamos los segmentos directos (entre paradas consecutivas)
        for (let i = 0; i < stopSequence.length - 1; i++) {
          const origin = stopSequence[i];
          const destination = stopSequence[i + 1];
          
          // Buscar precio y tiempos específicos del segmento
          const segmentData = tripData.segmentPrices.find(
            (sp: any) => sp.origin === origin && sp.destination === destination
          );
          
          let segmentDepartureTime = '';
          let segmentArrivalTime = '';
          let segmentPrice = 0;
          
          if (segmentData) {
            segmentPrice = segmentData.price;
            segmentDepartureTime = segmentData.departureTime || '';
            segmentArrivalTime = segmentData.arrivalTime || '';
          } else {
            // Calcular proporcionalmente
            segmentPrice = calculateProportionalPrice(
              { origin, destination, price: 0 },
              { origin: stopSequence[0], destination: stopSequence[stopSequence.length - 1], stops: stopSequence.slice(1, -1) },
              tripMasterData.price
            );
          }
          
          segmentsToCreate.push({
            tripMasterId: 0, // Se asignará después
            originStopIndex: i,
            destinationStopIndex: i + 1,
            origin,
            destination,
            price: segmentPrice,
            departureTime: segmentDepartureTime,
            arrivalTime: segmentArrivalTime,
            isDirectSegment: true
          });
        }
        
        // 2. Luego agregar segmentos significativos (no entre todas las paradas)
        // Estos son segmentos que abarcan múltiples paradas consecutivas
        for (let i = 0; i < stopSequence.length - 2; i++) {
          for (let j = i + 2; j < stopSequence.length; j++) {
            const origin = stopSequence[i];
            const destination = stopSequence[j];
            
            // Saltamos los segmentos donde origen y destino están en la misma ciudad
            if (isSameCity(origin, destination)) {
              continue;
            }
            
            // Determinar si es un segmento significativo
            const isFirstToLast = i === 0 && j === stopSequence.length - 1;
            const isShortRoute = stopSequence.length <= 4; // Rutas con pocas paradas
            
            // Solo incluir segmentos significativos o si la ruta tiene pocas paradas
            if (!isFirstToLast && !isShortRoute && j - i <= 2) {
              continue; // Saltar segmentos no significativos
            }
            
            // Buscar precio y tiempos específicos del segmento
            const segmentData = tripData.segmentPrices.find(
              (sp: any) => sp.origin === origin && sp.destination === destination
            );
            
            let segmentDepartureTime = '';
            let segmentArrivalTime = '';
            let segmentPrice = 0;
            
            if (segmentData) {
              segmentPrice = segmentData.price;
              segmentDepartureTime = segmentData.departureTime || '';
              segmentArrivalTime = segmentData.arrivalTime || '';
            } else {
              // Calcular proporcionalmente
              segmentPrice = calculateProportionalPrice(
                { origin, destination, price: 0 },
                { origin: stopSequence[0], destination: stopSequence[stopSequence.length - 1], stops: stopSequence.slice(1, -1) },
                tripMasterData.price
              );
            }
            
            segmentsToCreate.push({
              tripMasterId: 0, // Se asignará después
              originStopIndex: i,
              destinationStopIndex: j,
              origin,
              destination,
              price: segmentPrice,
              departureTime: segmentDepartureTime,
              arrivalTime: segmentArrivalTime,
              isDirectSegment: false
            });
          }
        }
        
        // Crear el viaje principal y sus segmentos
        try {
          const createdTrip = await optimizedTripStorage.createTrip(tripMasterData, segmentsToCreate);
          createdTrips.push(createdTrip);
          console.log(`Viaje optimizado creado con ID ${createdTrip.id} con ${segmentsToCreate.length} segmentos`);
        } catch (error) {
          console.error('Error al crear viaje optimizado:', error);
        }
      }
      
      res.status(201).json({
        message: "Viajes creados correctamente (modelo optimizado)",
        totalTrips: createdTrips.length,
        firstTrip: createdTrips[0]
      });
    } catch (error) {
      console.error("Error creating optimized trips:", error);
      res.status(500).json({ error: "Failed to create optimized trip" });
    }
  });

  // Endpoint para obtener viajes optimizados
  app.get(apiRouter("/trips-optimized"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      // Construir filtros basados en permisos y parámetros
      const filters: { companyId?: string; startDate?: Date; endDate?: Date; routeId?: number } = {};
      
      // Filtrar por compañía si el usuario no es superadmin
      if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.DEVELOPER) {
        filters.companyId = user.companyId || user.company;
      }
      
      // Aplicar filtros adicionales desde la consulta
      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
      }
      
      if (req.query.routeId) {
        filters.routeId = parseInt(req.query.routeId as string);
      }
      
      const trips = await optimizedTripStorage.getTrips(filters);
      
      res.json(trips);
    } catch (error) {
      console.error("Error getting optimized trips:", error);
      res.status(500).json({ error: "Failed to get optimized trips" });
    }
  });

  // Endpoint para obtener un viaje optimizado con sus segmentos
  app.get(apiRouter("/trips-optimized/:id"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tripId = parseInt(req.params.id);
      if (isNaN(tripId)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }
      
      const trip = await optimizedTripStorage.getTripWithSegments(tripId);
      
      // Verificar permisos de acceso
      const { user } = req as any;
      if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.DEVELOPER) {
        if (trip.companyId !== user.companyId && trip.companyId !== user.company) {
          return res.status(403).json({ error: "Access denied to this trip" });
        }
      }
      
      res.json(trip);
    } catch (error) {
      console.error(`Error getting optimized trip: ${error}`);
      res.status(500).json({ error: "Failed to get optimized trip" });
    }
  });

  // Endpoint para eliminar un viaje optimizado
  app.delete(apiRouter("/trips-optimized/:id"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tripId = parseInt(req.params.id);
      if (isNaN(tripId)) {
        return res.status(400).json({ error: "Invalid trip ID" });
      }
      
      // Obtener el viaje para verificar permisos
      const trip = await optimizedTripStorage.getTripWithSegments(tripId);
      
      // Verificar permisos de acceso
      const { user } = req as any;
      if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.DEVELOPER) {
        if (trip.companyId !== user.companyId && trip.companyId !== user.company) {
          return res.status(403).json({ error: "Access denied to delete this trip" });
        }
      }
      
      await optimizedTripStorage.deleteTrip(tripId);
      res.status(204).send();
    } catch (error) {
      console.error(`Error deleting optimized trip: ${error}`);
      res.status(500).json({ error: "Failed to delete optimized trip" });
    }
  });
}