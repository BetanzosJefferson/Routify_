import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
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
  FilterIcon
} from "lucide-react";

// Interfaz para las reservaciones con información de compañía
interface ReservationWithCompany extends ReservationWithDetails {
  companyInfo?: {
    id: string;
    name: string;
  }
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

export function CashRegisterPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("todos"); // Valor por defecto
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  
  // Estados adicionales para mejorar la UX
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showLoadingDelay, setShowLoadingDelay] = useState(false);
  
  // Estado para saber si estamos en modo administrador o taquillero
  const isAdminView = user?.role === 'dueño' || user?.role === 'administrador';
  const isTicketOfficeView = user?.role === 'taquilla';
  
  // Obtener las reservaciones marcadas como pagadas por el usuario actual
  const { 
    data: paidReservations, 
    isLoading,
    error
  } = useQuery({
    queryKey: ["/api/cash-register"],
    queryFn: async () => {
      if (!user) return null;
      
      const response = await fetch('/api/cash-register');
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
      const reservationId = `RES${reservation.id}`.toLowerCase();
      
      matchesSearch = (
        routeName.includes(searchLower) ||
        passengerNames.includes(searchLower) ||
        email.includes(searchLower) ||
        phone.includes(searchLower) ||
        reservationId.includes(searchLower)
      );
    }
    
    // Aplicar filtro de fecha
    let matchesDate = true;
    if (dateFilter) {
      const reservationDate = new Date(reservation.markedAsPaidAt || '');
      const filterDate = new Date(dateFilter);
      
      matchesDate = (
        reservationDate.getFullYear() === filterDate.getFullYear() &&
        reservationDate.getMonth() === filterDate.getMonth() &&
        reservationDate.getDate() === filterDate.getDate()
      );
    }
    
    // Aplicar filtro de método de pago
    let matchesPaymentMethod = true;
    if (paymentMethodFilter && paymentMethodFilter !== 'todos') {
      // Verificar si el pago fue con anticipio o pago completo
      if (reservation.advanceAmount && reservation.advanceAmount > 0) {
        // Si hay anticipo, verificar ambos métodos
        matchesPaymentMethod = (
          (paymentMethodFilter === 'efectivo' && 
           (reservation.advancePaymentMethod === 'efectivo' || reservation.paymentMethod === 'efectivo')) ||
          (paymentMethodFilter === 'transferencia' && 
           (reservation.advancePaymentMethod === 'transferencia' || reservation.paymentMethod === 'transferencia'))
        );
      } else {
        // Solo verificar el método principal
        matchesPaymentMethod = reservation.paymentMethod === paymentMethodFilter;
      }
    }
    
    return matchesSearch && matchesDate && matchesPaymentMethod;
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
    ? sortedReservations.reduce<Record<string, { name: string, reservations: ReservationWithCompany[] }>>((groups, reservation) => {
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
  
  // Calcular totales
  const totalAmount = sortedReservations.reduce((sum, reservation) => sum + (reservation.totalAmount || 0), 0);
  const totalCash = sortedReservations
    .filter(r => (r.advancePaymentMethod === 'efectivo' || r.paymentMethod === 'efectivo'))
    .reduce((sum, r) => {
      // Si tiene anticipo en efectivo, sumarlo
      let cashAmount = 0;
      if (r.advancePaymentMethod === 'efectivo') {
        cashAmount += r.advanceAmount || 0;
      }
      // Si el pago restante es en efectivo, sumarlo
      if (r.paymentMethod === 'efectivo') {
        cashAmount += (r.totalAmount || 0) - (r.advanceAmount || 0);
      }
      return sum + cashAmount;
    }, 0);
  const totalTransfer = totalAmount - totalCash;
  
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
  
  return (
    <div className="py-6">
      <div className="flex items-center mb-4">
        <div className="rounded-full bg-primary bg-opacity-10 p-2 mr-3">
          <DollarSign className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800">Caja</h2>
      </div>
      
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            </div>
            
            {/* Resumen de caja */}
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
            Mostrando {sortedReservations.length} pagos registrados
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
          ) : ((isTicketOfficeView ? Object.keys(reservationsByCompany).length : sortedReservations.length) === 0) ? (
            <div className="text-center p-10 bg-gray-50 rounded-lg">
              <FilterIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-gray-600">No hay pagos registrados</h3>
              <p className="text-gray-500 mt-1">
                {searchTerm || dateFilter || paymentMethodFilter
                  ? "No se encontraron pagos con los filtros aplicados."
                  : "Todavía no has marcado ninguna reservación como pagada."}
              </p>
            </div>
          ) : isTicketOfficeView ? (
            <div className="space-y-8">
              {Object.entries(reservationsByCompany).map(([companyId, companyData]) => (
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
                          <TableHead>Fecha de pago</TableHead>
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
                              {reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                              {reservation.advancePaymentMethod && (
                                <span className="text-xs text-gray-500 block">
                                  Anticipo: {reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4 text-gray-500" />
                                <span>{formatDate(reservation.markedAsPaidAt)}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{formatPrice(reservation.totalAmount || 0)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              ))}
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