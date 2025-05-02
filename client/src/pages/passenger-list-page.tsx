import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useLocation, useRoute } from "wouter";
import { 
  CalendarIcon, 
  ClipboardListIcon,
  Users, 
  ArrowLeft,
  Calendar,
  MapPin,
  Clock,
  Bus,
  Printer,
  Download,
  ChevronLeft,
  User
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Importamos nuestros nuevos hooks especializados para conductores
import { useTripDetails as useDriverTripDetails, useDriverTrips, Trip as DriverTrip } from "@/hooks/use-driver-trips";
import { useDriverReservations, Reservation as DriverReservation, Passenger as DriverPassenger } from "@/hooks/use-driver-reservations";

interface Trip {
  id: number;
  routeId: number;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  price: number;
  status: "scheduled" | "in-progress" | "completed" | "cancelled";
  capacity: number;
  availableSeats: number;
  vehicleType?: string;
  vehicleId?: number;
  driverId?: number;
  isSubTrip: boolean;
  parentTripId?: number;
  segmentOrigin?: string;
  segmentDestination?: string;
  vehicle?: {
    id: number;
    name: string;
    licensePlate?: string;
  };
  route: {
    id: number;
    name: string;
    origin: string;
    destination: string;
    stops: string[];
  };
}

interface Passenger {
  id: number;
  firstName: string;
  lastName: string;
  reservationId: number;
  reservationCode?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  email?: string;
  phone?: string;
  amount?: number;
  tripSegment?: string;
}

interface Reservation {
  id: number;
  tripId: number;
  createdAt: string;
  updatedAt: string;
  status: string;
  email: string;
  phone: string;
  paymentMethod: string;
  paymentStatus?: string;
  notes?: string;
  totalAmount: number;
  passengers: Passenger[];
}

export default function PassengerListPage() {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute<{ tripId: string }>("/trip/:tripId/passengers");

  if (!match) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>No se encontró el viaje solicitado</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => setLocation("/")}
            >
              <ChevronLeft className="mr-2 h-4 w-4" />
              Volver al inicio
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const tripId = Number(params.tripId);

  // Obtener información del usuario actual
  const { user } = useAuth();

  // Utilizamos useTripDetails para obtener detalles del viaje directamente
  const { 
    data: tripDetails, 
    isLoading: isLoadingTripDetails, 
    error: tripError 
  } = useDriverTripDetails(tripId);
  
  // También cargamos todos los viajes para asegurar compatibilidad con el código existente
  const { 
    data: trips, 
    isLoading: isLoadingTrips 
  } = useDriverTrips();

  // Utilizamos nuestro nuevo hook para obtener reservaciones específicas para este viaje
  const { 
    data: reservations, 
    isLoading: isLoadingReservations,
    error: reservationsError 
  } = useDriverReservations({
    tripId: tripId,
    includeRelated: true
  });

  // Interfaz para las reservaciones agrupadas con lista de pasajeros
  interface GroupedReservation {
    id: number;
    code: string;
    tripId: number;
    email: string;
    phone: string;
    paymentMethod: string;
    paymentStatus: string;
    amount: number;
    tripSegment: string;
    passengers: {
      id: number;
      firstName: string;
      lastName: string;
      initials: string;
    }[];
  }

  // Nueva implementación: agrupar pasajeros por reservación
  const groupedReservations = (() => {
    if (!tripId || !reservations || !trips) return [];
    
    try {
      console.log(`Procesando reservaciones para viaje ${tripId} (incluyendo relacionados)...`);
      console.log(`Total de reservaciones recibidas: ${reservations.length}`);
      
      // DEPURACIÓN DETALLADA: Verificar estructura de cada reservación
      console.log("ESTRUCTURA COMPLETA DE RESERVACIONES:");
      reservations.forEach((res, index) => {
        console.log(`Reserva #${index+1} (ID: ${res.id}, tripId: ${res.tripId}):`);
        console.log(`- Tiene pasajeros: ${res.passengers ? 'Sí' : 'No'}`);
        if (res.passengers) {
          console.log(`- Cantidad pasajeros: ${Array.isArray(res.passengers) ? res.passengers.length : 'No es un array'}`);
          if (Array.isArray(res.passengers)) {
            console.log(`- Pasajeros: ${JSON.stringify(res.passengers.map(p => 
              p ? `${p.firstName || 'Sin nombre'} ${p.lastName || 'Sin apellido'}` : 'Inválido'
            ))}`);
          }
        }
      });
      
      // Agrupar reservaciones por viaje para depuración
      const reservationsByTrip: Record<number, Reservation[]> = {};
      for (const res of reservations) {
        if (!reservationsByTrip[res.tripId]) {
          reservationsByTrip[res.tripId] = [];
        }
        reservationsByTrip[res.tripId].push(res);
      }
      
      // Mostrar desglose de reservaciones por viaje
      console.log("Desglose de reservaciones por viaje:");
      Object.entries(reservationsByTrip).forEach(([tripId, resList]) => {
        console.log(`Viaje ${tripId}: ${resList.length} reservaciones`);
      });
      
      // Solución definitiva para el problema: asegurarnos de que los pasajeros estén correctamente procesados
      // CORRECCIÓN: Aunque una reservación tenga un array pasajeros vacío, la seguimos mostrando
      // para que el conductor pueda ver todas las reservaciones
      const relevantReservations = reservations.map(res => {
        // Si passengers no existe o no es un array, lo inicializamos como array vacío
        if (!res.passengers || !Array.isArray(res.passengers)) {
          console.log(`Corrigiendo estructura de pasajeros para reserva ${res.id}`);
          return {...res, passengers: []};
        }
        return res;
      });
      
      console.log("Reservaciones procesadas para mostrar:", relevantReservations.length);
      
      // Si no hay reservaciones relevantes, terminar aquí
      if (relevantReservations.length === 0) {
        return [];
      }
      
      // Crear reservaciones agrupadas por ID de reservación
      const groupedResult: GroupedReservation[] = [];
      
      for (const reservation of relevantReservations) {
        // Asegurarse que passengers sea un array
        if (!reservation.passengers) {
          reservation.passengers = [];
        } else if (!Array.isArray(reservation.passengers)) {
          reservation.passengers = [];
        }
        
        // Encontrar el viaje asociado a esta reservación
        // Si es un viaje relacionado, puede ser que esté en un subviaje o viaje principal diferente al actual
        const reservationTrip = trips.find(t => t.id === reservation.tripId);
        
        // Si no encontramos el viaje, intentamos crear información básica para mostrar
        if (!reservationTrip) {
          console.log(`⚠️ No se encontró información del viaje ${reservation.tripId} para reserva ${reservation.id}`);
          
          // Crear un objeto de reservación con información mínima
          const groupedReservation: GroupedReservation = {
            id: reservation.id,
            code: `R-${reservation.id.toString().padStart(6, '0')}`,
            tripId: reservation.tripId,
            email: reservation.email || '',
            phone: reservation.phone || '',
            paymentMethod: reservation.paymentMethod || 'unknown',
            paymentStatus: reservation.status === 'confirmed' ? 'paid' : 'pending',
            amount: reservation.totalAmount || 0,
            tripSegment: `Viaje Relacionado #${reservation.tripId}`,
            passengers: (reservation.passengers || []).map(p => ({
              id: p.id || 0,
              firstName: p.firstName || 'Sin nombre',
              lastName: p.lastName || 'Sin apellido',
              initials: p.firstName && p.lastName ? 
                `${p.firstName.charAt(0)}${p.lastName.charAt(0)}` : 'XX'
            }))
          };
          
          // Añadir la reservación al resultado incluso sin información completa del viaje
          groupedResult.push(groupedReservation);
          continue;
        }
        
        // Crear el objeto de reservación agrupada
        const groupedReservation: GroupedReservation = {
          id: reservation.id,
          code: `R-${reservation.id.toString().padStart(6, '0')}`,
          tripId: reservation.tripId,
          email: reservation.email || '',
          phone: reservation.phone || '',
          paymentMethod: reservation.paymentMethod || 'unknown',
          paymentStatus: reservation.status === 'confirmed' ? 'paid' : 'pending',
          amount: reservation.totalAmount || 0,
          tripSegment: `${
            reservationTrip.segmentOrigin || 
            (reservationTrip.route ? reservationTrip.route.origin : 'Origen') || 'Origen'
          } → ${
            reservationTrip.segmentDestination || 
            (reservationTrip.route ? reservationTrip.route.destination : 'Destino') || 'Destino'
          }`,
          passengers: []
        };
        
        // Añadir todos los pasajeros de esta reservación
        if (Array.isArray(reservation.passengers)) {
          for (const passenger of reservation.passengers) {
            if (!passenger) continue;
            
            // Si faltan datos de pasajero, añadir valores por defecto (para asegurar que siempre se muestre algo)
            groupedReservation.passengers.push({
              id: passenger.id || 0,
              firstName: passenger.firstName || 'Sin nombre',
              lastName: passenger.lastName || 'Sin apellido',
              initials: passenger.firstName && passenger.lastName ? 
                `${passenger.firstName.charAt(0)}${passenger.lastName.charAt(0)}` : 'XX'
            });
          }
        }
        
        // Con el nuevo enfoque, SIEMPRE agregamos la reservación incluso si no tiene pasajeros
        // Esto asegura que se muestren todas las reservaciones para el conductor
        groupedResult.push(groupedReservation);
      }
      
      console.log(`Resultados agrupados: ${groupedResult.length} reservaciones con un total de ${
        groupedResult.reduce((total, r) => total + r.passengers.length, 0)
      } pasajeros`);
      
      return groupedResult;
    } catch (error) {
      console.error("Error al procesar reservaciones:", error);
      return [];
    }
  })();
  
  // Para compatibilidad con el código existente (usamos agrupados)
  const passengersList = groupedReservations.flatMap(res => 
    res.passengers.map(p => ({
      ...p,
      reservationId: res.id,
      reservationCode: res.code,
      paymentMethod: res.paymentMethod,
      paymentStatus: res.paymentStatus,
      email: res.email,
      phone: res.phone,
      amount: res.amount,
      tripSegment: res.tripSegment
    }))
  );

  // Función para formatear fecha para su visualización
  const formatDisplayDate = (dateString: string | Date) => {
    // Si es string, parseamos asegurándonos que la fecha se interprete correctamente
    let date;
    if (typeof dateString === 'string') {
      // Si es formato ISO, extraemos solo la parte de fecha y creamos un objeto Date
      // con la hora establecida al mediodía para evitar problemas de zona horaria
      if (dateString.includes('T')) {
        const datePart = dateString.split('T')[0];
        const [year, month, day] = datePart.split('-').map(Number);
        date = new Date(year, month - 1, day, 12, 0, 0);
      } else {
        // Para otros formatos, intentamos el constructor normal
        const parts = dateString.split('-');
        if (parts.length === 3) {
          const [year, month, day] = parts.map(Number);
          date = new Date(year, month - 1, day, 12, 0, 0);
        } else {
          date = new Date(dateString);
        }
      }
    } else {
      date = dateString;
    }
    
    return format(date, "d 'de' MMMM, yyyy", { locale: es });
  };

  // Usar directamente los detalles del viaje obtenidos
  // tripInfo no puede ser undefined en este punto porque ya verificamos con tripDetails
  const tripInfo = tripDetails!;

  // Función para imprimir la lista de pasajeros
  const handlePrint = () => {
    window.print();
  };

  // Función para volver atrás
  const handleGoBack = () => {
    setLocation("/");
  };

  if (isLoadingTripDetails || isLoadingTrips || isLoadingReservations) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Manejar errores específicos de rol como chofer
  const isPermissionError = tripError instanceof Error && 
                          tripError.message.includes("No tienes permisos");
  
  if (tripError) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Button variant="outline" className="mb-6" onClick={handleGoBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>
              {isPermissionError 
                ? "Acceso denegado" 
                : "Error al cargar el viaje"}
            </CardTitle>
            <CardDescription>
              {user?.role === 'chofer' && isPermissionError 
                ? "No tienes permiso para ver este viaje porque no está asignado a ti. Solo puedes ver los pasajeros de tus viajes asignados."
                : tripError instanceof Error 
                  ? tripError.message 
                  : "Ocurrió un error al cargar los detalles del viaje"}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Use tripDetails as the source of truth
  if (!tripDetails) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Button variant="outline" className="mb-6" onClick={handleGoBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Viaje no encontrado</CardTitle>
            <CardDescription>
              El viaje solicitado no existe o no tienes permisos para visualizarlo.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="print:hidden">
        <Button variant="outline" className="mb-6" onClick={handleGoBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Información del viaje */}
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Información del Viaje</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{tripInfo.route?.name}</h3>
              <p className="text-gray-500">
                {tripInfo.segmentOrigin || (tripInfo.route?.origin || 'Origen')} → {tripInfo.segmentDestination || (tripInfo.route?.destination || 'Destino')}
              </p>
            </div>

            <Separator />

            <div className="space-y-3 text-sm">
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-2 text-gray-500" />
                <span>{formatDisplayDate(tripInfo.departureDate)}</span>
              </div>
              
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-2 text-gray-500" />
                <span>{tripInfo.departureTime} - {tripInfo.arrivalTime}</span>
              </div>
              
              <div className="flex items-center">
                <Bus className="h-4 w-4 mr-2 text-gray-500" />
                <span className="capitalize">
                  {tripInfo.vehicle?.name || "Sin unidad asignada"}
                </span>
              </div>
              
              <div className="flex items-center">
                <Users className="h-4 w-4 mr-2 text-gray-500" />
                <span>{passengersList.length} pasajeros</span>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <div>
                <span className="text-sm text-gray-500">Capacidad:</span>
                <div className="font-medium">{tripInfo.capacity} asientos</div>
              </div>
              <div>
                <span className="text-sm text-gray-500">Asientos disponibles:</span>
                <div className="font-medium">{tripInfo.availableSeats} asientos</div>
              </div>
              <div>
                <span className="text-sm text-gray-500">Ocupación:</span>
                <div className="font-medium">
                  {Math.round(((tripInfo.capacity - tripInfo.availableSeats) / tripInfo.capacity) * 100)}%
                </div>
              </div>
            </div>
            
            <div className="pt-4 print:hidden">
              <Button onClick={handlePrint} variant="outline" className="w-full">
                <Printer className="mr-2 h-4 w-4" />
                Imprimir Lista
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Lista de pasajeros */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle>Lista de Pasajeros</CardTitle>
            <CardDescription>
              {formatDisplayDate(tripInfo.departureDate)} • {tripInfo.departureTime}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {groupedReservations.length > 0 ? (
              <div className="space-y-4">
                {groupedReservations.map((reservation, index) => (
                  <div 
                    key={`reservation-${reservation.id}`} 
                    className={`p-4 border rounded-md ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                  >
                    <div className="md:flex items-start">
                      <div className="flex-1 mb-3 md:mb-0">
                        <div className="flex items-center mb-2">
                          <div className="flex -space-x-2 mr-3">
                            {reservation.passengers.length > 0 ? (
                              <>
                                {reservation.passengers.slice(0, 3).map((passenger) => (
                                  <Avatar key={passenger.id} className="border-2 border-background">
                                    <AvatarFallback className="bg-primary/10 text-primary">
                                      {passenger.initials}
                                    </AvatarFallback>
                                  </Avatar>
                                ))}
                                {reservation.passengers.length > 3 && (
                                  <Avatar className="border-2 border-background">
                                    <AvatarFallback className="bg-muted text-muted-foreground">
                                      +{reservation.passengers.length - 3}
                                    </AvatarFallback>
                                  </Avatar>
                                )}
                              </>
                            ) : (
                              <Avatar className="border-2 border-background">
                                <AvatarFallback className="bg-yellow-100 text-yellow-600">
                                  0
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </div>
                          <div>
                            <div className="font-medium">Reservación {reservation.code}</div>
                            <div className="text-xs text-gray-500">
                              {reservation.passengers.length} {reservation.passengers.length === 1 ? 'pasajero' : 'pasajeros'}
                            </div>
                          </div>
                        </div>
                        
                        {reservation.passengers.length > 0 ? (
                          <div className="mt-3 border-l-2 border-gray-200 pl-3">
                            <div className="text-xs text-gray-500 mb-1">Pasajeros:</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {reservation.passengers.map((passenger) => (
                                <div key={passenger.id} className="text-sm flex items-center">
                                  <div className="h-2 w-2 rounded-full bg-primary/80 mr-2"></div>
                                  {passenger.firstName} {passenger.lastName}
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 border-l-2 border-yellow-200 pl-3">
                            <div className="text-xs text-gray-500 mb-1">Información:</div>
                            <div className="text-sm text-yellow-600">
                              Esta reservación está registrada pero aún no tiene pasajeros asignados.
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3 md:mt-0 md:ml-4 md:w-2/5">
                        <div>
                          <div className="text-xs text-gray-500">Segmento</div>
                          <div className="text-sm">{reservation.tripSegment}</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Contacto</div>
                          <div className="text-sm truncate max-w-[120px] md:max-w-full" title={reservation.email || 'N/A'}>
                            {reservation.email || 'N/A'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Teléfono</div>
                          <div className="text-sm truncate" title={reservation.phone || 'N/A'}>
                            {reservation.phone || 'N/A'}
                          </div>
                        </div>
                        <div className="col-span-2 md:col-span-3 text-right">
                          <div className="font-semibold">${reservation.amount}</div>
                          <Badge variant={reservation.paymentStatus === 'paid' ? 'default' : 'outline'}>
                            {reservation.paymentStatus === 'paid' ? 'Pagado' : 'Pendiente'}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <User className="h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium">Sin reservaciones</h3>
                <p className="text-gray-500">No hay reservaciones registradas para este viaje.</p>
                {user?.role === 'chofer' && (
                  <p className="text-primary text-center mt-4 text-sm max-w-md">
                    Como conductor, deberías ver aquí las reservaciones de este viaje. Si crees que esto es un error, por favor contacta al administrador.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}