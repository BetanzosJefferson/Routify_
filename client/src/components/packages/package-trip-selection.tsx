import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon, MapPinIcon, CalendarIcon, FilterIcon, ArrowLeft, Truck } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { formatDate, formatPrice } from "@/lib/utils";
import { format } from "date-fns";
import { extractLocationsFromTrips } from "@/lib/trip-utils";

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LocationAdapter } from "@/components/ui/location-adapter";

// Utilities
import { TripWithRouteInfo } from "@shared/schema";
import { normalizeToStartOfDay, formatDateForInput, formatDateForApiQuery } from "@/lib/utils";

interface SearchParams {
  origin?: string;
  destination?: string;
  date?: string;
  seats?: number;
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
  const [sortMethod, setSortMethod] = useState<"departure" | "price" | "duration">("departure");
  
  // Form state
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState(today);
  const [seats, setSeats] = useState("");
  
  // Query for all trips to build autocomplete options
  const { data: allTrips, isLoading: isLoadingAll } = useQuery({
    queryKey: ["/api/trips"],
    queryFn: async () => {
      const response = await fetch("/api/trips");
      if (!response.ok) throw new Error("Failed to fetch trips");
      return await response.json() as TripWithRouteInfo[];
    },
  });
  
  // Filter trips based on search parameters
  const { data: trips, isLoading, isError } = useQuery({
    queryKey: ["/api/trips", searchParams],
    queryFn: async () => {
      // Añadir el filtro de visibilidad publicado a los parámetros de búsqueda
      const paramsWithVisibility = { ...searchParams, visibility: 'publicado' };
      
      const queryString = new URLSearchParams(
        Object.entries(paramsWithVisibility).filter(([_, v]) => v !== undefined) as [string, string][]
      ).toString();
      
      const response = await fetch(`/api/trips${queryString ? `?${queryString}` : ''}`);
      if (!response.ok) throw new Error("Failed to fetch trips");
      return await response.json() as TripWithRouteInfo[];
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
      if (seats && !isNaN(parseInt(seats, 10))) {
        params.seats = parseInt(seats, 10);
      }
      
      setSearchParams(params);
    }, 300); // 300ms debounce
    
    return () => clearTimeout(debounceTimer);
  }, [origin, destination, date, seats]);
  
  // Función para ordenar los viajes según el criterio seleccionado
  const sortedTrips = useMemo(() => {
    if (!trips) return [];
    
    return [...trips].sort((a, b) => {
      // Ordenar por hora de salida (más temprano primero)
      if (sortMethod === "departure") {
        // Extraer hora de salida
        const getTimeValue = (timeStr: string) => {
          const [time, period] = timeStr.split(' ');
          const [hours, minutes] = time.split(':').map(Number);
          let value = hours * 60 + minutes;
          if (period === 'PM' && hours < 12) value += 12 * 60;
          if (period === 'AM' && hours === 12) value = minutes;
          return value;
        };
        
        return getTimeValue(a.departureTime) - getTimeValue(b.departureTime);
      }
      
      // Ordenar por precio (más barato primero)
      if (sortMethod === "price") {
        const priceA = a.isSubTrip && Array.isArray(a.segmentPrices) && a.segmentPrices.length > 0 
          ? a.segmentPrices[0]?.price || a.price 
          : a.price;
        
        const priceB = b.isSubTrip && Array.isArray(b.segmentPrices) && b.segmentPrices.length > 0 
          ? b.segmentPrices[0]?.price || b.price 
          : b.price;
        
        return priceA - priceB;
      }
      
      // Ordenar por duración (más corto primero)
      if (sortMethod === "duration") {
        // Calcular las duraciones
        const durationA = calculateDuration(a.departureTime, a.arrivalTime);
        const durationB = calculateDuration(b.departureTime, b.arrivalTime);
        
        // Convertir a minutos para comparar
        const getMinutes = (duration: string) => {
          let minutes = 0;
          if (duration.includes('h')) {
            const hours = parseInt(duration.split('h')[0], 10);
            minutes += hours * 60;
            
            if (duration.includes('m')) {
              const mins = parseInt(duration.split('h ')[1].split('m')[0], 10);
              minutes += mins;
            }
          } else if (duration.includes('m')) {
            minutes = parseInt(duration.split('m')[0], 10);
          }
          return minutes;
        };
        
        return getMinutes(durationA) - getMinutes(durationB);
      }
      
      return 0;
    });
  }, [trips, sortMethod]);
  
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
            Filtra por origen, destino, fecha y asientos disponibles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
            <div>
              <label htmlFor="seatsFilter" className="block text-sm font-medium text-gray-700 mb-1">Asientos</label>
              <Input
                id="seatsFilter"
                type="number"
                min="1"
                placeholder="Número de asientos"
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <div className="w-full p-2 border rounded-md bg-gray-50 text-center">
                <div className="flex items-center justify-center">
                  <FilterIcon className="h-4 w-4 mr-2 text-gray-500" />
                  <span className="text-sm text-gray-500">Búsqueda en tiempo real...</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Opciones de ordenamiento */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row gap-2 items-start">
          <div className="text-sm font-medium text-gray-700">Ordenar por:</div>
          <div className="flex flex-wrap gap-2">
            <button 
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                sortMethod === "departure" 
                  ? "bg-blue-50 text-blue-600" 
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
              onClick={() => setSortMethod("departure")}
            >
              Salida más temprana
            </button>
            <button 
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                sortMethod === "price" 
                  ? "bg-blue-50 text-blue-600" 
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
              onClick={() => setSortMethod("price")}
            >
              Precio más bajo
            </button>
            <button 
              className={`px-3 py-1 text-sm rounded-full transition-colors ${
                sortMethod === "duration" 
                  ? "bg-blue-50 text-blue-600" 
                  : "bg-gray-50 text-gray-600 hover:bg-gray-100"
              }`}
              onClick={() => setSortMethod("duration")}
            >
              Duración más corta
            </button>
          </div>
        </div>
      </div>
      
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
              <div className="flex flex-col md:flex-row p-4 w-full">
                {/* Columna izquierda: Información de origen/destino y horarios */}
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-2">
                    <div className="font-bold text-lg">{trip.departureTime}</div>
                    <div className="text-xs text-gray-500 hidden md:block">
                      {calculateDuration(trip.departureTime, trip.arrivalTime)}
                    </div>
                    <div className="font-bold text-lg text-right">{trip.arrivalTime}</div>
                  </div>
                  
                  <div className="flex justify-between items-start">
                    <div className="max-w-[40%]">
                      <div className="font-bold truncate">{trip.routeOrigin || trip.routeName?.split(' a ')[0]}</div>
                      <div className="text-xs text-gray-500">{trip.originTerminal || "Terminal principal"}</div>
                    </div>
                    
                    <div className="flex-1 flex justify-center items-center px-2">
                      <div className="border-t border-gray-300 flex-1 relative">
                        <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-white px-2 text-xs text-gray-500 md:hidden">
                          {calculateDuration(trip.departureTime, trip.arrivalTime)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="max-w-[40%] text-right">
                      <div className="font-bold truncate">{trip.routeDestination || trip.routeName?.split(' a ')[1]}</div>
                      <div className="text-xs text-gray-500">{trip.destinationTerminal || "Terminal principal"}</div>
                    </div>
                  </div>
                </div>
                
                {/* Columna central: Información adicional */}
                <div className="flex md:flex-col justify-between items-center mt-4 md:mt-0 md:px-4 md:border-l md:border-r border-gray-200">
                  <div className="flex flex-col items-center">
                    <div className="text-xs text-gray-500 mb-1">Fecha</div>
                    <div className="text-sm">{format(new Date(trip.departureDate), 'dd/MM/yyyy')}</div>
                  </div>
                  
                  <div className="flex items-center">
                    <Truck className="h-4 w-4 mr-1 text-gray-500" />
                    <span className="text-sm">{trip.vehicleType}</span>
                  </div>
                </div>
                
                {/* Columna derecha: Precio y botón */}
                <div className="flex justify-between items-center mt-4 md:mt-0 md:ml-4 min-w-[140px]">
                  <div className="text-right">
                    <div className="text-xs text-gray-500 mb-1">Precio</div>
                    <div className="font-bold text-xl">${trip.price}</div>
                    <div className="text-xs text-gray-500">{trip.availableSeats} asientos disponibles</div>
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