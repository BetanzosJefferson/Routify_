import { useState, useEffect } from "react";
import { ClipboardListIcon, UserIcon, DollarSignIcon, PackageIcon, ChevronLeftIcon, ChevronRightIcon, CalendarIcon, PlusCircleIcon, MinusCircleIcon, CoinsIcon, PiggyBankIcon, Calculator, Loader2, EyeIcon } from "lucide-react";
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
  userId?: number | null;    // ID del usuario que registró el gasto
  createdBy?: string | null; // Nombre del usuario que registró el gasto
};

export default function TripSummary({ className }: TripSummaryProps) {
  const [selectedTrip, setSelectedTrip] = useState<number | null>(null);
  const [tripReservations, setTripReservations] = useState<ReservationWithPassengers[]>([]);
  const [totalPassengers, setTotalPassengers] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [totalCashSales, setTotalCashSales] = useState(0);
  const [totalTransferSales, setTotalTransferSales] = useState(0);
  // Inicializar con la fecha actual del sistema
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    // Obtener la fecha actual
    const today = new Date();
    // Usar la misma "fecha base" para demo si estamos en un entorno anterior a 2025
    if (today.getFullYear() < 2025) {
      return new Date(2025, 4, today.getDate());
    }
    return today;
  });

  // Estado de carga para los datos financieros - desactivado para evitar problemas de carga infinita
  const [isLoadingFinancialData, setIsLoadingFinancialData] = useState(false);

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
      const url = `/api/trips/${tripId}/budget`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data && typeof data.amount === 'number') {
        setOperatorBudget(data.amount);
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
      const url = `/api/trips/${tripId}/budget`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ amount }),
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      setOperatorBudget(amount);
      toast({
        title: "Presupuesto guardado",
        description: "El presupuesto del operador ha sido actualizado.",
        variant: "default"
      });
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
      const url = `/api/trips/${tripId}/expenses`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (Array.isArray(data)) {
        // Adaptar datos del backend (con 'type') al formato del frontend (con 'category')
        const adaptedExpenses = data.map(expense => ({
          ...expense,
          // Añadir category como alias de type para mantener compatible el componente
          category: expense.type,
          // Asegurarnos de que los campos de usuario se preservan
          userId: expense.userId || null,
          createdBy: expense.createdBy || null
        }));
        console.log("Gastos cargados con información de usuario:", adaptedExpenses);
        setExpenses(adaptedExpenses);
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
      // Mapear 'category' del frontend a 'type' del backend
      const expenseData = {
        type: newExpense.category, // Importante: El backend espera 'type', no 'category'
        description: newExpense.description || '',
        amount: newExpense.amount,
        tripId: selectedTrip
      };

      // Enviar a la API
      const url = `/api/trips/${selectedTrip}/expenses`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(expenseData),
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data && data.id) {
        // Añadir el nuevo gasto a la lista local, adaptando type a category
        const adaptedExpense = {
          ...data,
          category: data.type // Añadir category como alias de type
        };
        setExpenses(prevExpenses => [...prevExpenses, adaptedExpense]);

        // Actualizar también tripsFinancialData para mantener datos en sincronía
        setTripsFinancialData(prev => {
          const tripData = prev[selectedTrip] || { budget: 0, expenses: [] };
          return {
            ...prev,
            [selectedTrip]: {
              ...tripData,
              expenses: [...tripData.expenses, adaptedExpense]
            }
          };
        });

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
      // Usar la nueva ruta simplificada para eliminar gastos
      const url = `/api/trips/expenses/remove`;

      // Datos básicos para la solicitud (solo necesitamos el ID)
      const expenseData = { 
        expenseId: Number(id)
      };

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(expenseData),
        credentials: "include"
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      // Actualizar lista local
      setExpenses(prevExpenses => prevExpenses.filter(expense => expense.id !== id));

      // Actualizar también tripsFinancialData
      setTripsFinancialData(prev => {
        // Buscar a qué viaje pertenece este gasto
        const expense = expenses.find(e => e.id === id);
        if (!expense) return prev;

        const tripId = expense.tripId;
        const tripData = prev[tripId];

        // Si no hay datos para este viaje, no hay nada que actualizar
        if (!tripData) return prev;

        return {
          ...prev,
          [tripId]: {
            ...tripData,
            expenses: tripData.expenses.filter(e => e.id !== id)
          }
        };
      });

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

  // Estado para almacenar datos financieros de todos los viajes
  const [tripsFinancialData, setTripsFinancialData] = useState<{[tripId: number]: {
    budget: number,
    expenses: Expense[]
  }}>({});

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

  // Definición de estilos para el indicador de carga
  const loadingStyles = `
    .financial-loader {
      width: 120px;
      height: 20px;
      background: 
        linear-gradient(90deg, rgba(0,0,0,0.06) 33%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.06) 66%)
        #f2f2f2;
      background-size: 300% 100%;
      animation: loadingAnimation 1s infinite linear;
      border-radius: 4px;
    }

    .profit-loader {
      display: inline-block;
      width: 100%;
      height: 20px;
      background: 
        linear-gradient(90deg, rgba(0,0,0,0.06) 33%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.06) 66%)
        #f2f2f2;
      background-size: 300% 100%;
      animation: loadingAnimation 1s infinite linear;
      border-radius: 4px;
    }

    @keyframes loadingAnimation {
      0% { background-position: right }
    }
  `;

  // Insertar los estilos en el DOM
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = loadingStyles;
    document.head.appendChild(styleElement);

    // Limpieza al desmontar
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  // Cargar datos financieros para todos los viajes mostrados en la tabla
  useEffect(() => {
    // Solo ejecutar si hay viajes filtrados
    if (filteredTrips.length === 0) return;

    // Activar indicador de carga
    setIsLoadingFinancialData(true);

    // Para cada viaje, cargar sus datos financieros en paralelo
    const loadAllTripsFinancialData = async () => {
      // Crear un objeto para almacenar los datos financieros
      const financialData: {[tripId: number]: {budget: number, expenses: Expense[]}} = {};

      // Inicializar el objeto con valores por defecto para todos los viajes
      filteredTrips.forEach(trip => {
        financialData[trip.id] = { budget: 0, expenses: [] };
      });

      // Crear un array para almacenar todas las promesas
      const promises: Promise<{tripId: number, type: string, data: any}>[] = [];

      // Preparar todas las promesas para presupuestos y gastos de todos los viajes
      filteredTrips.forEach(trip => {
        const tripId = trip.id;

        // Promesa para cargar presupuesto
        const budgetPromise = fetch(`/api/trips/${tripId}/budget`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include"
        })
        .then(response => response.ok ? response.json() : { amount: 0 })
        .then(data => ({
          tripId,
          type: 'budget',
          data: data && typeof data.amount === 'number' ? data.amount : 0
        }))
        .catch(error => {
          console.error(`Error al cargar presupuesto para viaje ${tripId}:`, error);
          return { tripId, type: 'budget', data: 0 };
        });

        // Promesa para cargar gastos
        const expensesPromise = fetch(`/api/trips/${tripId}/expenses`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
          credentials: "include"
        })
        .then(response => response.ok ? response.json() : [])
        .then(data => {
          // Adaptar datos del backend (con 'type') al formato del frontend (con 'category')
          const expenses = Array.isArray(data) ? data.map(expense => ({
            ...expense,
            category: expense.type // Añadir category como alias de type
          })) : [];

          return { tripId, type: 'expenses', data: expenses };
        })
        .catch(error => {
          console.error(`Error al cargar gastos para viaje ${tripId}:`, error);
          return { tripId, type: 'expenses', data: [] };
        });

        // Agregar ambas promesas al array
        promises.push(budgetPromise);
        promises.push(expensesPromise);
      });

      try {
        // Esperar a que todas las promesas se resuelvan en paralelo
        const results = await Promise.all(promises);

        // Procesar resultados y actualizar el objeto financialData
        results.forEach(result => {
          const { tripId, type, data } = result;

          if (type === 'budget') {
            financialData[tripId].budget = data;
          } else if (type === 'expenses') {
            financialData[tripId].expenses = data;
          }
        });
      } catch (error) {
        console.error("Error al cargar datos financieros:", error);
      }

      // Actualizar el estado con todos los datos financieros
      setTripsFinancialData(financialData);

      // Desactivar indicador de carga después de completar la carga
      setIsLoadingFinancialData(false);
    };

    loadAllTripsFinancialData();

    // Usar ids como dependencia en lugar de todo el array de objetos
    // Esto evita recargos infinitos cuando cambian propiedades internas
  }, [JSON.stringify(filteredTrips.map(trip => trip.id))]);

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

      // Calcular total de pasajeros
      const passengers = allReservations.reduce((acc, res) => acc + (res.passengers?.length || 0), 0);

      // Variables para el cálculo de ventas según nuevos criterios
      let totalSalesAmount = 0;
      let cashSales = 0;
      let transferSales = 0;

      // Recorrer cada reserva para calcular correctamente las ventas
      allReservations.forEach(res => {
        const isPaid = res.paymentStatus === 'pagado' || res.paymentStatus === 'paid';
        const hasPendingStatus = res.paymentStatus === 'pendiente' || res.paymentStatus === 'pending';
        const hasAdvance = res.advanceAmount && res.advanceAmount > 0;

        if (isPaid) {
          // Si está pagado, sumar el monto total
          totalSalesAmount += res.totalAmount || 0;

          // Si la reservación incluye anticipo, usamos el método de pago del anticipo
          // ya que esto refleja cómo se pagó realmente (especialmente para reservaciones pagadas)
          if (hasAdvance) {
            if (res.advancePaymentMethod === 'efectivo') {
              cashSales += res.totalAmount || 0;
            } else if (res.advancePaymentMethod === 'transferencia') {
              transferSales += res.totalAmount || 0;
            }
          } else {
            // Sin anticipo, usamos el método principal
            if (res.paymentMethod === 'efectivo') {
              cashSales += res.totalAmount || 0;
            } else if (res.paymentMethod === 'transferencia') {
              transferSales += res.totalAmount || 0;
            }
          }
        } 
        else if (hasAdvance && !hasPendingStatus) {
          // Si tiene anticipo y no está pendiente, sumar solo el anticipo
          totalSalesAmount += res.advanceAmount || 0;

          // Distribuir en métodos de pago según método del anticipo
          if (res.advancePaymentMethod === 'efectivo') {
            cashSales += res.advanceAmount || 0;
          } else if (res.advancePaymentMethod === 'transferencia') {
            transferSales += res.advanceAmount || 0;
          }
        }
        // Si no está pagado, no tiene anticipo o está pendiente, no se suma nada
      });

      setTripReservations(allReservations);
      setTotalPassengers(passengers);
      setTotalSales(totalSalesAmount);
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

    // Calcular ventas aplicando los mismos criterios de cálculo
    let totalSales = 0;
    tripReservations.forEach(res => {
      const isPaid = res.paymentStatus === 'pagado' || res.paymentStatus === 'paid';
      const hasPendingStatus = res.paymentStatus === 'pendiente' || res.paymentStatus === 'pending';
      const hasAdvance = res.advanceAmount && res.advanceAmount > 0;

      if (isPaid) {
        // Si está pagado, sumar el monto total
        totalSales += res.totalAmount || 0;
      } else if (hasAdvance && !hasPendingStatus) {
        // Si tiene anticipo y no está pendiente, sumar solo el anticipo
        totalSales += res.advanceAmount || 0;
      }
      // Si no está pagado, no tiene anticipo o está pendiente, no se suma nada
    });

    return { passengers, sales: totalSales };
  };

  return (
    <div className={`py-6 ${className}`}>

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
                <>
                  {/* Desktop Table */}
                  <div className="hidden lg:block overflow-x-auto">
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
                              {(() => {
                                // Crear la fecha con ajuste para evitar problemas de zona horaria
                                let dateStr = trip.departureDate;
                                let date;

                                if (typeof dateStr === 'string' && dateStr.includes('T')) {
                                  const datePart = dateStr.split('T')[0];
                                  const [year, month, day] = datePart.split('-').map(Number);
                                  date = new Date(year, month - 1, day, 12, 0, 0);
                                } else {
                                  date = new Date(dateStr);
                                }

                                return format(date, 'dd/MM/yyyy');
                              })()}
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
                              ${(() => {
                                // Usar datos precargados si existen, o usar el estado local como respaldo
                                const tripFinancialData = tripsFinancialData[trip.id];
                                if (tripFinancialData) {
                                  return tripFinancialData.expenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2);
                                } else {
                                  // Usar datos del estado solo cuando se ha seleccionado el viaje
                                  return expenses.filter(e => e.tripId === trip.id).reduce((sum, e) => sum + e.amount, 0).toFixed(2);
                                }
                              })()}
                            </td>
                            <td className={`py-3 px-4 text-sm font-bold ${
                              (() => {
                                // Usar datos precargados si existen, o usar el estado local como respaldo
                                const tripFinancialData = tripsFinancialData[trip.id];
                                let tripExpenses = 0;

                                if (tripFinancialData) {
                                  tripExpenses = tripFinancialData.expenses.reduce((sum, e) => sum + e.amount, 0);
                                } else {
                                  // Usar datos del estado solo cuando se ha seleccionado el viaje
                                  tripExpenses = expenses.filter(e => e.tripId === trip.id).reduce((sum, e) => sum + e.amount, 0);
                                }

                                const profit = sales - tripExpenses;
                                if (profit > 0) return "bg-green-50 text-green-600";
                                if (profit < 0) return "bg-red-50 text-red-600";
                                return "text-gray-600";
                              })()
                            }`}>
                              ${(() => {
                                // Usar datos precargados si existen, o usar el estado local como respaldo
                                const tripFinancialData = tripsFinancialData[trip.id];
                                let tripExpenses = 0;

                                if (tripFinancialData) {
                                  tripExpenses = tripFinancialData.expenses.reduce((sum, e) => sum + e.amount, 0);
                                } else {
                                  // Usar datos del estado solo cuando se ha seleccionado el viaje
                                  tripExpenses = expenses.filter(e => e.tripId === trip.id).reduce((sum, e) => sum + e.amount, 0);
                                }

                                return (sales - tripExpenses).toFixed(2);
                              })()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>

                  {/* Mobile Cards */}
                  <div className="lg:hidden space-y-3">
                    {filteredTrips.map(trip => {
                      const { passengers, sales } = getTripStats(trip.id);

                      // Calcular gastos del viaje
                      const tripFinancialData = tripsFinancialData[trip.id];
                      let tripExpenses = 0;

                      if (tripFinancialData) {
                        tripExpenses = tripFinancialData.expenses.reduce((sum, e) => sum + e.amount, 0);
                      } else {
                        tripExpenses = expenses.filter(e => e.tripId === trip.id).reduce((sum, e) => sum + e.amount, 0);
                      }

                      const profit = sales - tripExpenses;

                      return (
                        <div
                          key={trip.id}
                          className={`border rounded-xl p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                            selectedTrip === trip.id 
                              ? 'border-blue-500 bg-blue-50 shadow-md' 
                              : 'border-gray-200 bg-white hover:border-gray-300'
                          }`}
                          onClick={() => {
                            setSelectedTrip(trip.id);
                            setNewExpense(prev => ({...prev, tripId: trip.id}));
                          }}
                        >
                          {/* Header con ruta y fecha */}
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 truncate text-sm">
                                {trip.route.name}
                              </h3>
                              <p className="text-xs text-gray-500 mt-1">
                                {(() => {
                                  let dateStr = trip.departureDate;
                                  let date;

                                  if (typeof dateStr === 'string' && dateStr.includes('T')) {
                                    const datePart = dateStr.split('T')[0];
                                    const [year, month, day] = datePart.split('-').map(Number);
                                    date = new Date(year, month - 1, day, 12, 0, 0);
                                  } else {
                                    date = new Date(dateStr);
                                  }

                                  return format(date, 'dd/MM/yyyy');
                                })()}
                              </p>
                            </div>
                            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                              profit > 0 ? 'bg-green-100 text-green-800' :
                              profit < 0 ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              ${profit.toFixed(0)}
                            </div>
                          </div>

                          {/* Información principal */}
                          <div className="grid grid-cols-2 gap-3 mb-3">
                            <div>
                              <p className="text-xs text-gray-500">Horario</p>
                              <p className="text-sm font-medium text-gray-900">
                                {formatTripTime(trip.departureTime, true, 'pretty')} - {formatTripTime(trip.arrivalTime, true, 'pretty')}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500">Operador</p>
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {trip.assignedDriver 
                                  ? `${trip.assignedDriver.firstName} ${trip.assignedDriver.lastName}`
                                  : 'No asignado'}
                              </p>
                            </div>
                          </div>

                          {/* Métricas financieras */}
                          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-gray-100">
                            <div className="text-center">
                              <p className="text-xs text-gray-500">Pasajeros</p>
                              <p className="text-sm font-semibold text-gray-900">{passengers}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-500">Ventas</p>
                              <p className="text-sm font-semibold text-green-600">${sales.toFixed(0)}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-xs text-gray-500">Gastos</p>
                              <p className="text-sm font-semibold text-red-600">${tripExpenses.toFixed(0)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
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
                              // Obtener vehículo a partir del vehicleId
                              const selectedTripData = trips.find(t => t.id === selectedTrip);
                              if (selectedTripData?.vehicleId) {
                                // Buscar vehículo - si no lo encontramos, mostramos el ID como referencia
                                const vehicles = trips
                                  .map(t => t.assignedVehicle)
                                  .filter(Boolean);

                                const vehicle = vehicles.find(v => v && v.id === selectedTripData.vehicleId);
                                if (vehicle) {
                                  return `${vehicle.brand} ${vehicle.model} - ${vehicle.plates}`;
                                }
                                return `Vehículo ID: ${selectedTripData.vehicleId}`;
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
                              // Obtener conductor a partir del driverId
                              const selectedTripData = trips.find(t => t.id === selectedTrip);
                              if (selectedTripData?.driverId) {
                                // Buscar conductor - si no lo encontramos, mostramos el ID como referencia
                                const drivers = trips
                                  .map(t => t.assignedDriver)
                                  .filter(Boolean);

                                const driver = drivers.find(d => d && d.id === selectedTripData.driverId);
                                if (driver) {
                                  return `${driver.firstName} ${driver.lastName}`;
                                }
                                return `Conductor ID: ${selectedTripData.driverId}`;
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
                        <div className="mt-2 space-y-2">
                          <div className="flex justify-between text-sm text-green-700">
                            <span>Total ventas Efectivo:</span>
                            <span className="font-medium">${totalCashSales.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm text-green-700">
                            <span>Total ventas Transferencia:</span>
                            <span className="font-medium">${totalTransferSales.toFixed(2)}</span>
                          </div>
                          <div className="pt-2 mt-2 border-t border-green-200 flex justify-between items-center">
                            <span className="text-sm font-medium text-green-700">Total de ventas:</span>
                            <span className="text-xl font-bold text-green-700">${totalSales.toFixed(2)}</span>
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
                          {/* MODIFICACIÓN 1: Ajuste de layout para presupuesto */}
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center">
                            <div className="flex-1 flex items-center mb-2 sm:mb-0">
                              <Input
                                type="number"
                                min="0"
                                placeholder="Monto en MXN"
                                value={operatorBudget || ''}
                                onChange={(e) => setOperatorBudget(parseFloat(e.target.value) || 0)}
                                className="flex-1"
                                disabled={isLoadingBudget || isSavingBudget}
                              />
                              <span className="ml-2 text-sm text-gray-600">MXN</span> {/* Más compacto */}
                            </div>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => selectedTrip && saveTripBudget(selectedTrip, operatorBudget)}
                              disabled={isLoadingBudget || isSavingBudget || !selectedTrip}
                              className="w-full sm:w-auto sm:ml-2"
                            >
                              {isSavingBudget ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <PiggyBankIcon className="h-4 w-4" />
                              )}
                              <span className="ml-2">{isSavingBudget ? "Guardando..." : "Guardar"}</span>
                            </Button>
                          </div>
                          {isLoadingBudget && (
                            <div className="text-sm text-gray-500 mt-1 flex items-center">
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              Cargando presupuesto...
                            </div>
                          )}
                        </div>

                        {/* Sección de gastos */}
                        <div>
                          <div className="flex items-center mb-4">
                            <h4 className="text-md font-semibold text-gray-700">Gastos</h4>
                            <div className="flex-1 mx-2 h-px bg-gray-200"></div>
                            <div className="text-sm text-gray-500">Total: ${totalExpenses.toFixed(2)}</div>
                          </div>

                          {/* Lista de gastos actuales */}
                          {isLoadingExpenses ? (
                            <div className="py-4 flex justify-center items-center space-x-2">
                              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                              <span className="text-gray-600">Cargando gastos...</span>
                            </div>
                          ) : expenses.length > 0 ? (
                            <div className="space-y-2 mb-4">
                              {expenses.map(expense => (
                                <div key={expense.id} className="flex items-start justify-between bg-white p-3 rounded-md border border-gray-200"> {/* Use items-start for better alignment with wrapped text */}
                                  <div className="flex-1 pr-2"> {/* Added pr-2 for spacing from button */}
                                    {/* MODIFICACIÓN 2: Mejorar legibilidad de item de gasto */}
                                    <div className="font-medium text-gray-900 text-base">
                                      ${expense.amount.toFixed(2)} <span className="font-normal text-gray-700 text-sm">({expense.category})</span>
                                    </div>
                                    {expense.description && (
                                      <div className="text-sm text-gray-600 mt-1">{expense.description}</div>
                                    )}
                                    {/* Mostrar información de quién registró el gasto */}
                                    {expense.createdBy && (
                                      <div className="text-xs text-blue-600 mt-2 flex items-center">
                                        <UserIcon className="h-3 w-3 mr-1" />
                                        Registrado por: {expense.createdBy}
                                      </div>
                                    )}
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => handleRemoveExpense(expense.id)}
                                    disabled={isRemovingExpense === expense.id}
                                    className="flex-shrink-0" /* Prevent button from shrinking */
                                  >
                                    {isRemovingExpense === expense.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin text-red-500" />
                                    ) : (
                                      <MinusCircleIcon className="h-4 w-4 text-red-500" />
                                    )}
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
                            {/* MODIFICACIÓN 3: Apilar inputs de categoría y monto en mobile */}
                            <div className="flex flex-col sm:flex-row sm:space-x-2 space-y-2 sm:space-y-0 mb-2">
                              <div className="flex-1">
                                <Select
                                  value={newExpense.category}
                                  onValueChange={(value) => setNewExpense({...newExpense, category: value})}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Seleccionar categoría" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="combustible">Combustible</SelectItem>
                                    <SelectItem value="casetas">Casetas</SelectItem>
                                    <SelectItem value="sueldo">Sueldo del operador</SelectItem>
                                    <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                                    <SelectItem value="comida">Comida</SelectItem>
                                    <SelectItem value="otro">Otro gasto</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="flex items-center sm:w-1/2"> {/* Adjusted width for better fit */}
                                <Input 
                                  type="number" 
                                  min="0"
                                  placeholder="Monto" 
                                  value={newExpense.amount || ''}
                                  onChange={(e) => setNewExpense({...newExpense, amount: parseFloat(e.target.value) || 0})}
                                />
                                <span className="ml-2 text-sm text-gray-600">MXN</span>
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
                              disabled={!newExpense.category || newExpense.amount <= 0 || !selectedTrip || isSavingExpense}
                              className="w-full"
                            >
                              {isSavingExpense ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Guardando...
                                </>
                              ) : (
                                <>
                                  <PlusCircleIcon className="h-4 w-4 mr-2" />
                                  Agregar Gasto
                                </>
                              )}
                            </Button>
                          </div>

                          {/* Resumen financiero */}
                          <div className="bg-gray-100 p-4 rounded-md">
                            {/* MODIFICACIÓN 4: Apilar elementos en mobile, enfatizar ganancia */}
                            <div className="flex flex-col space-y-3">
                              <div>
                                <div className="text-sm text-gray-600">Ventas Totales</div>
                                {isLoadingFinancialData ? (
                                  <div className="profit-loader mt-1"></div>
                                ) : (
                                  <div className="font-bold text-green-600 text-lg">${totalSales.toFixed(2)}</div>
                                )}
                              </div>
                              <div>
                                <div className="text-sm text-gray-600">Gastos Totales</div>
                                {isLoadingFinancialData || isLoadingExpenses ? (
                                  <div className="profit-loader mt-1"></div>
                                ) : (
                                  <div className="font-bold text-red-600 text-lg">${totalExpenses.toFixed(2)}</div>
                                )}
                              </div>
                            </div>
                            <Separator className="my-3" />
                            <div className="flex justify-between items-center mt-3">
                              <div className="font-medium text-lg">Ganancia del viaje</div>
                              {isLoadingExpenses || isLoadingFinancialData ? (
                                <div className="profit-loader" style={{width: '120px', height: '30px'}}></div>
                              ) : (
                                <div className={`text-2xl font-bold ${tripProfit >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                  ${tripProfit.toFixed(2)}
                                </div>
                              )}
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
                                  Pasajero
                                </th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Ruta
                                </th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Fecha
                                </th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Asientos
                                </th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Pago
                                </th>
                                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                  Contacto
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                              {tripReservations.map((reservation, idx) => {
                                // Determinar si está completamente pagado o pendiente
                                const isPaid = reservation.paymentStatus === 'pagado' || reservation.paymentStatus === 'paid';
                                const hasAdvance = reservation.advanceAmount && reservation.advanceAmount > 0;
                                const remainingAmount = (reservation.totalAmount || 0) - (reservation.advanceAmount || 0);

                                // Formatear pasajeros (nombre del primer pasajero y número total)
                                const mainPassenger = reservation.passengers?.[0];
                                const passengerCount = reservation.passengers?.length || 0;

                                // Determinar la información detallada de la ruta
                                const routeName = reservation.trip?.route?.name || 'N/A';
                                const routeDetails = reservation.trip?.route ? 
                                  `${reservation.trip.route.origin} → ${reservation.trip.route.destination}` : '';

                                // Formatear fecha y hora
                                const tripDate = reservation.trip?.departureDate ? 
                                  format(new Date(reservation.trip.departureDate), 'dd/MM/yyyy') : 'N/A';
                                const tripTime = reservation.trip?.departureTime || 'N/A';

                                return (
                                  <tr key={`reservation-${reservation.id}`} className="hover:bg-gray-50">
                                    <td className="py-3 px-4 text-sm">
                                      <div className="font-medium text-gray-900">
                                        {mainPassenger ? `${mainPassenger.firstName} ${mainPassenger.lastName}` : 'N/A'}
                                      </div>
                                    </td>
                                    <td className="py-3 px-4 text-sm">
                                      <div className="font-medium text-gray-900">{routeName}</div>
                                      <div className="text-gray-500 text-xs mt-1">{routeDetails}</div>
                                    </td>
                                    <td className="py-3 px-4 text-sm">
                                      <div className="font-medium text-gray-900">{tripDate}</div>
                                      <div className="text-gray-500 text-xs mt-1">{tripTime}</div>
                                    </td>
                                    <td className="py-3 px-4 text-sm text-center text-gray-900">
                                      {passengerCount}
                                    </td>
                                    <td className="py-3 px-4 text-sm">
                                      <div className="font-medium text-gray-900">
                                        ${reservation.totalAmount?.toFixed(2) || '0.00'}
                                      </div>

                                      <div className="mt-1">
                                        {isPaid ? (
                                          <div className="inline-block px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-800">
                                            PAGADO
                                          </div>
                                        ) : (
                                          <div className="inline-block px-2 py-1 text-xs font-medium rounded-md bg-yellow-100 text-yellow-800">
                                            PENDIENTE
                                          </div>
                                        )}
                                      </div>

                                      {/* Información de anticipo y resto */}
                                      {hasAdvance && (
                                        <div className="text-xs mt-1">
                                          <div>
                                            Anticipo: ${reservation.advanceAmount?.toFixed(2)} ({reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})
                                          </div>

                                          {/* Solo mostrar "Resta" si está pendiente de pago */}
                                          {!isPaid && remainingAmount > 0 && (
                                            <div>
                                              Resta: ${remainingAmount.toFixed(2)} {reservation.paymentMethod ? `(${reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})` : ''}
                                            </div>
                                          )}

                                          {/* Si ya está pagado pero tiene advanceAmount diferente del total, mostrar "Pagó" en lugar de "Resta" */}
                                          {isPaid && reservation.advanceAmount < reservation.totalAmount && (
                                            <div>
                                              Pagó: ${remainingAmount.toFixed(2)} ({reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </td>
                                    <td className="py-3 px-4 text-sm text-gray-900">
                                      <div className="font-medium text-gray-900">
                                        {reservation.phone || 'Sin teléfono'}
                                      </div>
                                      <div className="text-gray-500 text-xs mt-1">
                                        {reservation.email || 'Sin correo'}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
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