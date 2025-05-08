import { Request, Response } from "express";
import { optimizedTripStorage } from "./trip-storage-optimized";
import { optimizedReservationStorage } from "./reservation-storage-optimized";
import { TripMaster, InsertTripMaster, TripSegment, InsertTripSegment, RouteWithSegments } from "@shared/schema";
import { db } from "./db";
import { routes, users, vehicles } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Registra las rutas relacionadas con viajes optimizados
 * @param app Aplicación Express
 * @param apiRouter Función para generar rutas de API
 */
export function registerOptimizedTripRoutes(
  app: any, 
  apiRouter: (path: string) => string,
  isAuthenticated: any
) {
  // Obtener todos los viajes (con filtros opcionales)
  app.get(apiRouter("/optimized/trips"), async (req: Request, res: Response) => {
    try {
      const { 
        companyId, 
        startDate, 
        endDate, 
        routeId,
        archived = false
      } = req.query;
      
      const filters: any = {
        archived: archived === 'true'
      };
      
      if (companyId) filters.companyId = companyId as string;
      if (routeId) filters.routeId = parseInt(routeId as string);
      
      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }
      
      if (endDate) {
        filters.endDate = new Date(endDate as string);
      }
      
      const trips = await optimizedTripStorage.getTrips(filters);
      
      // Realizar búsquedas adicionales para enriquecer la respuesta
      const enrichedTrips = await Promise.all(
        trips.map(async (trip) => {
          const route = await db.query.routes.findFirst({
            where: eq(routes.id, trip.routeId)
          });
          
          let vehicle = null;
          if (trip.vehicleId) {
            vehicle = await db.query.vehicles.findFirst({
              where: eq(vehicles.id, trip.vehicleId)
            });
          }
          
          let driver = null;
          if (trip.driverId) {
            driver = await db.query.users.findFirst({
              where: eq(users.id, trip.driverId)
            });
          }
          
          return {
            ...trip,
            route,
            vehicle,
            driver
          };
        })
      );
      
      res.json(enrichedTrips);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Obtener un viaje específico con todos sus segmentos
  app.get(apiRouter("/optimized/trips/:id"), async (req: Request, res: Response) => {
    try {
      const tripId = parseInt(req.params.id);
      const tripWithSegments = await optimizedTripStorage.getTripWithSegments(tripId);
      
      // Enriquecer con datos adicionales
      let vehicle = null;
      if (tripWithSegments.vehicleId) {
        vehicle = await db.query.vehicles.findFirst({
          where: eq(vehicles.id, tripWithSegments.vehicleId)
        });
      }
      
      let driver = null;
      if (tripWithSegments.driverId) {
        driver = await db.query.users.findFirst({
          where: eq(users.id, tripWithSegments.driverId)
        });
      }
      
      const enrichedTrip = {
        ...tripWithSegments,
        vehicle,
        driver
      };
      
      res.json(enrichedTrip);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Crear un nuevo viaje optimizado
  app.post(apiRouter("/optimized/trips"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const { tripMaster, segments, routeId } = req.body;
      
      console.log("[POST /optimized/trips] Datos recibidos:", { 
        tripMaster, 
        segmentsLength: segments.length,
        routeId 
      });
      
      // Verificar que la ruta existe
      const route = await db.query.routes.findFirst({
        where: eq(routes.id, routeId)
      });
      
      if (!route) {
        return res.status(404).json({ error: `Ruta con ID ${routeId} no encontrada` });
      }
      
      // Asegurarse de que la fecha es correcta
      let departureDate: Date;
      
      console.log("[POST /optimized/trips] Tipo de departureDate:", typeof tripMaster.departureDate);
      
      if (typeof tripMaster.departureDate === 'string') {
        try {
          departureDate = new Date(tripMaster.departureDate);
          
          // Verificar que la fecha es válida
          if (isNaN(departureDate.getTime())) {
            throw new Error("Fecha inválida");
          }
        } catch (error) {
          console.error("[POST /optimized/trips] Error al convertir fecha:", error);
          return res.status(400).json({ error: "Formato de fecha inválido" });
        }
      } else if (tripMaster.departureDate instanceof Date) {
        departureDate = tripMaster.departureDate;
      } else {
        return res.status(400).json({ error: "Se requiere una fecha de salida válida" });
      }
      
      // Si el usuario está autenticado, asignar su compañía al viaje
      let companyId = tripMaster.companyId || null;
      if (req.user && req.user.company) {
        companyId = req.user.company;
      }
      
      // Crear el viaje master con los datos validados
      const tripData: Omit<InsertTripMaster, "id"> = {
        routeId: route.id,
        departureDate,
        capacity: tripMaster.capacity,
        availableSeats: tripMaster.availableSeats || tripMaster.capacity,
        price: tripMaster.price,
        departureTime: tripMaster.departureTime || null,
        arrivalTime: tripMaster.arrivalTime || null,
        vehicleId: tripMaster.vehicleId || null,
        driverId: tripMaster.driverId || null,
        companyId: companyId,
        archived: false,
        createdAt: new Date()
      };
      
      // Verificar que hay segmentos y que tienen los datos necesarios
      if (!segments || !Array.isArray(segments) || segments.length === 0) {
        return res.status(400).json({ error: "Se requiere al menos un segmento para crear el viaje" });
      }
      
      console.log("[POST /optimized/trips] Validando segmentos:", segments.length);
      
      // Crear segmentos asegurando que todos los campos requeridos estén presentes
      const segmentDataList: Omit<InsertTripSegment, "id">[] = segments.map(
        (segment: any, index: number) => ({
          originStopIndex: segment.originStopIndex || 0,
          destinationStopIndex: segment.destinationStopIndex || index + 1,
          origin: segment.origin || "Origen desconocido",
          destination: segment.destination || "Destino desconocido",
          price: segment.price || 0,
          availableSeats: segment.availableSeats || tripMaster.capacity || 18,
          departureTime: segment.departureTime || null,
          arrivalTime: segment.arrivalTime || null,
          isDirectSegment: segment.isDirectSegment || false,
          createdAt: new Date()
          // No incluimos tripMasterId aquí porque se asignará en createTrip
        })
      );
      
      const createdTrip = await optimizedTripStorage.createTrip(tripData, segmentDataList);
      
      res.status(201).json(createdTrip);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Actualizar un viaje existente
  app.put(apiRouter("/optimized/trips/:id"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tripId = parseInt(req.params.id);
      const tripData = req.body;
      
      const updatedTrip = await optimizedTripStorage.updateTrip(tripId, tripData);
      
      res.json(updatedTrip);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Eliminar un viaje
  app.delete(apiRouter("/optimized/trips/:id"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tripId = parseInt(req.params.id);
      
      const success = await optimizedTripStorage.deleteTrip(tripId);
      
      if (success) {
        res.json({ message: `Viaje con ID ${tripId} eliminado correctamente` });
      } else {
        res.status(404).json({ error: `No se pudo eliminar el viaje con ID ${tripId}` });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Archivar un viaje (marcarlo como completado)
  app.post(apiRouter("/optimized/trips/:id/archive"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tripId = parseInt(req.params.id);
      
      const archivedTrip = await optimizedTripStorage.archiveTrip(tripId);
      
      res.json({
        message: `Viaje con ID ${tripId} archivado correctamente`,
        trip: archivedTrip
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Asignar vehículo y/o conductor a un viaje
  app.post(apiRouter("/optimized/trips/:id/assign"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const tripId = parseInt(req.params.id);
      const { vehicleId, driverId } = req.body;
      
      const updatedTrip = await optimizedTripStorage.assignVehicleAndDriver(
        tripId,
        vehicleId,
        driverId
      );
      
      res.json({
        message: `Asignación actualizada para el viaje con ID ${tripId}`,
        trip: updatedTrip
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Obtener reservaciones de un viaje
  app.get(apiRouter("/optimized/trips/:id/reservations"), async (req: Request, res: Response) => {
    try {
      const tripId = parseInt(req.params.id);
      
      const reservations = await optimizedReservationStorage.getReservations({}, tripId);
      
      res.json(reservations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Verificar disponibilidad de asientos para un segmento específico
  app.get(apiRouter("/optimized/trips/:id/availability"), async (req: Request, res: Response) => {
    try {
      const tripId = parseInt(req.params.id);
      const { originIndex, destinationIndex } = req.query;
      
      if (!originIndex || !destinationIndex) {
        return res.status(400).json({ error: "Se requieren los índices de origen y destino" });
      }
      
      const availableSeats = await optimizedTripStorage.calculateSegmentAvailability(
        tripId,
        parseInt(originIndex as string),
        parseInt(destinationIndex as string)
      );
      
      res.json({ availableSeats });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // =====================================
  // RUTAS PARA RESERVACIONES OPTIMIZADAS
  // =====================================
  
  // Crear una nueva reservación
  app.post(apiRouter("/optimized/reservations"), async (req: Request, res: Response) => {
    try {
      const { reservation, passengers } = req.body;
      
      const createdReservation = await optimizedReservationStorage.createReservation(
        reservation,
        passengers
      );
      
      res.status(201).json(createdReservation);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Obtener una reservación específica con todos sus detalles
  app.get(apiRouter("/optimized/reservations/:id"), async (req: Request, res: Response) => {
    try {
      const reservationId = parseInt(req.params.id);
      
      const reservation = await optimizedReservationStorage.getReservationWithDetails(reservationId);
      
      if (!reservation) {
        return res.status(404).json({ error: `Reservación con ID ${reservationId} no encontrada` });
      }
      
      res.json(reservation);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Obtener todas las reservaciones con filtros opcionales
  app.get(apiRouter("/optimized/reservations"), async (req: Request, res: Response) => {
    try {
      const { 
        companyId, 
        status, 
        paymentStatus, 
        startDate, 
        endDate,
        createdBy 
      } = req.query;
      
      const filters: any = {};
      
      if (companyId) filters.companyId = companyId as string;
      if (status) filters.status = status as string;
      if (paymentStatus) filters.paymentStatus = paymentStatus as string;
      if (createdBy) filters.createdBy = parseInt(createdBy as string);
      
      if (startDate) {
        filters.startDate = new Date(startDate as string);
      }
      
      if (endDate) {
        filters.endDate = new Date(endDate as string);
      }
      
      const reservations = await optimizedReservationStorage.getReservations(filters);
      
      res.json(reservations);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Actualizar el estado de una reservación
  app.patch(apiRouter("/optimized/reservations/:id/status"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const reservationId = parseInt(req.params.id);
      const { status } = req.body;
      
      const updatedReservation = await optimizedReservationStorage.updateReservationStatus(
        reservationId,
        status
      );
      
      res.json({
        message: `Estado de la reservación con ID ${reservationId} actualizado a "${status}"`,
        reservation: updatedReservation
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Actualizar el estado de pago de una reservación
  app.patch(apiRouter("/optimized/reservations/:id/payment"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const reservationId = parseInt(req.params.id);
      const { paymentStatus, paidBy } = req.body;
      
      const updatedReservation = await optimizedReservationStorage.updatePaymentStatus(
        reservationId,
        paymentStatus,
        paidBy
      );
      
      res.json({
        message: `Estado de pago de la reservación con ID ${reservationId} actualizado a "${paymentStatus}"`,
        reservation: updatedReservation
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Marcar una reservación como escaneada/verificada
  app.patch(apiRouter("/optimized/reservations/:id/check"), isAuthenticated, async (req: Request, res: Response) => {
    try {
      const reservationId = parseInt(req.params.id);
      const { checkedBy } = req.body;
      
      const updatedReservation = await optimizedReservationStorage.markAsChecked(
        reservationId,
        checkedBy
      );
      
      res.json({
        message: `Reservación con ID ${reservationId} marcada como escaneada/verificada`,
        reservation: updatedReservation
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}