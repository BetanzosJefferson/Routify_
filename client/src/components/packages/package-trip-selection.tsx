import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon, MapPinIcon, CalendarIcon, FilterIcon, ArrowLeft, Truck } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { formatDate, formatPrice } from "@/lib/utils";
import { format } from "date-fns";
import { extractLocationsFromTrips, formatTripTime, extractDayIndicator } from "@/lib/trip-utils";

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
      </div>
      
      {/* Filtros */}
      <Card>
        <CardHeader className="pb-4">
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
        <div className="grid grid-cols-1 gap-4">
          {sortedTrips.map((trip) => (
            <div 
              key={trip.id} 
              className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white cursor-pointer"
              onClick={() => onTripSelect(trip.id)}
            >
              {/* Header con logo de la compañía */}
              <div className="border-b border-gray-100 p-3 flex justify-between items-center">
                <div className="flex items-center">
                  {/* Logo de la compañía con fallback a icono predeterminado */}
                  <div className="mr-3 h-8 w-8 flex-shrink-0">
                    {trip.companyLogo ? (
                      <img 
                        src={trip.companyLogo} 
                        alt={trip.companyName || "Logo de transportista"} 
                        className="h-full w-full object-cover rounded-full"
                        onError={(e) => {
                          // Si falla la carga, mostrar el icono predeterminado
                          const target = e.currentTarget as HTMLImageElement;
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <div className={`${trip.companyLogo ? 'hidden' : ''} h-full w-full bg-gray-200 rounded-full flex items-center justify-center`}>
                      <span className="text-xs font-bold text-gray-600">
                        {(trip.companyName || "TR").substring(0, 2).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  
                  <div>
                    <div className="font-medium text-sm">{trip.companyName || "Transportista"}</div>
                    <div className="text-xs text-gray-500">
                      Directo • {trip.availableSeats} asientos disponibles
                    </div>
                  </div>
                </div>
              
              </div>

              {/* Contenido principal */}
              <div className="p-4">
                {/* Horarios */}
                <div className="flex justify-between items-center mb-4">
                  <div className="text-lg font-bold">{formatTripTime(trip.departureTime, true, "pretty")}</div>
                  <div className="flex flex-col items-center text-xs text-gray-500">
                    <div>{calculateDuration(trip.departureTime, trip.arrivalTime)}</div>
                    <div>→</div>
                  </div>
                  <div className="text-lg font-bold text-right">{formatTripTime(trip.arrivalTime, true, "pretty")}</div>
                </div>

                {/* Mensaje descriptivo para viajes que cruzan la medianoche */}
                {(extractDayIndicator(trip.departureTime) > 0 || extractDayIndicator(trip.arrivalTime) > 0) && (
                  <div className="mb-3">
                    <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded-md flex items-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                      </svg>
                      {formatTripTime(trip.departureTime, true, 'descriptive', trip.departureDate)}
                    </div>
                  </div>
                )}

                {/* Origen y destino */}
                <div className="flex justify-between items-center text-sm text-gray-600 mb-4">
                  <div className="flex-1 truncate">
                    {trip.isSubTrip 
                      ? (trip.segmentOrigin || trip.route?.origin || "Origen no especificado")
                      : (trip.route?.origin || "Origen no especificado")
                    }
                  </div>
                  <div className="flex-1 text-right truncate">
                    {trip.isSubTrip 
                      ? (trip.segmentDestination || trip.route?.destination || "Destino no especificado")
                      : (trip.route?.destination || "Destino no especificado")
                    }
                  </div>
                </div>

                {/* Botón de selección */}
                <div className="flex justify-between items-center">
                  <div></div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onTripSelect(trip.id);
                    }}
                  >
                    Seleccionar
                  </Button>
                </div>

                {/* Información adicional de sub-viajes */}
                {trip.isSubTrip && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <span className="flex items-center text-xs text-gray-500">
                      <span className="inline-block h-2 w-2 rounded-full bg-indigo-500 mr-2"></span>
                      Sub-viaje de {trip.route?.name}
                    </span>
                  </div>
                )}

                {!trip.isSubTrip && trip.numStops > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-500">
                      {trip.numStops} paradas en ruta
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}