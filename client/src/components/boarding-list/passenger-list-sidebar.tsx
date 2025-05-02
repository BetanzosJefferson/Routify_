import { useState, useEffect } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  CalendarIcon, 
  ClipboardListIcon,
  Users, 
  Calendar,
  Clock,
  Bus,
  User,
  X,
  UserIcon
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useDriverTrips, Trip } from "@/hooks/use-driver-trips";
import { useDriverReservations, Reservation, Passenger } from "@/hooks/use-driver-reservations";
import { normalizeToStartOfDay } from "@/lib/utils";

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

interface PassengerListSidebarProps {
  tripId: number;
  onClose: () => void;
}

export function PassengerListSidebar({ tripId, onClose }: PassengerListSidebarProps) {
  // Cargar detalles del viaje
  const { 
    data: tripDetails, 
    isLoading: isLoadingTripDetails, 
    error: tripError 
  } = useDriverTripDetails(tripId);
  
  // Cargar reservaciones del viaje
  const { 
    data: reservations, 
    isLoading: isLoadingReservations,
    error: reservationsError 
  } = useDriverReservations({
    tripId: tripId,
    includeRelated: true
  });

  // Función para formatear fecha
  const formatDisplayDate = (dateString: string | Date) => {
    const normalizedDate = normalizeToStartOfDay(dateString);
    return format(normalizedDate, "d 'de' MMMM, yyyy", { locale: es });
  };

  // Procesar reservaciones
  const groupedReservations: GroupedReservation[] = (() => {
    if (!tripId || !reservations) return [];
    
    try {
      // Filtrar solo reservaciones que tienen pasajeros
      const relevantReservations = reservations.map(res => {
        if (!res.passengers || !Array.isArray(res.passengers)) {
          return {...res, passengers: []};
        }
        return res;
      });
      
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
          tripSegment: reservation.segmentOrigin && reservation.segmentDestination ? 
            `${reservation.segmentOrigin} → ${reservation.segmentDestination}` : 
            'Viaje completo',
          passengers: []
        };
        
        // Añadir todos los pasajeros de esta reservación
        if (Array.isArray(reservation.passengers)) {
          for (const passenger of reservation.passengers) {
            if (!passenger) continue;
            
            groupedReservation.passengers.push({
              id: passenger.id || 0,
              firstName: passenger.firstName || 'Sin nombre',
              lastName: passenger.lastName || 'Sin apellido',
              initials: passenger.firstName && passenger.lastName ? 
                `${passenger.firstName.charAt(0)}${passenger.lastName.charAt(0)}`.toUpperCase() : 'XX'
            });
          }
        }
        
        groupedResult.push(groupedReservation);
      }
      
      return groupedResult;
    } catch (error) {
      console.error("Error al procesar reservaciones:", error);
      return [];
    }
  })();

  // Total de pasajeros
  const totalPassengers = groupedReservations.reduce((total, res) => total + res.passengers.length, 0);

  if (isLoadingTripDetails || isLoadingReservations) {
    return (
      <div className="absolute inset-y-0 right-0 w-full md:w-1/2 lg:w-1/3 bg-white shadow-xl">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">Cargando...</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex justify-center items-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (tripError || !tripDetails) {
    return (
      <div className="absolute inset-y-0 right-0 w-full md:w-1/2 lg:w-1/3 bg-white shadow-xl">
        <div className="flex justify-between items-center p-4 border-b">
          <h2 className="text-lg font-semibold">Error</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="p-4">
          <p className="text-red-500">
            {tripError instanceof Error 
              ? tripError.message 
              : "No se pudo cargar la información del viaje"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-y-0 right-0 w-full md:w-1/2 lg:w-1/3 bg-white shadow-xl overflow-y-auto">
      <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white z-10">
        <h2 className="text-lg font-semibold">Lista de Pasajeros</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      <div className="p-4">
        {/* Información del viaje */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold">{tripDetails.route?.name}</h3>
          <p className="text-gray-500">
            {tripDetails.segmentOrigin || (tripDetails.route?.origin || 'Origen')} → 
            {tripDetails.segmentDestination || (tripDetails.route?.destination || 'Destino')}
          </p>
          
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex items-center text-gray-600">
              <Calendar className="h-4 w-4 mr-2" />
              {formatDisplayDate(tripDetails.departureDate)}
            </div>
            
            <div className="flex items-center text-gray-600">
              <Clock className="h-4 w-4 mr-2" />
              {tripDetails.departureTime} - {tripDetails.arrivalTime}
            </div>
            
            {tripDetails.vehicleType && (
              <div className="flex items-center text-gray-600">
                <Bus className="h-4 w-4 mr-2" />
                <span className="capitalize">{tripDetails.vehicleType}</span>
              </div>
            )}
          </div>
          
          <div className="mt-4 p-3 bg-blue-50 rounded-md flex items-center">
            <Users className="h-5 w-5 text-blue-500 mr-2" />
            <span className="font-medium text-blue-700">{totalPassengers} pasajeros</span>
          </div>
        </div>
        
        <Separator className="my-4" />
        
        {/* Lista de pasajeros */}
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
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  +{reservation.passengers.length - 3}
                                </AvatarFallback>
                              </Avatar>
                            )}
                          </>
                        ) : (
                          <Avatar className="border-2 border-background">
                            <AvatarFallback className="bg-gray-200 text-gray-500">
                              0
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                      <div>
                        <div className="font-medium">
                          {reservation.passengers.length} {reservation.passengers.length === 1 ? 'pasajero' : 'pasajeros'}
                        </div>
                        <div className="text-sm text-gray-500">{reservation.code}</div>
                      </div>
                    </div>
                    <div className="text-sm">
                      {reservation.passengers.map((passenger) => (
                        <div key={passenger.id} className="mb-1">
                          <span className="font-medium">{passenger.firstName} {passenger.lastName}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {reservation.paymentMethod && (
                        <Badge variant="outline" className="capitalize">
                          {reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 
                          reservation.paymentMethod === 'transferencia' ? 'Transferencia' : 
                          reservation.paymentMethod}
                        </Badge>
                      )}
                      <Badge variant={reservation.paymentStatus === 'paid' ? 'success' : 'secondary'}>
                        {reservation.paymentStatus === 'paid' ? 'PAGADO' : 'PENDIENTE'}
                      </Badge>
                    </div>
                  </div>
                  <div className="md:text-right">
                    <div className="text-lg font-bold">
                      ${reservation.amount}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">{reservation.email}</div>
                    <div className="text-sm text-gray-500">{reservation.phone}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <UserIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-medium mb-2">No hay pasajeros registrados</h3>
            <p>Este viaje no tiene reservaciones o pasajeros.</p>
          </div>
        )}
      </div>
    </div>
  );
}