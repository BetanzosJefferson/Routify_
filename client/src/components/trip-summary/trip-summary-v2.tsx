import { useState, useEffect } from "react";
import { ClipboardListIcon, UserIcon, DollarSignIcon, PackageIcon, ChevronLeftIcon, ChevronRightIcon, CalendarIcon, PlusCircleIcon, MinusCircleIcon, CoinsIcon, PiggyBankIcon, Calculator, Loader2 } from "lucide-react";
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
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

// Redefinir tipo de Expense para persistencia
type Expense = {
  id: number | string;  // Usará string localmente y número cuando venga de la BD
  tripId: number;
  amount: number;
  category: string;     // Renombrar 'type' a 'category' para ser consistente con la API
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: number | null;
};

export default function TripSummary({ className }: TripSummaryProps) {
  const [selectedTrip, setSelectedTrip] = useState<number | null>(null);
  const [tripReservations, setTripReservations] = useState<ReservationWithPassengers[]>([]);
  const [totalPassengers, setTotalPassengers] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [totalCashSales, setTotalCashSales] = useState(0);
  const [totalTransferSales, setTotalTransferSales] = useState(0);
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  
  // Estados para datos financieros
  const [operatorBudget, setOperatorBudget] = useState<number>(0);
  const [isLoadingBudget, setIsLoadingBudget] = useState(false);
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  
  // Estado para gastos
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [isRemovingExpense, setIsRemovingExpense] = useState<number | null>(null);
  
  const [newExpense, setNewExpense] = useState<Expense>({
    id: '',
    tripId: 0,
    amount: 0,
    category: '',
    description: ''
  });

  // Notificaciones
  const { toast } = useToast();
  
  // Total de gastos
  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  
  // Cargar el presupuesto del viaje
  const loadTripBudget = async (tripId: number) => {
    if (!tripId) return;
    
    setIsLoadingBudget(true);
    try {
      const response = await apiRequest<{amount: number}>({
        url: `/api/trips/${tripId}/budget`,
        method: "GET"
      });
      
      if (response && typeof response.amount === 'number') {
        setOperatorBudget(response.amount);
      } else {
        setOperatorBudget(0);
      }
    } catch (error) {
      console.error("Error al cargar el presupuesto:", error);
      toast({
        title: "Error al cargar presupuesto",
        description: "No se pudo obtener el presupuesto del operador.",
        variant: "destructive"
      });
      setOperatorBudget(0);
    } finally {
      setIsLoadingBudget(false);
    }
  };
  
  // Guardar el presupuesto del viaje
  const saveTripBudget = async (tripId: number, amount: number) => {
    if (!tripId) return;
    
    setIsSavingBudget(true);
    try {
      const response = await apiRequest<{amount: number}>({
        url: `/api/trips/${tripId}/budget`,
        method: "POST",
        data: { amount }
      });
      
      if (response) {
        setOperatorBudget(amount);
        toast({
          title: "Presupuesto guardado",
          description: "El presupuesto del operador ha sido actualizado.",
          variant: "default"
        });
      }
    } catch (error) {
      console.error("Error al guardar el presupuesto:", error);
      toast({
        title: "Error al guardar",
        description: "No se pudo actualizar el presupuesto del operador.",
        variant: "destructive"
      });
    } finally {
      setIsSavingBudget(false);
    }
  };
  
  // Cargar los gastos del viaje
  const loadTripExpenses = async (tripId: number) => {
    if (!tripId) return;
    
    setIsLoadingExpenses(true);
    try {
      const response = await apiRequest<Expense[]>({
        url: `/api/trips/${tripId}/expenses`,
        method: "GET"
      });
      
      if (Array.isArray(response)) {
        setExpenses(response);
      } else {
        setExpenses([]);
      }
    } catch (error) {
      console.error("Error al cargar los gastos:", error);
      toast({
        title: "Error al cargar gastos",
        description: "No se pudieron obtener los gastos del viaje.",
        variant: "destructive"
      });
      setExpenses([]);
    } finally {
      setIsLoadingExpenses(false);
    }
  };
  
  // Función para agregar un nuevo gasto
  const handleAddExpense = async () => {
    if (newExpense.category.trim() === '' || newExpense.amount <= 0 || !selectedTrip) return;
    
    setIsSavingExpense(true);
    try {
      // Preparar el objeto de gasto para la API
      const expenseData = {
        category: newExpense.category,
        description: newExpense.description || '',
        amount: newExpense.amount,
        tripId: selectedTrip
      };
      
      // Enviar a la API
      const response = await apiRequest<Expense>({
        url: `/api/trips/${selectedTrip}/expenses`,
        method: "POST",
        data: expenseData
      });
      
      if (response && response.id) {
        // Añadir el nuevo gasto a la lista local
        setExpenses(prevExpenses => [...prevExpenses, response]);
        
        // Resetear el formulario
        setNewExpense({
          id: '',
          tripId: selectedTrip,
          amount: 0,
          category: '',
          description: ''
        });
        
        toast({
          title: "Gasto registrado",
          description: "El gasto ha sido añadido correctamente.",
          variant: "default"
        });
      }
    } catch (error) {
      console.error("Error al añadir gasto:", error);
      toast({
        title: "Error al crear gasto",
        description: "No se pudo guardar el gasto. Inténtelo de nuevo.",
        variant: "destructive"
      });
    } finally {
      setIsSavingExpense(false);
    }
  };
  
  // Función para eliminar un gasto
  const handleRemoveExpense = async (id: number | string) => {
    // Si el ID es un string (gasto local no guardado), simplemente eliminar del estado
    if (typeof id === 'string') {
      setExpenses(expenses.filter(expense => expense.id !== id));
      return;
    }
    
    // Si es un ID numérico, eliminar de la base de datos
    setIsRemovingExpense(id as number);
    try {
      await apiRequest({
        url: `/api/trips/expenses/${id}`,
        method: "DELETE"
      });
      
      // Actualizar lista local
      setExpenses(prevExpenses => prevExpenses.filter(expense => expense.id !== id));
      
      toast({
        title: "Gasto eliminado",
        description: "El gasto ha sido eliminado correctamente.",
        variant: "default"
      });
    } catch (error) {
      console.error(`Error al eliminar gasto ${id}:`, error);
      toast({
        title: "Error al eliminar",
        description: "No se pudo eliminar el gasto. Inténtelo de nuevo.",
        variant: "destructive"
      });
    } finally {
      setIsRemovingExpense(null);
    }
  };
  
  // Calculo de ganancias del viaje (ventas totales - gastos totales)
  const tripProfit = totalSales - totalExpenses;

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

  // Cargar datos financieros cuando se selecciona un viaje
  useEffect(() => {
    if (selectedTrip) {
      // Cargar presupuesto
      loadTripBudget(selectedTrip);
      
      // Cargar gastos
      loadTripExpenses(selectedTrip);
    } else {
      // Resetear datos si no hay viaje seleccionado
      setOperatorBudget(0);
      setExpenses([]);
    }
  }, [selectedTrip]);
  
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

  // Calcular número de pasajeros y ventas por viaje
  const getTripStats = (tripId: number) => {
    if (!reservations) return { passengers: 0, sales: 0 };
    
    const tripReservations = reservations.filter(r => r.tripId === tripId);
    const passengers = tripReservations.reduce((acc, res) => acc + (res.passengers?.length || 0), 0);
    const sales = tripReservations.reduce((acc, res) => acc + (res.totalAmount || 0), 0);
    
    return { passengers, sales };
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
      <div className="flex justify-between items-center mb-6">
        <Button 
          variant="outline" 
          onClick={goToPreviousDay}
          className="mr-2"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </Button>
        <div className="flex-1 text-center">
          <div className="relative w-full max-w-md mx-auto">
            <div className="flex flex-col items-center">
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CalendarIcon className="h-5 w-5 text-gray-400" />
                </div>
                <Input
                  type="date"
                  className="pl-10 pr-4 py-2 w-full"
                  value={formatDateForInput(currentDate)}
                  onChange={(e) => {
                    if (e.target.value) {
                      const [year, month, day] = e.target.value.split('-').map(Number);
                      const newDate = new Date(year, month - 1, day, 12, 0, 0);
                      setCurrentDate(newDate);
                      setSelectedTrip(null);
                    } else {
                      setCurrentDate(new Date());
                      setSelectedTrip(null);
                    }
                  }}
                />
              </div>
              <div className="text-sm font-medium text-gray-700 mt-2">
                {formatHeaderDate(currentDate)}
              </div>
            </div>
          </div>
        </div>
        <Button 
          variant="outline" 
          onClick={goToNextDay}
          className="ml-2"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </Button>
      </div>
      
      {isLoadingTrips || isLoadingReservations ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : trips && trips.length > 0 ? (
        <div className="space-y-6">
          {/* Tabla de viajes */}
          <Card>
            <CardHeader>
              <CardTitle>Viajes del día</CardTitle>
              <CardDescription>
                {filteredTrips.length > 0 
                  ? `${filteredTrips.length} ${filteredTrips.length === 1 ? 'viaje encontrado' : 'viajes encontrados'}`
                  : 'No hay viajes para esta fecha'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              {filteredTrips.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Fecha
                        </th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ruta
                        </th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Horario
                        </th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Unidad
                        </th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Operador
                        </th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Pasajeros
                        </th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Total Ventas
                        </th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Egresos
                        </th>
                        <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Ganancia
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {filteredTrips.map(trip => {
                        const { passengers, sales } = getTripStats(trip.id);
                        
                        return (
                          <tr 
                            key={trip.id}
                            className={`cursor-pointer hover:bg-gray-50 transition-colors ${selectedTrip === trip.id ? 'bg-blue-50' : ''}`}
                            onClick={() => {
                              setSelectedTrip(trip.id);
                              // Actualizar el ID del viaje en el formulario de gastos
                              setNewExpense(prev => ({...prev, tripId: trip.id}));
                            }}
                          >
                            <td className="py-3 px-4 text-sm text-gray-900">
                              {format(new Date(trip.departureDate), 'dd/MM/yyyy')}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-900 font-medium">
                              {trip.route.name}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-900">
                              {formatTripTime(trip.departureTime, true, 'pretty')} - {formatTripTime(trip.arrivalTime, true, 'pretty')}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-900">
                              {trip.assignedVehicle 
                                ? `${trip.assignedVehicle.brand} ${trip.assignedVehicle.model} - ${trip.assignedVehicle.plates}`
                                : 'Sin unidad asignada'}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-900">
                              {trip.assignedDriver 
                                ? `${trip.assignedDriver.firstName} ${trip.assignedDriver.lastName}`
                                : 'No asignado'}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-900 font-medium text-center">
                              {passengers}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-900 font-medium">
                              ${sales.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-900 font-medium">
                              ${expenses.filter(e => e.tripId === trip.id).reduce((sum, e) => sum + e.amount, 0).toFixed(2)}
                            </td>
                            <td className={`py-3 px-4 text-sm font-bold ${
                              (() => {
                                const tripExpenses = expenses.filter(e => e.tripId === trip.id).reduce((sum, e) => sum + e.amount, 0);
                                const profit = sales - tripExpenses;
                                if (profit > 0) return "bg-green-50 text-green-600";
                                if (profit < 0) return "bg-red-50 text-red-600";
                                return "text-gray-600";
                              })()
                            }`}>
                              ${(() => {
                                const tripExpenses = expenses.filter(e => e.tripId === trip.id).reduce((sum, e) => sum + e.amount, 0);
                                return (sales - tripExpenses).toFixed(2);
                              })()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No hay viajes programados para esta fecha
                </div>
              )}
            </CardContent>
          </Card>

          {/* Detalles del viaje seleccionado */}
          {selectedTrip && (
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
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Vehículo</h3>
                        <div className="font-medium">
                          {(() => {
                            const trip = trips.find(t => t.id === selectedTrip);
                            if (trip?.assignedVehicle) {
                              return `${trip.assignedVehicle.brand} ${trip.assignedVehicle.model} - ${trip.assignedVehicle.plates}`;
                            } else {
                              // Intentar obtener de vehículos pre-cargados
                              const vehicleInfo = trips.find(t => t.id === selectedTrip)?.vehicle;
                              if (vehicleInfo) {
                                return `${vehicleInfo.brand} ${vehicleInfo.model} - ${vehicleInfo.plates}`;
                              }
                              return 'Sin unidad asignada';
                            }
                          })()}
                        </div>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-4">Operador Asignado</h3>
                        <div className="font-medium">
                          {(() => {
                            const trip = trips.find(t => t.id === selectedTrip);
                            if (trip?.assignedDriver) {
                              return `${trip.assignedDriver.firstName} ${trip.assignedDriver.lastName}`;
                            } else {
                              // Intentar obtener de conductores pre-cargados
                              const driverInfo = trips.find(t => t.id === selectedTrip)?.driver;
                              if (driverInfo) {
                                return `${driverInfo.firstName} ${driverInfo.lastName}`;
                              }
                              return 'No asignado';
                            }
                          })()}
                        </div>
                      </div>
                    </div>

                    <Separator className="my-6" />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-blue-50 p-6 rounded-lg">
                        <div className="flex items-center mb-4">
                          <div className="rounded-full bg-blue-100 p-2 mr-3">
                            <UserIcon className="h-5 w-5 text-blue-600" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-800">Pasajeros</h3>
                        </div>
                        <div className="text-4xl font-bold text-blue-600 text-center">
                          {totalPassengers}
                        </div>
                      </div>
                      <div className="bg-green-50 p-6 rounded-lg">
                        <div className="flex items-center mb-4">
                          <div className="rounded-full bg-green-100 p-2 mr-3">
                            <DollarSignIcon className="h-5 w-5 text-green-600" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-800">Ventas</h3>
                        </div>
                        <div className="text-4xl font-bold text-green-600 text-center">
                          ${totalSales.toFixed(2)}
                        </div>
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Efectivo:</span>
                            <span className="font-medium">${totalCashSales.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Transferencia:</span>
                            <span className="font-medium">${totalTransferSales.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Nueva sección de presupuesto y gastos */}
                    <div className="mt-6">
                      <div className="bg-gray-50 rounded-lg p-6">
                        <div className="flex items-center mb-4">
                          <div className="rounded-full bg-purple-100 p-2 mr-3">
                            <CoinsIcon className="h-5 w-5 text-purple-600" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-800">Presupuesto y Gastos</h3>
                        </div>
                        
                        {/* Presupuesto para el operador */}
                        <div className="mb-6">
                          <Label className="text-gray-700 mb-2">Presupuesto para el operador</Label>
                          <div className="flex items-center">
                            <Input
                              type="number"
                              min="0"
                              placeholder="Monto en MXN"
                              value={operatorBudget || ''}
                              onChange={(e) => setOperatorBudget(parseFloat(e.target.value) || 0)}
                              className="flex-1"
                            />
                            <div className="ml-2">
                              <Label>MXN</Label>
                            </div>
                          </div>
                        </div>
                        
                        {/* Sección de gastos */}
                        <div>
                          <div className="flex items-center mb-4">
                            <h4 className="text-md font-semibold text-gray-700">Gastos</h4>
                            <div className="flex-1 mx-2 h-px bg-gray-200"></div>
                            <div className="text-sm text-gray-500">Total: ${totalExpenses.toFixed(2)}</div>
                          </div>
                          
                          {/* Lista de gastos actuales */}
                          {expenses.length > 0 ? (
                            <div className="space-y-2 mb-4">
                              {expenses.map(expense => (
                                <div key={expense.id} className="flex items-center justify-between bg-white p-3 rounded-md border border-gray-200">
                                  <div className="flex-1">
                                    <div className="font-medium">${expense.amount.toFixed(2)} ({expense.type})</div>
                                    {expense.description && (
                                      <div className="text-sm text-gray-500">{expense.description}</div>
                                    )}
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleRemoveExpense(expense.id)}
                                  >
                                    <MinusCircleIcon className="h-4 w-4 text-red-500" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-4 text-gray-500 mb-4">
                              No hay gastos registrados
                            </div>
                          )}
                          
                          {/* Formulario para agregar nuevo gasto */}
                          <div className="bg-white p-4 rounded-md border border-gray-200 mb-4">
                            <h5 className="text-sm font-medium mb-3 text-gray-700">Agregar nuevo gasto</h5>
                            <div className="grid grid-cols-12 gap-2 mb-2">
                              <div className="col-span-7">
                                <Input 
                                  placeholder="Tipo (ej. Gasolina, Casetas, Sueldo)" 
                                  value={newExpense.type}
                                  onChange={(e) => setNewExpense({...newExpense, type: e.target.value})}
                                />
                              </div>
                              <div className="col-span-5">
                                <div className="flex items-center">
                                  <Input 
                                    type="number" 
                                    min="0"
                                    placeholder="Monto" 
                                    value={newExpense.amount || ''}
                                    onChange={(e) => setNewExpense({...newExpense, amount: parseFloat(e.target.value) || 0})}
                                  />
                                  <span className="ml-2">MXN</span>
                                </div>
                              </div>
                            </div>
                            <div className="mb-3">
                              <Input 
                                placeholder="Descripción (opcional)" 
                                value={newExpense.description || ''}
                                onChange={(e) => setNewExpense({...newExpense, description: e.target.value})}
                              />
                            </div>
                            <Button 
                              onClick={handleAddExpense}
                              disabled={!newExpense.type || newExpense.amount <= 0 || !selectedTrip}
                              className="w-full"
                            >
                              <PlusCircleIcon className="h-4 w-4 mr-2" />
                              Agregar Gasto
                            </Button>
                          </div>
                          
                          {/* Resumen financiero */}
                          <div className="bg-gray-100 p-4 rounded-md">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-sm text-gray-600">Ventas Totales</div>
                                <div className="font-bold text-green-600">${totalSales.toFixed(2)}</div>
                              </div>
                              <div>
                                <div className="text-sm text-gray-600">Gastos Totales</div>
                                <div className="font-bold text-red-600">${totalExpenses.toFixed(2)}</div>
                              </div>
                            </div>
                            <Separator className="my-3" />
                            <div className="flex justify-between items-center">
                              <div className="font-medium">Ganancia del viaje</div>
                              <div className={`text-xl font-bold ${tripProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ${tripProfit.toFixed(2)}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Lista de Pasajeros */}
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
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                              {tripReservations.flatMap(reservation => 
                                (reservation.passengers || []).map((passenger, idx) => (
                                  <tr key={`${reservation.id}-${idx}`} className="hover:bg-gray-50">
                                    <td className="py-3 px-4 text-sm text-gray-900">
                                      {passenger.firstName} {passenger.lastName}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-900">
                                      {passenger.contactInfo || 'N/A'}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-900">
                                      {reservation.trip?.route?.name || 'N/A'}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-900">
                                      {reservation.isPaid ? (
                                        <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Pagado</Badge>
                                      ) : (
                                        <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Pendiente</Badge>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-900">
                                      ${reservation.totalAmount ? reservation.totalAmount.toFixed(2) : '0.00'}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          No hay pasajeros registrados para este viaje
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          No hay viajes disponibles en el sistema
        </div>
      )}
    </div>
  );
}