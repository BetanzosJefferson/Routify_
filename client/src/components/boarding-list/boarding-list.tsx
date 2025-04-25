import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { 
  CalendarIcon, 
  ClipboardListIcon,
  Users, 
  Calendar,
  MapPin,
  Clock,
  Bus
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

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
  paymentStatus: string;
  notes?: string;
  totalAmount: number;
  passengers: Passenger[];
}

export function BoardingList() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedTrip, setSelectedTrip] = useState<number | null>(null);
  const [passengerListOpen, setPassengerListOpen] = useState(false);
  
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

  // Filtrar para obtener solo viajes principales (no sub-viajes) y por fecha seleccionada
  const filteredTrips = trips?.filter(trip => {
    // Filtrar por viajes principales
    if (trip.isSubTrip) return false;
    
    // Convertir cadena de fecha a objeto Date y obtener solo la parte de la fecha (sin hora)
    // Aseguramos que trip.departureDate sea una cadena (ya que podría ser un objeto Date)
    const tripDate = typeof trip.departureDate === 'string' 
      ? trip.departureDate.split('T')[0] 
      : format(new Date(trip.departureDate), 'yyyy-MM-dd');
      
    const currentDateStr = format(currentDate, 'yyyy-MM-dd');
    
    // Comparar las cadenas de fecha directamente
    return tripDate === currentDateStr;
  }) || [];

  // Calcular pasajeros del viaje seleccionado con detección de relaciones de viajes
  // El uso de la IIFE garantiza que el cálculo se realice cada vez que se renderiza el componente
  const selectedTripPassengers = (() => {
    // Protección contra datos nulos o no disponibles
    if (!selectedTrip || !reservations || !trips) return [];
    
    try {
      // Obtener el viaje seleccionado para verificar si es principal o subviaje
      const currentTrip = trips.find(t => t.id === selectedTrip);
      if (!currentTrip) return [];
      
      let relevantTripIds = [];
      
      // 1. Si es un viaje principal, incluir también a sus sub-viajes
      if (!currentTrip.isSubTrip) {
        relevantTripIds.push(selectedTrip);
        
        // Añadir IDs de sub-viajes
        const subTripIds = trips
          .filter(t => t.parentTripId === selectedTrip)
          .map(t => t.id);
        
        relevantTripIds = [...relevantTripIds, ...subTripIds];
        console.log("Viaje principal y sus sub-viajes:", relevantTripIds);
      } 
      // 2. Si es un sub-viaje, incluir solo a ese viaje
      else {
        relevantTripIds.push(selectedTrip);
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

  // Función para formatear fecha para su visualización con ajuste para zona horaria
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

  // Función para formatear fecha para el encabezado
  const formatHeaderDate = (date: Date) => {
    return format(date, "d 'de' MMMM, yyyy", { locale: es });
  };
  
  // Función para formatear fecha para input date
  const formatDateForInput = (date: Date) => {
    return format(date, "yyyy-MM-dd");
  };

  // Función para obtener información del viaje seleccionado
  const getSelectedTripInfo = () => {
    return trips?.find(trip => trip.id === selectedTrip);
  };

  // Función para obtener conteo de pasajeros por viaje, incluyendo subviajes si aplica
  const getPassengerCount = (tripId: number) => {
    if (!trips || !reservations) return 0;
    
    // Obtener el viaje para determinar si es principal o sub-viaje
    const trip = trips.find(t => t.id === tripId);
    if (!trip) return 0;
    
    let relevantTripIds = [tripId];
    
    // Si es un viaje principal, incluir también pasajeros de subviajes
    if (!trip.isSubTrip) {
      const subTripIds = trips
        .filter(t => t.parentTripId === tripId)
        .map(t => t.id);
      
      relevantTripIds = [...relevantTripIds, ...subTripIds];
    }
    
    // Contar pasajeros en todos los viajes relevantes
    return reservations
      .filter(r => relevantTripIds.includes(r.tripId))
      .reduce((count, reservation) => count + (reservation.passengers?.length || 0), 0);
  };

  return (
    <div className="py-6">
      <div className="flex items-center mb-4">
        <div className="rounded-full bg-primary bg-opacity-10 p-2 mr-3">
          <ClipboardListIcon className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800">Lista de Abordaje</h2>
      </div>

      {/* Selector de fecha */}
      <div className="flex justify-center items-center mb-6">
        <div className="w-full max-w-md">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <CalendarIcon className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              type="date"
              className="pl-10 pr-4 py-2 w-full"
              value={formatDateForInput(currentDate)}
              onChange={(e) => {
                if (e.target.value) {
                  // Al crear la fecha con formato yyyy-MM-dd, usar el constructor con año, mes, día para evitar problemas de zona horaria
                  const [year, month, day] = e.target.value.split('-').map(Number);
                  // Meses en JavaScript son 0-indexados (0-11), pero en el input date son 1-indexados (1-12)
                  const newDate = new Date(year, month - 1, day, 12, 0, 0);
                  setCurrentDate(newDate);
                  setSelectedTrip(null); // Reseteamos la selección al cambiar de fecha
                } else {
                  setCurrentDate(new Date());
                  setSelectedTrip(null);
                }
              }}
            />
          </div>
        </div>
      </div>

      {isLoadingTrips || isLoadingReservations ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredTrips.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTrips.map(trip => {
            const passengerCount = getPassengerCount(trip.id);
            const occupancyRate = Math.round(((trip.capacity - trip.availableSeats) / trip.capacity) * 100);
            
            return (
              <Card 
                key={trip.id} 
                className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedTrip(trip.id);
                  setPassengerListOpen(true);
                }}
              >
                <CardContent className="p-0">
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{trip.route.name}</h3>
                        <p className="text-sm text-gray-500">
                          {trip.segmentOrigin || trip.route.origin} → {trip.segmentDestination || trip.route.destination}
                        </p>
                      </div>
                      <Badge variant={trip.status === "scheduled" ? "outline" : trip.status === "in-progress" ? "default" : "secondary"}>
                        {trip.status === "scheduled" 
                          ? "Programado" 
                          : trip.status === "in-progress" 
                            ? "En Progreso" 
                            : trip.status === "completed" 
                              ? "Completado" 
                              : "Cancelado"}
                      </Badge>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center text-gray-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        {formatDisplayDate(trip.departureDate)}
                      </div>
                      
                      <div className="flex items-center text-gray-600">
                        <MapPin className="h-4 w-4 mr-2" />
                        {trip.route.origin} → {trip.route.destination}
                      </div>
                      
                      <div className="flex items-center text-gray-600">
                        <Clock className="h-4 w-4 mr-2" />
                        {trip.departureTime} - {trip.arrivalTime}
                      </div>
                      
                      {trip.vehicleType && (
                        <div className="flex items-center text-gray-600">
                          <Bus className="h-4 w-4 mr-2" />
                          {trip.vehicleType}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between border-t p-3 bg-gray-50">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2 text-gray-500" />
                      <span className="text-sm font-medium">{passengerCount} pasajeros</span>
                    </div>
                    
                    <Badge variant={
                      occupancyRate < 50 ? "outline" : 
                      occupancyRate < 80 ? "secondary" : 
                      "default"
                    }>
                      {occupancyRate}% ocupación
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <ClipboardListIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium mb-2">No hay viajes programados</h3>
          <p>No se encontraron viajes para la fecha seleccionada.</p>
        </div>
      )}

      {/* Modal Lista de Pasajeros */}
      <Dialog open={passengerListOpen} onOpenChange={setPassengerListOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lista de Pasajeros</DialogTitle>
            <DialogDescription>
              {getSelectedTripInfo()?.route.name} - {formatHeaderDate(currentDate)}
            </DialogDescription>
            <p className="text-sm text-gray-500 mt-1">
              {getSelectedTripInfo()?.segmentOrigin || getSelectedTripInfo()?.route.origin} → {getSelectedTripInfo()?.segmentDestination || getSelectedTripInfo()?.route.destination}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {getSelectedTripInfo() && formatDisplayDate(getSelectedTripInfo()!.departureDate)}
            </p>
          </DialogHeader>

          <div className="mt-4">
            {selectedTripPassengers.length > 0 ? (
              <div className="space-y-4">
                <div className="bg-gray-50 p-3 rounded-md mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Users className="h-5 w-5 mr-2 text-gray-500" />
                      <span className="font-medium">{selectedTripPassengers.length} pasajeros</span>
                    </div>
                    <div>
                      <Badge variant="outline" className="ml-2">
                        {getSelectedTripInfo()?.departureTime}
                      </Badge>
                    </div>
                  </div>
                </div>

                {Array.isArray(selectedTripPassengers) && selectedTripPassengers.map((passenger, index) => {
                  // Verificación de seguridad para asegurar que todos los datos necesarios están presentes
                  if (!passenger || !passenger.firstName || !passenger.lastName) {
                    return null;
                  }
                  
                  return (
                    <div 
                      key={`passenger-${passenger.id}-${index}`} 
                      className={`p-3 border rounded-md ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar className="h-10 w-10 border border-gray-200">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {passenger.firstName.charAt(0)}{passenger.lastName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {passenger.firstName} {passenger.lastName}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            {passenger.reservationCode} • 
                            <span className={`ml-1 ${
                              passenger.paymentStatus === 'paid' 
                                ? 'text-green-600' 
                                : 'text-orange-600'
                            }`}>
                              {passenger.paymentMethod === 'cash' ? 'Efectivo' : 'Transferencia'}
                            </span>
                          </p>
                          {passenger.tripSegment && (
                            <p className="text-xs text-gray-400 mt-1 truncate">
                              {passenger.tripSegment}
                            </p>
                          )}
                        </div>
                        
                        <Badge 
                          variant={passenger.paymentStatus === 'paid' ? 'default' : 'outline'}
                          className="ml-2"
                        >
                          {passenger.paymentStatus === 'paid' ? 'Pagado' : 'Pendiente'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium mb-2">Sin pasajeros</h3>
                <p>No hay pasajeros registrados para este viaje.</p>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <Button 
              variant="outline" 
              onClick={() => setPassengerListOpen(false)}
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}