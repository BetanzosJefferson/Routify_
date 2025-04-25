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
  ChevronLeft
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

  // Fetch all trips
  const { data: trips, isLoading: isLoadingTrips } = useQuery<Trip[]>({
    queryKey: ["/api/trips"],
    staleTime: 5000,
    refetchInterval: 15000,
  });

  // Fetch all reservations
  const { data: reservations, isLoading: isLoadingReservations } = useQuery<Reservation[]>({
    queryKey: ["/api/reservations"],
    staleTime: 5000,
    refetchInterval: 15000,
  });

  // Calcular pasajeros del viaje seleccionado con detección de relaciones de viajes
  const passengersList = (() => {
    if (!tripId || !reservations || !trips) return [];
    
    try {
      // Obtener el viaje seleccionado para verificar si es principal o subviaje
      const currentTrip = trips.find(t => t.id === tripId);
      if (!currentTrip) return [];
      
      let relevantTripIds = [];
      
      // 1. Si es un viaje principal, incluir también a sus sub-viajes
      if (!currentTrip.isSubTrip) {
        relevantTripIds.push(tripId);
        
        // Añadir IDs de sub-viajes
        const subTripIds = trips
          .filter(t => t.parentTripId === tripId)
          .map(t => t.id);
        
        relevantTripIds = [...relevantTripIds, ...subTripIds];
        console.log("Viaje principal y sus sub-viajes:", relevantTripIds);
      } 
      // 2. Si es un sub-viaje, incluir solo a ese viaje
      else {
        relevantTripIds.push(tripId);
        console.log("Sub-viaje solamente:", relevantTripIds);
      }
      
      // Encontrar reservaciones para todos los viajes relevantes
      const relevantReservations = reservations.filter(r => 
        relevantTripIds.includes(r.tripId) && 
        r.passengers && 
        Array.isArray(r.passengers) && 
        r.passengers.length > 0
      );
      
      console.log("Reservaciones encontradas:", relevantReservations.length);
      
      // Si no hay reservaciones relevantes, terminar aquí
      if (relevantReservations.length === 0) {
        return [];
      }
      
      // Transformar a lista de pasajeros con información adicional
      const passengerList = [];
      
      for (const reservation of relevantReservations) {
        if (!reservation.passengers || !Array.isArray(reservation.passengers)) {
          continue;
        }
        
        for (const passenger of reservation.passengers) {
          if (!passenger || !passenger.firstName || !passenger.lastName) {
            continue;
          }
          
          // Obtener datos del viaje asociado a esta reservación
          const reservationTrip = trips.find(t => t.id === reservation.tripId);
          
          if (!reservationTrip) {
            continue;
          }
          
          // Añadir pasajero con datos enriquecidos
          passengerList.push({
            id: passenger.id,
            firstName: passenger.firstName,
            lastName: passenger.lastName,
            reservationId: passenger.reservationId,
            reservationCode: `R-${reservation.id.toString().padStart(6, '0')}`,
            paymentMethod: reservation.paymentMethod || 'unknown',
            paymentStatus: reservation.status === 'confirmed' ? 'paid' : 'pending',
            email: reservation.email || '',
            phone: reservation.phone || '',
            amount: reservation.totalAmount || 0,
            tripSegment: `${
              reservationTrip.segmentOrigin || 
              reservationTrip.route.origin || 'Origen'
            } → ${
              reservationTrip.segmentDestination || 
              reservationTrip.route.destination || 'Destino'
            }`
          });
        }
      }
      
      return passengerList;
    } catch (error) {
      console.error("Error al procesar pasajeros:", error);
      return [];
    }
  })();

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

  // Obtener información del viaje
  const tripInfo = trips?.find(trip => trip.id === tripId);

  // Función para imprimir la lista de pasajeros
  const handlePrint = () => {
    window.print();
  };

  // Función para volver atrás
  const handleGoBack = () => {
    setLocation("/");
  };

  if (isLoadingTrips || isLoadingReservations) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!tripInfo) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <Button variant="outline" className="mb-6" onClick={handleGoBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Viaje no encontrado</CardTitle>
            <CardDescription>El viaje solicitado no existe o ha sido eliminado.</CardDescription>
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
            <Badge 
              variant={
                tripInfo.status === "scheduled" ? "outline" : 
                tripInfo.status === "in-progress" ? "default" : 
                "secondary"
              }
            >
              {tripInfo.status === "scheduled" 
                ? "Programado" 
                : tripInfo.status === "in-progress" 
                  ? "En Progreso" 
                  : tripInfo.status === "completed" 
                    ? "Completado" 
                    : "Cancelado"}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{tripInfo.route.name}</h3>
              <p className="text-gray-500">
                {tripInfo.segmentOrigin || tripInfo.route.origin} → {tripInfo.segmentDestination || tripInfo.route.destination}
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
              
              {tripInfo.vehicleType && (
                <div className="flex items-center">
                  <Bus className="h-4 w-4 mr-2 text-gray-500" />
                  <span className="capitalize">{tripInfo.vehicleType}</span>
                </div>
              )}
              
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
            {passengersList.length > 0 ? (
              <div className="space-y-4">
                {passengersList.map((passenger, index) => (
                  <div 
                    key={`passenger-${passenger.id}-${index}`} 
                    className={`p-4 border rounded-md ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                  >
                    <div className="md:flex items-start">
                      <div className="flex items-center space-x-3 md:w-1/3 mb-3 md:mb-0">
                        <Avatar className="h-10 w-10 border border-gray-200">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {passenger.firstName.charAt(0)}{passenger.lastName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="min-w-0">
                          <p className="font-medium truncate">
                            {passenger.firstName} {passenger.lastName}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            {passenger.reservationCode}
                          </p>
                        </div>
                      </div>
                      
                      <div className="md:w-1/3 mb-3 md:mb-0">
                        <div className="space-y-1">
                          <p className="text-sm text-gray-500">
                            <span className="font-medium">Segmento:</span> {passenger.tripSegment}
                          </p>
                          {passenger.email && (
                            <p className="text-sm text-gray-500 truncate">
                              <span className="font-medium">Email:</span> {passenger.email}
                            </p>
                          )}
                          {passenger.phone && (
                            <p className="text-sm text-gray-500">
                              <span className="font-medium">Teléfono:</span> {passenger.phone}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-3 md:w-1/3 justify-end">
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            ${passenger.amount}
                          </p>
                          <span className={`text-xs ${
                            passenger.paymentStatus === 'paid' 
                              ? 'text-green-600' 
                              : 'text-orange-600'
                          }`}>
                            {passenger.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}
                          </span>
                        </div>
                        
                        <Badge 
                          variant={passenger.paymentStatus === 'paid' ? 'default' : 'outline'}
                        >
                          {passenger.paymentStatus === 'paid' ? 'Pagado' : 'Pendiente'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium mb-2">Sin pasajeros</h3>
                <p>No hay pasajeros registrados para este viaje.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}