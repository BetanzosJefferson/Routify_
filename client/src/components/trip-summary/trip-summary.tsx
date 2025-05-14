import { useState, useEffect } from "react";
import { ClipboardListIcon, UserIcon, DollarSignIcon, PackageIcon, ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, addDays, subDays, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { Trip, TripWithRouteInfo, Reservation, Passenger } from "@shared/schema";
import { useTrips } from "@/hooks/use-trips";
import { useReservations } from "@/hooks/use-reservations";
import { usePackages, Package } from "@/hooks/use-packages";
import { formatTripTime, extractDayIndicator } from "@/lib/trip-utils";

type TripSummaryProps = {
  className?: string;
};

type ReservationWithPassengers = Reservation & {
  passengers: Passenger[];
  trip: TripWithRouteInfo;
  createdByUser?: {
    id: number;
    firstName: string;
    lastName: string;
  };
  checkedByUser?: {
    id: number;
    firstName: string;
    lastName: string;
  };
  paidBy?: number;
  paidAt?: string | Date;
  paidByUser?: {
    id: number;
    firstName: string;
    lastName: string;
  };
};

export default function TripSummary({ className }: TripSummaryProps) {
  const [selectedTrip, setSelectedTrip] = useState<number | null>(null);
  const [tripReservations, setTripReservations] = useState<ReservationWithPassengers[]>([]);
  const [totalPassengers, setTotalPassengers] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [totalCashSales, setTotalCashSales] = useState(0);
  const [totalTransferSales, setTotalTransferSales] = useState(0);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  // Usando nuestros nuevos hooks especializados
  const { 
    data: trips, 
    isLoading: isLoadingTrips 
  } = useTrips();

  // Usando el hook especializado para reservaciones
  const { 
    data: reservations, 
    isLoading: isLoadingReservations 
  } = useReservations();
  
  // Consultar paqueterías solo cuando hay un viaje seleccionado
  const {
    data: packages,
    isLoading: isLoadingPackages
  } = usePackages({
    tripId: selectedTrip || undefined,
    enabled: !!selectedTrip
  });
  
  // Función helper para procesar fecha de viaje en formato consistente
  const getTripDateStr = (tripDate: any): string => {
    if (typeof tripDate === 'string') {
      // Si es formato ISO, extraer solo la parte de fecha
      if (tripDate.includes('T')) {
        return tripDate.split('T')[0];
      }
      return tripDate;
    } else if (tripDate instanceof Date) {
      return format(tripDate, 'yyyy-MM-dd');
    } else {
      // En caso de que sea un tipo no esperado, intentar convertir a fecha
      try {
        return format(new Date(tripDate), 'yyyy-MM-dd');
      } catch (e) {
        console.error("Formato de fecha inválido:", tripDate);
        return '';
      }
    }
  };

  // Filtrar para obtener solo viajes principales (no sub-viajes) y por fecha seleccionada
  const filteredTrips = trips?.filter(trip => {
    // Filtrar por viajes principales
    if (trip.isSubTrip) return false;
    
    // Obtener fecha del viaje y fecha actual en formato YYYY-MM-DD
    const tripDateStr = getTripDateStr(trip.departureDate);
    const currentDateStr = format(currentDate, 'yyyy-MM-dd');
    
    // Comparar las cadenas de fecha directamente
    return tripDateStr === currentDateStr;
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
      
      // Calcular ventas por método de pago considerando tanto anticipos como pagos finales
      let cashSales = 0;
      let transferSales = 0;
      
      // Recorrer cada reserva para calcular correctamente las ventas
      allReservations.forEach(res => {
        // Agregar anticipos según su método de pago
        if (res.advanceAmount && res.advanceAmount > 0) {
          if (res.advancePaymentMethod === 'efectivo') {
            cashSales += res.advanceAmount;
          } else if (res.advancePaymentMethod === 'transferencia') {
            transferSales += res.advanceAmount;
          }
        }
        
        // Calcular el monto restante
        const remainingAmount = res.totalAmount - (res.advanceAmount || 0);
        
        // Agregar pagos restantes según su método de pago
        if (remainingAmount > 0) {
          if (res.paymentMethod === 'efectivo') {
            cashSales += remainingAmount;
          } else if (res.paymentMethod === 'transferencia') {
            transferSales += remainingAmount;
          }
        }
      });
      
      setTripReservations(allReservations);
      setTotalPassengers(passengers);
      setTotalSales(sales);
      setTotalCashSales(cashSales);
      setTotalTransferSales(transferSales);
    } else {
      setTripReservations([]);
      setTotalPassengers(0);
      setTotalSales(0);
      setTotalCashSales(0);
      setTotalTransferSales(0);
    }
  }, [selectedTrip, reservations, trips]);

  // Calcular y actualizar los totales cuando hay paqueterías
  useEffect(() => {
    if (selectedTrip && packages && packages.length > 0) {
      // Calcular ventas por paqueterías
      let packageCashSales = 0;
      let packageTransferSales = 0;
      
      // Recorrer cada paquetería para calcular las ventas
      packages.forEach(pkg => {
        if (pkg.isPaid) {
          if (pkg.paymentMethod === 'efectivo') {
            packageCashSales += pkg.price;
          } else if (pkg.paymentMethod === 'transferencia') {
            packageTransferSales += pkg.price;
          }
        }
      });
      
      // Actualizar totales sumando los valores de paqueterías a los totales existentes
      setTotalSales(prevTotal => prevTotal + packageCashSales + packageTransferSales);
      setTotalCashSales(prevCash => prevCash + packageCashSales);
      setTotalTransferSales(prevTransfer => prevTransfer + packageTransferSales);
    }
  }, [selectedTrip, packages]);

  // Auto-seleccionar el primer viaje filtrado si no hay ninguno seleccionado
  useEffect(() => {
    if (filteredTrips && filteredTrips.length > 0 && !selectedTrip) {
      // Autoseleccionar el primer viaje del día actual
      setSelectedTrip(filteredTrips[0].id);
    }
  }, [filteredTrips, selectedTrip, currentDate]);

  // Función para formatear fecha con ajuste para zona horaria
  const formatDate = (dateString: string | Date) => {
    // Si es string, parseamos asegurándonos que la fecha se interprete correctamente
    let date;
    if (typeof dateString === 'string') {
      // Si es formato ISO, extraemos solo la parte de fecha y creamos un objeto Date
      // con la hora establecida al mediodía para evitar problemas de zona horaria
      if (dateString.includes('T')) {
        const datePart = dateString.split('T')[0];
        const [year, month, day] = datePart.split('-').map(Number);
        date = new Date(year, month - 1, day, 12, 0, 0);
      } else {
        // Para otros formatos, intentamos el constructor normal
        const parts = dateString.split('-');
        if (parts.length === 3) {
          const [year, month, day] = parts.map(Number);
          date = new Date(year, month - 1, day, 12, 0, 0);
        } else {
          date = new Date(dateString);
        }
      }
    } else {
      date = dateString;
    }
    
    return date.toLocaleDateString('es-MX', {
      year: 'numeric',
      month: 'long', 
      day: 'numeric',
      timeZone: 'UTC' // Usar UTC para evitar ajustes de zona horaria
    });
  };
  
  // Función para formatear fecha para el encabezado
  const formatHeaderDate = (date: Date) => {
    return format(date, "d 'de' MMMM, yyyy", { locale: es });
  };
  
  // Función para formatear fecha para input date
  const formatDateForInput = (date: Date) => {
    return format(date, "yyyy-MM-dd");
  };

  return (
    <div className={`py-6 ${className}`}>
      <div className="flex items-center mb-4">
        <div className="rounded-full bg-primary bg-opacity-10 p-2 mr-3">
          <ClipboardListIcon className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800">Bitácora</h2>
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
                            {formatTripTime(trip.departureTime, true, 'pretty')}
                          </span>
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
                                <div className="font-medium">{trips.find(t => t.id === selectedTrip)?.segmentOrigin || trips.find(t => t.id === selectedTrip)?.route.origin}</div>
                              </div>
                              <div>
                                <Label className="text-gray-500">Destino</Label>
                                <div className="font-medium">{trips.find(t => t.id === selectedTrip)?.segmentDestination || trips.find(t => t.id === selectedTrip)?.route.destination}</div>
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
                                  <div className="font-medium">
                                    {formatTripTime(trips.find(t => t.id === selectedTrip)?.departureTime || "", true, 'pretty')}
                                  </div>
                                </div>
                                <div>
                                  <Label className="text-gray-500">Llegada</Label>
                                  <div className="font-medium">
                                    {formatTripTime(trips.find(t => t.id === selectedTrip)?.arrivalTime || "", true, 'pretty')}
                                  </div>
                                </div>
                              </div>
                              
                              {/* Mensaje descriptivo para viajes que cruzan la medianoche */}
                              {(() => {
                                const currentTrip = trips.find(t => t.id === selectedTrip);
                                if (currentTrip && (
                                  extractDayIndicator(currentTrip.departureTime) > 0 || 
                                  extractDayIndicator(currentTrip.arrivalTime) > 0
                                )) {
                                  return (
                                    <div className="mt-2">
                                      <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded-md flex items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <circle cx="12" cy="12" r="10"></circle>
                                          <line x1="12" y1="8" x2="12" y2="12"></line>
                                          <line x1="12" y1="16" x2="12.01" y2="16"></line>
                                        </svg>
                                        {formatTripTime(currentTrip.departureTime, true, 'descriptive', currentTrip.departureDate)}
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                              <div>
                                <Label className="text-gray-500">Vehículo</Label>
                                <div className="font-medium capitalize">
                                  {(() => {
                                    const trip = trips.find(t => t.id === selectedTrip);
                                    // Primero intentamos mostrar la info desde assignedVehicle si existe
                                    if (trip?.assignedVehicle) {
                                      return `${trip.assignedVehicle.brand} ${trip.assignedVehicle.model} - ${trip.assignedVehicle.plates}`;
                                    }
                                    // Si no hay assignedVehicle pero hay vehicleId, buscamos por ID
                                    else if (trip?.vehicleId) {
                                      // Buscar el vehículo en trips (algún viaje podría tener la info)
                                      const vehicleInfo = trips
                                        .filter(t => t.assignedVehicle)
                                        .find(t => t.vehicleId === trip.vehicleId)?.assignedVehicle;
                                      
                                      if (vehicleInfo) {
                                        return `${vehicleInfo.brand} ${vehicleInfo.model} - ${vehicleInfo.plates}`;
                                      }
                                    }
                                    // Si no tenemos info, mostramos "Sin unidad asignada"
                                    return 'Sin unidad asignada';
                                  })()}
                                </div>
                              </div>
                              <div>
                                <Label className="text-gray-500">Operador Asignado</Label>
                                <div className="font-medium capitalize">
                                  {(() => {
                                    const trip = trips.find(t => t.id === selectedTrip);
                                    // Primero intentamos mostrar la info desde assignedDriver si existe
                                    if (trip?.assignedDriver) {
                                      return `${trip.assignedDriver.firstName} ${trip.assignedDriver.lastName}`;
                                    }
                                    // Si no hay assignedDriver pero hay driverId, buscamos por ID
                                    else if (trip?.driverId) {
                                      // Buscar el conductor en trips (algún viaje podría tener la info)
                                      const driverInfo = trips
                                        .filter(t => t.assignedDriver)
                                        .find(t => t.driverId === trip.driverId)?.assignedDriver;
                                      
                                      if (driverInfo) {
                                        return `${driverInfo.firstName} ${driverInfo.lastName}`;
                                      } else {
                                        // Si sabemos que es el chofer con ID 15 (Gerardo Jesus)
                                        if (trip.driverId === 15) {
                                          return 'Gerardo Jesus';
                                        }
                                      }
                                    }
                                    // Si no tenemos info, mostramos "No asignado"
                                    return 'No asignado';
                                  })()}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <Separator className="my-6" />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                <div className="text-green-600 font-medium">Ventas</div>
                              </div>
                              <div className="mt-2 space-y-2">
                                <div className="flex justify-between items-center">
                                  <div className="text-sm text-green-600">Total ventas Efectivo:</div>
                                  <div className="font-semibold">${totalCashSales.toLocaleString('es-MX')}</div>
                                </div>
                                <div className="flex justify-between items-center">
                                  <div className="text-sm text-green-600">Total ventas Transferencia:</div>
                                  <div className="font-semibold">${totalTransferSales.toLocaleString('es-MX')}</div>
                                </div>
                                <div className="pt-2 mt-2 border-t border-green-200 flex justify-between items-center">
                                  <div className="text-sm font-medium text-green-600">Total de ventas:</div>
                                  <div className="text-xl font-bold text-green-700">${totalSales.toLocaleString('es-MX')}</div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>
                        
                        <div className="mt-6">
                          <h3 className="text-lg font-semibold mb-4 flex items-center">
                            <UserIcon className="h-5 w-5 mr-2" />
                            Lista de Pasajeros
                          </h3>
                          
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
                                      Estado de Pago
                                    </th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Pagos
                                    </th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Creado Por
                                    </th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Ticket Escaneado
                                    </th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Cobrado por
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {tripReservations.map((reservation, reservationIndex) => (
                                    // Usando index del reservation como key principal
                                    <tr key={reservation.id} className="hover:bg-gray-50">
                                      <td className="py-3 px-4 whitespace-nowrap">
                                        <div className="text-sm font-medium text-gray-900">
                                          {reservation.passengers.map((p, i) => (
                                            <div key={i} className={i > 0 ? "mt-1" : ""}>
                                              {p.firstName} {p.lastName}
                                            </div>
                                          ))}
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
                                          {formatTripTime(reservation.trip.departureTime, true, 'pretty')} - {formatTripTime(reservation.trip.arrivalTime, true, 'pretty')}
                                        </div>
                                      </td>
                                      <td className="py-3 px-4 whitespace-nowrap">
                                        <div className="text-sm font-medium">
                                          <Badge variant={(reservation.paymentStatus === 'paid' || reservation.paymentStatus === 'pagado' || reservation.status === 'paid' || reservation.status === 'pagado') ? 'outline' : 'default'} 
                                            className={(reservation.paymentStatus === 'paid' || reservation.paymentStatus === 'pagado' || reservation.status === 'paid' || reservation.status === 'pagado')
                                              ? 'border-green-500 text-green-700 bg-green-50' 
                                              : 'bg-yellow-100 text-yellow-700'}>
                                            {(reservation.paymentStatus === 'paid' || reservation.paymentStatus === 'pagado' || reservation.status === 'paid' || reservation.status === 'pagado') ? 'PAGADO' : 'PENDIENTE'}
                                          </Badge>
                                        </div>
                                      </td>
                                      <td className="py-3 px-4 whitespace-nowrap">
                                        <div className="space-y-1">
                                          {reservation.advanceAmount && reservation.advanceAmount > 0 && (
                                            <div className="text-sm text-gray-700">
                                              <span className="font-medium">Anticipo:</span> ${reservation.advanceAmount.toLocaleString('es-MX')} 
                                              ({reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})
                                            </div>
                                          )}
                                          
                                          {(reservation.paymentStatus === 'paid' || reservation.paymentStatus === 'pagado' || reservation.status === 'paid' || reservation.status === 'pagado') ? (
                                            <div className="text-sm text-gray-700">
                                              <span className="font-medium">Pagó:</span> ${(reservation.totalAmount - (reservation.advanceAmount || 0)).toLocaleString('es-MX')} 
                                              ({reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})
                                            </div>
                                          ) : (
                                            <div className="text-sm text-gray-700">
                                              <span className="font-medium">Restó:</span> ${(reservation.totalAmount - (reservation.advanceAmount || 0)).toLocaleString('es-MX')}
                                              {reservation.paymentMethod && ` (${reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})`}
                                            </div>
                                          )}
                                          
                                          <div className="text-sm text-gray-900 font-medium border-t pt-1 mt-1">
                                            Total: ${reservation.totalAmount.toLocaleString('es-MX')}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="py-3 px-4 whitespace-nowrap">
                                        {reservation.createdBy ? (
                                          <div className="text-sm text-gray-700">
                                            {reservation.createdByUser?.firstName} {reservation.createdByUser?.lastName}
                                          </div>
                                        ) : (
                                          <div className="text-sm italic text-gray-500">No registrado</div>
                                        )}
                                      </td>
                                      <td className="py-3 px-4 whitespace-nowrap">
                                        {reservation.checkedBy ? (
                                          <div className="space-y-1">
                                            <div className="flex items-center">
                                              <Badge variant="outline" className="border-green-500 text-green-700 bg-green-50">
                                                Escaneado
                                              </Badge>
                                              <span className="ml-2 text-xs text-gray-500">
                                                {reservation.checkedAt && new Date(reservation.checkedAt).toLocaleString('es-MX')}
                                              </span>
                                            </div>
                                            {reservation.checkedByUser && (
                                              <div className="text-xs text-gray-700 mt-1">
                                                <span className="font-medium">Por:</span> {reservation.checkedByUser.firstName} {reservation.checkedByUser.lastName}
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <Badge variant="outline" className="border-gray-300 text-gray-500">
                                            Pendiente
                                          </Badge>
                                        )}
                                      </td>
                                      <td className="py-3 px-4 whitespace-nowrap">
                                        {reservation.paidBy ? (
                                          <div className="text-sm text-gray-700">
                                            {reservation.paidByUser?.firstName} {reservation.paidByUser?.lastName}
                                            {reservation.paidAt && (
                                              <div className="text-xs text-gray-500 mt-1">
                                                {new Date(reservation.paidAt).toLocaleString('es-MX')}
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="text-sm italic text-gray-500">No registrado</div>
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="text-center py-8 rounded-md bg-gray-50">
                              <p className="text-gray-500">No hay pasajeros registrados para este viaje</p>
                            </div>
                          )}
                        </div>
                        
                        {/* Sección de Paqueterías */}
                        {packages && packages.length > 0 && (
                          <div className="mt-6">
                            <h3 className="text-lg font-semibold mb-4 flex items-center">
                              <PackageIcon className="h-5 w-5 mr-2" />
                              Paqueterías
                            </h3>
                            
                            <div className="overflow-x-auto">
                              <table className="w-full border-collapse">
                                <thead>
                                  <tr className="bg-gray-50">
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      ID
                                    </th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Remitente
                                    </th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Destinatario
                                    </th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Descripción
                                    </th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Precio
                                    </th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Estado de Pago
                                    </th>
                                    <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Forma de Pago
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {packages.map(pkg => (
                                    <tr key={pkg.id}>
                                      <td className="py-3 px-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{pkg.id}</div>
                                      </td>
                                      <td className="py-3 px-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{pkg.senderName} {pkg.senderLastName}</div>
                                        <div className="text-xs text-gray-500">{pkg.senderPhone}</div>
                                      </td>
                                      <td className="py-3 px-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{pkg.recipientName} {pkg.recipientLastName}</div>
                                        <div className="text-xs text-gray-500">{pkg.recipientPhone}</div>
                                      </td>
                                      <td className="py-3 px-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">{pkg.packageDescription}</div>
                                      </td>
                                      <td className="py-3 px-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">${pkg.price.toLocaleString('es-MX')}</div>
                                      </td>
                                      <td className="py-3 px-4 whitespace-nowrap">
                                        <Badge variant={pkg.isPaid ? "success" : "outline"}>
                                          {pkg.isPaid ? "Pagado" : "Pendiente"}
                                        </Badge>
                                      </td>
                                      <td className="py-3 px-4 whitespace-nowrap">
                                        <div className="text-sm text-gray-900">
                                          {pkg.paymentMethod === 'efectivo' ? 'Efectivo' : 
                                           pkg.paymentMethod === 'transferencia' ? 'Transferencia' : 'N/A'}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
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