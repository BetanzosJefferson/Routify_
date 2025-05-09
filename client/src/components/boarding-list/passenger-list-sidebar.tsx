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
  UserIcon,
  Search
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input"; 
import { useDriverTrips, Trip } from "@/hooks/use-driver-trips";
import { useDriverReservations, Reservation, Passenger } from "@/hooks/use-driver-reservations";
import { normalizeToStartOfDay, formatPrice } from "@/lib/utils";

interface GroupedReservation {
  id: number;
  code: string;
  tripId: number;
  email: string;
  phone: string;
  paymentMethod: string;
  paymentStatus: string;
  amount: number;
  advanceAmount: number | null;
  advancePaymentMethod: string | null;
  tripSegment: string;
  origin?: string;
  destination?: string;
  notes?: string;
  finalPaymentAmount?: number;
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
  // Estado para la búsqueda de pasajeros
  const [searchQuery, setSearchQuery] = useState("");
  
  // Cargar detalles del viaje
  const { 
    data: trips, 
    isLoading: isLoadingTripDetails, 
    error: tripError 
  } = useDriverTrips();
  
  // Buscar el viaje específico en la lista de viajes
  const tripDetails = trips?.find(trip => trip.id === tripId);
  
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
        
        // Obtener información del viaje asociado
        const trip = trips?.find(trip => trip.id === reservation.tripId);
        
        // Crear el objeto de reservación agrupada
        const groupedReservation: GroupedReservation = {
          id: reservation.id,
          code: `R-${reservation.id.toString().padStart(6, '0')}`,
          tripId: reservation.tripId,
          email: reservation.email || '',
          phone: reservation.phone || '',
          paymentMethod: reservation.paymentMethod || 'efectivo',
          paymentStatus: reservation.paymentStatus || 'pendiente',
          amount: reservation.totalAmount || 0,
          advanceAmount: (reservation as any).advanceAmount || 0,
          advancePaymentMethod: (reservation as any).advancePaymentMethod || 'efectivo',
          tripSegment: 'Viaje completo',
          origin: reservation.origin || trip?.segmentOrigin || trip?.route?.origin || "Origen no especificado",
          destination: reservation.destination || trip?.segmentDestination || trip?.route?.destination || "Destino no especificado",
          notes: (reservation as any).notes || '',
          finalPaymentAmount: reservation.paymentStatus === 'pagado' ? 
            ((reservation.totalAmount || 0) - ((reservation as any).advanceAmount || 0)) : 0,
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

  // Filtrar reservaciones basadas en el término de búsqueda
  const filteredReservations = searchQuery.trim() 
    ? groupedReservations.filter(reservation => {
        const query = searchQuery.toLowerCase();
        
        // Buscar en nombres de pasajeros
        const matchesPassenger = reservation.passengers.some(
          passenger => `${passenger.firstName} ${passenger.lastName}`.toLowerCase().includes(query)
        );
        
        // Buscar en código de reservación
        const matchesCode = reservation.code.toLowerCase().includes(query);
        
        // Buscar en email
        const matchesEmail = reservation.email.toLowerCase().includes(query);
        
        // Buscar en teléfono
        const matchesPhone = reservation.phone.toLowerCase().includes(query);
        
        // Buscar en origen/destino
        const matchesOriginDestination = tripDetails ? (
          (tripDetails.segmentOrigin || '').toLowerCase().includes(query) || 
          (tripDetails.segmentDestination || '').toLowerCase().includes(query) ||
          (tripDetails.route?.origin || '').toLowerCase().includes(query) || 
          (tripDetails.route?.destination || '').toLowerCase().includes(query)
        ) : false;
        
        return matchesPassenger || matchesCode || matchesEmail || matchesPhone || matchesOriginDestination;
      })
    : groupedReservations;
  
  // Total de pasajeros (solo muestra total de todos los pasajeros, no de los filtrados)
  const totalPassengers = groupedReservations.reduce((total, res) => total + res.passengers.length, 0);

  if (isLoadingTripDetails || isLoadingReservations) {
    return (
      <div 
        className="fixed inset-y-0 right-0 w-full md:w-[500px] lg:w-[550px] bg-white shadow-2xl overflow-y-auto transition-all duration-300 ease-in-out z-50 border-l border-gray-200 max-w-[95%]"
        style={{ 
          boxShadow: "-10px 0 15px -3px rgba(0, 0, 0, 0.1), -4px 0 6px -2px rgba(0, 0, 0, 0.05)",
        }}
      >
        <div className="flex justify-between items-center p-5 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-gray-800">Cargando...</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-gray-100">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex flex-col justify-center items-center h-[calc(100vh-80px)]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-500">Cargando datos del viaje...</p>
        </div>
      </div>
    );
  }

  if (tripError || !tripDetails) {
    return (
      <div 
        className="fixed inset-y-0 right-0 w-full md:w-[500px] lg:w-[550px] bg-white shadow-2xl overflow-y-auto transition-all duration-300 ease-in-out z-50 border-l border-gray-200 max-w-[95%]"
        style={{ 
          boxShadow: "-10px 0 15px -3px rgba(0, 0, 0, 0.1), -4px 0 6px -2px rgba(0, 0, 0, 0.05)",
        }}
      >
        <div className="flex justify-between items-center p-5 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-gray-800">Error</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-gray-100">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="p-8 flex flex-col items-center justify-center">
          <div className="rounded-full bg-red-100 p-3 mb-4">
            <X className="h-6 w-6 text-red-500" />
          </div>
          <h3 className="text-lg font-medium mb-2 text-gray-800">No se pudo cargar la información</h3>
          <p className="text-red-500 text-center mb-4">
            {tripError instanceof Error 
              ? tripError.message 
              : "No se pudo cargar la información del viaje"}
          </p>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-y-0 right-0 w-full md:w-[500px] lg:w-[550px] bg-white shadow-2xl overflow-y-auto transition-all duration-300 ease-in-out z-50 border-l border-gray-200 max-w-[95%]"
      style={{ 
        boxShadow: "-10px 0 15px -3px rgba(0, 0, 0, 0.1), -4px 0 6px -2px rgba(0, 0, 0, 0.05)",
      }}
    >
      <div className="flex justify-between items-center p-5 border-b sticky top-0 bg-white z-10">
        <h2 className="text-xl font-semibold text-gray-800">Lista de Pasajeros</h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-gray-100">
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      <div className="p-6">
        {/* Información del viaje */}
        <div className="mb-6 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-xl font-semibold mb-1">{tripDetails.route?.name}</h3>
          <p className="text-gray-600 font-medium mb-3">
            {tripDetails.segmentOrigin || (tripDetails.route?.origin || 'Origen')} → 
            {tripDetails.segmentDestination || (tripDetails.route?.destination || 'Destino')}
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="flex items-center bg-gray-50 p-3 rounded-lg">
              <div className="rounded-full bg-blue-100 p-2 mr-3">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500">Fecha</div>
                <div className="text-sm font-medium">{formatDisplayDate(tripDetails.departureDate)}</div>
              </div>
            </div>
            
            <div className="flex items-center bg-gray-50 p-3 rounded-lg">
              <div className="rounded-full bg-purple-100 p-2 mr-3">
                <Clock className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500">Horario</div>
                <div className="text-sm font-medium">{tripDetails.departureTime} - {tripDetails.arrivalTime}</div>
              </div>
            </div>
            
            <div className="flex items-center bg-gray-50 p-3 rounded-lg">
              <div className="rounded-full bg-green-100 p-2 mr-3">
                <Bus className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500">Vehículo</div>
                <div className="text-sm font-medium capitalize">
                  {(() => {
                    // Primero intentamos mostrar la info desde assignedVehicle si existe
                    if (tripDetails.assignedVehicle) {
                      return `${tripDetails.assignedVehicle.brand} ${tripDetails.assignedVehicle.model} - ${tripDetails.assignedVehicle.plates}`;
                    }
                    // Si no hay assignedVehicle pero hay vehicleId, buscamos por ID
                    else if (tripDetails.vehicleId) {
                      // Buscar el vehículo en trips (algún viaje podría tener la info)
                      const vehicleInfo = trips
                        ?.filter(t => t.assignedVehicle !== undefined)
                        .find(t => t.vehicleId === tripDetails.vehicleId)?.assignedVehicle;
                      
                      if (vehicleInfo) {
                        return `${vehicleInfo.brand} ${vehicleInfo.model} - ${vehicleInfo.plates}`;
                      }
                    }
                    // Si no tenemos info, mostramos "Sin unidad asignada"
                    return 'Sin unidad asignada';
                  })()}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center bg-blue-50 p-4 rounded-lg border border-blue-100">
            <div className="rounded-full bg-blue-100 p-2 mr-3">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-xs text-blue-600">Total de pasajeros</div>
              <div className="text-lg font-bold text-blue-700">{totalPassengers}</div>
            </div>
          </div>
        </div>
        
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Lista de Pasajeros</h3>
          
          {/* Campo de búsqueda */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por nombre, número, origen, destino o email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pl-10 pr-4 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
            <div className="absolute left-3 top-2.5 text-gray-400">
              <Search className="h-4 w-4" />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        
        {/* Lista de pasajeros */}
        {groupedReservations.length > 0 ? (
          <>
            {filteredReservations.length > 0 ? (
              <div className="space-y-4">
                {filteredReservations.map((reservation, index) => (
                  <div 
                    key={`reservation-${reservation.id}`} 
                    className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white hover:shadow-md transition-shadow"
                  >
                    <div className="border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center">
                          <div className="bg-primary/10 text-primary font-medium px-3 py-1 rounded-md mr-3">
                            {reservation.passengers.length} asientos
                          </div>
                          <div>
                            <div className="font-medium">
                              {reservation.passengers.length === 1 
                                ? reservation.passengers[0]?.firstName + ' ' + reservation.passengers[0]?.lastName 
                                : `${reservation.passengers[0]?.firstName || 'nombre'} ${reservation.passengers[0]?.lastName || 'del pasajero'}`}
                            </div>
                            <div className="text-xs text-gray-500">{reservation.code}</div>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <div className="text-xs text-gray-700 mb-1">
                            Anticipo: {formatPrice(reservation.advanceAmount || 0)} ({reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})
                          </div>
                          
                          {/* Mostrar "Pagó" solamente si está marcado como pagado */}
                          {reservation.paymentStatus === 'pagado' && (
                            <div className="text-xs text-gray-700 mb-1">
                              Pagó: {formatPrice(reservation.finalPaymentAmount || 0)} ({reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})
                            </div>
                          )}
                          
                          <div className="flex items-center">
                            <span className="text-sm font-medium mr-2">Por cobrar</span> 
                            <span className="text-lg font-bold text-primary">
                              {reservation.paymentStatus === 'pagado' 
                                ? '$ 0' 
                                : `$ ${(reservation.amount - (reservation.advanceAmount || 0)).toFixed(0)}`
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4">
                      {/* Datos de pasajeros */}
                      <div className="mb-3">
                        <div className="text-sm font-medium text-gray-800">
                          {reservation.passengers.length > 1 
                            ? (
                              <>
                                <div className="mb-1">
                                  {reservation.passengers.map((passenger, idx) => (
                                    <div key={idx}>
                                      {passenger.firstName} {passenger.lastName}
                                    </div>
                                  ))}
                                </div>
                              </>
                            ) 
                            : null}
                        </div>
                      </div>
                      
                      {/* Origen y destino simplificados */}
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div>
                          <div className="text-xs text-gray-500">Origen</div>
                          <div className="font-medium">
                            {reservation.origin && !reservation.origin.includes('no especificado') 
                              ? reservation.origin.split(' - ')[0]
                              : tripDetails?.route?.origin 
                                ? tripDetails.route.origin.split(' - ')[0]
                                : 'Acapulco de Juárez, Guerrero'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Destino</div>
                          <div className="font-medium">
                            {reservation.destination && !reservation.destination.includes('no especificado') 
                              ? reservation.destination.split(' - ')[0] 
                              : tripDetails?.route?.destination
                                ? tripDetails.route.destination.split(' - ')[0]
                                : 'Coyoacán, Ciudad de México'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Información de pago simplificada */}
                      <div className="mt-3">
                        <Badge 
                          variant="outline"
                          className={reservation.paymentStatus === 'pagado' 
                            ? 'bg-green-100 text-green-800 border-green-200' 
                            : 'bg-yellow-100 text-yellow-800 border-yellow-200'}
                        >
                          {reservation.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
                        </Badge>
                      </div>
                      
                      {/* Notas adicionales */}
                      {reservation.notes && reservation.notes.trim() !== '' && (
                        <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="text-xs text-gray-500 mb-1">Notas adicionales:</div>
                          <div className="text-sm">{reservation.notes}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-gray-50 rounded-lg border border-gray-200">
                <div className="rounded-full bg-gray-100 p-3 mx-auto w-14 h-14 mb-3 flex items-center justify-center">
                  <Search className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="text-base font-medium mb-1 text-gray-800">No se encontraron resultados</h3>
                <p className="text-gray-500 text-sm max-w-sm mx-auto">
                  No hay pasajeros que coincidan con tu búsqueda. Intenta con otros términos.
                </p>
                {searchQuery && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSearchQuery("")}
                    className="mt-3"
                  >
                    Limpiar búsqueda
                  </Button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200">
            <div className="rounded-full bg-gray-100 p-4 mx-auto w-16 h-16 mb-4 flex items-center justify-center">
              <UserIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium mb-2 text-gray-800">No hay pasajeros registrados</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              Este viaje no tiene reservaciones o pasajeros registrados en el sistema.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}