import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon, MapPinIcon, CalendarIcon, FilterIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { formatDate, formatPrice } from "@/lib/utils";
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

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LocationAdapter } from "@/components/ui/location-adapter";
import { LocationOption } from "@/components/ui/command-combobox";
import { TripWithRouteInfo } from "@shared/schema";
import { ReservationModal } from "./reservation-modal";

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
              <label htmlFor="dateFilter" className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
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
      
      {/* Título de la fecha actual */}
      <div className="flex justify-center items-center mb-6">
        <div className="text-xl font-medium mx-4">
          {new Date(date).toLocaleDateString('es-MX', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
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
        <div className="grid grid-cols-1 gap-4">
          {trips.map((trip) => (
            <Card key={trip.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <div className="bg-primary h-2"></div>
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4 mt-2">
                  <div>
                    <h3 className="font-medium text-lg text-gray-900">
                      {trip.isSubTrip ? (
                        <span className="flex items-center">
                          <span className="inline-block h-2 w-2 rounded-full bg-indigo-500 mr-2"></span>
                          <span className="hidden md:inline">{trip.segmentOrigin}</span>
                          <span className="md:hidden">{abbreviateLocation(trip.segmentOrigin || '')}</span>
                          {' → '}
                          <span className="hidden md:inline">{trip.segmentDestination}</span>
                          <span className="md:hidden">{abbreviateLocation(trip.segmentDestination || '')}</span>
                        </span>
                      ) : (
                        <span>
                          <span className="hidden md:inline">{trip.route.name}</span>
                          <span className="md:hidden">
                            {abbreviateLocation(trip.route.origin || '')}{' → '}{abbreviateLocation(trip.route.destination || '')}
                          </span>
                        </span>
                      )}
                    </h3>
                    <div className="text-sm text-gray-500 mt-1">
                      {trip.isSubTrip ? (
                        <span className="text-xs italic">Sub-viaje de {trip.route.name}</span>
                      ) : (
                        `${trip.numStops} paradas`
                      )}
                    </div>
                  </div>
                  <div className="text-lg font-semibold text-primary">
                    {formatPrice(trip.isSubTrip && Array.isArray(trip.segmentPrices) && trip.segmentPrices.length > 0 
                      ? trip.segmentPrices[0]?.price || trip.price 
                      : trip.price)}
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-4 border-t border-gray-100 pt-4">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-500">Salida</span>
                    <span className="text-sm font-medium">{trip.departureTime}</span>
                    <span className="text-xs text-gray-500">{formatDate(trip.departureDate)}</span>
                  </div>
                  
                  <div className="flex-1 px-4">
                    <div className="relative flex items-center justify-center">
                      <div className="border-t border-dashed border-gray-300 w-full"></div>
                      <div className="absolute">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end">
                    <span className="text-xs text-gray-500">Llegada</span>
                    <span className="text-sm font-medium">{trip.arrivalTime}</span>
                    <span className="text-xs text-gray-500">{formatDate(trip.departureDate)}</span>
                  </div>
                </div>
                
                <div className="mt-5 flex items-center justify-between">
                  <div className="text-sm">
                    <span className="capitalize">{trip.vehicleType}</span> • 
                    <span className="ml-1 font-medium">
                      {Math.round(((trip.capacity - trip.availableSeats) / trip.capacity) * 100)}%
                    </span>
                    <span className="text-gray-500"> ocupación</span>
                  </div>
                  
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleReserve(trip)}
                    disabled={trip.availableSeats <= 0}
                  >
                    Reservar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center text-gray-500 mb-4">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">No hay viajes disponibles para esta fecha.</p>
              <p className="text-sm mt-2">Intenta con otra fecha o modifica los filtros de búsqueda.</p>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Reservation Modal */}
      {selectedTrip && (
        <ReservationModal
          trip={selectedTrip}
          isOpen={showModal}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
