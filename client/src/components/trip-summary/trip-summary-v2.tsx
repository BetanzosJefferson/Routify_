import { useState, useEffect } from "react";
import { ClipboardListIcon, UserIcon, DollarSignIcon, PackageIcon, ChevronLeftIcon, ChevronRightIcon, CalendarIcon, PlusCircleIcon, MinusCircleIcon, CoinsIcon, PiggyBankIcon, Calculator, Loader2, EyeIcon, X } from "lucide-react";
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
import TripDetailModal from "./trip-detail-modal";

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

type ReservationWithDetails = Reservation & {
  passengers?: {
    id: number;
    firstName: string;
    lastName: string;
    reservationId: number;
  }[];
  trip?: Trip;
};

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
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedTrip, setSelectedTrip] = useState<number | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [operatorBudget, setOperatorBudget] = useState<number>(0);
  const [tripReservations, setTripReservations] = useState<ReservationWithPassengers[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [newExpense, setNewExpense] = useState<Omit<Expense, 'id' | 'tripId'>>({
    amount: 0,
    category: 'fuel',
    description: ''
  });
  const [isLoadingBudget, setIsLoadingBudget] = useState(false);
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [isRemovingExpense, setIsRemovingExpense] = useState(false);
  
  const { toast } = useToast();
  
  // Consultas y mutaciones
  const { trips = [], isLoading: isLoadingTrips } = useTrips({departureDate: format(currentDate, 'yyyy-MM-dd')});
  const { reservations, isLoading: isLoadingReservations } = useReservations();
  const { packages, isLoading: isLoadingPackages } = usePackages();
  
  // DEBUG: Monitorear los viajes que se reciben
  useEffect(() => {
    console.log(`[Bitácora] Se obtuvieron ${trips.length} viajes para la fecha: ${format(currentDate, 'yyyy-MM-dd')}`);
    if (trips.length > 0) {
      console.log('[Bitácora] Ejemplo del primer viaje:', JSON.stringify(trips[0], null, 2).substring(0, 200) + '...');
    }
  }, [trips, currentDate]);
  
  const formatHeaderDate = (date: Date) => {
    return format(date, "EEEE d 'de' MMMM, yyyy", { locale: es });
  };
  
  const formatDateForInput = (date: Date) => {
    return format(date, "yyyy-MM-dd");
  };
  
  const goToPreviousDay = () => {
    setCurrentDate(prevDate => subDays(prevDate, 1));
  };
  
  const goToNextDay = () => {
    setCurrentDate(prevDate => addDays(prevDate, 1));
  };
  
  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(event.target.value);
    setCurrentDate(newDate);
  };
  
  const openTripDetails = (tripId: number) => {
    setSelectedTrip(tripId);
    loadTripDetails(tripId);
    setIsDetailModalOpen(true);
  };
  
  const loadTripDetails = async (tripId: number) => {
    try {
      // Cargar reservaciones asociadas al viaje
      const reservationsResponse = await apiRequest<ReservationWithDetails[]>(`/api/trips/${tripId}/reservations`);
      if (reservationsResponse) {
        setTripReservations(reservationsResponse as unknown as ReservationWithPassengers[]);
      }
      
      // Cargar presupuesto del operador
      setIsLoadingBudget(true);
      const budgetResponse = await apiRequest<{ budget: number }>(`/api/trips/${tripId}/budget`);
      if (budgetResponse) {
        setOperatorBudget(budgetResponse.budget);
      }
      setIsLoadingBudget(false);
      
      // Cargar gastos del viaje
      setIsLoadingExpenses(true);
      const expensesResponse = await apiRequest<Expense[]>(`/api/trips/${tripId}/expenses`);
      if (expensesResponse) {
        setExpenses(expensesResponse);
      }
      setIsLoadingExpenses(false);
    } catch (error) {
      console.error("Error al cargar detalles del viaje", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar los detalles del viaje",
        variant: "destructive"
      });
    }
  };
  
  const saveTripBudget = async (tripId: number, budget: number) => {
    try {
      setIsSavingBudget(true);
      await apiRequest('/api/trips/budget', {
        method: 'POST',
        body: { tripId, budget }
      });
      
      toast({
        title: "Presupuesto guardado",
        description: "El presupuesto del operador ha sido actualizado",
      });
      setIsSavingBudget(false);
    } catch (error) {
      console.error("Error al guardar presupuesto", error);
      toast({
        title: "Error",
        description: "No se pudo guardar el presupuesto",
        variant: "destructive"
      });
      setIsSavingBudget(false);
    }
  };
  
  const handleAddExpense = async (expense: Omit<Expense, 'id' | 'tripId'>, tripId: number) => {
    try {
      setIsSavingExpense(true);
      const response = await apiRequest<Expense>('/api/trips/expenses', {
        method: 'POST',
        body: { ...expense, tripId }
      });
      
      if (response) {
        setExpenses(prev => [...prev, response]);
        setNewExpense({
          amount: 0,
          category: 'fuel',
          description: ''
        });
        
        toast({
          title: "Gasto agregado",
          description: "El gasto ha sido registrado correctamente",
        });
      }
      setIsSavingExpense(false);
    } catch (error) {
      console.error("Error al agregar gasto", error);
      toast({
        title: "Error",
        description: "No se pudo agregar el gasto",
        variant: "destructive"
      });
      setIsSavingExpense(false);
    }
  };
  
  const handleRemoveExpense = async (expenseId: number | string) => {
    try {
      setIsRemovingExpense(true);
      await apiRequest('/api/trips/expenses/remove', {
        method: 'POST',
        body: { expenseId }
      });
      
      setExpenses(prev => prev.filter(e => e.id !== expenseId));
      toast({
        title: "Gasto eliminado",
        description: "El gasto ha sido eliminado correctamente",
      });
      setIsRemovingExpense(false);
    } catch (error) {
      console.error("Error al eliminar gasto", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el gasto",
        variant: "destructive"
      });
      setIsRemovingExpense(false);
    }
  };
  
  // Cálculos financieros
  const totalPassengers = tripReservations.reduce((acc, res) => 
    acc + (res.passengers?.length || 0), 0);
  
  const totalCashSales = tripReservations
    .filter(res => res.paymentMethod === 'cash' && res.paymentStatus === 'paid')
    .reduce((acc, res) => acc + (res.amount || 0), 0);
  
  const totalTransferSales = tripReservations
    .filter(res => res.paymentMethod === 'transfer' && res.paymentStatus === 'paid')
    .reduce((acc, res) => acc + (res.amount || 0), 0);
  
  // Suma solo reservaciones con estatus 'paid'
  const totalSales = tripReservations
    .filter(res => res.paymentStatus === 'paid')
    .reduce((acc, res) => acc + (res.amount || 0), 0);
  
  const totalExpenses = expenses.reduce((acc, expense) => 
    acc + expense.amount, 0);
  
  const tripProfit = totalSales - totalExpenses;
  
  // Renderizado
  return (
    <div className={`space-y-6 ${className}`}>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Bitácora de Viajes</h1>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={goToPreviousDay}>
            <ChevronLeftIcon className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-gray-500" />
            <input
              type="date"
              value={formatDateForInput(currentDate)}
              onChange={handleDateChange}
              className="px-2 py-1 border rounded"
            />
          </div>
          <Button size="icon" variant="outline" onClick={goToNextDay}>
            <ChevronRightIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {isLoadingTrips ? (
        <div className="flex justify-center items-center p-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Cargando viajes...</span>
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle>Viajes programados - {formatHeaderDate(currentDate)}</CardTitle>
              <CardDescription>
                Información detallada de los viajes y sus indicadores
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trips && trips.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2">ID</th>
                        <th className="text-left py-3 px-2">Ruta</th>
                        <th className="text-left py-3 px-2">Salida</th>
                        <th className="text-left py-3 px-2">Llegada</th>
                        <th className="text-left py-3 px-2">Unidad</th>
                        <th className="text-left py-3 px-2">Operador</th>
                        <th className="text-left py-3 px-2">Ocupación</th>
                        <th className="text-left py-3 px-2">Estado</th>
                        <th className="text-center py-3 px-2">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trips.map((trip) => {
                        // Calcular ocupación del viaje
                        const occupancyPercentage = trip.availableSeats && trip.capacity 
                          ? Math.round(((trip.capacity - trip.availableSeats) / trip.capacity) * 100)
                          : 0;
                          
                        return (
                          <tr key={trip.id} className="border-b hover:bg-gray-50">
                            <td className="py-3 px-2">{trip.id}</td>
                            <td className="py-3 px-2">
                              {trip.route?.origin} - {trip.route?.destination}
                            </td>
                            <td className="py-3 px-2">
                              {formatTripTime(trip.departureTime)}
                            </td>
                            <td className="py-3 px-2">
                              {formatTripTime(trip.arrivalTime)}
                            </td>
                            <td className="py-3 px-2">
                              {trip.vehicle?.licensePlate || 'No asignada'}
                            </td>
                            <td className="py-3 px-2">
                              {trip.driver?.firstName 
                                ? `${trip.driver?.firstName} ${trip.driver?.lastName}`
                                : 'No asignado'}
                            </td>
                            <td className="py-3 px-2">
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full ${
                                      occupancyPercentage > 80 
                                        ? 'bg-red-500' 
                                        : occupancyPercentage > 50 
                                          ? 'bg-yellow-500' 
                                          : 'bg-green-500'
                                    }`}
                                    style={{ width: `${occupancyPercentage}%` }}
                                  />
                                </div>
                                <span>{occupancyPercentage}%</span>
                              </div>
                            </td>
                            <td className="py-3 px-2">
                              <Badge variant={
                                trip.tripStatus === 'finalizado' 
                                  ? 'outline' 
                                  : trip.tripStatus === 'en_progreso' 
                                    ? 'default' 
                                    : 'secondary'
                              }>
                                {trip.tripStatus === 'finalizado' 
                                  ? 'Completado' 
                                  : trip.tripStatus === 'en_progreso' 
                                    ? 'En Progreso' 
                                    : 'No Iniciado'}
                              </Badge>
                            </td>
                            <td className="py-3 px-2 text-center">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => openTripDetails(trip.id)}
                                className="flex items-center"
                              >
                                <EyeIcon className="h-4 w-4 mr-1" />
                                Ver Detalles
                              </Button>
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
          
          {/* Modal de detalles del viaje */}
          {selectedTrip && (
            <TripDetailModal
              isOpen={isDetailModalOpen}
              onClose={() => setIsDetailModalOpen(false)}
              trip={trips?.find(t => t.id === selectedTrip)}
              expenses={expenses.filter(e => e.tripId === selectedTrip)}
              reservations={tripReservations}
              budget={operatorBudget}
              totalSales={totalSales}
            />
          )}
        </div>
      )}
    </div>
  );
}