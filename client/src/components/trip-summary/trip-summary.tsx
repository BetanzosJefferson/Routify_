import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ClipboardListIcon, UserIcon, DollarSignIcon, PackageIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { format, addDays, subDays, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Trip, TripWithRouteInfo, Reservation, Passenger } from "@shared/schema";

type TripSummaryProps = {
  className?: string;
};

type ReservationWithPassengers = Reservation & {
  passengers: Passenger[];
  trip: TripWithRouteInfo;
};

export default function TripSummary({ className }: TripSummaryProps) {
  const [selectedTrip, setSelectedTrip] = useState<number | null>(null);
  const [tripReservations, setTripReservations] = useState<ReservationWithPassengers[]>([]);
  const [totalPassengers, setTotalPassengers] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Fetch all trips
  const { data: trips, isLoading: isLoadingTrips } = useQuery<TripWithRouteInfo[]>({
    queryKey: ["/api/trips"],
    staleTime: 30000, // 30 seconds
  });

  // Fetch all reservations
  const { data: reservations, isLoading: isLoadingReservations } = useQuery<ReservationWithPassengers[]>({
    queryKey: ["/api/reservations"],
    staleTime: 30000, // 30 seconds
  });
  
  // Filtrar para obtener solo viajes principales (no sub-viajes) y por fecha seleccionada
  const filteredTrips = trips?.filter(trip => {
    // Filtrar por viajes principales
    if (trip.isSubTrip) return false;
    
    // Filtrar por fecha actual
    const tripDate = new Date(trip.departureDate);
    return isSameDay(tripDate, currentDate);
  }) || [];
  
  // Navegación de fecha
  const goToPreviousDay = () => {
    setCurrentDate(prevDate => subDays(prevDate, 1));
    setSelectedTrip(null); // Resetear selección al cambiar de fecha
  };
  
  const goToNextDay = () => {
    setCurrentDate(prevDate => addDays(prevDate, 1));
    setSelectedTrip(null); // Resetear selección al cambiar de fecha
  };

  // Filter reservations by selected trip
  useEffect(() => {
    if (selectedTrip && reservations) {
      // Filtrar reservas directas para este viaje
      const directReservations = reservations.filter(r => r.tripId === selectedTrip);
      
      // Buscar el viaje seleccionado
      const selectedTripData = trips?.find(t => t.id === selectedTrip);
      
      // Si es un viaje principal, buscar también reservas de sub-viajes relacionados
      const relatedReservations = selectedTripData && !selectedTripData.isSubTrip
        ? reservations.filter(r => {
            const trip = trips?.find(t => t.id === r.tripId);
            return trip?.parentTripId === selectedTrip;
          })
        : [];
      
      // Combinar reservas directas y relacionadas
      const allReservations = [...directReservations, ...relatedReservations];
      
      // Calcular totales
      const passengers = allReservations.reduce((acc, res) => acc + (res.passengers?.length || 0), 0);
      const sales = allReservations.reduce((acc, res) => acc + (res.totalAmount || 0), 0);
      
      setTripReservations(allReservations);
      setTotalPassengers(passengers);
      setTotalSales(sales);
    } else {
      setTripReservations([]);
      setTotalPassengers(0);
      setTotalSales(0);
    }
  }, [selectedTrip, reservations, trips]);

  // Auto-seleccionar el primer viaje filtrado si no hay ninguno seleccionado
  useEffect(() => {
    if (filteredTrips && filteredTrips.length > 0 && !selectedTrip) {
      // Autoseleccionar el primer viaje del día actual
      setSelectedTrip(filteredTrips[0].id);
    }
  }, [filteredTrips, selectedTrip, currentDate]);

  // Función para formatear fecha
  const formatDate = (dateString: string | Date) => {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric'
    });
  };
  
  // Función para formatear fecha para el encabezado
  const formatHeaderDate = (date: Date) => {
    return format(date, "d 'de' MMMM, yyyy", { locale: es });
  };

  return (
    <div className={`py-6 ${className}`}>
      <div className="flex items-center mb-4">
        <div className="rounded-full bg-primary bg-opacity-10 p-2 mr-3">
          <ClipboardListIcon className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800">Resumen de Viajes</h2>
      </div>

      {/* Navegador de fechas */}
      <div className="flex justify-center items-center mb-6">
        <Button 
          variant="outline" 
          size="icon"
          onClick={goToPreviousDay}
          className="mr-2"
        >
          <ChevronLeftIcon className="h-4 w-4" />
        </Button>
        
        <div className="text-xl font-medium mx-4">
          {formatHeaderDate(currentDate)}
        </div>
        
        <Button 
          variant="outline" 
          size="icon"
          onClick={goToNextDay}
          className="ml-2"
        >
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>
      
      {isLoadingTrips || isLoadingReservations ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : trips && trips.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>Viajes Disponibles</CardTitle>
                <CardDescription>Selecciona un viaje para ver detalles</CardDescription>
              </CardHeader>
              <CardContent>
                {filteredTrips.length > 0 ? (
                  <div className="space-y-3">
                    {filteredTrips.map(trip => (
                      <div 
                        key={trip.id}
                        className={`
                          p-3 rounded-md cursor-pointer transition-colors
                          ${selectedTrip === trip.id 
                            ? 'bg-primary text-white' 
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-800'}
                        `}
                        onClick={() => setSelectedTrip(trip.id)}
                      >
                        <div className="font-medium">{trip.route.name}</div>
                        <div className="text-sm mt-1 flex justify-between">
                          <span className={selectedTrip === trip.id ? 'text-white' : 'text-gray-500'}>
                            {trip.departureTime}
                          </span>
                          <Badge variant={selectedTrip === trip.id ? "outline" : "secondary"}>
                            {trip.availableSeats}/{trip.capacity}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    No hay viajes programados para esta fecha
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-3">
            {selectedTrip && trips ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Detalles del Viaje</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {trips.find(t => t.id === selectedTrip) && (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div>
                            <h3 className="text-lg font-semibold mb-4">Ruta</h3>
                            <div className="space-y-4">
                              <div>
                                <Label className="text-gray-500">Nombre de la Ruta</Label>
                                <div className="font-medium">{trips.find(t => t.id === selectedTrip)?.route.name}</div>
                              </div>
                              <div>
                                <Label className="text-gray-500">Origen</Label>
                                <div className="font-medium">{trips.find(t => t.id === selectedTrip)?.route.origin}</div>
                              </div>
                              <div>
                                <Label className="text-gray-500">Destino</Label>
                                <div className="font-medium">{trips.find(t => t.id === selectedTrip)?.route.destination}</div>
                              </div>
                            </div>
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold mb-4">Horario</h3>
                            <div className="space-y-4">
                              <div>
                                <Label className="text-gray-500">Fecha</Label>
                                <div className="font-medium">
                                  {formatDate(trips.find(t => t.id === selectedTrip)?.departureDate || '')}
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-gray-500">Salida</Label>
                                  <div className="font-medium">{trips.find(t => t.id === selectedTrip)?.departureTime}</div>
                                </div>
                                <div>
                                  <Label className="text-gray-500">Llegada</Label>
                                  <div className="font-medium">{trips.find(t => t.id === selectedTrip)?.arrivalTime}</div>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <Label className="text-gray-500">Tipo de Vehículo</Label>
                                  <div className="font-medium capitalize">{trips.find(t => t.id === selectedTrip)?.vehicleType}</div>
                                </div>
                                <div>
                                  <Label className="text-gray-500">Asientos Disponibles</Label>
                                  <div className="font-medium">{trips.find(t => t.id === selectedTrip)?.availableSeats} / {trips.find(t => t.id === selectedTrip)?.capacity}</div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <Separator className="my-6" />
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                          <Card className="bg-blue-50 border-blue-100">
                            <CardContent className="pt-6">
                              <div className="flex items-center space-x-2">
                                <div className="p-2 bg-blue-100 rounded-full">
                                  <UserIcon className="h-5 w-5 text-blue-600" />
                                </div>
                                <div className="text-blue-600 font-medium">Pasajeros</div>
                              </div>
                              <div className="mt-4 text-3xl font-bold text-blue-700">{totalPassengers}</div>
                            </CardContent>
                          </Card>
                          
                          <Card className="bg-green-50 border-green-100">
                            <CardContent className="pt-6">
                              <div className="flex items-center space-x-2">
                                <div className="p-2 bg-green-100 rounded-full">
                                  <DollarSignIcon className="h-5 w-5 text-green-600" />
                                </div>
                                <div className="text-green-600 font-medium">Ventas Totales</div>
                              </div>
                              <div className="mt-4 text-3xl font-bold text-green-700">
                                ${totalSales.toLocaleString('es-MX')}
                              </div>
                            </CardContent>
                          </Card>
                          
                          <Card className="bg-purple-50 border-purple-100">
                            <CardContent className="pt-6">
                              <div className="flex items-center space-x-2">
                                <div className="p-2 bg-purple-100 rounded-full">
                                  <PackageIcon className="h-5 w-5 text-purple-600" />
                                </div>
                                <div className="text-purple-600 font-medium">Reservaciones</div>
                              </div>
                              <div className="mt-4 text-3xl font-bold text-purple-700">
                                {tripReservations.length}
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                        
                        <div className="mt-6">
                          <h3 className="text-lg font-semibold mb-4">Lista de Pasajeros</h3>
                          
                          {tripReservations.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse">
                                <thead>
                                  <tr className="bg-gray-50">
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Nombre
                                    </th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Contacto
                                    </th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Ruta
                                    </th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Importe
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {tripReservations.flatMap(reservation => 
                                    reservation.passengers.map((passenger, index) => (
                                      <tr key={`${reservation.id}-${index}`} className="hover:bg-gray-50">
                                        <td className="py-3 px-4 whitespace-nowrap">
                                          <div className="text-sm font-medium text-gray-900">
                                            {passenger.firstName} {passenger.lastName}
                                          </div>
                                        </td>
                                        <td className="py-3 px-4 whitespace-nowrap">
                                          <div className="text-sm text-gray-500">{reservation.email}</div>
                                          <div className="text-sm text-gray-500">{reservation.phone}</div>
                                        </td>
                                        <td className="py-3 px-4 whitespace-nowrap">
                                          <div className="text-sm text-gray-900">
                                            {reservation.trip?.segmentOrigin || reservation.trip?.route.origin} → {' '}
                                            {reservation.trip?.segmentDestination || reservation.trip?.route.destination}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            {reservation.trip.departureTime} - {reservation.trip.arrivalTime}
                                          </div>
                                        </td>
                                        <td className="py-3 px-4 whitespace-nowrap">
                                          <div className="text-sm font-medium text-gray-900">
                                            ${reservation.totalAmount.toLocaleString('es-MX')}
                                          </div>
                                        </td>
                                      </tr>
                                    ))
                                  )}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-center py-8 rounded-md bg-gray-50">
                              <p className="text-gray-500">No hay pasajeros registrados para este viaje</p>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="flex flex-col justify-center items-center h-64 bg-gray-50 rounded-lg p-6">
                <p className="text-gray-500 text-center mb-2">
                  Selecciona un viaje para ver los detalles
                </p>
                {filteredTrips.length === 0 && (
                  <p className="text-gray-400 text-center text-sm">
                    No hay viajes disponibles para esta fecha
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex justify-center items-center h-64 bg-gray-50 rounded-lg">
          <p className="text-gray-500">No hay viajes registrados en el sistema</p>
        </div>
      )}
    </div>
  );
}