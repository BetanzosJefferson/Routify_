import * as schema from "@shared/schema";
import { 
  Route, 
  InsertRoute, 
  Trip, 
  InsertTrip, 
  Reservation, 
  InsertReservation, 
  Passenger, 
  InsertPassenger,
  RouteWithSegments,
  TripWithRouteInfo,
  ReservationWithDetails,
  SegmentPrice,
  Vehicle,
  InsertVehicle,
  Commission,
  InsertCommission,
  User,
  Coupon,
  InsertCoupon,
  InsertNotification,
  Notification,
  ReservationRequest,
  TripBudget,
  InsertTripBudget,
  TripExpense,
  InsertTripExpense,
  // Referencias a caja registradora eliminadas
} from "@shared/schema";

export interface IStorage {
  // Route methods
  getRoutes(companyId?: string): Promise<Route[]>;
  getRoute(id: number): Promise<Route | undefined>;
  createRoute(route: InsertRoute): Promise<Route>;
  updateRoute(id: number, route: Partial<Route>): Promise<Route | undefined>;
  deleteRoute(id: number): Promise<boolean>;
  getRouteWithSegments(id: number): Promise<RouteWithSegments | undefined>;

  // Presupuestos de operadores
  getTripBudget(tripId: number): Promise<TripBudget | undefined>;
  createTripBudget(budget: InsertTripBudget): Promise<TripBudget>;
  updateTripBudget(tripId: number, amount: number): Promise<TripBudget | undefined>;
  
  // Gastos de viaje
  getTripExpenses(tripId: number): Promise<TripExpense[]>;
  createTripExpense(expense: InsertTripExpense): Promise<TripExpense>;
  updateTripExpense(id: number, expense: Partial<TripExpense>): Promise<TripExpense | undefined>;
  deleteTripExpense(id: number): Promise<boolean>;
  
  // Sistema de Cajas y operaciones de caja han sido eliminados
  
  // Trip methods
  getTrips(companyId?: string): Promise<TripWithRouteInfo[]>;
  getTrip(id: number): Promise<Trip | undefined>;
  getTripWithRouteInfo(id: number): Promise<TripWithRouteInfo | undefined>;
  createTrip(trip: InsertTrip): Promise<Trip>;
  updateTrip(id: number, trip: Partial<Trip>): Promise<Trip | undefined>;
  deleteTrip(id: number): Promise<boolean>;
  searchTrips(params: {
    origin?: string;
    destination?: string;
    date?: string;
    seats?: number;
    companyId?: string | null;
  }): Promise<TripWithRouteInfo[]>;
  updateRelatedTripsAvailability(tripId: number, seatChange: number): Promise<void>;
  
  // Reservation methods
  getReservations(companyId?: string, tripId?: number, companyIds?: string[], dateFilter?: string): Promise<ReservationWithDetails[]>;
  getReservation(id: number): Promise<Reservation | undefined>;
  getReservationWithDetails(id: number, companyId?: string): Promise<ReservationWithDetails | undefined>;
  createReservation(reservation: InsertReservation): Promise<Reservation>;
  updateReservation(id: number, reservation: Partial<Reservation>): Promise<Reservation | undefined>;
  deleteReservation(id: number): Promise<boolean>;
  getPaidReservationsByUser(userId: number): Promise<ReservationWithDetails[]>;
  getPaidReservationsByCompany(companyId: string): Promise<ReservationWithDetails[]>;
  
  // Passenger methods
  getPassengers(reservationId: number): Promise<Passenger[]>;
  createPassenger(passenger: InsertPassenger): Promise<Passenger>;
  deletePassengersByReservation(reservationId: number): Promise<boolean>;
  
  // Vehicle methods
  getVehicles(companyId?: string): Promise<Vehicle[]>;
  getVehicle(id: number): Promise<Vehicle | undefined>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: number, vehicle: Partial<Vehicle>): Promise<Vehicle | undefined>;
  deleteVehicle(id: number): Promise<boolean>;
  
  // Commission methods
  getCommissions(companyId?: string): Promise<Commission[]>;
  getCommission(id: number): Promise<Commission | undefined>;
  createCommission(commission: InsertCommission): Promise<Commission>;
  updateCommission(id: number, commission: Partial<Commission>): Promise<Commission | undefined>;
  deleteCommission(id: number): Promise<boolean>;
  
  // User methods
  getUsers(): Promise<User[]>;
  getUsersByCompany(companyId: string): Promise<User[]>;
  getUsersByRole(role: string): Promise<User[]>;
  getUserById(id: number): Promise<User | undefined>;
  updateUser(id: number, userData: { 
    email?: string; 
    password?: string; 
    commissionPercentage?: number; 
  }): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  
  // Reservation Requests methods (new)
  createReservationRequest(requestData: any): Promise<ReservationRequest>;
  getReservationRequests(filters?: { 
    companyId?: string, 
    status?: string,
    requesterId?: number 
  }): Promise<any[]>;
  getReservationRequest(id: number): Promise<any>;
  updateReservationRequestStatus(
    id: number, 
    status: string, 
    reviewedBy: number, 
    reviewNotes?: string
  ): Promise<ReservationRequest>;
  
  // Notification methods (new)
  createNotification(notificationData: InsertNotification): Promise<Notification>;
  getNotifications(userId: number): Promise<Notification[]>;
  markNotificationAsRead(id: number): Promise<Notification>;
  getUnreadNotificationsCount(userId: number): Promise<number>;
  
  // Transferencia de pasajeros
  checkReservationTransferPermission(reservationId: number, userId: number): Promise<boolean>;
  
  // Pagos de comisiones
  markCommissionsAsPaid(reservationIds: number[]): Promise<{
    success: boolean;
    message: string;
    affectedCount: number;
  }>;
  
  // Cupones methods
  getCoupons(companyId?: string): Promise<Coupon[]>;
  getCoupon(id: number): Promise<Coupon | undefined>;
  getCouponByCode(code: string): Promise<Coupon | undefined>;
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: number, coupon: Partial<Coupon>): Promise<Coupon | undefined>;
  deleteCoupon(id: number): Promise<boolean>;
  incrementCouponUsage(id: number): Promise<Coupon | undefined>;
  verifyCouponValidity(code: string): Promise<{
    valid: boolean;
    coupon?: Coupon;
    message?: string;
  }>;
  
  // Package methods
  getPackages(filters?: { companyId?: string, tripId?: number }): Promise<schema.Package[]>;
  getPackage(id: number): Promise<schema.Package | undefined>;
  getPackageWithTripInfo(id: number): Promise<schema.Package & { trip?: TripWithRouteInfo } | undefined>;
  createPackage(packageData: schema.InsertPackage): Promise<schema.Package>;
  updatePackage(id: number, packageData: Partial<schema.Package>): Promise<schema.Package | undefined>;
  deletePackage(id: number): Promise<boolean>;
  
  // Company methods
  getCompanyById(companyId: string): Promise<{id: string, name: string} | null>;
  
  // Transacciones methods
  createTransaccion(transaccionData: schema.InsertTransaccion): Promise<schema.Transaccion>;
  getTransacciones(filters?: { usuario_id?: number, id_corte?: number }): Promise<schema.Transaccion[]>;
  getTransactionsByCompanyExcludingUser(companyId: string, excludeUserId: number): Promise<schema.Transaccion[]>;
  
  // Cajas de usuarios methods
  getUserCashBoxes(currentUserId: number, companyId: string): Promise<any[]>;
}

export class MemStorage implements IStorage {
  private routes: Map<number, Route>;
  private trips: Map<number, Trip>;
  private reservations: Map<number, Reservation>;
  private passengers: Map<number, Passenger>;
  private vehicles: Map<number, Vehicle>;
  private commissions: Map<number, Commission>;
  private users: Map<number, User>;
  
  private routeId: number;
  private tripId: number;
  private reservationId: number;
  private passengerId: number;
  private vehicleId: number;
  private commissionId: number;
  private userId: number;
  
  constructor() {
    this.routes = new Map();
    this.trips = new Map();
    this.reservations = new Map();
    this.passengers = new Map();
    this.vehicles = new Map();
    this.commissions = new Map();
    this.users = new Map();
    
    this.routeId = 1;
    this.tripId = 1;
    this.reservationId = 1;
    this.passengerId = 1;
    this.vehicleId = 1;
    this.commissionId = 1;
    this.userId = 1;

    // Add some initial data
    this.createRoute({
      name: "Acapulco - México",
      origin: "Acapulco de Juarez - Terminal Condesa",
      stops: [
        "Chilpancingo de los Bravo - Terminal Blvd Vicente Guerrero",
        "Cuernavaca - Polvorín",
        "Cuernavaca - Galerías Cuernavaca",
        "Coyoacan - Taxqueña"
      ],
      destination: "México - Terminal Central Norte"
    });
  }
  
  // Route methods
  async getRoutes(): Promise<Route[]> {
    return Array.from(this.routes.values());
  }
  
  async getRoute(id: number): Promise<Route | undefined> {
    return this.routes.get(id);
  }
  
  async createRoute(route: InsertRoute): Promise<Route> {
    const id = this.routeId++;
    const newRoute: Route = { 
      ...route, 
      id, 
      companyId: route.companyId || null 
    };
    this.routes.set(id, newRoute);
    return newRoute;
  }
  
  async updateRoute(id: number, routeUpdate: Partial<Route>): Promise<Route | undefined> {
    const existingRoute = this.routes.get(id);
    if (!existingRoute) return undefined;
    
    const updatedRoute = { ...existingRoute, ...routeUpdate };
    this.routes.set(id, updatedRoute);
    return updatedRoute;
  }
  
  async deleteRoute(id: number): Promise<boolean> {
    return this.routes.delete(id);
  }
  
  async getRouteWithSegments(id: number): Promise<RouteWithSegments | undefined> {
    const route = await this.getRoute(id);
    if (!route) return undefined;
    
    const segments: Array<{ origin: string; destination: string; price?: number }> = [];
    
    // Crear un array con todos los puntos en la ruta (origen, paradas, destino)
    const allPoints = [route.origin, ...route.stops, route.destination];
    
    // Función para verificar si dos ubicaciones están en la misma ciudad
    function isSameCity(location1: string, location2: string): boolean {
      // Extraer el nombre de la ciudad (asumiendo formato "Ciudad, Estado - Ubicación")
      const city1 = location1.split(' - ')[0].trim();
      const city2 = location2.split(' - ')[0].trim();
      return city1 === city2;
    }
    
    // Generar todas las combinaciones posibles de segmentos
    for (let i = 0; i < allPoints.length - 1; i++) {
      for (let j = i + 1; j < allPoints.length; j++) {
        // No agregar segmentos donde origen y destino están en la misma ciudad
        if (isSameCity(allPoints[i], allPoints[j])) continue;
        
        // Agregar cada combinación posible como un segmento
        segments.push({
          origin: allPoints[i],
          destination: allPoints[j]
        });
      }
    }
    
    // Si no hay segmentos (caso raro), al menos agregar la ruta directa
    if (segments.length === 0) {
      segments.push({
        origin: route.origin,
        destination: route.destination
      });
    }
    
    console.log(`Generados ${segments.length} segmentos válidos (excluyendo misma ciudad) para la ruta ${id}`);
    
    return {
      ...route,
      segments
    };
  }
  
  // Trip methods
  async getTrips(companyId?: string): Promise<TripWithRouteInfo[]> {
    let trips = Array.from(this.trips.values());
    
    // Filtrar por companyId si se proporciona
    if (companyId) {
      trips = trips.filter(trip => trip.companyId === companyId);
    }
    
    const tripsWithRoute: TripWithRouteInfo[] = [];
    
    for (const trip of trips) {
      const route = await this.getRoute(trip.routeId);
      if (route) {
        tripsWithRoute.push({
          ...trip,
          route,
          numStops: route.stops.length
        });
      }
    }
    
    return tripsWithRoute;
  }
  
  async getTrip(id: number): Promise<Trip | undefined> {
    return this.trips.get(id);
  }
  
  async getTripWithRouteInfo(id: number): Promise<TripWithRouteInfo | undefined> {
    const trip = await this.getTrip(id);
    if (!trip) return undefined;
    
    const route = await this.getRoute(trip.routeId);
    if (!route) return undefined;
    
    return {
      ...trip,
      route,
      numStops: route.stops.length
    };
  }
  
  async createTrip(trip: InsertTrip): Promise<Trip> {
    const id = this.tripId++;
    const newTrip: Trip = { 
      ...trip, 
      id,
      isSubTrip: trip.isSubTrip ?? false,
      parentTripId: trip.parentTripId ?? null,
      segmentOrigin: trip.segmentOrigin ?? null,
      segmentDestination: trip.segmentDestination ?? null,
      companyId: trip.companyId || null
    };
    this.trips.set(id, newTrip);
    return newTrip;
  }
  
  async updateTrip(id: number, tripUpdate: Partial<Trip>): Promise<Trip | undefined> {
    const existingTrip = this.trips.get(id);
    if (!existingTrip) return undefined;
    
    const updatedTrip = { ...existingTrip, ...tripUpdate };
    this.trips.set(id, updatedTrip);
    return updatedTrip;
  }
  
  async deleteTrip(id: number): Promise<boolean> {
    return this.trips.delete(id);
  }
  
  async searchTrips(params: {
    origin?: string;
    destination?: string;
    date?: string;
    seats?: number;
    companyId?: string | null;
  }): Promise<TripWithRouteInfo[]> {
    // Pasar el companyId a getTrips si está presente
    let trips = await this.getTrips(params.companyId || undefined);
    
    // First, filter by sub-trips
    if ((params.origin || params.destination) && !(params.origin && params.destination)) {
      // If only origin or only destination is specified, include sub-trips
      trips = trips.filter(trip => {
        // Include main trips
        if (!trip.isSubTrip) return true;
        
        // Include relevant sub-trips
        const segmentOrigin = trip.segmentOrigin;
        const segmentDestination = trip.segmentDestination;
        
        if (params.origin && !params.destination) {
          // Filter by origin only
          const originLower = params.origin.toLowerCase();
          return segmentOrigin?.toLowerCase().includes(originLower);
        } 
        
        if (params.destination && !params.origin) {
          // Filter by destination only
          const destinationLower = params.destination.toLowerCase();
          return segmentDestination?.toLowerCase().includes(destinationLower);
        }
        
        return true;
      });
    } else if (params.origin && params.destination) {
      // If both origin and destination are specified, prioritize direct sub-trips
      const originLower = params.origin.toLowerCase();
      const destinationLower = params.destination.toLowerCase();
      
      // Find sub-trips that match exactly the origin-destination pair
      const exactMatches = trips.filter(trip => {
        if (!trip.isSubTrip) return false;
        
        const segmentOrigin = trip.segmentOrigin?.toLowerCase() || "";
        const segmentDestination = trip.segmentDestination?.toLowerCase() || "";
        
        return segmentOrigin.includes(originLower) && 
               segmentDestination.includes(destinationLower);
      });
      
      // If we found exact sub-trip matches, use those, otherwise continue with regular filtering
      if (exactMatches.length > 0) {
        trips = exactMatches;
      } else {
        // Standard filtering on main trips
        trips = trips.filter(trip => {
          if (trip.isSubTrip) return false;
          
          // Check if main trip has both the origin and destination
          const routeOrigin = trip.route.origin.toLowerCase();
          const routeDestination = trip.route.destination.toLowerCase();
          const routeStops = trip.route.stops.map(stop => stop.toLowerCase());
          
          // Main trip has the origin and destination (either as endpoints or stops)
          const hasOrigin = routeOrigin.includes(originLower) || 
                         routeStops.some(stop => stop.includes(originLower));
          
          const hasDestination = routeDestination.includes(destinationLower) || 
                              routeStops.some(stop => stop.includes(destinationLower));
          
          return hasOrigin && hasDestination;
        });
      }
    }
    
    // Additional filters (date and seats)
    if (params.date) {
      const searchDate = new Date(params.date);
      trips = trips.filter(trip => {
        const tripDate = new Date(trip.departureDate);
        return tripDate.toDateString() === searchDate.toDateString();
      });
    }
    
    const seatsRequired = params.seats !== undefined ? params.seats : 0;
    if (seatsRequired > 0) {
      trips = trips.filter(trip => trip.availableSeats >= seatsRequired);
    }
    
    return trips;
  }
  
  // Update availability on related trips (main trip and sub-trips)
  async updateRelatedTripsAvailability(tripId: number, seatChange: number): Promise<void> {
    const trip = await this.getTrip(tripId);
    if (!trip) return;
    
    // Obtenemos todos los viajes
    const allTrips = Array.from(this.trips.values());
    
    if (trip.isSubTrip && trip.parentTripId && trip.segmentOrigin && trip.segmentDestination) {
      // Este es un sub-viaje, actualizamos el viaje principal y otros sub-viajes que se superpongan
      const mainTrip = await this.getTrip(trip.parentTripId);
      if (!mainTrip) return;
      
      // Actualizar el viaje principal
      await this.updateTrip(mainTrip.id, {
        availableSeats: mainTrip.availableSeats + seatChange
      });
      
      // Obtener todos los puntos de parada del viaje principal
      const routeInfo = await this.getRouteWithSegments(mainTrip.routeId);
      if (!routeInfo) return;
      
      const allStops = [routeInfo.origin, ...routeInfo.stops, routeInfo.destination];
      
      // Encontrar índices para este segmento
      const segmentOriginIdx = allStops.indexOf(trip.segmentOrigin);
      const segmentDestinationIdx = allStops.indexOf(trip.segmentDestination);
      
      if (segmentOriginIdx === -1 || segmentDestinationIdx === -1) return;
      
      // Actualizar todos los sub-viajes que se superponen con este segmento
      const subTrips = allTrips.filter(t => 
        t.isSubTrip && 
        t.parentTripId === mainTrip.id &&
        t.id !== trip.id &&
        t.segmentOrigin && 
        t.segmentDestination
      );
      
      for (const subTrip of subTrips) {
        // Encontrar índices para el sub-viaje comparado
        const subOriginIdx = allStops.indexOf(subTrip.segmentOrigin!);
        const subDestinationIdx = allStops.indexOf(subTrip.segmentDestination!);
        
        if (subOriginIdx === -1 || subDestinationIdx === -1) continue;
        
        // Verificar si hay superposición de segmentos
        // Los segmentos se superponen si hay cualquier parte del camino que comparten
        const hasOverlap = (
          // Si alguna parte del segmento actual está dentro del otro segmento
          (segmentOriginIdx >= subOriginIdx && segmentOriginIdx < subDestinationIdx) ||
          (segmentDestinationIdx > subOriginIdx && segmentDestinationIdx <= subDestinationIdx) ||
          // O si el otro segmento está completamente dentro del segmento actual
          (subOriginIdx >= segmentOriginIdx && subDestinationIdx <= segmentDestinationIdx)
        );
        
        if (hasOverlap) {
          await this.updateTrip(subTrip.id, {
            availableSeats: subTrip.availableSeats + seatChange
          });
        }
      }
    } else {
      // Es un viaje principal, obtener todos los sub-viajes
      const subTrips = allTrips.filter(t => 
        t.isSubTrip && t.parentTripId === trip.id
      );
      
      // Actualizar todos los sub-viajes
      for (const subTrip of subTrips) {
        await this.updateTrip(subTrip.id, {
          availableSeats: subTrip.availableSeats + seatChange
        });
      }
    }
  }
  
  // Reservation methods
  async getReservations(companyId?: string, tripId?: number, companyIds?: string[], dateFilter?: string): Promise<ReservationWithDetails[]> {
    let reservations = Array.from(this.reservations.values());
    
    // Filtrar por companyId si se proporciona
    if (companyId) {
      reservations = reservations.filter(reservation => reservation.companyId === companyId);
    }
    
    // Filtrar por múltiples compañías si se proporciona
    if (companyIds && companyIds.length > 0) {
      reservations = reservations.filter(reservation => 
        reservation.companyId && companyIds.includes(reservation.companyId)
      );
    }
    
    // Filtrar por viaje específico si se proporciona
    if (tripId) {
      reservations = reservations.filter(reservation => reservation.tripId === tripId);
    }
    
    const result: ReservationWithDetails[] = [];
    
    for (const reservation of reservations) {
      const tripWithRoute = await this.getTripWithRouteInfo(reservation.tripId);
      if (!tripWithRoute) continue;
      
      // Filtrar por fecha si se proporciona
      if (dateFilter) {
        const tripDate = tripWithRoute.departureDate.toISOString().split('T')[0];
        if (tripDate !== dateFilter) continue;
      }
      
      const passengers = await this.getPassengers(reservation.id);
      
      result.push({
        ...reservation,
        trip: tripWithRoute,
        passengers
      });
    }
    
    return result;
  }
  
  async getReservation(id: number): Promise<Reservation | undefined> {
    return this.reservations.get(id);
  }
  
  async getReservationWithDetails(id: number, companyId?: string): Promise<ReservationWithDetails | undefined> {
    const reservation = await this.getReservation(id);
    if (!reservation) return undefined;
    
    // Si se proporciona un companyId, verificar que la reserva pertenezca a esa compañía
    if (companyId && reservation.companyId !== companyId) {
      return undefined;
    }
    
    const tripWithRoute = await this.getTripWithRouteInfo(reservation.tripId);
    if (!tripWithRoute) return undefined;
    
    const passengers = await this.getPassengers(reservation.id);
    
    return {
      ...reservation,
      trip: tripWithRoute,
      passengers
    };
  }
  
  async createReservation(reservation: InsertReservation): Promise<Reservation> {
    const id = this.reservationId++;
    // Preparamos los datos de la reserva asegurándonos de que notes sea null si no está definido
    const reservationData = { ...reservation };
    
    // Eliminar las propiedades que configuraremos explícitamente para evitar problemas con el spreading
    delete reservationData.notes;
    delete reservationData.paymentMethod;
    
    const newReservation: Reservation = { 
      ...reservationData, 
      id,
      notes: reservation.notes || null, // Aseguramos que notas sea string | null (nunca undefined)
      paymentMethod: reservation.paymentMethod || "cash", // Valor por defecto si no se proporciona
      status: reservation.status || "confirmed",
      createdAt: new Date(),
      companyId: reservation.companyId || null // Aseguramos companyId sea string | null (nunca undefined)
    };
    
    this.reservations.set(id, newReservation);
    
    // Update available seats on the trip
    const trip = await this.getTrip(reservation.tripId);
    if (trip) {
      const passengerCount = (await this.getPassengers(id)).length;
      
      // Update this trip's seat availability
      await this.updateTrip(trip.id, {
        availableSeats: trip.availableSeats - passengerCount
      });
      
      // Update related trips seat availability
      await this.updateRelatedTripsAvailability(trip.id, -passengerCount);
    }
    
    return newReservation;
  }
  
  async updateReservation(id: number, reservationUpdate: Partial<Reservation>): Promise<Reservation | undefined> {
    const existingReservation = this.reservations.get(id);
    if (!existingReservation) return undefined;
    
    const updatedReservation = { ...existingReservation, ...reservationUpdate };
    this.reservations.set(id, updatedReservation);
    return updatedReservation;
  }
  
  async deleteReservation(id: number): Promise<boolean> {
    const reservation = await this.getReservation(id);
    if (!reservation) return false;
    
    // Get passenger count before deleting
    const passengers = await this.getPassengers(id);
    const passengerCount = passengers.length;
    
    // Update available seats on the trip
    const trip = await this.getTrip(reservation.tripId);
    if (trip) {
      // Update this trip's seat availability
      await this.updateTrip(trip.id, {
        availableSeats: trip.availableSeats + passengerCount
      });
      
      // Update related trips seat availability
      await this.updateRelatedTripsAvailability(trip.id, passengerCount);
    }
    
    // Delete passengers
    await this.deletePassengersByReservation(id);
    
    // Delete reservation
    return this.reservations.delete(id);
  }
  
  // Passenger methods
  async getPassengers(reservationId: number): Promise<Passenger[]> {
    const allPassengers = Array.from(this.passengers.values());
    return allPassengers.filter(p => p.reservationId === reservationId);
  }
  
  async createPassenger(passenger: InsertPassenger): Promise<Passenger> {
    const id = this.passengerId++;
    const newPassenger: Passenger = { ...passenger, id };
    this.passengers.set(id, newPassenger);
    return newPassenger;
  }
  
  async deletePassengersByReservation(reservationId: number): Promise<boolean> {
    const allPassengers = Array.from(this.passengers.entries());
    
    for (const [id, passenger] of allPassengers) {
      if (passenger.reservationId === reservationId) {
        this.passengers.delete(id);
      }
    }
    
    return true;
  }
  
  // Vehicle methods
  async getVehicles(companyId?: string): Promise<Vehicle[]> {
    let vehicles = Array.from(this.vehicles.values());
    
    // Filtrar por companyId si se proporciona
    if (companyId) {
      vehicles = vehicles.filter(vehicle => vehicle.companyId === companyId);
    }
    
    return vehicles;
  }
  
  async getVehicle(id: number): Promise<Vehicle | undefined> {
    return this.vehicles.get(id);
  }
  
  async createVehicle(vehicle: InsertVehicle): Promise<Vehicle> {
    const id = this.vehicleId++;
    const newVehicle: Vehicle = { 
      ...vehicle, 
      id,
      createdAt: new Date(),
      updatedAt: null,
      hasAC: vehicle.hasAC ?? null,
      hasRecliningSeats: vehicle.hasRecliningSeats ?? null,
      services: vehicle.services ?? null,
      description: vehicle.description ?? null,
      companyId: vehicle.companyId || null
    };
    this.vehicles.set(id, newVehicle);
    return newVehicle;
  }
  
  async updateVehicle(id: number, vehicleUpdate: Partial<Vehicle>): Promise<Vehicle | undefined> {
    const existingVehicle = this.vehicles.get(id);
    if (!existingVehicle) return undefined;
    
    const updatedVehicle = { ...existingVehicle, ...vehicleUpdate };
    this.vehicles.set(id, updatedVehicle);
    return updatedVehicle;
  }
  
  async deleteVehicle(id: number): Promise<boolean> {
    return this.vehicles.delete(id);
  }
  
  // Commission methods
  async getCommissions(companyId?: string): Promise<Commission[]> {
    let commissions = Array.from(this.commissions.values());
    
    // Filtrar por companyId si se proporciona
    if (companyId) {
      commissions = commissions.filter(commission => commission.companyId === companyId);
    }
    
    return commissions;
  }
  
  async getCommission(id: number): Promise<Commission | undefined> {
    return this.commissions.get(id);
  }
  
  async createCommission(commission: InsertCommission): Promise<Commission> {
    const id = this.commissionId++;
    const newCommission: Commission = { 
      ...commission, 
      id,
      createdAt: new Date(),
      updatedAt: null,
      routeId: commission.routeId ?? null,
      tripId: commission.tripId ?? null,
      description: commission.description ?? null,
      percentage: commission.percentage ?? null,
      companyId: commission.companyId || null
    };
    this.commissions.set(id, newCommission);
    return newCommission;
  }
  
  async updateCommission(id: number, commissionUpdate: Partial<Commission>): Promise<Commission | undefined> {
    const existingCommission = this.commissions.get(id);
    if (!existingCommission) return undefined;
    
    const updatedCommission = { ...existingCommission, ...commissionUpdate };
    this.commissions.set(id, updatedCommission);
    return updatedCommission;
  }
  
  async deleteCommission(id: number): Promise<boolean> {
    return this.commissions.delete(id);
  }
  
  // User methods
  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }
  
  async getUsersByCompany(companyId: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => 
      user.companyId === companyId || user.company === companyId
    );
  }
  
  async getUserById(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async updateUser(id: number, userData: { 
    email?: string; 
    password?: string; 
    commissionPercentage?: number; 
  }): Promise<User | undefined> {
    const existingUser = this.users.get(id);
    if (!existingUser) return undefined;
    
    const updatedUser = { 
      ...existingUser, 
      ...userData,
      updatedAt: new Date()
    };
    
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }
}

// Importamos la clase DatabaseStorage desde el archivo separado
import { DatabaseStorage } from "./db-storage";

// Usamos la versión de almacenamiento en base de datos para implementar la funcionalidad
export const storage = new DatabaseStorage();
