import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon, MapPinIcon, CalendarIcon } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { formatDate, formatPrice } from "@/lib/utils";
import { format } from "date-fns";
import { extractLocationsFromTrips, formatTripTime, extractDayIndicator } from "@/lib/trip-utils";

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

// Función para calcular la duración entre horas, considerando indicadores de día siguiente
function calculateDuration(departureTime: string, arrivalTime: string): string {
  if (!departureTime || !arrivalTime) return "1h";

  // Primero, limpiar los posibles indicadores de día para extraer solo el tiempo
  const cleanDepartureTime = departureTime.replace(/\s*\+\d+d$/, '');
  const cleanArrivalTime = arrivalTime.replace(/\s*\+\d+d$/, '');

  // Extraer el número de días adicionales, si existe
  const departureExtraDays = departureTime.match(/\+(\d+)d$/) ?
    parseInt(departureTime.match(/\+(\d+)d$/)![1], 10) : 0;
  const arrivalExtraDays = arrivalTime.match(/\+(\d+)d$/) ?
    parseInt(arrivalTime.match(/\+(\d+)d$/)![1], 10) : 0;

  // Convertir a formato 24 horas para cálculos
  const parseTime = (time: string) => {
    let [hourMin, period] = time.split(' ');
    let [hours, minutes] = hourMin.split(':').map(Number);

    // Convertir a formato 24 horas
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return { hours, minutes };
  };

  const departure = parseTime(cleanDepartureTime);
  const arrival = parseTime(cleanArrivalTime);

  // Calcular diferencia en minutos, considerando días adicionales
  let totalMinutesDeparture = (departure.hours * 60 + departure.minutes) + (departureExtraDays * 24 * 60);
  let totalMinutesArrival = (arrival.hours * 60 + arrival.minutes) + (arrivalExtraDays * 24 * 60);

  // Si no hay indicadores de día explícitos y la llegada parece ser antes que la salida,
  // asumimos que cruza medianoche
  if (arrivalExtraDays === 0 && departureExtraDays === 0 && totalMinutesArrival < totalMinutesDeparture) {
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
  isSubTrip?: 'true' | 'false'; // Explicitly define as 'true' or 'false' string
  visibility?: 'publicado';
}

import { normalizeToStartOfDay, formatDateForInput, formatDateForApiQuery } from "@/lib/utils";

export function TripList() {
  // Obtener la fecha actual formateada como YYYY-MM-DD en hora local
  const today = formatDateForInput(new Date());

  // Calcular fechas permitidas (ayer, hoy, mañana)
  const yesterday = formatDateForInput(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const tomorrow = formatDateForInput(new Date(Date.now() + 24 * 60 * 60 * 1000));

  // Initialize searchParams. Default to isSubTrip: 'false' for initial load.
  // This will be conditionally removed if a specific search is performed.
  const [searchParams, setSearchParams] = useState<SearchParams>({ date: today, isSubTrip: 'false' });
  const [selectedTrip, setSelectedTrip] = useState<TripWithRouteInfo | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [sortMethod, setSortMethod] = useState<"departure" | "price" | "duration">("departure");

  // Form state
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState(today);
  const [seats, setSeats] = useState("");

  // Query optimizada para traer solo viajes de ayer, hoy y mañana para opciones de autocomplete
  // This query fetches ALL trips (including subtrips) for autocomplete to ensure comprehensive options.
  // The filtering for isSubTrip is then done in the `useMemo` for `locationOptions`.
  const { data: allTrips, isLoading: isLoadingAll } = useQuery<TripWithRouteInfo[]>({
    queryKey: ["/api/trips", "limited-dates", "all"], // Changed key to distinguish from filtered trips
    queryFn: async () => {
      const dateRange = `${yesterday},${today},${tomorrow}`;
      // Fetch all trips for autocomplete, don't filter by isSubTrip here
      const response = await fetch(`/api/trips?dateRange=${encodeURIComponent(dateRange)}&visibility=publicado`);
      if (!response.ok) throw new Error("Failed to fetch trips");
      return await response.json();
    },
  });

  // Filter trips based on search parameters
  const { data: trips, isLoading, isError } = useQuery<TripWithRouteInfo[]>({
    queryKey: ["/api/trips", searchParams],
    queryFn: async () => {
      // Add the published visibility filter
      const paramsToFetch = { ...searchParams, visibility: 'publicado' };

      const queryString = new URLSearchParams(
        Object.entries(paramsToFetch).filter(([_, v]) => v !== undefined) as [string, string][]
      ).toString();

      const response = await fetch(`/api/trips${queryString ? `?${queryString}` : ''}`);
      if (!response.ok) throw new Error("Failed to fetch trips");
      return await response.json();
    },
    enabled: true // Always run the query based on searchParams
  });

  // Extract unique locations for autocomplete
  const locationOptions = useMemo(() => {
    if (!allTrips) return [];
    // Extract locations from ALL fetched trips, as a user might search for a subtrip origin/destination
    return extractLocationsFromTrips(allTrips);
  }, [allTrips]);

  // Update search params in real-time as the user types
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      const newParams: SearchParams = {};
      newParams.date = formatDateForApiQuery(date); // Date always included

      let hasUserSearchInput = false;

      if (origin) {
        newParams.origin = origin;
        hasUserSearchInput = true;
      }
      if (destination) {
        newParams.destination = destination;
        hasUserSearchInput = true;
      }
      if (seats && !isNaN(parseInt(seats, 10))) {
        newParams.seats = parseInt(seats, 10);
        hasUserSearchInput = true;
      }

      // If no specific origin, destination, or seats are entered,
      // default to showing only non-subtrips.
      // Otherwise, if the user is searching for something specific,
      // allow all trip types to be returned by the API.
      if (!hasUserSearchInput) {
        newParams.isSubTrip = 'false';
      }

      setSearchParams(newParams);
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

  // Función para ordenar y filtrar los viajes según el criterio seleccionado
  const sortedAndFilteredTrips = useMemo(() => {
    // The `trips` data already contains the `isSubTrip` filter from the API call if no specific search is active.
    // If a search is active, it contains all relevant trips (subtrips included if they match search criteria).
    if (!trips) return [];

    // Filter `trips` only if there's no active origin/destination/seats search AND `isSubTrip` is explicitly 'false' in searchParams.
    // This handles the default view to only show non-subtrips.
    // If a search is active, the API should return what matches, including subtrips if they fit the search.
    let currentTrips = trips;
    if (!origin && !destination && !seats && searchParams.isSubTrip === 'false') {
        currentTrips = trips.filter(trip => !trip.isSubTrip);
    }
    // If origin/destination/seats are provided, we assume the API already returned relevant subtrips if they match.
    // So, no extra filter needed here based on `isSubTrip` if a search is active.


    return [...currentTrips].sort((a, b) => {
      if (sortMethod === "departure") {
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

      if (sortMethod === "price") {
        // Use the correct price for the trip, considering segment prices for subtrips if applicable
        const priceA = a.isSubTrip && Array.isArray(a.segmentPrices) && a.segmentPrices.length > 0
          ? a.segmentPrices[0]?.price || a.price
          : a.price;
        const priceB = b.isSubTrip && Array.isArray(b.segmentPrices) && b.segmentPrices.length > 0
          ? b.segmentPrices[0]?.price || b.price
          : b.price;
        return priceA - priceB;
      }

      if (sortMethod === "duration") {
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
  }, [trips, sortMethod, origin, destination, seats, searchParams.isSubTrip]); // Added dependencies

  return (
    <div className="py-6">
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
                  min={yesterday}
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
      ) : sortedAndFilteredTrips && sortedAndFilteredTrips.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {sortedAndFilteredTrips.map((trip) => (
            <div key={trip.id} className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white">
              <div className="border-b border-gray-100 p-3 flex justify-between items-center">
                <div className="flex items-center">
                  <div className="mr-3 h-8 w-8 flex-shrink-0">
                    {trip.companyLogo ? (
                      <img
                        src={trip.companyLogo}
                        alt={trip.companyName || "Logo de transportista"}
                        className="h-full w-full object-cover rounded-full"
                        onError={(e) => {
                          const target = e.currentTarget as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="h-full w-full bg-gray-100 rounded-full flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col">
                    {trip.companyName && (
                      <span className="text-xs text-gray-600 mb-1">
                        {trip.companyName}
                      </span>
                    )}
                    <div className="text-sm font-medium">
                      {trip.isSubTrip ? (
                        <span>Conexión · {trip.availableSeats} asientos disponibles</span>
                      ) : (
                        <span>Directo · {trip.availableSeats} asientos disponibles</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-base font-medium">
                  {formatPrice(trip.isSubTrip && Array.isArray(trip.segmentPrices) && trip.segmentPrices.length > 0
                    ? trip.segmentPrices[0]?.price || trip.price
                    : trip.price)}
                  <span className="text-xs text-gray-500 ml-1">MXN</span>
                </div>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col">
                    <div className="text-lg font-bold">
                      {formatTripTime(trip.departureTime, true, 'pretty')}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {trip.isSubTrip ? trip.segmentOrigin : trip.route.origin}
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center">
                    <div className="text-xs text-gray-500 mb-1">
                      {calculateDuration(trip.departureTime, trip.arrivalTime)}
                    </div>
                    <div className="relative w-full flex items-center justify-center">
                      <div className="border-t border-gray-300 w-full"></div>
                      <div className="absolute">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14"></path>
                          <path d="M12 5l7 7-7 7"></path>
                        </svg>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <div className="text-lg font-bold">
                      {formatTripTime(trip.arrivalTime, true, 'pretty')}
                    </div>
                    <div className="text-sm text-gray-500 mt-1 text-right">
                      {trip.isSubTrip ? trip.segmentDestination : trip.route.destination}
                    </div>
                  </div>
                </div>

                {/* Mostrar mensaje descriptivo para viajes que cruzan la medianoche */}
                {(extractDayIndicator(trip.departureTime) > 0 || extractDayIndicator(trip.arrivalTime) > 0) ? (
                  <div className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-md flex items-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"></circle>
                      <line x1="12" y1="8" x2="12" y2="12"></line>
                      <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    {formatTripTime(trip.departureTime, true, 'descriptive', trip.departureDate)}
                  </div>
                ) : null}

                <div className="mt-4 flex items-center justify-between">
                  {trip.vehicle?.name && (
                    <div className="text-sm">
                      <span className="capitalize">{trip.vehicle.name}</span>
                    </div>
                  )}

                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleReserve(trip)}
                    disabled={trip.availableSeats <= 0}
                  >
                    Reservar
                  </Button>
                </div>

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
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center text-gray-500 mb-4">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">No hay viajes disponibles para esta fecha con los filtros aplicados.</p>
              <p className="text-sm mt-2">Intenta con otra fecha o modifica los filtros de búsqueda.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reservation Modal */}
      {selectedTrip && (
        <ReservationStepsModal
          trip={selectedTrip}
          isOpen={showModal}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}