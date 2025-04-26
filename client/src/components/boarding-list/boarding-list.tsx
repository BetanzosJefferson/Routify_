import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { 
  CalendarIcon, 
  ClipboardListIcon,
  Users, 
  Calendar,
  Clock,
  Bus
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
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
  const [, navigate] = useLocation();
  const { user } = useAuth();
  
  // Fetch trips assigned to the driver
  const { data: trips, isLoading: isLoadingTrips } = useQuery<Trip[]>({
    queryKey: ["/api/trips", { driverId: user?.id }],
    staleTime: 5000,
    refetchInterval: 15000,
    enabled: !!user && user.role === "chofer",
  });

  // Fetch all reservations
  const { data: reservations, isLoading: isLoadingReservations } = useQuery<Reservation[]>({
    queryKey: ["/api/reservations"],
    staleTime: 5000,
    refetchInterval: 15000,
    enabled: !!trips && trips.length > 0,
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

  // La lógica de procesamiento de pasajeros ya no es necesaria aquí
  // ya que ahora se maneja en la página dedicada de PassengerListPage

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

  // Función para formatear fecha para input date
  const formatDateForInput = (date: Date) => {
    return format(date, "yyyy-MM-dd");
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
                } else {
                  setCurrentDate(new Date());
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
                  navigate(`/trip/${trip.id}/passengers`);
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
                        <Clock className="h-4 w-4 mr-2" />
                        {trip.departureTime} - {trip.arrivalTime}
                      </div>
                      
                      {trip.vehicleType && (
                        <div className="flex items-center text-gray-600">
                          <Bus className="h-4 w-4 mr-2" />
                          <span className="capitalize">{trip.vehicleType}</span>
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
    </div>
  );
}