import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon, MapPinIcon, CalendarIcon, FilterIcon } from "lucide-react";
import { formatDate, formatPrice } from "@/lib/utils";
import { extractLocationsFromTrips } from "@/lib/trip-utils";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Combobox, ComboboxOption } from "@/components/ui/combobox";
import { TripWithRouteInfo } from "@shared/schema";
import { ReservationModal } from "./reservation-modal";

interface SearchParams {
  origin?: string;
  destination?: string;
  date?: string;
  seats?: number;
}

export function TripList() {
  const [searchParams, setSearchParams] = useState<SearchParams>({});
  const [selectedTrip, setSelectedTrip] = useState<TripWithRouteInfo | null>(null);
  const [showModal, setShowModal] = useState(false);
  
  // Form state
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
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
        <h2 className="text-xl font-semibold text-gray-800">Trips</h2>
      </div>
      
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="originFilter" className="block text-sm font-medium text-gray-700 mb-1">Origin</Label>
              {locationOptions.length > 0 ? (
                <Combobox
                  options={locationOptions}
                  value={origin}
                  onChange={setOrigin}
                  placeholder="Select origin"
                  className="w-full"
                />
              ) : (
                <Input
                  id="originFilter"
                  placeholder="Loading locations..."
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  disabled={isLoadingAll}
                />
              )}
            </div>
            <div>
              <Label htmlFor="destinationFilter" className="block text-sm font-medium text-gray-700 mb-1">Destination</Label>
              {locationOptions.length > 0 ? (
                <Combobox
                  options={locationOptions}
                  value={destination}
                  onChange={setDestination}
                  placeholder="Select destination"
                  className="w-full"
                />
              ) : (
                <Input
                  id="destinationFilter"
                  placeholder="Loading locations..."
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  disabled={isLoadingAll}
                />
              )}
            </div>
            <div>
              <label htmlFor="dateFilter" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
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
              <label htmlFor="seatsFilter" className="block text-sm font-medium text-gray-700 mb-1">Seats</label>
              <Input
                id="seatsFilter"
                type="number"
                min="1"
                placeholder="Number of seats"
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <div className="w-full p-2 border rounded-md bg-gray-50 text-center">
                <div className="flex items-center justify-center">
                  <FilterIcon className="h-4 w-4 mr-2 text-gray-500" />
                  <span className="text-sm text-gray-500">Real-time searching...</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="flex justify-center items-center p-8">
              <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Loading trips...</span>
            </div>
          ) : isError ? (
            <div className="text-center p-8 text-red-500">
              Error loading trips. Please try again.
            </div>
          ) : trips && trips.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Departure</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Arrival</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vehicle Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Available Seats</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {trips.map((trip) => (
                  <tr key={trip.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {trip.isSubTrip ? (
                          <span className="flex items-center">
                            <span className="inline-block h-2 w-2 rounded-full bg-indigo-500 mr-2"></span>
                            {trip.segmentOrigin} → {trip.segmentDestination}
                          </span>
                        ) : (
                          trip.route.name
                        )}
                      </div>
                      <div className="text-sm text-gray-500">
                        {trip.isSubTrip ? (
                          <span className="text-xs italic">Sub-trip of {trip.route.name}</span>
                        ) : (
                          `${trip.numStops} stops`
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(trip.departureDate)}</div>
                      <div className="text-sm text-gray-500">{trip.departureTime}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(trip.departureDate)}</div>
                      <div className="text-sm text-gray-500">{trip.arrivalTime}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {trip.vehicleType.charAt(0).toUpperCase() + trip.vehicleType.slice(1)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {trip.availableSeats}/{trip.capacity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatPrice(trip.price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button
                        size="sm"
                        className="bg-primary hover:bg-primary-dark"
                        onClick={() => handleReserve(trip)}
                        disabled={trip.availableSeats <= 0}
                      >
                        Reserve
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center p-8 text-gray-500">
              No trips found matching your criteria.
            </div>
          )}
        </div>
        
        {/* Pagination (placeholder, would be implemented with actual data) */}
        <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
          <div className="flex justify-between items-center">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">1</span> to <span className="font-medium">{trips?.length || 0}</span> of <span className="font-medium">{trips?.length || 0}</span> results
                </p>
              </div>
              {/* Pagination controls would go here if needed */}
            </div>
          </div>
        </div>
      </Card>
      
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
