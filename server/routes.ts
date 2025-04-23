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
  createReservationValidationSchema
} from "@shared/schema";
import { isSameCity } from "../client/src/lib/utils";

export async function registerRoutes(app: Express): Promise<Server> {
  // prefix all routes with /api
  const apiRouter = (path: string) => `/api${path}`;

  // ROUTES ENDPOINTS
  app.get(apiRouter("/routes"), async (req: Request, res: Response) => {
    try {
      const routes = await storage.getRoutes();
      res.json(routes);
    } catch (error) {
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

  app.post(apiRouter("/routes"), async (req: Request, res: Response) => {
    try {
      const validationResult = createRouteValidationSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid route data", 
          details: validationResult.error.format() 
        });
      }
      
      const routeData = validationResult.data;
      const route = await storage.createRoute(routeData);
      res.status(201).json(route);
    } catch (error) {
      res.status(500).json({ error: "Failed to create route" });
    }
  });

  app.put(apiRouter("/routes/:id"), async (req: Request, res: Response) => {
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

  app.delete(apiRouter("/routes/:id"), async (req: Request, res: Response) => {
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
      // Check if query parameters for search are provided
      const { origin, destination, date, seats } = req.query;
      
      if (origin || destination || date || seats) {
        const searchParams: any = {};
        if (origin) searchParams.origin = origin as string;
        if (destination) searchParams.destination = destination as string;
        if (date) searchParams.date = date as string;
        if (seats) searchParams.seats = parseInt(seats as string, 10);
        
        const trips = await storage.searchTrips(searchParams);
        return res.json(trips);
      }
      
      const trips = await storage.getTrips();
      res.json(trips);
    } catch (error) {
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
      
      res.json(trip);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch trip" });
    }
  });

  app.post(apiRouter("/trips"), async (req: Request, res: Response) => {
    try {
      const validationResult = publishTripValidationSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid trip data", 
          details: validationResult.error.format() 
        });
      }
      
      const tripData = validationResult.data;
      
      // Convert time format
      const departureTime = `${tripData.departureHour.padStart(2, '0')}:${tripData.departureMinute.padStart(2, '0')} ${tripData.departureAmPm}`;
      const arrivalTime = `${tripData.arrivalHour.padStart(2, '0')}:${tripData.arrivalMinute.padStart(2, '0')} ${tripData.arrivalAmPm}`;
      
      // Create a trip for each date in the range
      const startDate = new Date(tripData.startDate);
      const endDate = new Date(tripData.endDate);
      const createdTrips = [];
      
      for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
        const tripToCreate = {
          routeId: tripData.routeId,
          departureDate: new Date(date),
          departureTime,
          arrivalTime,
          capacity: tripData.capacity,
          availableSeats: tripData.capacity,
          price: tripData.price,
          vehicleType: tripData.vehicleType,
          segmentPrices: tripData.segmentPrices
        };
        
        const trip = await storage.createTrip(tripToCreate);
        createdTrips.push(trip);
      }
      
      res.status(201).json(createdTrips);
    } catch (error) {
      res.status(500).json({ error: "Failed to create trip" });
    }
  });

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
      
      const tripData = validationResult.data;
      const updatedTrip = await storage.updateTrip(id, tripData);
      
      if (!updatedTrip) {
        return res.status(404).json({ error: "Trip not found" });
      }
      
      res.json(updatedTrip);
    } catch (error) {
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
      const reservations = await storage.getReservations();
      res.json(reservations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reservations" });
    }
  });

  app.get(apiRouter("/reservations/:id"), async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id, 10);
      const reservation = await storage.getReservationWithDetails(id);
      
      if (!reservation) {
        return res.status(404).json({ error: "Reservation not found" });
      }
      
      res.json(reservation);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch reservation" });
    }
  });

  app.post(apiRouter("/reservations"), async (req: Request, res: Response) => {
    try {
      const validationResult = createReservationValidationSchema.safeParse(req.body);
      
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
      
      // Update available seats on the trip
      await storage.updateTrip(trip.id, {
        availableSeats: trip.availableSeats - passengerCount
      });
      
      res.status(201).json({
        ...reservation,
        passengers
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to create reservation" });
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

  const httpServer = createServer(app);
  return httpServer;
}
