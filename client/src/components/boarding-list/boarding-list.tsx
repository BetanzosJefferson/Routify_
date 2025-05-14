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
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [showAllTrips, setShowAllTrips] = useState<boolean>(true);
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

  // Filtrar viajes según el rol del usuario y la fecha seleccionada
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
    
    let filteredList = trips;
    
    // Ya no necesitamos filtrar por conductor aquí porque se hace en el servidor
    // Ahora solo registramos el conteo para depuración
    if (user && user.role === 'chofer' && user.id) {
      console.log(`Total de viajes asignados al conductor: ${trips.length}`);
    }
    
    // Filtrar viajes excluyendo sub-viajes primero
    const noSubTripsFiltered = filteredList.filter(trip => !trip.isSubTrip);
    
    // Determinar si filtrar por fecha
    let dateFilteredTrips;
    
    if (showAllTrips && user?.role === 'chofer') {
      // Si showAllTrips es true y el usuario es chofer, mostrar todos los viajes asignados
      dateFilteredTrips = noSubTripsFiltered;
      console.log(`Mostrando todos los viajes asignados al chofer (${noSubTripsFiltered.length}) sin filtro de fecha`);
    } else {
      // Filtrar por fecha seleccionada usando nuestra nueva función de utilidad
      dateFilteredTrips = noSubTripsFiltered.filter(trip => {
        // Utilizar la función isSameLocalDay para comparar las fechas correctamente
        return isSameLocalDay(trip.departureDate, currentDate);
      });
      
      console.log(`Filtrando viajes por fecha: ${format(currentDate, 'yyyy-MM-dd')}`);
    }
    
    console.log(`Viajes filtrados${showAllTrips ? " (mostrando todos)" : ` por fecha (${format(currentDate, 'yyyy-MM-dd')}`}: ${dateFilteredTrips.length}`);
    return dateFilteredTrips;
  }, [trips, user, currentDate, showAllTrips]);

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
    
    let relevantTripIds = [tripId];
    
    // Si es un viaje principal, incluir también pasajeros de subviajes
    if (!trip.isSubTrip) {
      const subTripIds = trips
        .filter(t => t.parentTripId === tripId)
        .map(t => t.id);
      
      relevantTripIds = [...relevantTripIds, ...subTripIds];
    }
    
    // Contar todos los pasajeros en todos los viajes relevantes
    let totalPassengers = 0;
    
    // Filtrar reservaciones para los viajes relevantes
    const relevantReservations = reservations.filter(r => relevantTripIds.includes(r.tripId));
    
    console.log(`[BoardingList] Contando pasajeros para viaje ${tripId} (incluye ${relevantTripIds.length} viajes relacionados)`);
    console.log(`[BoardingList] Encontradas ${relevantReservations.length} reservaciones relevantes`);
    
    // Contar el número total de pasajeros en todas las reservaciones relevantes
    for (const reservation of relevantReservations) {
      if (reservation.passengers && Array.isArray(reservation.passengers)) {
        totalPassengers += reservation.passengers.length;
        console.log(`[BoardingList] Reserva ${reservation.id}: ${reservation.passengers.length} pasajeros`);
      }
    }
    
    console.log(`[BoardingList] Total de pasajeros para viaje ${tripId}: ${totalPassengers}`);
    return totalPassengers;
  };

  return (
    <div className="py-6 relative">
      <div className="flex items-center mb-4">
        <div className="rounded-full bg-primary bg-opacity-10 p-2 mr-3">
          <ClipboardListIcon className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Lista de Abordaje</h2>
          {user?.role === 'chofer' && (
            <div>
              <p className="text-sm text-gray-500 mb-1">
                {showAllTrips 
                  ? "Mostrando todos tus viajes asignados. Usa el calendario para filtrar por fecha." 
                  : `Mostrando sólo viajes para el ${formatDisplayDate(currentDate)}.`}
              </p>
              <button 
                onClick={(e) => {
                  e.preventDefault();
                  setShowAllTrips(!showAllTrips);
                }}
                className="text-xs text-primary hover:text-primary-dark underline"
              >
                {showAllTrips 
                  ? "Ver solo viajes de la fecha seleccionada" 
                  : "Ver todos mis viajes asignados"}
              </button>
            </div>
          )}
        </div>
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