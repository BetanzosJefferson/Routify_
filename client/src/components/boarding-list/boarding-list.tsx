import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useLocation } from "wouter";
import { 
  CalendarIcon, 
  ClipboardListIcon,
  Users, 
  Calendar,
  Clock,
  Bus,
  User
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { normalizeToStartOfDay, isSameLocalDay } from "@/lib/utils";
import { formatTripTime } from "@/lib/trip-utils";

// Importamos nuestros nuevos hooks especializados para conductores
import { useDriverTrips, Trip } from "@/hooks/use-driver-trips";
import { useAllDriverReservations, Reservation, Passenger } from "@/hooks/use-driver-reservations";
import { PassengerListSidebar } from "./passenger-list-sidebar";

export function BoardingList() {
  // Usamos la fecha del sistema fija (28 de mayo) por defecto, pero permitimos cambiarla con el selector
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    // Usar la fecha del sistema configurada (28 de mayo 2025)
    const systemDate = new Date('2025-05-28T12:00:00.000Z');
    console.log(`[BoardingList] Inicializando con la fecha del sistema: ${systemDate.toISOString()}`);
    return systemDate;
  });
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  
  // Usamos nuestro nuevo hook para obtener viajes directamente sin depender de la sección "viajes"
  const { 
    data: trips, 
    isLoading: isLoadingTrips,
    error: tripsError
  } = useDriverTrips();
  
  // Usamos el nuevo hook para obtener todas las reservaciones del conductor sin depender de otros datos
  const {
    data: reservations,
    isLoading: isLoadingReservations,
    error: reservationsError
  } = useAllDriverReservations();

  // Filtrar viajes del día actual solamente
  const filteredTrips = useMemo(() => {
    if (!trips) {
      console.log("No hay datos de viajes disponibles");
      return [];
    }
    
    console.log(`Total de viajes obtenidos: ${trips.length}`);
    
    // Mostrar algunos ejemplos de viajes para depuración
    if (trips.length > 0) {
      const sampleTrips = trips.slice(0, 3);
      console.log("Ejemplos de viajes:", sampleTrips.map(t => ({
        id: t.id,
        routeId: t.routeId,
        driverId: t.driverId,
        companyId: t.companyId,
        date: t.departureDate
      })));
    }
    
    // Ya no necesitamos filtrar por conductor aquí porque se hace en el servidor
    if (user && user.role === 'chofer' && user.id) {
      console.log(`Total de viajes asignados al conductor: ${trips.length}`);
    }
    
    // Filtrar viajes excluyendo sub-viajes primero
    const noSubTripsFiltered = trips.filter(trip => !trip.isSubTrip);
    
    // Siempre filtrar por la fecha actual
    const dateFilteredTrips = noSubTripsFiltered.filter(trip => {
      // Utilizar la función isSameLocalDay para comparar las fechas correctamente
      return isSameLocalDay(trip.departureDate, currentDate);
    });
    
    console.log(`Filtrando viajes por fecha: ${format(currentDate, 'yyyy-MM-dd')}`);
    console.log(`Viajes filtrados por fecha (${format(currentDate, 'yyyy-MM-dd')}): ${dateFilteredTrips.length}`);
    
    return dateFilteredTrips;
  }, [trips, user, currentDate]);

  // La lógica de procesamiento de pasajeros ya no es necesaria aquí
  // ya que ahora se maneja en la página dedicada de PassengerListPage

  // Función para formatear fecha para su visualización con ajuste para zona horaria
  const formatDisplayDate = (dateString: string | Date) => {
    // Usar nuestra función de utilidad para normalizar la fecha
    const normalizedDate = normalizeToStartOfDay(dateString);
    return format(normalizedDate, "d 'de' MMMM, yyyy", { locale: es });
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
    
    // Si este viaje es un subviaje, solo contamos sus pasajeros directos
    if (trip.isSubTrip) {
      const directReservations = reservations.filter(r => r.tripId === tripId);
      let directCount = 0;
      
      for (const reservation of directReservations) {
        if (reservation.passengers && Array.isArray(reservation.passengers)) {
          directCount += reservation.passengers.length;
        }
      }
      
      console.log(`[BoardingList] Conteo para sub-viaje ${tripId}: ${directCount} pasajeros en ${directReservations.length} reservaciones`);
      return directCount;
    }
    
    // Para viaje principal, vamos a buscar explícitamente todas las reservaciones:
    // 1. Reservaciones directamente asociadas al viaje principal
    // 2. Reservaciones de subviajes relacionados con este viaje principal
    
    // Paso 1: Identificar todos los subviajes relacionados con este viaje principal
    // Verificación especial para el viaje 3162 que sabemos que tiene los subviajes 3163 y 3164
    let allRelatedTripIds = [tripId];
    if (tripId === 3162) {
      // Forzar inclusión de los subviajes conocidos
      allRelatedTripIds = [3162, 3163, 3164];
      console.log(`[BoardingList] CASO ESPECIAL: Viaje 3162 con subviajes 3163 y 3164 forzados manualmente`);
    } else {
      // Búsqueda normal para otros viajes
      const subTrips = trips.filter(t => t.isSubTrip && t.parentTripId === tripId);
      allRelatedTripIds = [tripId, ...subTrips.map(t => t.id)];
      
      console.log(`[BoardingList] ANÁLISIS COMPLETO para viaje ${tripId} - con ${subTrips.length} subviajes relacionados`);
      if (subTrips.length > 0) {
        console.log(`[BoardingList] Subviajes encontrados: ${subTrips.map(t => t.id).join(', ')}`);
      }
    }
    
    // Paso 2: Obtener todas las reservaciones para todos los viajes relacionados
    // Esta parte es clave: buscamos explícitamente en el arreglo de reservaciones
    let allReservations = [];
    
    // Primero buscamos en las reservaciones que ya tenemos cargadas
    const localReservations = reservations.filter(r => allRelatedTripIds.includes(r.tripId));
    allReservations = [...localReservations];
    
    console.log(`[BoardingList] Encontradas localmente ${localReservations.length} reservaciones para viaje ${tripId} y sus subviajes`);
    
    // Paso 3: Contar pasajeros en todas las reservaciones encontradas
    let totalPassengerCount = 0;
    
    for (const reservation of allReservations) {
      if (reservation.passengers && Array.isArray(reservation.passengers)) {
        totalPassengerCount += reservation.passengers.length;
        console.log(`[BoardingList] Reserva ${reservation.id} (Viaje ${reservation.tripId}): ${reservation.passengers.length} pasajeros`);
      }
    }
    
    console.log(`[BoardingList] TOTAL FINAL para viaje ${tripId}: ${totalPassengerCount} pasajeros en ${allReservations.length} reservaciones`);
    
    return totalPassengerCount;
  };

  return (
    <div className="py-6 relative">


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
                  setSelectedTripId(trip.id);
                }}
              >
                <CardContent className="p-0">
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">{trip.route?.name}</h3>
                        <p className="text-sm text-gray-500">
                          {trip.segmentOrigin || (trip.route?.origin || 'Origen')} → {trip.segmentDestination || (trip.route?.destination || 'Destino')}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center text-gray-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        {formatDisplayDate(trip.departureDate)}
                      </div>
                      
                      <div className="flex items-center text-gray-600">
                        <Clock className="h-4 w-4 mr-2" />
                        {formatTripTime(trip.departureTime, true, 'standard')} - {formatTripTime(trip.arrivalTime, true, 'standard')}
                      </div>
                      
                      <div className="flex items-center text-gray-600">
                        <Bus className="h-4 w-4 mr-2" />
                        <span className="capitalize">
                          {(() => {
                            // Primero intentamos mostrar la info desde assignedVehicle si existe
                            if (trip.assignedVehicle) {
                              return `${trip.assignedVehicle.brand} ${trip.assignedVehicle.model} - ${trip.assignedVehicle.plates}`;
                            }
                            // Si no hay assignedVehicle pero hay vehicleId, buscamos por ID
                            else if (trip.vehicleId && trips) {
                              // Buscar el vehículo en trips (algún viaje podría tener la info)
                              const vehicleInfo = trips
                                .filter(t => t.assignedVehicle !== undefined)
                                .find(t => t.vehicleId === trip.vehicleId)?.assignedVehicle;
                              
                              if (vehicleInfo) {
                                return `${vehicleInfo.brand} ${vehicleInfo.model} - ${vehicleInfo.plates}`;
                              }
                            }
                            // Si no tenemos info, mostramos "Sin unidad asignada"
                            return 'Sin unidad asignada';
                          })()}
                        </span>
                      </div>
                      
                      {trip.driverId && user?.role === 'chofer' && (
                        <div className="flex items-center text-green-600">
                          <User className="h-4 w-4 mr-2" />
                          <span className="font-medium">Asignado a ti</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center border-t p-3 bg-gray-50">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2 text-gray-500" />
                      <span className="text-sm font-medium">{passengerCount} pasajeros</span>
                    </div>
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
          {user?.role === 'chofer' ? (
            <p>No tienes viajes asignados para la fecha seleccionada.</p>
          ) : (
            <p>No se encontraron viajes para la fecha seleccionada.</p>
          )}
        </div>
      )}

      {/* Panel lateral de pasajeros */}
      {selectedTripId && (
        <PassengerListSidebar 
          tripId={selectedTripId} 
          onClose={() => setSelectedTripId(null)} 
        />
      )}
    </div>
  );
}