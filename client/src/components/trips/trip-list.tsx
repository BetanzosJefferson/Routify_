import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Loader2Icon, 
  MapPinIcon, 
  CalendarIcon, 
  FilterIcon, 
  ChevronLeftIcon, 
  ChevronRightIcon,
  CarIcon,
  UserIcon,
  EyeIcon,
  ArrowRightIcon 
} from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { formatDate, formatPrice } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { extractLocationsFromTrips } from "@/lib/trip-utils";

// Función para abreviar ubicaciones en móvil
function abbreviateLocation(location: string): string {
  if (!location) return '';
  
  // Si ya es corto, dejarlo como está
  if (location.length <= 8) return location;
  
  // Si tiene comas, tomar solo la primera parte
  if (location.includes(',')) {
    return location.split(',')[0].trim();
  }
  
  // Si tiene espacios, tomar primeras letras de cada palabra
  if (location.includes(' ')) {
    const words = location.split(' ');
    if (words.length >= 2) {
      return words.map(word => word.charAt(0)).join('');
    }
  }
  
  // Si todo falla, cortar a 8 caracteres
  return location.substring(0, 7) + '.';
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

// Función para formatear la fecha en español
function formatDateInSpanish(date: Date): string {
  try {
    return format(date, "EEEE, d 'de' MMMM 'de' yyyy", { locale: es });
  } catch (error) {
    console.error("Error formatting date:", error);
    return "Fecha inválida";
  }
}

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LocationAdapter } from "@/components/ui/location-adapter";
import { LocationOption } from "@/components/ui/command-combobox";
import { TripWithRouteInfo } from "@shared/schema";
import { ReservationStepsModal } from "./reservation-steps-modal";

interface SearchParams {
  origin?: string;
  destination?: string;
  date?: string;
  seats?: number;
}

// Función para formatear fecha en formato ISO (YYYY-MM-DD)
function formatDateForInput(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function TripList() {
  // Obtener la fecha actual formateada como YYYY-MM-DD
  const today = formatDateForInput(new Date());
  
  const [searchParams, setSearchParams] = useState<SearchParams>({ date: today });
  const [selectedTrip, setSelectedTrip] = useState<TripWithRouteInfo | null>(null);
  const [showModal, setShowModal] = useState(false);
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
      const queryString = new URLSearchParams(
        Object.entries(searchParams).filter(([_, v]) => v !== undefined) as [string, string][]
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
      if (date) params.date = date;
      if (seats && !isNaN(parseInt(seats, 10))) {
        params.seats = parseInt(seats, 10);
      }
      
      setSearchParams(params);
    }, 300); // 300ms debounce
    
    return () => clearTimeout(debounceTimer);
  }, [origin, destination, date, seats]);
  
  // Handler for reservation button click
  const handleReserve = (trip: TripWithRouteInfo) => {
    setSelectedTrip(trip);
    setShowModal(true);
  };
  
  // Close modal handler
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedTrip(null);
  };

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
        // Calcular duración en minutos
        const getDuration = (departureTime: string, arrivalTime: string) => {
          if (!departureTime || !arrivalTime) return 0;
          
          const parseTime = (time: string) => {
            let [hourMin, period] = time.split(' ');
            let [hours, minutes] = hourMin.split(':').map(Number);
            
            if (period === 'PM' && hours < 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;
            
            return hours * 60 + minutes;
          };
          
          let departure = parseTime(departureTime);
          let arrival = parseTime(arrivalTime);
          
          // Si la llegada es antes que la salida, sumar 24 horas
          if (arrival < departure) {
            arrival += 24 * 60;
          }
          
          return arrival - departure;
        };
        
        const durationA = getDuration(a.departureTime, a.arrivalTime);
        const durationB = getDuration(b.departureTime, b.arrivalTime);
        
        return durationA - durationB;
      }
      
      return 0;
    });
  }, [trips, sortMethod]);
  
  return (
    <div className="py-6">
      <div className="flex items-center mb-4">
        <div className="rounded-full bg-primary bg-opacity-10 p-2 mr-3">
          <MapPinIcon className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800">Viajes</h2>
      </div>
      
      <Card className="mb-6">
        <CardContent className="p-6">
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

      {isLoading ? (
        <div className="flex justify-center items-center p-8">
          <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Cargando viajes...</span>
        </div>
      ) : isError ? (
        <div className="text-center p-8 text-red-500">
          Error al cargar los viajes. Por favor, inténtalo de nuevo.
        </div>
      ) : trips && trips.length > 0 ? (
        <div>
          {/* Título con fecha para la vista de gestión de viajes */}
          <div className="mb-4 mt-8">
            <h3 className="text-xl font-semibold text-gray-800">
              Viajes para {formatDateInSpanish(new Date(date))}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Gestiona los viajes programados para esta fecha, asigna vehículos y conductores.
            </p>
          </div>
          
          <div className="space-y-4">
            {sortedTrips.map((trip) => (
              <div key={trip.id} className="border rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow">
                <div className="p-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex flex-col">
                        <div className="text-sm font-medium text-gray-700">
                          {trip.route.name}
                        </div>
                        <div className="flex items-center text-sm text-gray-500 mt-1">
                          <CalendarIcon className="h-4 w-4 mr-1" />
                          <span>{format(new Date(trip.departureDate), "dd/MM/yyyy")}</span>
                          <span className="mx-2">•</span>
                          <span>{trip.departureTime} - {trip.arrivalTime}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 text-blue-600 font-medium text-xs px-2 py-1 rounded-full">
                      Programado
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-xs text-gray-500 uppercase mb-1">Ruta</div>
                      <div className="font-medium">
                        {trip.isSubTrip 
                          ? `${abbreviateLocation(trip.segmentOrigin || '')} → ${abbreviateLocation(trip.segmentDestination || '')}`
                          : `${abbreviateLocation(trip.route.origin)} → ${abbreviateLocation(trip.route.destination)}`
                        }
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {trip.route.stops?.length || 0} paradas intermedias
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-xs text-gray-500 uppercase mb-1">Vehículo</div>
                      <div className="font-medium flex items-center text-amber-600">
                        <CarIcon className="h-4 w-4 mr-1" />
                        No asignado
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-xs text-gray-500 uppercase mb-1">Conductor</div>
                      <div className="font-medium flex items-center text-amber-600">
                        <UserIcon className="h-4 w-4 mr-1" />
                        No asignado
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center mt-4 pt-3 border-t space-x-2">
                    <div className="text-sm text-gray-500 mr-auto">
                      <span className="font-medium">{trip.availableSeats}</span> de <span className="font-medium">{trip.capacity}</span> asientos disponibles
                    </div>
                    
                    <Button variant="outline" className="text-sm">
                      Asignar Vehículo
                    </Button>
                    
                    <Button variant="outline" className="text-sm">
                      Asignar Conductor
                    </Button>
                    
                    <Button variant="outline" className="text-sm flex items-center space-x-1">
                      <EyeIcon className="h-4 w-4" />
                      <span>Ver Segmentos</span>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center p-8 bg-gray-50 rounded-lg border border-gray-200">
          <div className="text-gray-500 mb-2">No se encontraron viajes para los criterios seleccionados.</div>
          <div className="text-sm text-gray-400">Prueba ajustando los filtros de búsqueda.</div>
        </div>
      )}
      
      {/* Modal para reservar */}
      {showModal && selectedTrip && (
        <ReservationStepsModal 
          trip={selectedTrip} 
          isOpen={showModal}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}