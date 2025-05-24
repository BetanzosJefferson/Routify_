import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatDate, formatPrice } from "@/lib/utils";
import { ReservationWithDetails } from "@shared/schema";
import { jsPDF } from "jspdf";
import QRCode from "qrcode";
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
  XCircle
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
  const isAdminView = user?.role === 'dueño' || user?.role === 'administrador';
  const isTicketOfficeView = user?.role === 'taquilla';
  
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

  // Obtener las reservaciones marcadas como pagadas por el usuario actual
  const { 
    data: paidReservations, 
    isLoading,
    error
  } = useQuery({
    queryKey: ["/api/cashbox/transactions"],
    queryFn: async () => {
      if (!user) return null;
      
      const response = await fetch('/api/cashbox/transactions');
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
      if (!storedProcessedItems) return false;

      const processedItems = JSON.parse(storedProcessedItems);
      // Verificar si este elemento específico ya está en la lista de procesados
      return processedItems.some((item: any) => 
        item.type === itemType && item.id === itemId
      );
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
  
  // Filtrar y enriquecer paqueterías
  const filteredPackages = paidReservations?.filter((reservation: ReservationWithCompany) => {
    // Solo incluir paqueterías en esta lista
    if (!reservation.originalPackageId) {
      return false;
    }
    
    // No incluir elementos ya procesados en cortes anteriores
    if (isItemProcessed('package', reservation.id)) {
      return false;
    }
    
    // Aplicar filtro de búsqueda
    let matchesSearch = true;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const routeName = reservation.trip?.route?.name?.toLowerCase() || '';
      const senderName = (reservation.senderName || '').toLowerCase();
      const receiverName = (reservation.receiverName || '').toLowerCase();
      const packageId = `RES${reservation.id}`.toLowerCase();
      
      matchesSearch = (
        routeName.includes(searchLower) ||
        senderName.includes(searchLower) ||
        receiverName.includes(searchLower) ||
        packageId.includes(searchLower)
      );
    }
    
    // Aplicar filtro de fecha (misma lógica que para reservaciones)
    let matchesDate = true;
    if (dateFilter) {
      const packageDate = new Date(reservation.paymentDate || reservation.markedAsPaidAt || reservation.paidAt || reservation.createdAt || '');
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
      matchesPaymentMethod = reservation.paymentMethod === paymentMethodFilter;
    }
    
    // Aplicar filtro de empresa (solo para taquilleros)
    let matchesCompany = true;
    if (isTicketOfficeView && companyFilter !== 'todas') {
      matchesCompany = reservation.companyInfo?.id === companyFilter;
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
      
      // Refrescar los datos para asegurarnos de tener todas las transacciones actualizadas
      await queryClient.invalidateQueries({ queryKey: ["/api/cashbox/transactions"] });
      
      // Esperar un momento para que la consulta se complete
      await new Promise(resolve => setTimeout(resolve, 500));
      
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
      
      // Preparar los datos para el modal - incluimos tanto reservaciones como paqueterías
      const cutoffSummary = {
        date: new Date().toLocaleString(),
        user: `${user.firstName} ${user.lastName}`,
        totalAmount, // El total ya incluye reservaciones y paqueterías
        totalCash,
        totalTransfer,
        transactionCount: sortedReservations.length + sortedPackages.length, // Total de transacciones
        transactions: [
          // Reservaciones
          ...sortedReservations.map(r => ({
            id: r.id,
            type: 'reservation',
            tripName: r.trip?.route?.name || "Sin ruta",
            passengers: r.passengers?.map(p => `${p.firstName} ${p.lastName}`).join(", ") || "Sin pasajeros",
            amount: r.totalAmount || 0,
            paymentMethod: getCombinedPaymentMethod(r)
          })),
          // Paqueterías
          ...sortedPackages.map(p => ({
            id: p.id,
            type: 'package',
            tripName: p.trip?.route?.name || "Sin ruta",
            sender: `${p.senderName || ''} ${p.senderLastName || ''}`,
            recipient: `${p.recipientName || ''} ${p.recipientLastName || ''}`,
            amount: p.price || 0,
            paymentMethod: p.paymentMethod || 'efectivo'
          }))
        ]
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
        items: cutoffData.transactions.map(item => ({
          ...item,
          // Asegurarse de que cada elemento tenga el tipo correcto
          type: item.originalPackageId ? 'package' : 'reservation'
        }))
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
      // Crear un nuevo documento PDF con dimensiones 60mm x altura variable
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [58, 160], // 58mm (ancho estándar para tickets de 60mm) x 160mm de alto
      });
      
      // Configuración básica
      doc.setFont("courier", "normal");
      
      // Variables para posición vertical
      let y = 5;
      const margin = 5;
      
      // Encabezado
      doc.setFontSize(10);
      doc.setFont("courier", "bold");
      
      // Centrar el texto del encabezado
      doc.text("AUTOBUSES VIAJEROS", 29, y, { align: "center" });
      y += 4;
      
      doc.setFontSize(8);
      doc.text(`CORTE DE CAJA #${cutoffInfo.id}`, 29, y, { align: "center" });
      y += 3;
      
      // Añadir fecha 
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
      
      // Línea separadora
      y += 2;
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
      
      // Detalles de las transacciones
      if (data.transactions && data.transactions.length > 0) {
        doc.setFontSize(7);
        doc.setFont("courier", "bold");
        doc.text("DETALLE DE TRANSACCIONES:", margin, y);
        y += 3;
        
        // Mostrar solo las primeras 10 transacciones
        const limitedTransactions = data.transactions.slice(0, 10);
        
        doc.setFont("courier", "normal");
        limitedTransactions.forEach((t: any) => {
          // Limitar longitud del nombre
          const tripName = t.tripName ? 
            (t.tripName.length > 18 ? t.tripName.substring(0, 15) + '...' : t.tripName) : 
            'Sin nombre';
          
          doc.text(`#${t.id} - ${tripName}`, margin, y);
          y += 2.5;
          doc.text(`${formatPrice(t.amount)} - ${t.paymentMethod}`, margin + 2, y);
          y += 3;
        });
        
        // Si hay más transacciones
        if (data.transactions.length > 10) {
          y += 1;
          doc.text(`... y ${data.transactions.length - 10} transacciones más`, margin, y);
          y += 3;
        }
      }
      
      // Línea final
      y += 2;
      doc.line(margin, y, 53, y);
      y += 4;
      
      // Pie de página
      doc.setFontSize(8);
      doc.text("¡GRACIAS POR SU SERVICIO!", 29, y, { align: "center" });
      y += 3;
      doc.setFontSize(6);
      doc.text("www.autobusesviajeros.com", 29, y, { align: "center" });
      
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
                    <p className="text-xs text-muted-foreground">Total</p>
                    <p className="font-medium text-primary">{formatPrice(cutoffData.totalAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Transacciones</p>
                    <p className="font-medium">{cutoffData.transactionCount}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Efectivo</p>
                    <p className="font-medium text-green-600">{formatPrice(cutoffData.totalCash)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Transferencia</p>
                    <p className="font-medium text-blue-600">{formatPrice(cutoffData.totalTransfer)}</p>
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
                      <p><span className="font-medium">Ruta:</span> {t.tripName}</p>
                      <p><span className="font-medium">Monto:</span> {formatPrice(t.amount)}</p>
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
                        {reservation.trip ? (
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
                        )}
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
                <div className="mt-8">
                  <h3 className="text-lg font-semibold mb-4">Pagos de Paqueterías</h3>
                  <Table>
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
                          <TableCell className="font-medium">RES{packageItem.id}</TableCell>
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
                          // Usar la función de generación de PDF para el ticket
                          await generateCutoffTicketPDF({
                            totalAmount: cutoff.totalAmount,
                            totalCash: cutoff.totalCash,
                            totalTransfer: cutoff.totalTransfer,
                            transactionCount: cutoff.transactionCount,
                            user: cutoff.user,
                            // Los tickets históricos no tienen transacciones detalladas
                            transactions: []
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