import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { formatDate, formatPrice } from "@/lib/utils";
import { ReservationWithDetails } from "@shared/schema";
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
  
  // Filtrar las reservaciones
  const filteredReservations = paidReservations?.filter((reservation: ReservationWithCompany) => {
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
  
  // Calcular totales - Ahora usamos directamente el monto mostrado para cada ítem
  const totalAmount = sortedReservations.reduce((sum, reservation) => sum + (reservation.totalAmount || 0), 0);
  
  // Calcular efectivo y transferencia basado en los métodos de pago de los ítems
  const totalCash = sortedReservations
    .filter(r => r.paymentMethod === 'efectivo')
    .reduce((sum, r) => sum + (r.totalAmount || 0), 0);
    
  const totalTransfer = sortedReservations
    .filter(r => r.paymentMethod === 'transferencia')
    .reduce((sum, r) => sum + (r.totalAmount || 0), 0);
  
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
      
      // Preparar los datos para el modal
      const cutoffSummary = {
        date: new Date().toLocaleString(),
        user: `${user.firstName} ${user.lastName}`,
        totalAmount,
        totalCash,
        totalTransfer,
        transactionCount: sortedReservations.length,
        transactions: sortedReservations.map(r => ({
          id: r.id,
          tripName: r.trip?.route?.name || "Sin ruta",
          passengers: r.passengers?.map(p => `${p.firstName} ${p.lastName}`).join(", ") || "Sin pasajeros",
          amount: r.totalAmount || 0,
          paymentMethod: getCombinedPaymentMethod(r)
        }))
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
  
  // Función para completar el corte de caja
  const completeCashboxCutoff = async () => {
    if (!user || !cutoffData) return;
    
    try {
      setIsLoadingCutoff(true);
      
      // Realizar la petición al servidor para guardar el corte
      const response = await fetch('/api/cashbox/cutoff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notes: cutoffNotes
        })
      });
      
      if (!response.ok) {
        throw new Error(await response.text());
      }
      
      const result = await response.json();
      
      // Si el servidor responde con éxito
      if (result.success) {
        toast({
          title: "Corte realizado",
          description: `Se ha realizado el corte de caja correctamente.`,
        });
        
        // Imprimir el ticket
        printCutoffTicket(cutoffData, result.cutoff);
        
        // Limpiar los estados
        setCutoffData(null);
        setCutoffNotes("");
        setShowCutoffModal(false);
        
        // Refrescar los datos
        queryClient.invalidateQueries({ queryKey: ["/api/cash-register"] });
      } else {
        throw new Error(result.message || "Error al realizar el corte");
      }
    } catch (error) {
      console.error("Error al realizar el corte:", error);
      toast({
        title: "Error",
        description: typeof error === 'object' && error !== null && 'message' in error ? 
          String(error.message) : "No se pudo realizar el corte de caja. Inténtalo de nuevo.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingCutoff(false);
    }
  };
  
  // Función para imprimir el ticket de corte
  const printCutoffTicket = (data: any, cutoffInfo: any) => {
    try {
      // Crear contenido del ticket (formato 60mm)
      const ticketContent = document.createElement('div');
      ticketContent.style.width = '220px'; // 60mm aproximadamente
      ticketContent.style.fontFamily = 'monospace';
      ticketContent.style.fontSize = '10px';
      ticketContent.style.padding = '5px';
      
      // Información de la empresa y corte
      ticketContent.innerHTML = `
        <div style="text-align:center;margin-bottom:10px;">
          <h3 style="margin:3px 0;font-size:12px;">AUTOBUSES VIAJEROS</h3>
          <p style="margin:3px 0;">CORTE DE CAJA #${cutoffInfo.id}</p>
          <p style="margin:3px 0;">FECHA: ${new Date(cutoffInfo.createdAt).toLocaleString()}</p>
          <p style="margin:3px 0;">USUARIO: ${data.user}</p>
        </div>
        <div style="border-top:1px dashed #000;border-bottom:1px dashed #000;padding:5px 0;margin:5px 0;">
          <p style="margin:3px 0;"><strong>TOTAL:</strong> ${formatPrice(data.totalAmount)}</p>
          <p style="margin:3px 0;"><strong>EFECTIVO:</strong> ${formatPrice(data.totalCash)}</p>
          <p style="margin:3px 0;"><strong>TRANSFERENCIA:</strong> ${formatPrice(data.totalTransfer)}</p>
          <p style="margin:3px 0;"><strong>TRANSACCIONES:</strong> ${data.transactionCount}</p>
        </div>
        <div style="margin-top:10px;">
          <p style="margin:3px 0;font-size:9px;"><strong>DETALLE DE TRANSACCIONES:</strong></p>
      `;
      
      // Recorrer las transacciones (limitado a 10 para que no sea muy largo)
      const limitedTransactions = data.transactions.slice(0, 10);
      limitedTransactions.forEach((t: any, index: number) => {
        ticketContent.innerHTML += `
          <div style="font-size:8px;margin:3px 0;border-bottom:1px dotted #ccc;padding-bottom:3px;">
            <span>#${t.id} - ${t.tripName.substring(0, 15)}${t.tripName.length > 15 ? '...' : ''}</span><br>
            <span>${formatPrice(t.amount)} - ${t.paymentMethod}</span>
          </div>
        `;
      });
      
      // Si hay más transacciones, mostrar un mensaje
      if (data.transactions.length > 10) {
        ticketContent.innerHTML += `
          <p style="font-size:8px;text-align:center;margin:5px 0;">
            ... y ${data.transactions.length - 10} transacciones más
          </p>
        `;
      }
      
      // Añadir notas si existen
      if (cutoffNotes) {
        ticketContent.innerHTML += `
          <div style="margin-top:10px;border-top:1px dashed #000;padding-top:5px;">
            <p style="margin:3px 0;font-size:9px;"><strong>NOTAS:</strong></p>
            <p style="margin:3px 0;font-size:8px;">${cutoffNotes}</p>
          </div>
        `;
      }
      
      // Cierre del ticket
      ticketContent.innerHTML += `
        </div>
        <div style="text-align:center;margin-top:20px;border-top:1px dashed #000;padding-top:10px;">
          <p style="margin:3px 0;">¡GRACIAS POR SU SERVICIO!</p>
          <p style="margin:3px 0;font-size:8px;">www.autobusesviajeros.com</p>
        </div>
      `;
      
      // Crear una ventana para imprimir
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        toast({
          title: "Error",
          description: "No se pudo abrir la ventana de impresión. Comprueba que no estén bloqueados los popups.",
          variant: "destructive"
        });
        return;
      }
      
      printWindow.document.write(`
        <html>
          <head>
            <title>Corte de Caja #${cutoffInfo.id}</title>
            <style>
              @media print {
                body { margin: 0; padding: 0; }
                @page { size: 80mm auto; margin: 0; }
              }
            </style>
          </head>
          <body>
            ${ticketContent.outerHTML}
            <script>
              window.onload = function() {
                window.print();
                setTimeout(function() { window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `);
      
      printWindow.document.close();
    } catch (error) {
      console.error("Error al imprimir ticket:", error);
      toast({
        title: "Error de impresión",
        description: "No se pudo imprimir el ticket. Intenta de nuevo o imprime manualmente.",
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
                                <span>{reservation.passengers[0]?.firstName} {reservation.passengers[0]?.lastName}</span>
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
                    <TableHead>Fecha de pago</TableHead>
                    {isAdminView && <TableHead>Cobrado por</TableHead>}
                    {isAdminView && <TableHead>Registrado por</TableHead>}
                    <TableHead className="text-right">Monto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedReservations.map((reservation) => (
                    <TableRow key={reservation.id}>
                      <TableCell className="font-medium">RES{reservation.id}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <User className="h-4 w-4 text-gray-500" />
                          <span>{reservation.passengers[0]?.firstName} {reservation.passengers[0]?.lastName}</span>
                        </div>
                        {reservation.passengers.length > 1 && (
                          <div className="text-xs text-gray-500 ml-5 mt-1">
                            +{reservation.passengers.length - 1} pasajeros más
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span>{reservation.companyInfo?.name || reservation.trip.route.companyId || 'No disponible'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">
                          {reservation.trip.segmentOrigin || reservation.trip.route.origin}
                        </div>
                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <span>→</span> {reservation.trip.segmentDestination || reservation.trip.route.destination}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={reservation.paymentMethod === 'efectivo' 
                          ? 'bg-green-100 text-green-800 border-green-200' 
                          : 'bg-blue-100 text-blue-800 border-blue-200'}>
                          {reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span>{formatDate(reservation.markedAsPaidAt)}</span>
                        </div>
                      </TableCell>
                      {isAdminView && (
                        <TableCell>
                          {reservation.paidByUserInfo ? (
                            <div className="flex flex-col">
                              <span className="font-medium">{reservation.paidByUserInfo.firstName} {reservation.paidByUserInfo.lastName}</span>
                              <span className="text-xs text-gray-500 capitalize">{reservation.paidByUserInfo.role}</span>
                            </div>
                          ) : (
                            <span className="text-gray-500">Usuario desconocido</span>
                          )}
                        </TableCell>
                      )}
                      {isAdminView && (
                        <TableCell>
                          {reservation.createdByUser ? (
                            <div className="flex flex-col">
                              <span className="font-medium">{reservation.createdByUser.firstName} {reservation.createdByUser.lastName}</span>
                              <span className="text-xs text-gray-500 capitalize">{reservation.createdByUser.role}</span>
                            </div>
                          ) : (
                            <span className="text-gray-500">Usuario desconocido</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="text-right font-medium">
                        {formatPrice(reservation.totalAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}