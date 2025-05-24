import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatDate, formatPrice } from "@/lib/utils";
import { ReservationWithDetails } from "@shared/schema";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { PackageList } from "./package-list";
import { 
  DollarSign, 
  Search, 
  Calendar, 
  Loader2,
  UserCheck,
  Clock,
  User,
  ArrowDownUp,
  FilterIcon,
  Printer,
  XCircle,
  Users,
  Package,
  TicketIcon
} from "lucide-react";

// Interfaz para las reservaciones con información de compañía
interface ReservationWithCompany extends ReservationWithDetails {
  companyInfo?: {
    id: string;
    name: string;
  },
  paymentNote?: string;      // Indica si es anticipo o restante
  paymentDate?: string;      // Fecha específica del pago
  cashItemId?: string;       // ID único para el ítem de caja
  originalReservationId?: number; // ID de la reservación original
}
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export function CashRegisterPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("todos"); // Valor por defecto
  const [companyFilter, setCompanyFilter] = useState("todas"); // Filtro por empresa para taquilleros
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  
  // Variable para almacenar información completa de rutas
  const [completeRoutes, setCompleteRoutes] = useState<{[key: string]: string}>({});
  
  // Estados adicionales para mejorar la UX
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showLoadingDelay, setShowLoadingDelay] = useState(false);
  const [isLoadingCutoff, setIsLoadingCutoff] = useState(false);
  const [showCutoffModal, setShowCutoffModal] = useState(false);
  const [cutoffData, setCutoffData] = useState<any>(null);
  
  // Tipo para los elementos del historial de cortes
  interface CutoffHistoryItem {
    id: number;
    date: string;
    user: string;
    totalAmount: number;
    totalCash: number;
    totalTransfer: number;
    transactionCount: number;
    notes?: string;
    items?: any[];
  }
  
  // Estados para el historial de cortes
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [cutoffHistory, setCutoffHistory] = useState<CutoffHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  

  
  // Consulta para obtener el historial de cortes
  const { data: cutoffsData, isLoading: isLoadingCutoffs } = useQuery({
    queryKey: ['/api/cutoffs'],
    queryFn: async () => {
      const response = await fetch('/api/cutoffs');
      if (!response.ok) {
        throw new Error('Error al cargar el historial de cortes');
      }
      return response.json();
    },
    enabled: !!user // Solo ejecutar la consulta si el usuario está autenticado
  });
  
  // Estado para saber si estamos en modo administrador o taquillero
  const isAdminView = user?.role === 'dueño' || user?.role === 'administrador' || user?.role === 'admin';
  const isTicketOfficeView = user?.role === 'taquilla';
  const isOwnerOrAdmin = user?.role === 'dueño' || user?.role === 'admin';
  
  // Estado para almacenar la caja seleccionada (para dueños y admins)
  const [selectedCashbox, setSelectedCashbox] = useState<number | null>(null);
  
  // Función para manejar el cambio de caja seleccionada
  const handleCashboxChange = (value: string) => {
    if (value === "mi-caja") {
      setSelectedCashbox(null);
    } else {
      setSelectedCashbox(parseInt(value));
    }
    // Refrescar los datos cuando se cambia de caja
    setTimeout(() => {
      refetchCashboxTransactions();
    }, 100);
  };
  
  // Obtener las cajas de la compañía con transacciones (solo para dueños y admins)
  const {
    data: companyCashboxes,
    isLoading: isLoadingCashboxes,
    refetch: refetchCompanyCashboxes
  } = useQuery({
    queryKey: ["/api/cashboxes/company/with-transactions"],
    queryFn: async () => {
      if (!user || (!isOwnerOrAdmin)) return [];
      
      const response = await fetch('/api/cashboxes/company/with-transactions');
      if (!response.ok) {
        console.error("Error al obtener cajas de la compañía:", await response.text());
        return [];
      }
      
      return await response.json();
    },
    enabled: !!user && isOwnerOrAdmin
  });
  

  
  // Obtener las empresas asociadas para usuarios de taquilla
  const { 
    data: associatedCompanies
  } = useQuery({
    queryKey: ["/api/user/companies"],
    queryFn: async () => {
      if (!user || user.role !== 'taquilla') return [];
      
      const response = await fetch('/api/user/companies');
      if (!response.ok) {
        console.error("Error al obtener empresas asociadas:", await response.text());
        return [];
      }
      
      return await response.json();
    },
    enabled: !!user && user.role === 'taquilla'
  });
  
  // Obtener todos los viajes para tener datos de rutas
  const {
    data: allTrips
  } = useQuery({
    queryKey: ["/api/trips"],
    queryFn: async () => {
      const response = await fetch('/api/trips');
      if (!response.ok) {
        console.error("Error al obtener viajes:", await response.text());
        return [];
      }
      return await response.json();
    }
  });
  


  // Obtener las reservaciones marcadas como pagadas por el usuario actual o del cashbox seleccionado
  const { 
    data: paidReservations, 
    isLoading,
    error,
    refetch: refetchCashboxTransactions
  } = useQuery({
    queryKey: ["/api/cashbox/transactions", selectedCashbox],
    queryFn: async () => {
      if (!user) return null;
      
      // Si hay una caja seleccionada (como admin o dueño) usamos un endpoint diferente
      const url = selectedCashbox 
        ? `/api/cashbox/${selectedCashbox}/transactions` 
        : '/api/cashbox/transactions';
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Error al cargar los datos de caja");
      }
      
      return await response.json();
    },
    enabled: !!user
  });
  
  // Actualizar estados de UI basados en el estado de carga
  useEffect(() => {
    if (isLoading) {
      const loadingTimeout = setTimeout(() => setShowLoadingDelay(true), 500);
      return () => clearTimeout(loadingTimeout);
    } else {
      setIsInitialLoad(false);
    }
  }, [isLoading]);
  
  // Capturar y mostrar información completa de rutas
  useEffect(() => {
    // Recopilar información completa de rutas de las reservaciones cuando cambian los datos
    if (paidReservations && paidReservations.length > 0 && allTrips && allTrips.length > 0) {
      const routesInfo: {[key: string]: string} = {};
      
      // Primero obtenemos todas las rutas disponibles
      const allRoutes = allTrips.reduce((acc: {[key: string]: any}, trip: any) => {
        if (trip.route && trip.route.id) {
          if (!acc[trip.route.id]) {
            acc[trip.route.id] = trip.route;
          }
        }
        return acc;
      }, {});
      
      // Para cada viaje, guardamos el formato exacto que se muestra en la columna Ruta
      allTrips.forEach((trip: any) => {
        if (trip.id) {
          const tripId = trip.id.toString();
          let routeDisplay = '';
          
          // Formato similar al que se muestra en la columna de Ruta
          if (trip.route) {
            // Primera línea: Origen completo con ciudad y terminal
            if (trip.route.origin) {
              routeDisplay = trip.route.origin;
            }
            
            // Segunda línea: Flecha + Destino completo con ciudad y terminal
            if (trip.route.destination) {
              routeDisplay += `\n→ ${trip.route.destination}`;
            }
          }
          
          // Si no hay información de ruta específica, usar el nombre del viaje
          if (!routeDisplay && trip.route?.name) {
            routeDisplay = trip.route.name;
          }
          
          // Guardar la información en el formato correcto
          routesInfo[tripId] = routeDisplay;
        }
      });
      
      // Actualizar el estado con la información recopilada
      setCompleteRoutes(routesInfo);
      
      // Mostrar la información en la consola para depuración
      console.log("Información completa de rutas:", routesInfo);
    }
  }, [paidReservations, allTrips]);
  
  // Separar reservaciones y paqueterías
  const separateReservationsAndPackages = (items: ReservationWithCompany[] = []) => {
    const reservations: ReservationWithCompany[] = [];
    const packages: ReservationWithCompany[] = [];
    
    items.forEach(item => {
      if (item.originalPackageId) {
        packages.push(item);
      } else {
        reservations.push(item);
      }
    });
    
    return { reservations, packages };
  };
  
  // Función auxiliar para verificar si un elemento ya fue procesado en un corte anterior
  // Usando localStorage como respaldo mientras se resuelve el problema de base de datos
  const isItemProcessed = (itemType: string, itemId: number) => {
    if (!user) return false;
    
    try {
      // Usamos localStorage como respaldo hasta que la tabla exista en la BD
      const processedItemsKey = `processed_items_${user.id}`;
      const storedProcessedItems = localStorage.getItem(processedItemsKey);
      
      // Log para depuración
      console.log(`[isItemProcessed] Verificando si el elemento ${itemType} ${itemId} ya ha sido procesado`);
      
      if (!storedProcessedItems) {
        console.log(`[isItemProcessed] No hay elementos procesados en localStorage para el usuario ${user.id}`);
        return false;
      }

      const processedItems = JSON.parse(storedProcessedItems);
      
      // Log para depuración - ver todos los elementos procesados
      console.log(`[isItemProcessed] Total elementos procesados encontrados: ${processedItems.length}`);
      
      // Convertir el ID a string para comparación consistente
      const itemIdStr = String(itemId);
      
      // Verificar si este elemento específico ya está en la lista de procesados (comparando como string para evitar problemas de tipo)
      const isProcessed = processedItems.some((item: any) => {
        const storedId = String(item.id);
        const match = item.type === itemType && storedId === itemIdStr;
        
        if (match) {
          console.log(`[isItemProcessed] Coincidencia encontrada: ${itemType} ${itemIdStr} procesado en corte #${item.cutoffId || 'desconocido'}`);
        }
        
        return match;
      });
      
      return isProcessed;
    } catch (e) {
      console.error("Error al verificar elementos procesados:", e);
      return false;
    }
  };
  

  
  // Filtrar las reservaciones
  const filteredReservations = paidReservations?.filter((reservation: ReservationWithCompany) => {
    // No incluir paqueterías en esta lista
    if (reservation.originalPackageId) {
      return false;
    }
    
    // No incluir elementos ya procesados en cortes anteriores
    if (isItemProcessed('reservation', reservation.id)) {
      return false;
    }
    
    // Aplicar filtro de búsqueda
    let matchesSearch = true;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const routeName = reservation.trip?.route?.name?.toLowerCase() || '';
      const passengerNames = (reservation.passengers || []).map(
        (p) => `${p.firstName} ${p.lastName}`.toLowerCase()
      ).join(" ");
      const email = (reservation.email || '').toLowerCase();
      const phone = (reservation.phone || '').toLowerCase();
      const reservationId = `RES${reservation.originalReservationId || reservation.id}`.toLowerCase();
      const paymentNote = (reservation.paymentNote || '').toLowerCase();
      
      matchesSearch = (
        routeName.includes(searchLower) ||
        passengerNames.includes(searchLower) ||
        email.includes(searchLower) ||
        phone.includes(searchLower) ||
        reservationId.includes(searchLower) ||
        paymentNote.includes(searchLower)
      );
    }
    
    // Aplicar filtro de fecha
    let matchesDate = true;
    if (dateFilter) {
      // Usar la fecha de pago específica para este ítem (anticipo o restante)
      const reservationDate = new Date(reservation.paymentDate || reservation.markedAsPaidAt || reservation.paidAt || reservation.createdAt || '');
      const filterDate = new Date(dateFilter);
      
      matchesDate = (
        reservationDate.getFullYear() === filterDate.getFullYear() &&
        reservationDate.getMonth() === filterDate.getMonth() &&
        reservationDate.getDate() === filterDate.getDate()
      );
    }
    
    // Aplicar filtro de método de pago - ahora usamos directamente el método asignado al ítem
    let matchesPaymentMethod = true;
    if (paymentMethodFilter && paymentMethodFilter !== 'todos') {
      matchesPaymentMethod = reservation.paymentMethod === paymentMethodFilter;
    }
    
    // Aplicar filtro de empresa (solo para taquilleros)
    let matchesCompany = true;
    if (isTicketOfficeView && companyFilter !== 'todas') {
      matchesCompany = reservation.companyInfo?.id === companyFilter;
    }
    
    return matchesSearch && matchesDate && matchesPaymentMethod && matchesCompany;
  }) || [];
  
  // Obtener las paqueterías directamente de los datos cargados
  // Extraer paqueterías del array de datos cargados
  console.log("Transacciones de caja cargadas:", paidReservations?.length || 0);
  
  // Filtrar y enriquecer paqueterías
  const filteredPackages = paidReservations?.filter((item: any) => {
    // Solo incluir items que sean paqueterías
    if (!item.originalPackageId && !item.packageDescription) {
      return false;
    }
    
    console.log(`Evaluando paquetería #${item.id} para mostrar en caja:`, {
      isPaid: item.isPaid,
      paidBy: item.paidBy,
      userId: user?.id,
      isAdminView: isAdminView
    });
    
    // Verificar que la paquetería está marcada como pagada
    if (!item.isPaid) {
      console.log(`Paquetería #${item.id} no está marcada como pagada, omitiendo`);
      return false;
    }
    
    // Si el usuario actual marcó esta paquetería como pagada o es admin/dueño
    const userMarkedAsPaid = item.paidBy === user?.id;
    const userCanViewAll = isAdminView;
    
    if (!userMarkedAsPaid && !userCanViewAll) {
      console.log(`Paquetería #${item.id} no fue marcada como pagada por el usuario actual (${user?.id}) y no es admin/dueño, omitiendo`);
      return false;
    }
    
    // No incluir elementos ya procesados en cortes anteriores
    const isProcessed = isItemProcessed('package', item.id);
    console.log(`Verificando si paquetería #${item.id} ya está procesada: ${isProcessed ? 'SÍ' : 'NO'}`);
    
    if (isProcessed) {
      console.log(`Paquetería #${item.id} ya procesada en un corte anterior, omitiendo`);
      return false;
    }
    
    // Aplicar filtro de búsqueda
    let matchesSearch = true;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const routeName = routeInfoMap[item.tripId]?.toLowerCase() || '';
      const senderName = ((item.senderName || '') + ' ' + (item.senderLastName || '')).toLowerCase();
      const receiverName = ((item.recipientName || '') + ' ' + (item.recipientLastName || '')).toLowerCase();
      const packageId = `PKG${item.id}`.toLowerCase();
      const packageDesc = (item.packageDescription || '').toLowerCase();
      
      matchesSearch = (
        routeName.includes(searchLower) ||
        senderName.includes(searchLower) ||
        receiverName.includes(searchLower) ||
        packageId.includes(searchLower) ||
        packageDesc.includes(searchLower)
      );
    }
    
    // Aplicar filtro de fecha (misma lógica que para reservaciones)
    let matchesDate = true;
    if (dateFilter) {
      const packageDate = new Date(item.paymentDate || item.createdAt || '');
      const filterDate = new Date(dateFilter);
      
      matchesDate = (
        packageDate.getFullYear() === filterDate.getFullYear() &&
        packageDate.getMonth() === filterDate.getMonth() &&
        packageDate.getDate() === filterDate.getDate()
      );
    }
    
    // Aplicar filtro de método de pago
    let matchesPaymentMethod = true;
    if (paymentMethodFilter && paymentMethodFilter !== 'todos') {
      matchesPaymentMethod = item.paymentMethod === paymentMethodFilter;
    }
    
    // Aplicar filtro de empresa (solo para taquilleros)
    let matchesCompany = true;
    if (isTicketOfficeView && companyFilter !== 'todas') {
      matchesCompany = item.companyId === companyFilter;
    }
    
    return matchesSearch && matchesDate && matchesPaymentMethod && matchesCompany;
  }) || [];

  // Ordenar por fecha
  const sortedReservations = [...filteredReservations].sort((a, b) => {
    const dateA = new Date(a.markedAsPaidAt || '');
    const dateB = new Date(b.markedAsPaidAt || '');
    
    if (sortDirection === "asc") {
      return dateA.getTime() - dateB.getTime();
    } else {
      return dateB.getTime() - dateA.getTime();
    }
  });
  
  // Ordenar paqueterías por fecha
  const sortedPackages = [...filteredPackages].sort((a, b) => {
    const dateA = new Date(a.markedAsPaidAt || '');
    const dateB = new Date(b.markedAsPaidAt || '');
    
    if (sortDirection === "asc") {
      return dateA.getTime() - dateB.getTime();
    } else {
      return dateB.getTime() - dateA.getTime();
    }
  });
  
  // Agrupar reservaciones por compañía para taquilleros
  const reservationsByCompany = isTicketOfficeView 
    ? (paidReservations || []).reduce<Record<string, { name: string, reservations: ReservationWithCompany[] }>>((groups, reservation) => {
        const companyId = reservation.companyInfo?.id || 'sin-empresa';
        const companyName = reservation.companyInfo?.name || 'Sin empresa asignada';
        
        if (!groups[companyId]) {
          groups[companyId] = {
            name: companyName,
            reservations: []
          };
        }
        
        groups[companyId].reservations.push(reservation);
        return groups;
      }, {})
    : {};
  
  // Calcular totales - Ahora incluimos tanto reservaciones como paqueterías
  const reservationTotal = sortedReservations.reduce((sum, reservation) => sum + (reservation.totalAmount || 0), 0);
  const packageTotal = sortedPackages.reduce((sum, packageItem) => sum + (packageItem.price || 0), 0);
  const totalAmount = reservationTotal + packageTotal;
  
  // Log para ver los datos de paqueterías
  console.log('Paqueterías disponibles para mostrar:', sortedPackages);
  console.log('Total de paqueterías:', sortedPackages.length);
  
  // Calcular efectivo y transferencia basado en los métodos de pago para reservaciones
  const reservationTotalCash = sortedReservations
    .filter(r => r.paymentMethod === 'efectivo')
    .reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    
  const reservationTotalTransfer = sortedReservations
    .filter(r => r.paymentMethod === 'transferencia')
    .reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    
  // Calcular efectivo y transferencia para paqueterías  
  const packageTotalCash = sortedPackages
    .filter(p => p.paymentMethod === 'efectivo')
    .reduce((sum, p) => sum + (p.price || 0), 0);
    
  const packageTotalTransfer = sortedPackages
    .filter(p => p.paymentMethod === 'transferencia')
    .reduce((sum, p) => sum + (p.price || 0), 0);
    
  // Totales combinados
  const totalCash = reservationTotalCash + packageTotalCash;
  const totalTransfer = reservationTotalTransfer + packageTotalTransfer;
  
  // Calcular totales por compañía para taquilleros
  const companyTotals = isTicketOfficeView 
    ? Object.entries(reservationsByCompany).reduce<Record<string, { totalAmount: number, totalCash: number, totalTransfer: number }>>((totals, [companyId, companyData]) => {
        const companyTotalAmount = companyData.reservations.reduce((sum: number, r: ReservationWithCompany) => 
          sum + (r.totalAmount || 0), 0);
        
        const companyTotalCash = companyData.reservations
          .filter((r: ReservationWithCompany) => 
            (r.advancePaymentMethod === 'efectivo' || r.paymentMethod === 'efectivo'))
          .reduce((sum: number, r: ReservationWithCompany) => {
            let cashAmount = 0;
            if (r.advancePaymentMethod === 'efectivo') {
              cashAmount += r.advanceAmount || 0;
            }
            if (r.paymentMethod === 'efectivo') {
              cashAmount += (r.totalAmount || 0) - (r.advanceAmount || 0);
            }
            return sum + cashAmount;
          }, 0);
        
        const companyTotalTransfer = companyTotalAmount - companyTotalCash;
        
        totals[companyId] = {
          totalAmount: companyTotalAmount,
          totalCash: companyTotalCash, 
          totalTransfer: companyTotalTransfer
        };
        
        return totals;
      }, {})
    : {};
  
  const toggleSortDirection = () => {
    setSortDirection(prev => prev === "asc" ? "desc" : "asc");
  };
  
  // Variable para almacenar las notas del corte
  const [cutoffNotes, setCutoffNotes] = useState("");
  
  // Función para realizar el corte de caja
  const handleCashboxCutoff = async () => {
    if (!user) return;
    
    try {
      setIsLoadingCutoff(true);
      
      // Mostrar mensaje de carga mientras obtenemos los datos actualizados
      toast({
        title: "Actualizando datos",
        description: "Obteniendo las transacciones más recientes...",
      });
      
      // Refrescar los datos para asegurarnos de tener todas las transacciones actualizadas
      await queryClient.invalidateQueries({ queryKey: ["/api/cashbox/transactions"] });
      
      // Esperar a que la consulta se complete haciendo una nueva consulta directa
      // para asegurar que tenemos los datos más recientes
      const response = await fetch('/api/cashbox/transactions');
      if (!response.ok) {
        throw new Error("Error al actualizar las transacciones");
      }
      
      // Obtener los datos frescos directamente del servidor
      const freshTransactions = await response.json();
      console.log("Transacciones actualizadas para el corte:", freshTransactions.length);
      // Mostrar la estructura completa para depuración
      console.log("Estructura de las transacciones frescas:", JSON.stringify(freshTransactions[0], null, 2));
      
      // Usar estas transacciones frescas en lugar de las del estado para preparar el corte
      // Esto garantiza que estamos usando los datos más actualizados
      
      // Determinar si estamos filtrando los datos
      const isFiltered = searchTerm || dateFilter || paymentMethodFilter !== 'todos' || (isTicketOfficeView && companyFilter !== 'todas');
      
      // Si hay filtros, preguntamos al usuario si quiere hacer el corte solo de lo filtrado
      if (isFiltered) {
        // Aquí mostramos un modal para confirmar
        const confirmCutoff = window.confirm(
          "Estás realizando un corte con filtros aplicados. ¿Deseas hacer el corte solo de las transacciones mostradas?\n\n" +
          "Presiona 'Aceptar' para hacer el corte solo de lo filtrado\n" +
          "Presiona 'Cancelar' para hacer el corte de todas tus transacciones"
        );
        
        if (!confirmCutoff) {
          // Si no confirma, reseteamos los filtros
          setSearchTerm("");
          setDateFilter("");
          setPaymentMethodFilter("todos");
          if (isTicketOfficeView) setCompanyFilter("todas");
        }
      }
      
      // Preparar los datos para el modal usando las transacciones frescas obtenidas directamente del servidor
      // Esto garantiza que estamos usando los datos más actualizados
      
      // Procesar los datos frescos de transacciones y asegurar que tengan nombre de pasajero
      const freshReservations = freshTransactions.filter(t => t.type === 'reservation').map(r => {
        // Asegurar que tengamos el nombre del pasajero correctamente formateado
        const passengerName = r.passengers && Array.isArray(r.passengers) && r.passengers.length > 0
          ? `${r.passengers[0]?.firstName || ''} ${r.passengers[0]?.lastName || ''}`.trim()
          : 'Sin pasajeros';
        
        // Loguear para verificar que estamos obteniendo el nombre del pasajero
        console.log(`Procesando pasajero para reserva ${r.id}:`, {
          id: r.id,
          passengers: r.passengers,
          extractedName: passengerName
        });
        
        return {
          ...r,
          passengerName
        };
      });
      
      const freshPackages = freshTransactions.filter(t => t.type === 'package');
      
      // Calcular nuevos totales basados en los datos frescos
      const freshReservationTotal = freshReservations.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
      const freshPackageTotal = freshPackages.reduce((sum, p) => sum + (p.price || 0), 0);
      const freshTotalAmount = freshReservationTotal + freshPackageTotal;
      
      // Calcular efectivo y transferencias con los datos frescos
      const freshReservationCash = freshReservations
        .filter(r => r.advancePaymentMethod === 'efectivo' || r.paymentMethod === 'efectivo')
        .reduce((sum, r) => {
          let cashAmount = 0;
          if (r.advancePaymentMethod === 'efectivo') {
            cashAmount += r.advanceAmount || 0;
          }
          if (r.paymentMethod === 'efectivo') {
            cashAmount += (r.totalAmount || 0) - (r.advanceAmount || 0);
          }
          return sum + cashAmount;
        }, 0);
      
      const freshPackageCash = freshPackages
        .filter(p => p.paymentMethod === 'efectivo')
        .reduce((sum, p) => sum + (p.price || 0), 0);
      
      const freshTotalCash = freshReservationCash + freshPackageCash;
      const freshTotalTransfer = freshTotalAmount - freshTotalCash;
      
      console.log("Totales calculados con datos frescos:", {
        totalAmount: freshTotalAmount,
        totalCash: freshTotalCash,
        totalTransfer: freshTotalTransfer,
        transactionCount: freshTransactions.length
      });
      
      // Preparar los datos para el modal con los datos frescos
      const cutoffSummary = {
        date: new Date().toLocaleString(),
        user: `${user.firstName} ${user.lastName}`,
        totalAmount: freshTotalAmount,
        totalCash: freshTotalCash,
        totalTransfer: freshTotalTransfer,
        transactionCount: freshTransactions.length,
        transactions: freshTransactions.map(item => {
          if (item.type === 'reservation') {
            // Procesar reservación
            const r = item;
            const origin = r.trip?.segmentOrigin || (r.trip?.route && r.trip.route.origin) || r.origin || "Origen no especificado";
            const destination = r.trip?.segmentDestination || (r.trip?.route && r.trip.route.destination) || r.destination || "Destino no especificado";
            
            console.log("Procesando reservación fresca para corte:", { 
              id: r.id,
              isSegment: !!r.trip?.segmentOrigin,
              origin,
              destination
            });
            
            // Determinar el monto correcto para la transacción
            let transactionAmount = 0;
            
            // Si es un anticipo
            if (r.isAdvancePayment) {
              transactionAmount = r.advanceAmount || 0;
            } 
            // Si es un pago restante
            else if (r.advanceAmount && r.advanceAmount > 0 && r.paymentDate) {
              transactionAmount = (r.totalAmount || 0) - (r.advanceAmount || 0);
            } 
            // Si es un pago completo
            else {
              transactionAmount = r.totalAmount || 0;
            }
            
            console.log("Calculando monto de transacción para el modal:", {
              id: r.id,
              isAdvancePayment: r.isAdvancePayment,
              advanceAmount: r.advanceAmount,
              totalAmount: r.totalAmount,
              calculatedAmount: transactionAmount
            });
            
            // Extraer el nombre del pasajero de forma segura
            const passengerName = r.passengerName || (
              r.passengers && Array.isArray(r.passengers) && r.passengers.length > 0 
              ? `${r.passengers[0]?.firstName || ''} ${r.passengers[0]?.lastName || ''}`.trim()
              : "Sin pasajeros"
            );
            
            console.log("Preparando datos de pasajero para el modal:", {
              id: r.id,
              passengerName,
              hasPassengers: r.passengers && r.passengers.length > 0
            });
            
            return {
              id: r.id,
              type: 'reservation',
              tripName: r.trip?.route?.name || "Sin ruta",
              origin,
              destination,
              passengerName,
              passengers: r.passengers?.map(p => `${p.firstName} ${p.lastName}`).join(", ") || "Sin pasajeros",
              amount: transactionAmount, // Usar el monto calculado correctamente
              paymentMethod: getCombinedPaymentMethod(r)
            };
          } else {
            // Procesar paquetería
            const p = item;
            const origin = p.trip?.segmentOrigin || (p.trip?.route && p.trip.route.origin) || p.origin || "Origen no especificado";
            const destination = p.trip?.segmentDestination || (p.trip?.route && p.trip.route.destination) || p.destination || "Destino no especificado";
            
            // Asegurarnos de que el monto se muestra correctamente
            const packageAmount = p.price || p.totalAmount || 0;
            
            console.log("Calculando monto para paquetería:", {
              id: p.id,
              price: p.price,
              totalAmount: p.totalAmount,
              calculatedAmount: packageAmount
            });
            
            return {
              id: p.id,
              type: 'package',
              tripName: p.trip?.route?.name || "Sin ruta",
              origin,
              destination,
              sender: `${p.senderName || ''} ${p.senderLastName || ''}`,
              recipient: `${p.recipientName || ''} ${p.recipientLastName || ''}`,
              amount: packageAmount,
              paymentMethod: p.paymentMethod || 'efectivo'
            };
          }
        })
      };
      
      setCutoffData(cutoffSummary);
      setShowCutoffModal(true);
      
    } catch (error) {
      console.error("Error al preparar el corte de caja:", error);
      toast({
        title: "Error",
        description: "No se pudo realizar el corte de caja. Inténtalo de nuevo.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingCutoff(false);
    }
  };
  
  // Función para cargar el historial de cortes desde la API
  const loadCutoffHistory = () => {
    if (!user) return;
    
    // Mostrar el modal y la consulta de React Query ya se habrá encargado de cargar los datos
    setShowHistoryModal(true);
    
    // Si todavía no tenemos datos de la API, usamos los del localStorage como respaldo
    if (!cutoffsData) {
      try {
        const storedHistory = localStorage.getItem('cutoffHistory');
        if (storedHistory) {
          setCutoffHistory(JSON.parse(storedHistory));
        }
      } catch (error) {
        console.error("Error al cargar historial de cortes del respaldo:", error);
      }
    }
  };
  
  // Procesar los datos de cortes recibidos de la API
  useEffect(() => {
    if (cutoffsData && Array.isArray(cutoffsData) && cutoffsData.length > 0) {
      // Transformar los datos de la API al formato esperado por la interfaz
      const formattedHistory = cutoffsData.map(cutoff => {
        // Asegurar que la fecha se formatea correctamente
        let dateStr = '';
        try {
          // Solo si es una fecha válida la formateamos
          const date = new Date(cutoff.createdAt);
          if (!isNaN(date.getTime())) {
            dateStr = date.toLocaleString('es-MX', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            });
          }
        } catch(e) {
          dateStr = 'Fecha no disponible';
        }
        
        return {
          id: cutoff.id,
          date: dateStr,
          // Eliminamos el "Usuario ID: " del operador
          user: `${cutoff.operatorId}`,
          totalAmount: cutoff.totalIncome,
          totalCash: cutoff.totalCash || 0,
          totalTransfer: cutoff.totalTransfer || 0,
          transactionCount: cutoff.transactionCount || 0,
          // Limpiamos las notas para evitar mostrar texto vacío
          notes: cutoff.notes && cutoff.notes.trim() ? cutoff.notes : null
        };
      });
      
      setCutoffHistory(formattedHistory);
    }
  }, [cutoffsData]);
  
  // Inicializar isInitialLoad
  useEffect(() => {
    // Inicializar el estado isInitialLoad a false después de cargar datos
    const timer = setTimeout(() => {
      setIsInitialLoad(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  // Función para mostrar el historial de cortes
  const showCutoffHistory = () => {
    setIsLoadingHistory(true);
    try {
      // Cargar el historial desde localStorage
      loadCutoffHistory();
      // Mostrar el modal
      setShowHistoryModal(true);
    } catch (error) {
      console.error("Error al cargar el historial de cortes:", error);
      toast({
        title: "Error",
        description: "No se pudo cargar el historial de cortes.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Función para completar el corte de caja
  const completeCashboxCutoff = async () => {
    if (!user || !cutoffData) return;
    
    try {
      setIsLoadingCutoff(true);
      
      // Conectamos con el backend para realizar el corte de caja persistente
      
      // Preparar los datos para enviar al servidor
      const requestData = {
        notes: cutoffNotes || `Corte realizado por ${user.firstName} ${user.lastName}`,
        items: cutoffData.transactions.map(item => {
          // Asegurarse de que el pasajero/remitente se incluya en los detalles
          const itemDetails = {
            passengerName: item.type === 'reservation' 
              ? (item.passengerName || 
                 (item.passengers && Array.isArray(item.passengers) && item.passengers.length > 0 
                   ? `${item.passengers[0]?.firstName || ''} ${item.passengers[0]?.lastName || ''}`.trim() 
                   : 'No disponible'))
              : (item.type === 'package' ? (item.sender || 'Remitente sin nombre') : 'No disponible'),
            origin: item.origin || 'Origen no especificado',
            destination: item.destination || 'Destino no especificado',
            amount: item.amount || 0,
            totalAmount: item.totalAmount || 0,
            tripName: item.tripName || ''
          };
          
          console.log("Enviando información al servidor:", {
            id: item.id,
            type: item.type,
            passengerName: itemDetails.passengerName
          });
          
          return {
            ...item,
            // Asegurarse de que cada elemento tenga el tipo correcto
            type: item.originalPackageId ? 'package' : 'reservation',
            // Incluir los detalles importantes que queremos guardar
            details: itemDetails
          };
        })
      };
      
      // Enviar datos al servidor para crear el corte en la base de datos
      const response = await fetch('/api/cutoffs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al procesar el corte");
      }
      
      const result = await response.json();
      console.log("Corte creado exitosamente:", result);
      
      // Marcar elementos procesados en localStorage para que no se muestren en futuros cortes
      // Esto incluye tanto reservaciones como paqueterías
      if (user) {
        try {
          const processedItemsKey = `processed_items_${user.id}`;
          // Obtener elementos ya procesados
          const storedProcessedItems = localStorage.getItem(processedItemsKey);
          let processedItems = storedProcessedItems ? JSON.parse(storedProcessedItems) : [];
          
          // Crear un array para los logs
          const processingLogs = [];
          
          // Agregar elementos de este corte
          cutoffData.transactions.forEach(item => {
            // Determinar el tipo correcto del elemento
            const itemType = item.originalPackageId ? 'package' : 'reservation';
            const itemId = item.id;
            
            // Log para depuración
            processingLogs.push(`Procesando ${itemType} con ID ${itemId}`);
            
            // Verificar si este elemento ya está marcado como procesado
            const isAlreadyProcessed = processedItems.some(
              (p: any) => p.id === itemId && p.type === itemType
            );
            
            // Solo agregar si no está procesado ya
            if (!isAlreadyProcessed) {
              // Agregar a la lista de procesados
              processedItems.push({
                id: itemId,
                type: itemType,
                processedAt: new Date().toISOString(),
                cutoffId: result.id // ID del corte actual
              });
              processingLogs.push(`-> Marcado como procesado`);
            } else {
              processingLogs.push(`-> Ya estaba marcado como procesado`);
            }
          });
          
          // Guardar la lista actualizada
          localStorage.setItem(processedItemsKey, JSON.stringify(processedItems));
          
          // Mostrar logs en consola
          console.log(`--- PROCESAMIENTO DE ELEMENTOS EN CORTE #${result.id || 'nuevo'} ---`);
          processingLogs.forEach(log => console.log(log));
          console.log(`Marcados ${cutoffData.transactions.length} elementos como procesados en el corte #${result.id || 'nuevo'}`);
          console.log(`Total de elementos procesados en localStorage: ${processedItems.length}`);
          
          // Para depuración: mostrar lista completa
          console.log('Lista completa de elementos procesados:', processedItems);
        } catch (e) {
          console.error("Error al marcar elementos como procesados:", e);
          console.error(e);
        }
      }
      
      // Invalidar la caché para forzar una recarga de las transacciones
      // Esto eliminará los elementos procesados en este corte
      queryClient.invalidateQueries({ queryKey: ["/api/cashbox/transactions"] });
      
      // También invalidar la caché de los cortes para mostrar el nuevo corte
      queryClient.invalidateQueries({ queryKey: ["/api/cutoffs"] });
      
      // Limpiar los filtros para mostrar la vista limpia
      setSearchTerm("");
      setDateFilter("");
      setPaymentMethodFilter("todos");
      if (isTicketOfficeView) setCompanyFilter("todas");
      
      // Cerrar el modal de corte
      setShowCutoffModal(false);
      
      // Mostrar mensaje de éxito
      toast({
        title: "Corte realizado",
        description: "Se ha realizado el corte de caja correctamente. Las transacciones procesadas se han movido al historial.",
      });
      
      // Imprimir el ticket (simulación)
      const ticketContent = `
CORTE DE CAJA
--------------------------------
Fecha: ${new Date().toLocaleString()}
Usuario: ${user.firstName} ${user.lastName}
--------------------------------
Total: $${cutoffData.totalAmount}
Efectivo: $${cutoffData.totalCash}
Transferencia: $${cutoffData.totalTransfer}
--------------------------------
Total transacciones: ${cutoffData.transactionCount}
      `;
      
      alert("Imprimiendo ticket:\n\n" + ticketContent);
      
      // Limpiar los estados
      setCutoffData(null);
      setCutoffNotes("");
      setShowCutoffModal(false);
      
      // Recargar la página para simular el borrado de elementos
      setTimeout(() => {
        window.location.reload();
      }, 1000);
      
    } catch (error) {
      console.error("Error al realizar el corte:", error);
      toast({
        title: "Error",
        description: "No se pudo realizar el corte de caja.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingCutoff(false);
    }
  };
  
  // Función para generar un PDF del ticket de corte en formato térmico (60mm)
  const generateCutoffTicketPDF = async (data: any, cutoffInfo: any) => {
    try {
      // Cálculo más preciso de la altura basado en el número de transacciones
      // Estimamos el espacio por transacción basado en su complejidad
      
      // Base para encabezado y pie: 80mm
      // Por cada transacción regular: 25mm
      // Ajuste final para precisión: 10mm
      let baseHeight = 80; // Encabezado, resumen y notas
      let heightPerTransaction = 25; // Espacio promedio por transacción
      
      // Calcular altura estimada total
      const transactionCount = data.transactions?.length || 0;
      const estimatedHeight = Math.max(120, baseHeight + (transactionCount * heightPerTransaction) + 10);
      
      console.log(`Generando PDF con altura estimada: ${estimatedHeight}mm para ${transactionCount} transacciones`);
      
      // Crear un nuevo documento PDF con dimensiones 60mm x altura dinámica optimizada
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [58, estimatedHeight], // 58mm (ancho estándar para tickets de 60mm) x altura optimizada
      });
      
      // Configuración básica
      doc.setFont("courier", "normal");
      
      // Variables para posición vertical
      let y = 5;
      const margin = 5;
      
      // Encabezado - Usar el nombre de la empresa del usuario actual
      doc.setFontSize(10);
      doc.setFont("courier", "bold");
      
      // Obtener el nombre de la empresa del usuario
      const companyName = user?.company?.toUpperCase() || (user?.companyId ? user.companyId.toUpperCase() : "SISTEMA DE CAJA");
      doc.text(companyName, 29, y, { align: "center" });
      y += 4;
      
      doc.setFontSize(8);
      doc.text(`CORTE DE CAJA #${cutoffInfo.id}`, 29, y, { align: "center" });
      y += 3;
      
      // Añadir fecha y usuario que realizó el corte
      try {
        const fechaCorte = new Date(cutoffInfo.createdAt);
        if (!isNaN(fechaCorte.getTime())) {
          doc.text(`FECHA: ${fechaCorte.toLocaleString('es-MX', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })}`, margin, y);
        } else {
          doc.text(`FECHA: ${new Date().toLocaleString('es-MX')}`, margin, y);
        }
      } catch (e) {
        doc.text(`FECHA: ${new Date().toLocaleString('es-MX')}`, margin, y);
      }
      
      y += 3;
      doc.text(`OPERADOR: ${user ? `${user.firstName} ${user.lastName}` : data.user}`, margin, y);
      y += 3;
      
      // Línea separadora
      y += 1;
      doc.setDrawColor(0);
      doc.line(margin, y, 53, y);
      y += 3;
      
      // Información del corte
      doc.setFontSize(8);
      doc.setFont("courier", "bold");
      doc.text("RESUMEN DE CAJA:", margin, y);
      y += 4;
      
      doc.setFont("courier", "normal");
      doc.text(`TOTAL: ${formatPrice(data.totalAmount)}`, margin, y);
      y += 3;
      doc.text(`EFECTIVO: ${formatPrice(data.totalCash)}`, margin, y);
      y += 3;
      doc.text(`TRANSFERENCIA: ${formatPrice(data.totalTransfer)}`, margin, y);
      y += 3;
      doc.text(`TRANSACCIONES: ${data.transactionCount}`, margin, y);
      y += 4;
      
      // Otra línea separadora
      doc.line(margin, y, 53, y);
      y += 4;
      
      // Detalles completos de las transacciones
      if (data.transactions && data.transactions.length > 0) {
        doc.setFontSize(7);
        doc.setFont("courier", "bold");
        doc.text("DETALLE DE TRANSACCIONES:", margin, y);
        y += 3;
        
        doc.setFont("courier", "normal");
        data.transactions.forEach((t: any, index: number) => {
          // Sección principal de la transacción
          doc.setFont("courier", "bold");
          doc.text(`${index + 1}. ${t.type === 'package' ? 'PAQUETERÍA' : 'RESERVACIÓN'} #${t.id}`, margin, y);
          y += 2.5;
          
          // Detalles específicos según el tipo
          doc.setFont("courier", "normal");
          if (t.type === 'package') {
            // Detalles para paqueterías
            doc.text(`Remitente: ${t.senderName || ''} ${t.senderLastName || ''}`, margin + 2, y);
            y += 2;
            doc.text(`Destinatario: ${t.receiverName || ''} ${t.receiverLastName || ''}`, margin + 2, y);
            y += 2;
            // Dividir la ruta en dos líneas para mejor legibilidad
            doc.text(`Origen: ${t.originCity || t.origin || ''}`, margin + 2, y);
            y += 2;
            doc.text(`Destino: ${t.destinationCity || t.destination || ''}`, margin + 2, y);
          } else {
            // Solo conservamos esta sección sobre información de pasajeros
            
            // Información de pasajeros
            if (t.passengers && t.passengers.length > 0) {
              if (t.passengers.length === 1) {
                const passenger = t.passengers[0];
                let passengerName = '';
                
                if (typeof passenger === 'string') {
                  passengerName = passenger;
                } else if (passenger && typeof passenger === 'object') {
                  passengerName = `${passenger.firstName || ''} ${passenger.lastName || ''}`.trim();
                }
                
                if (passengerName) {
                  // Si el nombre es muy largo, truncarlo
                  if (passengerName.length > 25) {
                    passengerName = passengerName.substring(0, 22) + '...';
                  }
                  doc.text(`Pasajero: ${passengerName}`, margin + 2, y);
                  y += 2;
                }
              } else {
                // Si hay múltiples pasajeros, solo mostrar la cantidad
                doc.text(`Pasajeros: ${t.passengers.length}`, margin + 2, y);
                y += 2;
              }
            } else if (t.passengerCount) {
              doc.text(`Pasajeros: ${t.passengerCount}`, margin + 2, y);
              y += 2;
            }
            
            // Origen y destino directamente sin etiqueta "Ruta:"
            if (t.origin || t.destination) {
              // Mostrar origen
              if (t.origin) {
                const origenText = t.origin;
                // Si es muy largo, dividirlo con saltos de línea
                if (origenText.length > 30) {
                  doc.text("Origen:", margin + 2, y);
                  y += 2;
                  // Dividir el texto en líneas para mejor legibilidad
                  const splitOrigen = doc.splitTextToSize(origenText, 44);
                  splitOrigen.forEach((line: string) => {
                    doc.text(`  ${line}`, margin + 2, y);
                    y += 2;
                  });
                } else {
                  doc.text(`Origen: ${origenText}`, margin + 2, y);
                  y += 2;
                }
              }
              
              // Mostrar destino
              if (t.destination) {
                const destinoText = t.destination;
                // Si es muy largo, dividirlo con saltos de línea
                if (destinoText.length > 30) {
                  doc.text("Destino:", margin + 2, y);
                  y += 2;
                  // Dividir el texto en líneas para mejor legibilidad
                  const splitDestino = doc.splitTextToSize(destinoText, 44);
                  splitDestino.forEach((line: string) => {
                    doc.text(`  ${line}`, margin + 2, y);
                    y += 2;
                  });
                } else {
                  doc.text(`Destino: ${destinoText}`, margin + 2, y);
                  y += 2;
                }
              }
            }
          }
          
          // Información de pago común para ambos tipos - con línea separadora para mejor legibilidad
          doc.setDrawColor(200, 200, 200); // Línea gris clara para separar
          doc.line(margin + 2, y, 51, y);
          y += 2;
          
          doc.text(`Monto: ${formatPrice(t.amount)}`, margin + 2, y);
          y += 2;
          doc.text(`Método: ${t.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}`, margin + 2, y);
          y += 2;
          doc.text(`Concepto: ${t.paymentNote || (t.advanceAmount && t.advanceAmount > 0 ? 'Anticipo' : 'Pago completo')}`, margin + 2, y);
          
          // Agregar un poco más de espacio después de cada transacción
          y += 3;
          
          // Ya agregamos separador y espacio arriba, así que eliminamos este bloque de código redundante
        });
      } else if (cutoffInfo.notes) {
        // Si no hay transacciones detalladas pero hay notas, mostrarlas
        y += 3;
        doc.setFont("courier", "italic");
        doc.text("Información no disponible para cortes antiguos", margin, y);
        y += 3;
      }
      
      // Mostrar notas del corte si existen
      if (cutoffInfo.notes) {
        y += 2;
        doc.setFont("courier", "bold");
        doc.text("NOTAS:", margin, y);
        y += 3;
        doc.setFont("courier", "normal");
        
        // Dividir notas largas en múltiples líneas
        const notesWidth = 48; // Ancho máximo para notas
        const splitNotes = doc.splitTextToSize(cutoffInfo.notes, notesWidth);
        splitNotes.forEach((line: string) => {
          doc.text(line, margin, y);
          y += 2.5;
        });
      }
      
      // Línea final
      y += 2;
      doc.line(margin, y, 53, y);
      
      // No incluimos pie de página con "¡GRACIAS POR SU SERVICIO!" como se solicitó
      
      // Abrir el PDF en una nueva ventana
      window.open(URL.createObjectURL(doc.output('blob')));
      
      return doc;
    } catch (error) {
      console.error("Error al generar el PDF del corte:", error);
      toast({
        title: "Error",
        description: "No se pudo generar el ticket PDF. Intente nuevamente.",
        variant: "destructive",
      });
      return null;
    }
  };
  
  // Función para imprimir el ticket de corte
  const printCutoffTicket = async (data: any, cutoffInfo: any) => {
    try {
      // Mostrar información completa de rutas para depuración
      console.log("Información de rutas disponible al imprimir:", completeRoutes);
      
      // Utilizamos la función de generación de PDF en formato 60mm
      await generateCutoffTicketPDF(data, cutoffInfo);
    } catch (error) {
      console.error("Error al preparar el ticket:", error);
      toast({
        title: "Error",
        description: "No se pudo generar el ticket para imprimir.",
        variant: "destructive"
      });
    }
  };
  
  // Función auxiliar para mostrar el método de pago combinado
  const getCombinedPaymentMethod = (reservation: ReservationWithCompany) => {
    if (reservation.advanceAmount && reservation.advanceAmount > 0) {
      return `Anticipo: ${reservation.advancePaymentMethod} / Resto: ${reservation.paymentMethod || 'Pendiente'}`;
    } else {
      return reservation.paymentMethod || 'Pendiente';
    }
  };
  
  return (
    <div className="py-6">
      <div className="flex items-center mb-4">
        <div className="rounded-full bg-primary bg-opacity-10 p-2 mr-3">
          <DollarSign className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800">Caja</h2>
      </div>
      
      {/* Modal de confirmación del corte de caja */}
      <Dialog open={showCutoffModal} onOpenChange={setShowCutoffModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar corte de caja</DialogTitle>
            <DialogDescription>
              Por favor verifica los detalles del corte antes de confirmar.
            </DialogDescription>
          </DialogHeader>
          
          {cutoffData && (
            <div className="space-y-4">
              <div className="border rounded-lg p-4 bg-secondary/10">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Usuario</p>
                    <p className="font-medium">{cutoffData.user}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Fecha</p>
                    <p className="font-medium">{cutoffData.date}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Transacciones</p>
                    <p className="font-medium">{cutoffData.transactionCount}</p>
                  </div>
                </div>
              </div>
              
              <div>
                <label htmlFor="notes" className="text-sm font-medium">
                  Notas para el corte (opcional)
                </label>
                <Textarea
                  id="notes"
                  placeholder="Añadir notas o comentarios sobre este corte..."
                  className="mt-1"
                  value={cutoffNotes}
                  onChange={(e) => setCutoffNotes(e.target.value)}
                />
              </div>
              
              <div className="border rounded-lg p-4 max-h-[200px] overflow-y-auto">
                <h4 className="text-sm font-semibold mb-2">Transacciones incluidas</h4>
                <div className="space-y-2">
                  {cutoffData.transactions.slice(0, 5).map((t: any) => (
                    <div key={t.id} className="border-b pb-2 text-sm">
                      <p><span className="font-medium">ID:</span> {t.id}</p>
                      <p>
                        <span className="font-medium">Pasajero:</span> {
                          t.type === 'reservation' 
                            ? (t.passengerName || 
                               (t.passengers && Array.isArray(t.passengers) && t.passengers.length > 0 
                                 ? `${t.passengers[0]?.firstName || ''} ${t.passengers[0]?.lastName || ''}`.trim() 
                                 : 'No disponible'))
                            : (t.type === 'package' ? (t.sender || 'Remitente sin nombre') : 'No disponible')
                        }
                      </p>
                      <p>
                        <span className="font-medium">Ruta:</span> {t.origin || t.tripInfo?.processedOrigin || 'Origen no especificado'} 
                        <span className="mx-1">→</span> 
                        {t.destination || t.tripInfo?.processedDestination || 'Destino no especificado'}
                      </p>
                      <p><span className="font-medium">Monto:</span> {formatPrice(t.amount || t.advanceAmount || t.totalAmount || 0)}</p>
                      <p><span className="font-medium">Método:</span> {t.paymentMethod}</p>
                    </div>
                  ))}
                  {cutoffData.transactions.length > 5 && (
                    <p className="text-sm text-muted-foreground text-center">
                      ... y {cutoffData.transactions.length - 5} transacciones más
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <DialogFooter className="flex space-x-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowCutoffModal(false)}
              disabled={isLoadingCutoff}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <div className="flex space-x-2">
              <Button
                type="button"
                variant="default"
                onClick={completeCashboxCutoff}
                disabled={isLoadingCutoff}
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoadingCutoff ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Realizar corte e imprimir
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="space-y-6">
            <div className={`grid grid-cols-1 ${isTicketOfficeView ? 'md:grid-cols-4' : 'md:grid-cols-3'} gap-4`}>
              <div className="col-span-2">
                <label htmlFor="searchInput" className="mb-2 block text-sm font-medium">
                  Buscar
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="searchInput"
                    className="pl-10"
                    placeholder="Buscar por nombre, teléfono, correo o ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="dateFilter" className="mb-2 block text-sm font-medium">
                  Filtrar por fecha de pago
                </label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="dateFilter"
                    className="pl-10"
                    type="date"
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="paymentMethodFilter" className="mb-2 block text-sm font-medium">
                  Método de pago
                </label>
                <Select value={paymentMethodFilter} onValueChange={setPaymentMethodFilter}>
                  <SelectTrigger id="paymentMethodFilter" className="w-full">
                    <SelectValue placeholder="Todos los métodos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos los métodos</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Selector de cajas para dueños y administradores */}
              {isOwnerOrAdmin && (
                <div>
                  <label htmlFor="cashboxSelector" className="mb-2 block text-sm font-medium">
                    Seleccionar caja
                  </label>
                  <Select 
                    value={selectedCashbox ? selectedCashbox.toString() : "mi-caja"} 
                    onValueChange={handleCashboxChange}
                  >
                    <SelectTrigger id="cashboxSelector" className="w-full">
                      <SelectValue placeholder="Seleccionar caja" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mi-caja">Mi caja</SelectItem>
                      {companyCashboxes && companyCashboxes.map((cashbox) => (
                        <SelectItem key={cashbox.id} value={cashbox.id.toString()}>
                          {cashbox.operatorInfo ? `${cashbox.operatorInfo.name}` : `Caja #${cashbox.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* Selector de empresa (solo para taquilleros) */}
              {isTicketOfficeView && (
                <div>
                  <label htmlFor="companyFilter" className="mb-2 block text-sm font-medium">
                    Empresa
                  </label>
                  <Select value={companyFilter} onValueChange={setCompanyFilter}>
                    <SelectTrigger id="companyFilter" className="w-full">
                      <SelectValue placeholder="Todas las empresas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas las empresas</SelectItem>
                      {/* Mostrar empresas asociadas para el usuario de taquilla */}
                      {associatedCompanies && associatedCompanies.length > 0 ? (
                        associatedCompanies.map((company) => (
                          <SelectItem key={company.identifier} value={company.identifier}>
                            {company.name}
                          </SelectItem>
                        ))
                      ) : (
                        // Como respaldo, usar las empresas encontradas en las reservaciones
                        Object.entries(reservationsByCompany).map(([companyId, companyData]) => (
                          <SelectItem key={companyId} value={companyId}>
                            {companyData.name}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            
            {/* Resumen de caja */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Resumen de caja</h3>
              <Button
                onClick={() => handleCashboxCutoff()}
                className="bg-green-600 hover:bg-green-700"
                disabled={isLoadingCutoff}
              >
                {isLoadingCutoff ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <DollarSign className="h-4 w-4 mr-2" />
                    Realizar corte
                  </>
                )}
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="bg-primary/5">
                <CardContent className="p-4">
                  <div className="flex items-center mb-1">
                    <DollarSign className="h-5 w-5 text-primary mr-2" />
                    <p className="text-sm font-medium">Total</p>
                  </div>
                  <p className="text-2xl font-bold">{formatPrice(totalAmount)}</p>
                </CardContent>
              </Card>
              
              <Card className="bg-green-50">
                <CardContent className="p-4">
                  <div className="flex items-center mb-1">
                    <DollarSign className="h-5 w-5 text-green-600 mr-2" />
                    <p className="text-sm font-medium">Efectivo</p>
                  </div>
                  <p className="text-2xl font-bold text-green-700">{formatPrice(totalCash)}</p>
                </CardContent>
              </Card>
              
              <Card className="bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex items-center mb-1">
                    <DollarSign className="h-5 w-5 text-blue-600 mr-2" />
                    <p className="text-sm font-medium">Transferencia</p>
                  </div>
                  <p className="text-2xl font-bold text-blue-700">{formatPrice(totalTransfer)}</p>
                </CardContent>
              </Card>
            </div>
          </div>
          
          {/* Botón para ver el historial de cortes */}
          <div className="mt-4">
            <Button 
              variant="outline" 
              className="w-full border border-gray-300 hover:bg-gray-100"
              onClick={showCutoffHistory}
            >
              <Clock className="h-5 w-5 mr-2" />
              Ver historial de cortes
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-0 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary" />
              <CardTitle className="text-md">Pagos marcados por {user?.firstName}</CardTitle>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSortDirection}
              className="flex items-center gap-1"
            >
              <ArrowDownUp className="h-4 w-4" />
              <span>{sortDirection === "desc" ? "Más recientes primero" : "Más antiguos primero"}</span>
            </Button>
          </div>
          <CardDescription className="mt-1">
            {isTicketOfficeView && companyFilter !== 'todas' 
              ? `Mostrando pagos registrados para ${Object.entries(reservationsByCompany).find(([id]) => id === companyFilter)?.[1]?.name || 'la empresa seleccionada'}`
              : `Mostrando ${sortedReservations.length} pagos registrados`}
          </CardDescription>
        </CardHeader>
        
        <div className="p-4">
          {isLoading && showLoadingDelay ? (
            <div className="flex justify-center items-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Cargando datos de caja...</span>
            </div>
          ) : error ? (
            <div className="text-center p-6 text-red-600">
              <p>Error al cargar los datos: {error instanceof Error ? error.message : "Error desconocido"}</p>
              <p className="text-sm mt-2">Por favor, intenta de nuevo más tarde.</p>
            </div>
          ) : ((isTicketOfficeView ? 
              (companyFilter !== 'todas' 
                ? !sortedReservations.length 
                : !Object.keys(reservationsByCompany).length)
              : !sortedReservations.length)) ? (
            <div className="text-center p-10 bg-gray-50 rounded-lg">
              <FilterIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-600">No hay pagos registrados</h3>
              <p className="text-gray-500 mt-1">
                {isTicketOfficeView && associatedCompanies?.length === 0
                  ? "No tienes empresas asociadas a tu cuenta. Contacta al administrador para configurar tus accesos."
                  : searchTerm || dateFilter || paymentMethodFilter || (isTicketOfficeView && companyFilter !== 'todas')
                    ? "No se encontraron pagos con los filtros aplicados."
                    : "Todavía no has marcado ninguna reservación como pagada."}
              </p>
            </div>
          ) : isTicketOfficeView ? (
            <div className="space-y-8">
              {Object.entries(reservationsByCompany).map(([companyId, companyData]) => {
                // Filtrar por empresa seleccionada si hay filtro activo
                if (companyFilter !== 'todas' && companyId !== companyFilter) {
                  return null;
                }
                
                return (
                  <div key={companyId} className="mb-8">
                    <h3 className="text-lg font-semibold mb-3 text-primary border-b pb-2">
                      Empresa: {companyData.name}
                    </h3>
                  
                  {/* Tarjetas resumen por empresa */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center">
                          <DollarSign className="h-5 w-5 mr-2 text-green-500" />
                          <div>
                            <p className="text-sm font-medium">Total</p>
                            <p className="text-xl font-bold">{formatPrice(companyTotals[companyId]?.totalAmount || 0)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center">
                          <DollarSign className="h-5 w-5 mr-2 text-blue-500" />
                          <div>
                            <p className="text-sm font-medium">Efectivo</p>
                            <p className="text-xl font-bold">{formatPrice(companyTotals[companyId]?.totalCash || 0)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center">
                          <DollarSign className="h-5 w-5 mr-2 text-purple-500" />
                          <div>
                            <p className="text-sm font-medium">Transferencia</p>
                            <p className="text-xl font-bold">{formatPrice(companyTotals[companyId]?.totalTransfer || 0)}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <Table>
                      <TableCaption>
                        Pagos registrados para {companyData.name}
                      </TableCaption>
                      <TableHeader>
                        <TableRow>
                          <TableHead>ID Reservación</TableHead>
                          <TableHead>Pasajero</TableHead>
                          <TableHead>Empresa</TableHead>
                          <TableHead>Ruta</TableHead>
                          <TableHead>Método</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {companyData.reservations.map((reservation: ReservationWithCompany) => (
                          <TableRow key={reservation.id}>
                            <TableCell className="font-medium">RES{reservation.id}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <User className="h-4 w-4 text-gray-500" />
                                <span>
                                  {reservation.passengers && reservation.passengers.length > 0 
                                    ? `${reservation.passengers[0]?.firstName} ${reservation.passengers[0]?.lastName}`
                                    : reservation.originalPackageId 
                                      ? `${reservation.senderName || 'Remitente'} → ${reservation.receiverName || 'Destinatario'}`
                                      : 'No disponible'
                                  }
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <span>{companyData.name || 'No disponible'}</span>
                              </div>
                            </TableCell>
                            <TableCell>{reservation.trip?.route?.name || 'No disponible'}</TableCell>
                            <TableCell>
                              <Badge variant={reservation.paymentMethod === 'efectivo' ? 'default' : 'outline'}>
                                {reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {reservation.paymentNote || 
                                  (reservation.advanceAmount && 
                                   reservation.advanceAmount > 0 && 
                                   reservation.totalAmount === reservation.advanceAmount 
                                    ? 'Anticipo' 
                                    : 'Pago')}
                              </Badge>
                            </TableCell>

                            <TableCell className="text-right">{formatPrice(reservation.totalAmount || 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )})}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableCaption>
                  {isAdminView 
                    ? 'Lista de pagos registrados por todos los usuarios de la empresa' 
                    : `Lista de pagos registrados por ${user?.firstName}`}
                </TableCaption>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID Reservación</TableHead>
                    <TableHead>Pasajero</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Ruta</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* Mostrar primero las reservaciones */}
                  {sortedReservations
                    .filter(reservation => !reservation.originalPackageId)
                    .map((reservation) => (
                    <TableRow key={`res-${reservation.id}`}>
                      <TableCell className="font-medium">RES{reservation.id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4 text-gray-500" />
                          <span>
                            {reservation.passengers && reservation.passengers.length > 0 
                              ? `${reservation.passengers[0]?.firstName} ${reservation.passengers[0]?.lastName}`
                              : 'No disponible'
                            }
                          </span>
                        </div>
                        {reservation.passengers && reservation.passengers.length > 1 && (
                          <div className="text-xs text-gray-500 ml-5 mt-1">
                            +{reservation.passengers.length - 1} pasajeros más
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span>
                            {reservation.companyInfo?.name || 
                             (reservation.trip && reservation.trip.route && reservation.trip.route.companyId) || 
                             reservation.companyId || 
                             'No disponible'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          // Console log para debugging
                          const tripData = reservation.trip;
                          const hasSegments = tripData && tripData.segmentOrigin && tripData.segmentDestination;
                          
                          // Obtenemos la información de origen y destino según corresponda
                          const routeInfo = hasSegments 
                            ? {
                                origin: tripData.segmentOrigin,
                                destination: tripData.segmentDestination,
                                isSegment: true
                              }
                            : tripData
                              ? {
                                  origin: tripData.route?.origin,
                                  destination: tripData.route?.destination,
                                  isSegment: false
                                }
                              : null;
                          
                          // Log simplificado con solo la información solicitada
                          console.log("Ruta:", {
                            id: reservation.id,
                            isSegment: routeInfo?.isSegment || false,
                            origin: routeInfo?.origin || "No disponible",
                            destination: routeInfo?.destination || "No disponible"
                          });
                          
                          // Devuelve el contenido original
                          return reservation.trip ? (
                            <>
                              <div className="font-medium">
                                {reservation.trip.segmentOrigin || (reservation.trip.route && reservation.trip.route.origin) || 'Origen'}
                              </div>
                              <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                <span>→</span> {reservation.trip.segmentDestination || (reservation.trip.route && reservation.trip.route.destination) || 'Destino'}
                              </div>
                            </>
                          ) : reservation.originalPackageId ? (
                            <>
                              <div className="font-medium">
                                {reservation.origin || 'Origen paquetería'}
                              </div>
                              <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                <span>→</span> {reservation.destination || 'Destino paquetería'}
                              </div>
                            </>
                          ) : (
                            <span>No disponible</span>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge className={reservation.paymentMethod === 'efectivo' 
                          ? 'bg-green-100 text-green-800 border-green-200' 
                          : 'bg-blue-100 text-blue-800 border-blue-200'}>
                          {reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {reservation.paymentNote || 
                            (reservation.advanceAmount && 
                             reservation.advanceAmount > 0 && 
                             reservation.totalAmount === reservation.advanceAmount 
                              ? 'Anticipo' 
                              : reservation.advanceAmount && 
                                reservation.advanceAmount > 0 && 
                                reservation.totalAmount > reservation.advanceAmount
                                ? 'Restante'
                                : 'Pago completo')}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-right font-medium">
                        {formatPrice(reservation.totalAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              
              {/* Sección de paqueterías */}
              {sortedPackages.length > 0 && (
                <div className="mt-8 border-t pt-8">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <Package className="h-5 w-5 text-primary mr-2" />
                    Paqueterías Registradas
                  </h3>
                  <Table>
                    <TableCaption>
                      {isAdminView 
                        ? 'Lista de paqueterías registradas por todos los usuarios de la empresa' 
                        : `Lista de paqueterías registradas por ${user?.firstName}`}
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID Paquetería</TableHead>
                        <TableHead>Remitente</TableHead>
                        <TableHead>Destinatario</TableHead>
                        <TableHead>Empresa</TableHead>
                        <TableHead>Ruta</TableHead>
                        <TableHead>Método</TableHead>
                        <TableHead>Concepto</TableHead>
                        <TableHead className="text-right">Monto</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedPackages.map((packageItem) => (
                        <TableRow key={`package-${packageItem.id}`}>
                          <TableCell className="font-medium">PKG{packageItem.id}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4 text-gray-500" />
                              <span className="font-medium">{packageItem.senderName || ''} {packageItem.senderLastName || ''}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <User className="h-4 w-4 text-gray-500" />
                              <span>{packageItem.recipientName || ''} {packageItem.recipientLastName || ''}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <span>
                                {packageItem.companyId === "bamo-936622" ? "BAMO" : 
                                 packageItem.companyInfo?.name || 'BAMO'}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {(() => {
                                // Usar tripId para obtener la ruta
                                if (packageItem.tripId) {
                                  const trip = allTrips?.find(t => t.id === packageItem.tripId);
                                  return trip?.route?.origin || packageItem.originCity || packageItem.origin || 'Sin especificar';
                                }
                                return packageItem.originCity || packageItem.origin || 'Sin especificar';
                              })()}
                            </div>
                            <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                              <span>→</span> {(() => {
                                if (packageItem.tripId) {
                                  const trip = allTrips?.find(t => t.id === packageItem.tripId);
                                  return trip?.route?.destination || packageItem.destinationCity || packageItem.destination || 'Sin especificar';
                                }
                                return packageItem.destinationCity || packageItem.destination || 'Sin especificar';
                              })()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={packageItem.paymentMethod === 'efectivo' 
                              ? 'bg-green-100 text-green-800 border-green-200' 
                              : 'bg-blue-100 text-blue-800 border-blue-200'}>
                              {packageItem.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              Paquetería
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatPrice(packageItem.totalAmount)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
      
      {/* Sección de Paqueterías */}
      <div className="my-6">
        <PackageList 
          packages={filteredPackages || []} 
          routeInfoMap={completeRoutes}
          isLoading={isLoading}
          sortDirection={sortDirection}
          userName={user?.firstName || ''}
        />
      </div>
      
      {/* Modal para mostrar el historial de cortes */}
      <Dialog open={showHistoryModal} onOpenChange={setShowHistoryModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Historial de Cortes de Caja</DialogTitle>
            <DialogDescription>
              Registro de todos los cortes de caja realizados
            </DialogDescription>
          </DialogHeader>
          
          {cutoffHistory.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-muted-foreground">No hay cortes de caja registrados</p>
            </div>
          ) : (
            <div className="space-y-6">
              {cutoffHistory.map((cutoff) => (
                <Card key={cutoff.id} className="bg-muted/20">
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">
                          Corte #{cutoff.id}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {new Date(cutoff.date).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">Usuario: {cutoff.user}</p>
                        <p className="text-sm text-muted-foreground">
                          {cutoff.transactionCount} transacciones
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="p-2 bg-primary/5 rounded">
                        <p className="text-sm font-medium">Total</p>
                        <p className="text-xl font-bold">${cutoff.totalAmount.toFixed(2)}</p>
                      </div>
                      <div className="p-2 bg-green-50 rounded">
                        <p className="text-sm font-medium">Efectivo</p>
                        <p className="text-xl font-bold text-green-700">${cutoff.totalCash.toFixed(2)}</p>
                      </div>
                      <div className="p-2 bg-blue-50 rounded">
                        <p className="text-sm font-medium">Transferencia</p>
                        <p className="text-xl font-bold text-blue-700">${cutoff.totalTransfer.toFixed(2)}</p>
                      </div>
                    </div>
                    
                    {cutoff.notes && (
                      <div className="mt-2 p-2 bg-yellow-50 rounded">
                        <p className="text-sm font-medium">Notas:</p>
                        <p className="text-sm">{cutoff.notes}</p>
                      </div>
                    )}
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-4"
                      onClick={async () => {
                        try {
                          // Cargar los detalles del corte desde la API
                          const response = await fetch(`/api/cutoffs/${cutoff.id}`);
                          if (!response.ok) {
                            throw new Error('No se pudieron cargar los detalles del corte');
                          }
                          
                          const cutoffDetails = await response.json();
                          console.log("Detalles del corte cargados:", cutoffDetails);
                          
                          // Procesar los ítems para extraer la información detallada almacenada en JSON
                          const transactionsDetailed = cutoffDetails.items.map((item: any) => {
                            try {
                              // Intentar parsear los detalles JSON
                              const details = item.details ? JSON.parse(item.details) : {};
                              
                              // Normalizar el método de pago para mostrar correctamente
                              let normalizedPaymentMethod = (item.paymentMethod || '').toLowerCase().trim();
                              if (normalizedPaymentMethod.includes('efectivo') || normalizedPaymentMethod === 'cash') {
                                normalizedPaymentMethod = 'efectivo';
                              } else if (normalizedPaymentMethod.includes('transfer')) {
                                normalizedPaymentMethod = 'transferencia';
                              }
                              
                              // Obtener información de viaje o paquetería
                              const tripInfo = details.tripInfo || {};
                              
                              // Aplicar la misma lógica que usamos en el console.log para determinar el origen/destino
                              let originDestInfo = {
                                origin: '',
                                destination: ''
                              };
                              
                              // Si hay información de segmentos específicos, la usamos
                              if (tripInfo.segmentOrigin && tripInfo.segmentDestination) {
                                originDestInfo = {
                                  origin: tripInfo.segmentOrigin,
                                  destination: tripInfo.segmentDestination
                                };
                              } 
                              // Si no hay segmentos pero hay información de ruta, usamos esa
                              else if (tripInfo.routeOrigin && tripInfo.routeDestination) {
                                originDestInfo = {
                                  origin: tripInfo.routeOrigin,
                                  destination: tripInfo.routeDestination
                                };
                              }
                              // Si no hay información de viaje pero sí de paquetería
                              else if (details.origin || details.destination) {
                                originDestInfo = {
                                  origin: details.origin || 'Origen no disponible',
                                  destination: details.destination || 'Destino no disponible'
                                };
                              }
                              
                              console.log(`Procesando ítem para PDF: ID=${item.itemId}, Método original=${item.paymentMethod}, Método normalizado=${normalizedPaymentMethod}`);
                              console.log(`Información de ruta procesada para PDF: Origen=${originDestInfo.origin}, Destino=${originDestInfo.destination}`);
                              
                              // Combinar los detalles con la información básica del item
                              return {
                                id: item.itemId,
                                type: item.itemType,
                                amount: item.amount,
                                paymentMethod: normalizedPaymentMethod,
                                paymentNote: item.concept,
                                
                                // Información detallada del JSON con origen/destino mejorados
                                tripName: details.tripName || '',
                                origin: originDestInfo.origin || details.origin || '',
                                destination: originDestInfo.destination || details.destination || '',
                                passengerCount: details.passengerCount || 0,
                                advanceAmount: details.advanceAmount || 0,
                                senderName: details.senderName || '',
                                senderLastName: details.senderLastName || '',
                                receiverName: details.receiverName || '',
                                receiverLastName: details.receiverLastName || '',
                                
                                // Fecha y hora
                                departureDate: details.departureDate || '',
                                departureTime: details.departureTime || '',
                                
                                // Otros detalles útiles
                                concept: details.concept || item.concept || '',
                                companyName: details.companyName || '',
                                passengers: details.passengers || []
                              };
                            } catch (e) {
                              console.error("Error al parsear detalles JSON:", e, item.details);
                              return {
                                id: item.itemId,
                                type: item.itemType,
                                amount: item.amount,
                                paymentMethod: item.paymentMethod,
                                paymentNote: item.concept
                              };
                            }
                          });
                          
                          // Recalcular los totales de efectivo y transferencia a partir de las transacciones detalladas
                          // para asegurar que los montos del PDF reflejen el mismo desglose que se muestra en el modal
                          const calculatedTotalCash = transactionsDetailed
                            .filter(t => t.paymentMethod === 'efectivo')
                            .reduce((sum, t) => sum + (t.amount || 0), 0);
                            
                          const calculatedTotalTransfer = transactionsDetailed
                            .filter(t => t.paymentMethod === 'transferencia')
                            .reduce((sum, t) => sum + (t.amount || 0), 0);
                            
                          console.log('Recalculando totales para PDF:', {
                            calculatedTotalCash,
                            calculatedTotalTransfer,
                            transactionsDetallesCount: transactionsDetailed.length
                          });
                            
                          // Usar la función de generación de PDF para el ticket con los totales recalculados
                          await generateCutoffTicketPDF({
                            totalAmount: cutoff.totalAmount,
                            // Usar los totales recalculados para asegurar consistencia
                            totalCash: calculatedTotalCash,
                            totalTransfer: calculatedTotalTransfer,
                            transactionCount: cutoff.transactionCount,
                            user: cutoff.user,
                            // Ahora incluimos las transacciones detalladas
                            transactions: transactionsDetailed
                          }, {
                            id: cutoff.id,
                            createdAt: cutoff.date,
                            notes: cutoff.notes
                          });
                          
                          toast({
                            title: "Éxito",
                            description: "Se ha generado el ticket en formato PDF.",
                          });
                        } catch (error) {
                          console.error("Error al generar el ticket PDF:", error);
                          toast({
                            title: "Error",
                            description: "No se pudo generar el ticket. Intente nuevamente.",
                            variant: "destructive"
                          });
                        }
                      }}
                    >
                      <Printer className="h-4 w-4 mr-2" />
                      Imprimir ticket
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHistoryModal(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}