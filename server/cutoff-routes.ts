import { Express, Request, Response } from "express";
import { cutoffService } from "./cutoff-service";

/**
 * Middleware de autenticación
 */
function isAuthenticated(req: Request, res: Response, next: any) {
  if (!(req as any).user) {
    return res.status(401).json({ message: "No autenticado" });
  }
  next();
}

/**
 * Registra las rutas relacionadas con los cortes de caja
 */
export function registerCutoffRoutes(app: Express) {
  
  // POST /api/cutoffs - Crear un nuevo corte
  app.post('/api/cutoffs', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const { notes, items } = req.body;
      
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Se requiere al menos un elemento para realizar el corte"
        });
      }
      
      console.log(`[POST /cutoffs] Usuario ${user.firstName} ${user.lastName} realizando corte con ${items.length} elementos`);
      
      const result = await cutoffService.createCutoff(user.id, items, notes);
      
      if (result.success) {
        res.json({
          success: true,
          message: "Corte realizado con éxito",
          cutoffId: result.cutoffId
        });
      } else {
        res.status(500).json({
          success: false,
          message: result.message || "Error al realizar el corte"
        });
      }
    } catch (error) {
      console.error(`[POST /cutoffs] Error:`, error);
      res.status(500).json({
        success: false,
        message: "Error al procesar la solicitud"
      });
    }
  });
  
  // GET /api/cutoffs - Obtener todos los cortes del usuario
  app.get('/api/cutoffs', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      
      console.log(`[GET /cutoffs] Usuario ${user.firstName} ${user.lastName} solicitando sus cortes`);
      
      const cutoffs = await cutoffService.getCutoffsByOperator(user.id);
      
      res.json(cutoffs);
    } catch (error) {
      console.error(`[GET /cutoffs] Error:`, error);
      res.status(500).json({
        success: false,
        message: "Error al obtener los cortes"
      });
    }
  });
  
  // GET /api/cutoffs/:id - Obtener un corte específico con sus elementos y datos enriquecidos
  app.get('/api/cutoffs/:id', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { user } = req as any;
      const cutoffId = parseInt(req.params.id);
      
      if (isNaN(cutoffId)) {
        return res.status(400).json({
          success: false,
          message: "ID de corte inválido"
        });
      }
      
      console.log(`[GET /cutoffs/${cutoffId}] Usuario ${user.firstName} ${user.lastName} solicitando detalles del corte`);
      
      // Obtener los datos básicos del corte
      const result = await cutoffService.getCutoffDetails(cutoffId);
      
      // Verificar que el corte exista
      if (!result.cutoff) {
        return res.status(404).json({
          success: false,
          message: "Corte no encontrado"
        });
      }
      
      // Verificar que el usuario sea el propietario del corte o tenga permisos administrativos
      if (result.cutoff.operatorId !== user.id && !['admin', 'superAdmin', 'dueño'].includes(user.role)) {
        return res.status(403).json({
          success: false,
          message: "No tienes permiso para ver este corte"
        });
      }
      
      // SOLUCIÓN DEFINITIVA: Enriquecer cada elemento del corte con datos actualizados
      // Este proceso garantiza que siempre tengamos la información más actualizada
      // para cada reservación o paquete, independientemente de lo que se haya guardado originalmente
      
      // Crear una copia profunda del resultado para no modificar los datos originales
      const enrichedResult = {
        cutoff: result.cutoff,
        items: await Promise.all(result.items.map(async (item) => {
          // Si es una reservación, obtener datos actualizados directamente de la BD
          if (item.itemType === 'reservation' && item.itemId) {
            try {
              // Parsear los detalles guardados originalmente
              let details = {};
              try {
                details = JSON.parse(item.details);
              } catch (e) {
                console.error(`[GET /cutoffs/${cutoffId}] Error al parsear detalles:`, e);
              }
              
              // Obtener datos completos y actualizados de la reservación directamente de la BD
              const reservationData = await db.query.reservations.findFirst({
                where: eq(schema.reservations.id, item.itemId),
                with: {
                  trip: {
                    with: {
                      route: true
                    }
                  }
                }
              });
              
              // Si encontramos la reservación y el viaje asociado
              if (reservationData && reservationData.trip) {
                // Verificar si es un subviaje
                const isSubtrip = !!reservationData.trip.parentTripId;
                let origin = '';
                let destination = '';
                let routeName = '';
                
                // Procesamiento específico para subviajes
                if (isSubtrip) {
                  console.log(`[GET /cutoffs/${cutoffId}] Ítem ${item.itemId}: ES UN SUBVIAJE`);
                  
                  // Para subviajes, usar directamente segmentOrigin/segmentDestination
                  origin = reservationData.trip.segmentOrigin || '';
                  destination = reservationData.trip.segmentDestination || '';
                  
                  // Obtener datos de la ruta desde el viaje principal
                  if (reservationData.trip.parentTripId) {
                    const parentTrip = await db.query.trips.findFirst({
                      where: eq(schema.trips.id, reservationData.trip.parentTripId),
                      with: {
                        route: true
                      }
                    });
                    
                    if (parentTrip && parentTrip.route) {
                      routeName = parentTrip.route.name || '';
                    }
                  }
                } 
                // Procesamiento para viajes normales
                else if (reservationData.trip.route) {
                  console.log(`[GET /cutoffs/${cutoffId}] Ítem ${item.itemId}: ES UN VIAJE NORMAL`);
                  
                  // Verificar si hay segmentos específicos
                  const hasSegmentOrigin = reservationData.trip.segmentOrigin && reservationData.trip.segmentOrigin.trim() !== '';
                  const hasSegmentDestination = reservationData.trip.segmentDestination && reservationData.trip.segmentDestination.trim() !== '';
                  
                  // Aplicar la misma lógica de priorización que en la UI
                  origin = hasSegmentOrigin ? reservationData.trip.segmentOrigin : (reservationData.trip.route.origin || '');
                  destination = hasSegmentDestination ? reservationData.trip.segmentDestination : (reservationData.trip.route.destination || '');
                  routeName = reservationData.trip.route.name || '';
                }
                
                // Obtener los pasajeros actualizados
                const passengers = await db
                  .select({
                    firstName: schema.passengers.firstName,
                    lastName: schema.passengers.lastName
                  })
                  .from(schema.passengers)
                  .where(eq(schema.passengers.reservationId, item.itemId));
                
                console.log(`[GET /cutoffs/${cutoffId}] Datos actualizados para ítem ${item.itemId}:`, {
                  origin,
                  destination,
                  routeName,
                  pasajeros: passengers.length
                });
                
                // Crear un objeto con detalles actualizados
                const updatedDetails = {
                  ...details,
                  tripName: routeName,
                  origin: origin,
                  destination: destination,
                  departureDate: reservationData.trip.departureDate || '',
                  departureTime: reservationData.trip.departureTime || '',
                  passengers: passengers.map(p => ({
                    firstName: p.firstName || '',
                    lastName: p.lastName || ''
                  }))
                };
                
                // Devolver item enriquecido con datos actualizados
                return {
                  ...item,
                  details: JSON.stringify(updatedDetails)
                };
              }
            } catch (err) {
              console.error(`[GET /cutoffs/${cutoffId}] Error al obtener datos actualizados:`, err);
            }
          }
          
          // Si no es una reservación o hubo un error, devolver el item original
          return item;
        }))
      };
      
      res.json(enrichedResult);
    } catch (error) {
      console.error(`[GET /cutoffs/:id] Error:`, error);
      res.status(500).json({
        success: false,
        message: "Error al obtener los detalles del corte"
      });
    }
  });
  
  // GET /api/cash-register/check - Verificar si un elemento ya ha sido procesado
  app.get('/api/cash-register/check', isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { itemType, itemId } = req.query;
      
      if (!itemType || !itemId) {
        return res.status(400).json({
          success: false,
          message: "Se requiere tipo y ID del elemento"
        });
      }
      
      const processed = await cutoffService.isItemProcessed(
        itemType as string,
        parseInt(itemId as string)
      );
      
      res.json({
        success: true,
        processed
      });
    } catch (error) {
      console.error(`[GET /cash-register/check] Error:`, error);
      res.status(500).json({
        success: false,
        message: "Error al verificar el elemento"
      });
    }
  });
}