import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon, MapPinIcon, CalendarIcon, FilterIcon, ArrowLeft, Truck } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { formatDate, formatPrice } from "@/lib/utils";
import { format } from "date-fns";
import { extractLocationsFromTrips, formatTripTime } from "@/lib/trip-utils";

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LocationAdapter } from "@/components/ui/location-adapter";

// Utilities
import { TripWithRouteInfo } from "@shared/schema";

// Extendemos la interfaz TripWithRouteInfo para incluir los campos específicos que necesitamos
interface ExtendedTripInfo extends TripWithRouteInfo {
  originTerminal?: string;
  destinationTerminal?: string;
  routeName?: string;
}
import { normalizeToStartOfDay, formatDateForInput, formatDateForApiQuery } from "@/lib/utils";

interface SearchParams {
  origin?: string;
  destination?: string;
  date?: string;
  visibility?: string;
}

interface PackageTripSelectionProps {
  onTripSelect: (tripId: number) => void;
  onBack: () => void;
}

// Función para calcular la duración entre horas
function calculateDuration(departureTime: string, arrivalTime: string): string {
  if (!departureTime || !arrivalTime) return "1h";
  
  // Convertir a formato 24 horas para cálculos
  const parseDepartureTime = (time: string) => {
    let [hourMin, period] = time.split(' ');
    let [hours, minutes] = hourMin.split(':').map(Number);
    
    // Convertir a formato 24 horas
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    return { hours, minutes };
  };
  
  const departure = parseDepartureTime(departureTime);
  const arrival = parseDepartureTime(arrivalTime);
  
  // Calcular diferencia en minutos
  let totalMinutesDeparture = departure.hours * 60 + departure.minutes;
  let totalMinutesArrival = arrival.hours * 60 + arrival.minutes;
  
  // Si la llegada es al día siguiente (tiempo de llegada es menor que salida)
  if (totalMinutesArrival < totalMinutesDeparture) {
    totalMinutesArrival += 24 * 60; // Agregar 24 horas en minutos
  }
  
  const diffMinutes = totalMinutesArrival - totalMinutesDeparture;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  
  // Formatear el resultado
  if (hours === 0) {
    return `${minutes}m`;
  } else if (minutes === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${minutes}m`;
  }
}

export function PackageTripSelection({ onTripSelect, onBack }: PackageTripSelectionProps) {
  // Obtener la fecha actual formateada como YYYY-MM-DD en hora local
  const today = formatDateForInput(new Date());
  
  const [searchParams, setSearchParams] = useState<SearchParams>({ date: today });
  
  // Form state
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState(today);
  
  // Query for all trips to build autocomplete options
  const { data: allTrips, isLoading: isLoadingAll } = useQuery({
    queryKey: ["/api/trips"],
    queryFn: async () => {
      const response = await fetch("/api/trips");
      if (!response.ok) throw new Error("Failed to fetch trips");
      return await response.json() as ExtendedTripInfo[];
    },
  });
  
  // Filter trips based on search parameters
  const { data: trips, isLoading, isError } = useQuery({
    queryKey: ["/api/trips", searchParams],
    queryFn: async () => {
      const queryString = new URLSearchParams(
        Object.entries(searchParams).filter(([_, v]) => v !== undefined) as [string, string][]
      ).toString();
      
      const response = await fetch(`/api/trips${queryString ? `?${queryString}` : ''}`);
      if (!response.ok) throw new Error("Failed to fetch trips");
      const fetchedTrips = await response.json() as ExtendedTripInfo[];
      console.log("Trips with route info:", fetchedTrips);
      
      // Obtenemos datos completos, pues ahora TripWithRouteInfo incluye los campos que necesitamos
      const processedTrips = fetchedTrips.map(trip => ({
        ...trip,
        // Fallbacks por si acaso algún dato no viene completo
        originTerminal: trip.originTerminal || (trip.route?.stops?.length ? trip.route.stops[0] : "Terminal principal"),
        destinationTerminal: trip.destinationTerminal || (trip.route?.stops?.length ? trip.route.stops[trip.route.stops.length - 1] : "Terminal principal"),
        routeName: trip.routeName || trip.route?.name || `${trip.route?.origin || ""} - ${trip.route?.destination || ""}`
      }));
      
      return processedTrips;
    },
    enabled: Object.keys(searchParams).length > 0 // Only run if there are search params
  });
  
  // Extract unique locations for autocomplete
  const locationOptions = useMemo(() => {
    if (!allTrips) return [];
    return extractLocationsFromTrips(allTrips);
  }, [allTrips]);
  
  // Update search params in real-time as the user types
  useEffect(() => {
    // Small debounce function to avoid too many requests
    const debounceTimer = setTimeout(() => {
      const params: SearchParams = {};
      if (origin) params.origin = origin;
      if (destination) params.destination = destination;
      if (date) params.date = formatDateForApiQuery(date);
      
      // Always add visibility parameter
      params.visibility = 'publicado';
      
      setSearchParams(params);
    }, 300); // 300ms debounce
    
    return () => clearTimeout(debounceTimer);
  }, [origin, destination, date]);
  
  // Obtener los viajes ordenados por hora de salida 
  const sortedTrips = useMemo(() => {
    if (!trips) return [];
    
    return [...trips].sort((a, b) => {
      // Ordenar por hora de salida (más temprano primero)
      const getTimeValue = (timeStr: string) => {
        const [time, period] = timeStr.split(' ');
        const [hours, minutes] = time.split(':').map(Number);
        let value = hours * 60 + minutes;
        if (period === 'PM' && hours < 12) value += 12 * 60;
        if (period === 'AM' && hours === 12) value = minutes;
        return value;
      };
      
      return getTimeValue(a.departureTime) - getTimeValue(b.departureTime);
    });
  }, [trips]);
  
  return (
    <div className="space-y-8">
      <div className="flex items-center mb-4">
        <Button 
          variant="ghost" 
          className="mr-2" 
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <h2 className="text-xl font-bold">Selecciona un viaje para el paquete</h2>
      </div>
      
      {/* Filtros */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Busca el viaje ideal para tu paquete</CardTitle>
          <CardDescription>
            Filtra por origen, destino y fecha para encontrar el viaje
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="originFilter" className="block text-sm font-medium text-gray-700 mb-1">Origen</Label>
              {locationOptions.length > 0 ? (
                <LocationAdapter
                  options={locationOptions}
                  value={origin}
                  onChange={setOrigin}
                  placeholder="Selecciona origen"
                  mode="grouped"
                  className="w-full"
                />
              ) : (
                <Input
                  id="originFilter"
                  placeholder="Cargando ubicaciones..."
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  disabled={isLoadingAll}
                />
              )}
            </div>
            <div>
              <Label htmlFor="destinationFilter" className="block text-sm font-medium text-gray-700 mb-1">Destino</Label>
              {locationOptions.length > 0 ? (
                <LocationAdapter
                  options={locationOptions}
                  value={destination}
                  onChange={setDestination}
                  placeholder="Selecciona destino"
                  mode="grouped"
                  className="w-full"
                />
              ) : (
                <Input
                  id="destinationFilter"
                  placeholder="Cargando ubicaciones..."
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  disabled={isLoadingAll}
                />
              )}
            </div>
            <div>
              <Label htmlFor="dateFilter" className="block text-sm font-medium text-gray-700 mb-1">Fecha</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CalendarIcon className="h-5 w-5 text-gray-400" />
                </div>
                <Input
                  id="dateFilter"
                  type="date"
                  className="pl-10"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      

      
      {/* Estado de carga */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2Icon className="h-8 w-8 animate-spin text-blue-500 mb-2" />
          <p className="text-gray-500">Buscando viajes disponibles...</p>
        </div>
      )}
      
      {/* Error de carga */}
      {isError && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle className="text-red-500">Error al cargar viajes</CardTitle>
          </CardHeader>
          <CardContent>
            <p>No pudimos cargar los viajes. Por favor, intenta de nuevo más tarde.</p>
          </CardContent>
          <CardFooter>
            <Button onClick={() => setSearchParams({ ...searchParams })}>
              Reintentar
            </Button>
          </CardFooter>
        </Card>
      )}
      
      {/* Sin resultados */}
      {!isLoading && !isError && trips && trips.length === 0 && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>No hay viajes disponibles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">
              No encontramos viajes que coincidan con tus criterios de búsqueda. Intenta modificar los filtros.
            </p>
          </CardContent>
        </Card>
      )}
      
      {/* Lista de viajes disponibles */}
      {!isLoading && !isError && sortedTrips && sortedTrips.length > 0 && (
        <div className="space-y-4">
          {sortedTrips.map((trip) => (
            <Card 
              key={trip.id}
              className="hover:shadow-md transition-all cursor-pointer border-l-4 border-l-blue-500"
              onClick={() => onTripSelect(trip.id)}
            >
              <div className="p-4 w-full">
                {/* Horarios en la parte superior */}
                <div className="flex justify-between items-center mb-4">
                  <div className="font-bold text-lg">{trip.departureTime}</div>
                  <div className="text-xs text-gray-500">
                    {calculateDuration(trip.departureTime, trip.arrivalTime)}
                  </div>
                  <div className="font-bold text-lg text-right">{trip.arrivalTime}</div>
                </div>
                
                <div className="border-t border-gray-200 pt-3 mt-2">




                  {/* Puntos específicos de abordaje y llegada */}
                  <div className="border-2 border-dashed border-gray-200 rounded-md p-2 mb-3">
                    <div className="text-xs font-medium text-gray-600 mb-1">
                      <span className="inline-flex items-center">
                        <MapPinIcon className="h-3 w-3 mr-1" />
                        Puntos específicos de este viaje
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs font-semibold text-gray-600">Punto de abordaje</div>
                        <div className="text-sm font-medium text-green-700 flex items-center">
                          <div className="w-2 h-2 rounded-full bg-green-600 mr-2"></div>
                          {trip.segmentOrigin || trip.originTerminal || "Terminal principal"}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-gray-600">Punto de llegada</div>
                        <div className="text-sm font-medium text-red-700 flex items-center">
                          <div className="w-2 h-2 rounded-full bg-red-600 mr-2"></div>
                          {trip.segmentDestination || trip.destinationTerminal || "Terminal principal"}
                        </div>
                      </div>
                    </div>
                  </div>
                  



                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}