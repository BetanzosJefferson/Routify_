import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { 
  CalendarIcon, 
  ClipboardListIcon,
  Users, 
  Calendar,
  Clock,
  Bus,
  User,
  X,
  UserIcon,
  Search,
  Check as CheckIcon,
  Phone,
  FilterIcon,
  Trash,
  ClipboardCopy,
  LockIcon,
  DollarSign,
  Wallet,
  Package
} from "lucide-react";
import { formatTripTime } from "@/lib/trip-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input"; 
import { useDriverTrips, Trip } from "@/hooks/use-driver-trips";
import { useDriverReservations, Reservation, Passenger } from "@/hooks/use-driver-reservations";
import { useTripBudget } from "@/hooks/use-trip-budget";
import { useTripExpenses, TripExpense } from "@/hooks/use-trip-expenses";
import { useTripPackages } from "@/hooks/use-trip-packages";
import { normalizeToStartOfDay, formatPrice } from "@/lib/utils";
import { AddExpenseModal } from "./add-expense-modal";
import { ExpenseButton } from "./expense-button";

interface GroupedReservation {
  id: number;
  code: string;
  tripId: number;
  email: string;
  phone: string;
  paymentMethod: string;
  paymentStatus: string;
  amount: number;
  advanceAmount?: number;
  advancePaymentMethod?: string;
  tripSegment: string;
  origin?: string;
  destination?: string;
  notes?: string;
  checkCount?: number;
  checkedBy?: number | null;
  checkedAt?: string | null;
  passengers: {
    id: number;
    firstName: string;
    lastName: string;
    initials: string;
  }[];
}

interface PassengerListSidebarProps {
  tripId: number;
  onClose: () => void;
}

export function PassengerListSidebar({ tripId, onClose }: PassengerListSidebarProps) {
  // Estado para la búsqueda de pasajeros
  const [searchQuery, setSearchQuery] = useState("");
  
  // Ref para el contenedor del sidebar
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  // Obtener información del usuario actual para restricciones por rol
  const { user } = useAuth();
  
  // Query client para refrescar datos después de agregar gastos
  const queryClient = useQueryClient();

  // Efecto para detectar clics fuera del sidebar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Agregar el event listener cuando el componente se monta
    document.addEventListener('mousedown', handleClickOutside);

    // Limpiar el event listener cuando el componente se desmonta
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);
  
  // Función para verificar si el usuario puede ver números telefónicos
  const canViewPhoneNumbers = () => {
    if (!user) return false;
    return !["chofer", "checador"].includes(user.role);
  };
  
  // Cargar detalles del viaje
  const { 
    data: trips, 
    isLoading: isLoadingTripDetails, 
    error: tripError 
  } = useDriverTrips();
  
  // Buscar el viaje específico en la lista de viajes
  const tripDetails = trips?.find(trip => trip.id === tripId);
  
  // Cargar reservaciones del viaje
  const { 
    data: reservations, 
    isLoading: isLoadingReservations,
    error: reservationsError 
  } = useDriverReservations({
    tripId: tripId,
    includeRelated: true
  });
  
  // Cargar el presupuesto del viaje (específicamente para conductores)
  const {
    data: tripBudget,
    isLoading: isLoadingBudget,
    error: budgetError
  } = useTripBudget(tripId);
  
  // Cargar los gastos del viaje para mostrar el resumen presupuesto - gastos
  const {
    data: tripExpenses,
    isLoading: isLoadingExpenses,
    error: expensesError
  } = useTripExpenses(tripId);
  
  // Cargar las paqueterías del viaje
  const {
    data: tripPackages,
    isLoading: isLoadingPackages,
    error: packagesError
  } = useTripPackages(tripId);

  // Función para formatear fecha
  const formatDisplayDate = (dateString: string | Date) => {
    const normalizedDate = normalizeToStartOfDay(dateString);
    return format(normalizedDate, "d 'de' MMMM, yyyy", { locale: es });
  };

  // Procesar reservaciones
  const groupedReservations: GroupedReservation[] = (() => {
    if (!tripId || !reservations) return [];
    
    try {
      // Obtener información de los subviajes
      console.log('[PassengerListSidebar] Buscando información de subviajes...');
      
      // Crear mapa de viajes para búsqueda rápida
      const tripsMap = new Map();
      
      // Añadir los viajes que ya tenemos en el estado
      if (trips) {
        trips.forEach(trip => {
          tripsMap.set(trip.id, trip);
        });
      }
      
      // Añadir información de trip que viene en las reservaciones
      reservations.forEach(res => {
        if ((res as any).trip && (res as any).trip.id) {
          const tripInfo = (res as any).trip;
          if (!tripsMap.has(tripInfo.id)) {
            tripsMap.set(tripInfo.id, tripInfo);
            console.log(`[PassengerListSidebar] Añadido viaje ${tripInfo.id} desde la reservación ${res.id}`);
          }
        }
      });
      
      // Filtrar solo reservaciones que tienen pasajeros
      const relevantReservations = reservations.map(res => {
        if (!res.passengers || !Array.isArray(res.passengers)) {
          return {...res, passengers: []};
        }
        return res;
      });
      
      if (relevantReservations.length === 0) {
        return [];
      }
      
      // Crear reservaciones agrupadas por ID de reservación
      const groupedResult: GroupedReservation[] = [];
      
      for (const reservation of relevantReservations) {
        // Asegurarse que passengers sea un array
        if (!reservation.passengers) {
          reservation.passengers = [];
        } else if (!Array.isArray(reservation.passengers)) {
          reservation.passengers = [];
        }
        
        // Verificar si es un subviaje
        const isFromSubTrip = tripId && reservation.tripId !== tripId;
        
        // Obtener información del subviaje de diferentes posibles fuentes
        let tripInfo = tripsMap.get(reservation.tripId);
        
        // Si no tenemos info del viaje pero hay una propiedad 'trip' en la reservación
        if (!tripInfo && (reservation as any).trip) {
          tripInfo = (reservation as any).trip;
        }
        
        if (isFromSubTrip) {
          console.log(`[PassengerListSidebar] Información de subviaje ${reservation.tripId} para reservación ${reservation.id}:`, 
            tripInfo ? JSON.stringify({
              id: tripInfo.id,
              segmentOrigin: tripInfo.segmentOrigin,
              segmentDestination: tripInfo.segmentDestination,
            }) : "No hay información de viaje"
          );
        }
                        
        // La etiqueta que indica si es viaje completo o subviaje
        const tripSegmentLabel = isFromSubTrip ? 'Subviaje' : 'Viaje completo';
        
        // Determinar origen y destino específicos para este viaje/subviaje
        let tripOrigin = "";
        let tripDestination = "";
        
        if (tripInfo) {
          // Para subviajes, usar segmentOrigin y segmentDestination
          if (isFromSubTrip && tripInfo.segmentOrigin) {
            tripOrigin = tripInfo.segmentOrigin;
          } else if (tripInfo.route && tripInfo.route.origin) {
            tripOrigin = tripInfo.route.origin;
          }
          
          if (isFromSubTrip && tripInfo.segmentDestination) {
            tripDestination = tripInfo.segmentDestination;
          } else if (tripInfo.route && tripInfo.route.destination) {
            tripDestination = tripInfo.route.destination;
          }
        }
        
        // Formatear los orígenes y destinos
        let formattedOrigin = tripOrigin || (reservation as any).origin || "Origen no especificado";
        let formattedDestination = tripDestination || (reservation as any).destination || "Destino no especificado";
        
        // Para subviajes, añadir un indicador visual
        if (isFromSubTrip) {
          formattedOrigin = `${formattedOrigin}`;
          formattedDestination = `${formattedDestination}`;
        }
        
        // Crear el objeto de reservación agrupada
        const groupedReservation: GroupedReservation = {
          id: reservation.id,
          code: `R-${reservation.id.toString().padStart(6, '0')}`,
          tripId: reservation.tripId,
          email: reservation.email || '',
          phone: reservation.phone || '',
          paymentMethod: reservation.paymentMethod || 'unknown',
          paymentStatus: reservation.paymentStatus || 'pendiente',
          amount: reservation.totalAmount || 0,
          advanceAmount: (reservation as any).advanceAmount || 0,
          advancePaymentMethod: (reservation as any).advancePaymentMethod || 'efectivo',
          tripSegment: tripSegmentLabel,
          origin: formattedOrigin,
          destination: formattedDestination,
          notes: reservation.notes || '',
          checkCount: reservation.checkCount || 0,
          checkedBy: reservation.checkedBy || null,
          checkedAt: reservation.checkedAt || null,
          passengers: []
        };
        
        // Añadir todos los pasajeros de esta reservación
        if (Array.isArray(reservation.passengers)) {
          for (const passenger of reservation.passengers) {
            if (!passenger) continue;
            
            groupedReservation.passengers.push({
              id: passenger.id || 0,
              firstName: passenger.firstName || 'Sin nombre',
              lastName: passenger.lastName || 'Sin apellido',
              initials: passenger.firstName && passenger.lastName ? 
                `${passenger.firstName.charAt(0)}${passenger.lastName.charAt(0)}`.toUpperCase() : 'XX'
            });
          }
        }
        
        groupedResult.push(groupedReservation);
      }
      
      return groupedResult;
    } catch (error) {
      console.error("Error al procesar reservaciones:", error);
      return [];
    }
  })();

  // Determinar si una reservación ha sido verificada (tiene check)
  const isReservationChecked = (reservation: any) => {
    // Verificación explícita: varias alternativas para detectar reservaciones verificadas
    if (reservation.checked === true) return true;
    if (reservation.checkedBy) return true;
    if (reservation.checkedAt) return true;
    if (reservation.checkCount && reservation.checkCount > 0) return true;
    
    return false;
  };
  
  // Filtrar y ordenar reservaciones basadas en el término de búsqueda
  const filteredReservations = searchQuery.trim() 
    ? groupedReservations.filter(reservation => {
        const query = searchQuery.toLowerCase();
        
        // Buscar en nombres de pasajeros
        const matchesPassenger = reservation.passengers.some(
          passenger => `${passenger.firstName} ${passenger.lastName}`.toLowerCase().includes(query)
        );
        
        // Buscar en código de reservación
        const matchesCode = reservation.code.toLowerCase().includes(query);
        
        // Buscar en email
        const matchesEmail = reservation.email.toLowerCase().includes(query);
        
        // Buscar en teléfono
        const matchesPhone = reservation.phone.toLowerCase().includes(query);
        
        // Buscar en origen/destino
        const matchesOriginDestination = tripDetails ? (
          (tripDetails.segmentOrigin || '').toLowerCase().includes(query) || 
          (tripDetails.segmentDestination || '').toLowerCase().includes(query) ||
          (tripDetails.route?.origin || '').toLowerCase().includes(query) || 
          (tripDetails.route?.destination || '').toLowerCase().includes(query)
        ) : false;
        
        return matchesPassenger || matchesCode || matchesEmail || matchesPhone || matchesOriginDestination;
      })
    : groupedReservations;
    
  // Ordenar las reservaciones: primero las no verificadas, después las verificadas
  const sortedReservations = [...filteredReservations].sort((a, b) => {
    const aIsChecked = isReservationChecked(a);
    const bIsChecked = isReservationChecked(b);
    
    if (aIsChecked && !bIsChecked) return 1; // a es verificada, b no, entonces a va después
    if (!aIsChecked && bIsChecked) return -1; // a no es verificada, b sí, entonces a va primero
    return 0; // Mantener el orden original si ambas están en el mismo estado
  });
  
  // Total de pasajeros (solo muestra total de todos los pasajeros, no de los filtrados)
  const totalPassengers = groupedReservations.reduce((total, res) => total + res.passengers.length, 0);

  if (isLoadingTripDetails || isLoadingReservations) {
    return (
      <div 
        className="fixed inset-y-0 right-0 w-full md:w-[500px] lg:w-[550px] bg-white shadow-2xl overflow-y-auto transition-all duration-300 ease-in-out z-50 border-l border-gray-200 max-w-[95%]"
        style={{ 
          boxShadow: "-10px 0 15px -3px rgba(0, 0, 0, 0.1), -4px 0 6px -2px rgba(0, 0, 0, 0.05)",
        }}
      >
        <div className="flex justify-between items-center p-5 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-gray-800">Cargando...</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-gray-100">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex flex-col justify-center items-center h-[calc(100vh-80px)]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-500">Cargando datos del viaje...</p>
        </div>
      </div>
    );
  }

  if (tripError || !tripDetails) {
    return (
      <div 
        className="fixed inset-y-0 right-0 w-full md:w-[500px] lg:w-[550px] bg-white shadow-2xl overflow-y-auto transition-all duration-300 ease-in-out z-50 border-l border-gray-200 max-w-[95%]"
        style={{ 
          boxShadow: "-10px 0 15px -3px rgba(0, 0, 0, 0.1), -4px 0 6px -2px rgba(0, 0, 0, 0.05)",
        }}
      >
        <div className="flex justify-between items-center p-5 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-gray-800">Error</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-gray-100">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="p-8 flex flex-col items-center justify-center">
          <div className="rounded-full bg-red-100 p-3 mb-4">
            <X className="h-6 w-6 text-red-500" />
          </div>
          <h3 className="text-lg font-medium mb-2 text-gray-800">No se pudo cargar la información</h3>
          <p className="text-red-500 text-center mb-4">
            {tripError instanceof Error 
              ? tripError.message 
              : "No se pudo cargar la información del viaje"}
          </p>
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={sidebarRef}
      className="fixed inset-y-0 right-0 w-full md:w-[500px] lg:w-[550px] bg-white shadow-2xl overflow-y-auto transition-all duration-300 ease-in-out z-50 border-l border-gray-200 max-w-[95%]"
      style={{ 
        boxShadow: "-10px 0 15px -3px rgba(0, 0, 0, 0.1), -4px 0 6px -2px rgba(0, 0, 0, 0.05)",
      }}
    >
      <div className="flex justify-between items-center p-5 border-b sticky top-0 bg-white z-10">
        <h2 className="text-xl font-semibold text-gray-800">Lista de Pasajeros</h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-gray-100">
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      <div className="p-6">
        {/* Información del viaje */}
        <div className="mb-6 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-xl font-semibold mb-1">{tripDetails.route?.name}</h3>
          <p className="text-gray-600 font-medium mb-3">
            {tripDetails.segmentOrigin || (tripDetails.route?.origin || 'Origen')} → 
            {tripDetails.segmentDestination || (tripDetails.route?.destination || 'Destino')}
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="flex items-center bg-gray-50 p-3 rounded-lg">
              <div className="rounded-full bg-blue-100 p-2 mr-3">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500">Fecha</div>
                <div className="text-sm font-medium">{formatDisplayDate(tripDetails.departureDate)}</div>
              </div>
            </div>
            
            <div className="flex items-center bg-gray-50 p-3 rounded-lg">
              <div className="rounded-full bg-purple-100 p-2 mr-3">
                <Clock className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500">Horario</div>
                <div className="text-sm font-medium">
                  {formatTripTime(tripDetails.departureTime, true, 'pretty')} - {formatTripTime(tripDetails.arrivalTime, true, 'pretty')}
                </div>
              </div>
            </div>
            
            <div className="flex items-center bg-gray-50 p-3 rounded-lg">
              <div className="rounded-full bg-green-100 p-2 mr-3">
                <Bus className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <div className="text-xs text-gray-500">Vehículo</div>
                <div className="text-sm font-medium capitalize">
                  {(() => {
                    // Primero intentamos mostrar la info desde assignedVehicle si existe
                    if (tripDetails.assignedVehicle) {
                      return `${tripDetails.assignedVehicle.brand} ${tripDetails.assignedVehicle.model} - ${tripDetails.assignedVehicle.plates}`;
                    }
                    // Si no hay assignedVehicle pero hay vehicleId, buscamos por ID
                    else if (tripDetails.vehicleId) {
                      // Buscar el vehículo en trips (algún viaje podría tener la info)
                      const vehicleInfo = trips
                        ?.filter(t => t.assignedVehicle !== undefined)
                        .find(t => t.vehicleId === tripDetails.vehicleId)?.assignedVehicle;
                      
                      if (vehicleInfo) {
                        return `${vehicleInfo.brand} ${vehicleInfo.model} - ${vehicleInfo.plates}`;
                      }
                    }
                    // Si no tenemos info, mostramos "Sin unidad asignada"
                    return 'Sin unidad asignada';
                  })()}
                </div>
              </div>
            </div>
            
            {/* Eliminamos esta sección ya que se moverá a un div independiente */}
          </div>
          
          <div className="flex items-center bg-blue-50 p-4 rounded-lg border border-blue-100">
            <div className="rounded-full bg-blue-100 p-2 mr-3">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-xs text-blue-600">Total de pasajeros</div>
              <div className="text-lg font-bold text-blue-700">{totalPassengers}</div>
            </div>
          </div>
        </div>
        
        {/* Nueva sección independiente de presupuesto y gastos para conductores */}
        {user?.role === 'chofer' && (
          <div className="mb-6 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            {/* Sección de presupuesto asignado */}
            <div className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
              <div className="flex items-center">
                <div className="rounded-full bg-yellow-100 p-2 mr-3">
                  <Wallet className="h-4 w-4 text-yellow-600" />
                </div>
                <div>
                  <div className="text-xs text-gray-500">Presupuesto asignado</div>
                  <div className="text-sm font-medium">
                    {isLoadingBudget ? (
                      <span className="text-gray-400">Cargando...</span>
                    ) : tripBudget ? (
                      <span className="text-gray-700 font-semibold">${tripBudget.amount.toFixed(2)} MXN</span>
                    ) : (
                      <span className="text-gray-500">Sin presupuesto asignado</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Usamos nuestro componente ExpenseButton */}
              <ExpenseButton tripId={tripId} />
            </div>
            
            {/* Sección de gastos registrados y balance */}
            <div className="mt-3 bg-gray-50 p-3 rounded-lg">
              <div className="flex justify-between mb-2">
                <h4 className="text-sm font-medium text-gray-700">Gastos registrados:</h4>
                {isLoadingExpenses ? (
                  <span className="text-gray-400 text-xs">Cargando...</span>
                ) : (
                  <span className="text-red-600 font-medium text-sm">
                    ${(tripExpenses?.reduce((total, expense) => total + expense.amount, 0) || 0).toFixed(2)} MXN
                  </span>
                )}
              </div>
              
              {/* Lista breve de gastos */}
              {!isLoadingExpenses && tripExpenses && tripExpenses.length > 0 ? (
                <div className="space-y-1 mt-2 mb-3 max-h-24 overflow-y-auto">
                  {tripExpenses.map((expense) => (
                    <div key={expense.id} className="flex justify-between text-xs px-2 py-1 rounded bg-white">
                      <span className="text-gray-600">{expense.type}: {expense.description?.substring(0, 20)}{expense.description?.length > 20 ? '...' : ''}</span>
                      <span className="text-red-500">${expense.amount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : !isLoadingExpenses ? (
                <div className="text-xs text-gray-500 mb-3">No hay gastos registrados</div>
              ) : null}
              
              {/* Mostrar balance (presupuesto - gastos) */}
              <Separator className="my-2" />
              <div className="flex justify-between mt-2">
                <span className="text-sm font-medium">Balance:</span>
                {isLoadingBudget || isLoadingExpenses ? (
                  <span className="text-gray-400 text-xs">Calculando...</span>
                ) : (
                  <div className="text-sm font-bold">
                    {(() => {
                      const presupuesto = tripBudget?.amount || 0;
                      const totalGastos = tripExpenses?.reduce((total, expense) => total + expense.amount, 0) || 0;
                      const balance = presupuesto - totalGastos;
                      
                      return (
                        <span className={balance >= 0 ? "text-green-600" : "text-red-600"}>
                          ${balance.toFixed(2)} MXN
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">Lista de Pasajeros</h3>
          
          {/* Campo de búsqueda */}
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar por nombre, número, origen, destino o email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pl-10 pr-4 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
            />
            <div className="absolute left-3 top-2.5 text-gray-400">
              <Search className="h-4 w-4" />
            </div>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        
        {/* Lista de pasajeros */}
        {groupedReservations.length > 0 ? (
          <>
            {sortedReservations.length > 0 ? (
              <div className="space-y-4">
                {sortedReservations.map((reservation, index) => (
                  <div 
                    key={`reservation-${reservation.id}`} 
                    className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white hover:shadow-md transition-shadow"
                  >
                    <div className="border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                      <div className="flex justify-between items-center mb-1.5">
                        <div className="flex items-center">
                          <div className="bg-primary/10 text-primary font-medium px-3 py-1 rounded-md mr-3">
                            {reservation.passengers.length} asientos
                          </div>
                          <div>
                            <div className="font-medium">
                              {reservation.passengers.length === 1 
                                ? reservation.passengers[0]?.firstName + ' ' + reservation.passengers[0]?.lastName 
                                : `${reservation.passengers[0]?.firstName || 'nombre'} ${reservation.passengers[0]?.lastName || 'del pasajero'}`}
                            </div>
                            <div className="text-xs text-gray-500">{reservation.code}</div>
                            {/* Indicador de Check basado en checkCount */}
                            <div className="mt-1">
                              {reservation.checkCount && reservation.checkCount > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                  <CheckIcon className="h-3 w-3 mr-1" />
                                  Check
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                  <X className="h-3 w-3 mr-1" />
                                  No check
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <div className="text-xs text-gray-700 mb-1">
                            Anticipo: {formatPrice(reservation.advanceAmount || 0)} ({reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})
                          </div>
                          
                          {/* Mostrar "Pagó" solamente si está marcado como pagado */}
                          {reservation.paymentStatus === 'pagado' && reservation.advanceAmount < reservation.amount && (
                            <div className="text-xs text-gray-700 mb-1">
                              Pagó: {formatPrice(reservation.amount - (reservation.advanceAmount || 0))} ({reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})
                            </div>
                          )}
                          
                          <div className="flex items-center">
                            <span className="text-sm font-medium mr-2">Por cobrar</span> 
                            <span className="text-lg font-bold text-primary">
                              {reservation.paymentStatus === 'pagado' 
                                ? '$ 0' 
                                : `$ ${(reservation.amount - (reservation.advanceAmount || 0)).toFixed(0)}`
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-4">
                      {/* Datos de pasajeros */}
                      <div className="mb-3">
                        <div className="text-sm font-medium text-gray-800">
                          {reservation.passengers.length > 1 
                            ? (
                              <>
                                <div className="mb-1">
                                  {reservation.passengers.map((passenger, idx) => (
                                    <div key={idx}>
                                      {passenger.firstName} {passenger.lastName}
                                    </div>
                                  ))}
                                </div>
                              </>
                            ) 
                            : null}
                        </div>
                      </div>
                      
                      {/* Etiqueta de subviaje eliminada */}
                      
                      {/* Origen y destino completos (incluyendo punto de abordaje) */}
                      <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                        <div>
                          <div className="text-xs text-gray-500">Origen</div>
                          <div className="font-medium">
                            {reservation.origin || tripDetails?.route?.origin || 'Origen'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Destino</div>
                          <div className="font-medium">
                            {reservation.destination || tripDetails?.route?.destination || 'Destino'}
                          </div>
                        </div>
                      </div>
                      
                      {/* Teléfono de contacto con botón para copiar */}
                      {reservation.phone && (
                        <div className="text-sm mb-3">
                          <div className="text-xs text-gray-500">Contacto</div>
                          <div className="font-medium flex items-center">
                            {canViewPhoneNumbers() ? (
                              <>
                                <Phone className="h-3 w-3 mr-1 text-gray-500" />
                                <a href={`tel:${reservation.phone}`} className="text-primary hover:underline">
                                  {reservation.phone}
                                </a>
                                <button 
                                  onClick={() => {
                                    navigator.clipboard.writeText(reservation.phone || '');
                                    // Podríamos añadir una notificación de éxito aquí
                                  }}
                                  className="ml-2 p-1 rounded-sm hover:bg-gray-100"
                                  title="Copiar al portapapeles"
                                >
                                  <ClipboardCopy className="h-3.5 w-3.5 text-gray-500" />
                                </button>
                              </>
                            ) : (
                              <>
                                <LockIcon className="h-3 w-3 mr-1 text-gray-500" />
                                <span className="text-gray-500 italic">Información restringida</span>
                              </>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Notas de la reservación */}
                      {reservation.notes && (
                        <div className="text-sm mb-3">
                          <div className="text-xs text-gray-500">Notas</div>
                          <div className="font-medium p-1.5 bg-gray-50 rounded-sm border border-gray-100 text-gray-700 text-xs">
                            {reservation.notes}
                          </div>
                        </div>
                      )}
                      
                      {/* Información de pago simplificada */}
                      <div className="mt-3">
                        <Badge 
                          variant="outline"
                          className={reservation.paymentStatus === 'pagado' 
                            ? 'bg-green-100 text-green-800 border-green-200' 
                            : 'bg-yellow-100 text-yellow-800 border-yellow-200'}
                        >
                          {reservation.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-10 bg-gray-50 rounded-lg border border-gray-200">
                <div className="rounded-full bg-gray-100 p-3 mx-auto w-14 h-14 mb-3 flex items-center justify-center">
                  <Search className="h-6 w-6 text-gray-400" />
                </div>
                <h3 className="text-base font-medium mb-1 text-gray-800">No se encontraron resultados</h3>
                <p className="text-gray-500 text-sm max-w-sm mx-auto">
                  No hay pasajeros que coincidan con tu búsqueda. Intenta con otros términos.
                </p>
                {searchQuery && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => setSearchQuery("")}
                    className="mt-3"
                  >
                    Limpiar búsqueda
                  </Button>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16 bg-gray-50 rounded-xl border border-gray-200">
            <div className="rounded-full bg-gray-100 p-4 mx-auto w-16 h-16 mb-4 flex items-center justify-center">
              <UserIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium mb-2 text-gray-800">No hay pasajeros registrados</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              Este viaje no tiene reservaciones o pasajeros registrados en el sistema.
            </p>
          </div>
        )}

        {/* Sección de Paqueterías */}
        <div className="mt-6">
          <Separator className="mb-4" />
          <div className="flex items-center gap-2 mb-4">
            <Package className="h-5 w-5 text-orange-600" />
            <h3 className="text-lg font-semibold text-gray-900">Paqueterías del Viaje</h3>
          </div>
          
          {isLoadingPackages ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-600 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Cargando paqueterías...</p>
            </div>
          ) : packagesError ? (
            <div className="text-center py-4 text-red-600">
              <p className="text-sm">Error al cargar paqueterías</p>
            </div>
          ) : tripPackages && tripPackages.length > 0 ? (
            <div className="space-y-3">
              <div className="flex items-center bg-orange-50 p-3 rounded-lg border border-orange-100">
                <div className="rounded-full bg-orange-100 p-2 mr-3">
                  <Package className="h-4 w-4 text-orange-600" />
                </div>
                <div>
                  <div className="text-xs text-orange-600">Total de paquetes</div>
                  <div className="text-lg font-bold text-orange-700">{tripPackages.length}</div>
                </div>
              </div>
              
              <div className="max-h-48 overflow-y-auto space-y-2">
                {tripPackages.map((pkg) => (
                  <Card key={pkg.id} className="border border-gray-200">
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="font-medium text-sm text-gray-900">
                            {pkg.senderName} → {pkg.recipientName}
                          </p>
                          <p className="text-xs text-gray-600 truncate">
                            {pkg.description}
                          </p>
                        </div>
                        <Badge 
                          variant={pkg.isPaid ? "default" : "secondary"}
                          className={pkg.isPaid ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}
                        >
                          {pkg.isPaid ? "Pagado" : "Pendiente"}
                        </Badge>
                      </div>
                      
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>{pkg.weight}kg</span>
                        <span className="font-medium text-gray-900">
                          {formatPrice(pkg.amount)}
                        </span>
                      </div>
                      
                      {pkg.fragile && (
                        <div className="mt-1">
                          <Badge variant="outline" className="text-xs border-red-200 text-red-600">
                            Frágil
                          </Badge>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
              
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200">
              <div className="rounded-full bg-gray-100 p-3 mx-auto w-12 h-12 mb-3 flex items-center justify-center">
                <Package className="h-6 w-6 text-gray-400" />
              </div>
              <h4 className="text-sm font-medium mb-1 text-gray-800">Sin paqueterías</h4>
              <p className="text-gray-500 text-xs max-w-xs mx-auto">
                Este viaje no tiene paquetes registrados en el sistema.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}