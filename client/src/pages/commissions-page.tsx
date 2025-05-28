import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Loader2, AlertCircle, CalendarIcon, CheckCircle } from 'lucide-react';
import { format, parseISO, isAfter, isBefore, startOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { formatPrice } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';
import { useAuth } from '@/hooks/use-auth';
import { TabType } from '@/hooks/use-active-tab';
import { hasAccessToSection } from '@/lib/role-based-permissions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';

// Componente principal para la página de comisiones
// Tipo para la reserva
type Reservation = {
  id: number;
  totalAmount: number;
  paymentStatus: string;
  commissionPaid: boolean;
  createdByUser: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    commissionPercentage: number;
  };
  trip: {
    departureDate: string;
    departureTime: string;
    route: {
      name: string;
      origin: string;
      destination: string;
    };
  };
  passengers: any[];
};

// Tipo para usuario comisionista
type Commissioner = {
  id: number;
  name: string;
};

export default function CommissionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>("commissions");
  const [selectedReservations, setSelectedReservations] = useState<number[]>([]);
  const [selectedCommissioner, setSelectedCommissioner] = useState<string>("all");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentSummary, setPaymentSummary] = useState<{
    commissionerName: string;
    totalSales: number;
    totalCommission: number;
    reservationIds: number[];
  } | null>(null);
  const [, setLocation] = useLocation();

  // Consulta para obtener todas las reservaciones creadas por comisionistas
  const { data: commissionReservations, isLoading, error } = useQuery({
    queryKey: ['/api/commissions/reservations'],
    queryFn: async () => {
      const response = await fetch('/api/commissions/reservations');
      if (!response.ok) {
        throw new Error('Error al obtener reservaciones de comisionistas');
      }
      return response.json();
    },
  });
  
  // Mutación para marcar comisiones como pagadas
  const payCommissionMutation = useMutation({
    mutationFn: async (reservationIds: number[]) => {
      const response = await fetch('/api/commissions/pay', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reservationIds }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al marcar las comisiones como pagadas');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalidar la consulta para refrescar los datos
      queryClient.invalidateQueries({ queryKey: ['/api/commissions/reservations'] });
      
      // Mostrar mensaje de éxito
      toast({
        title: "Comisiones pagadas",
        description: "Las comisiones seleccionadas han sido marcadas como pagadas exitosamente.",
        variant: "default",
      });
      
      // Cerrar el diálogo y limpiar selecciones
      setShowPaymentDialog(false);
      setSelectedReservations([]);
    },
    onError: (error) => {
      // Mostrar mensaje de error
      toast({
        title: "Error al pagar comisiones",
        description: error instanceof Error ? error.message : "Ha ocurrido un error al procesar el pago de comisiones.",
        variant: "destructive",
      });
    }
  });

  // Función para ir a la página de detalles de reservación
  const goToReservationDetails = (reservationId: number) => {
    setLocation(`/reservation-details?id=${reservationId}`);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd MMMM yyyy', { locale: es });
  };

  // Maneja el cambio de pestaña en la navegación principal
  const handleTabChange = (tab: TabType) => {
    // En lugar de solo cambiar el estado local, redirigir a la URL correcta
    if (tab === "commissions") {
      // Si estamos ya en comisiones, no hacer nada
      return;
    }
    
    // Redirigir al dashboard con la pestaña seleccionada utilizando wouter
    setLocation(`/?tab=${tab}`);
  };

  // Verificar si el usuario tiene acceso a esta sección
  const canAccess = (sectionId: string): boolean => {
    if (!user) return false;
    return hasAccessToSection(user.role, sectionId);
  };

  // Lista de comisionistas únicos
  const commissioners: Commissioner[] = commissionReservations 
    ? Array.from(new Set((commissionReservations as Reservation[]).map(res => res.createdByUser.id)))
      .map((id) => {
        const commissioner = (commissionReservations as Reservation[]).find(res => res.createdByUser.id === id)?.createdByUser;
        return {
          id,
          name: commissioner ? `${commissioner.firstName} ${commissioner.lastName}` : 'Desconocido'
        };
      })
    : [];

  // Filtrar reservaciones
  const filteredReservations = commissionReservations 
    ? (commissionReservations as Reservation[]).filter((reservation) => {
        let matches = true;
        
        // Filtro por comisionista
        if (selectedCommissioner && selectedCommissioner !== 'all' && reservation.createdByUser) {
          matches = matches && reservation.createdByUser.id.toString() === selectedCommissioner;
        }
        
        // Filtro por fecha
        if (date) {
          const reservationDate = parseISO(reservation.trip.departureDate);
          const filterDate = startOfDay(date);
          matches = matches && 
            isBefore(filterDate, reservationDate) && 
            isAfter(filterDate, reservationDate);
        }
        
        return matches;
      })
    : [];

  // Manejar selección/deselección de reservación
  const toggleReservationSelection = (id: number, e: any) => {
    if (e && e.stopPropagation) {
      e.stopPropagation(); // Evitar que se propague al tr y navegue a detalles
    }
    setSelectedReservations(prev => 
      prev.includes(id) 
        ? prev.filter(resId => resId !== id) 
        : [...prev, id]
    );
  };

  // Manejar clic en "Pagar Comisiones"
  const handlePayCommissions = () => {
    if (selectedReservations.length === 0) return;
    
    const reservationsToProcess = filteredReservations.filter((res) => 
      selectedReservations.includes(res.id)
    );
    
    if (reservationsToProcess.length === 0) return;
    
    // Agrupar por comisionista
    const commissionerGroups: Record<string, Reservation[]> = {};
    reservationsToProcess.forEach(res => {
      const commissionerId = res.createdByUser.id.toString();
      if (!commissionerGroups[commissionerId]) {
        commissionerGroups[commissionerId] = [];
      }
      commissionerGroups[commissionerId].push(res);
    });
    
    // Verificar si hay más de un comisionista
    if (Object.keys(commissionerGroups).length > 1) {
      toast({
        title: "Error de selección",
        description: "Solo puedes pagar comisiones de un comisionista a la vez.",
        variant: "destructive",
      });
      return;
    }
    
    // Extraer datos para el resumen
    const commissionerId = Object.keys(commissionerGroups)[0];
    const reservations = commissionerGroups[commissionerId];
    const commissioner = reservations[0].createdByUser;
    const commissionRate = commissioner.commissionPercentage / 100;
    
    // Calcular totales
    const totalSales = reservations.reduce((sum, res) => sum + res.totalAmount, 0);
    const totalCommission = totalSales * commissionRate;
    
    // Preparar datos para el modal
    setPaymentSummary({
      commissionerName: `${commissioner.firstName} ${commissioner.lastName}`,
      totalSales,
      totalCommission,
      reservationIds: reservations.map(res => res.id),
    });
    
    // Mostrar modal
    setShowPaymentDialog(true);
  };

  // Manejar confirmación de pago
  const confirmPayment = () => {
    if (paymentSummary) {
      payCommissionMutation.mutate(paymentSummary.reservationIds);
    }
  };

  // Componente para el contenido de comisiones
  const CommissionsContent = () => {
    // Estado para las pestañas
    const [commissionTab, setCommissionTab] = useState("pendientes");

    // Filtrar las reservaciones según el estado de pago de comisión
    const pendingCommissions = filteredReservations.filter(res => !res.commissionPaid);
    const paidCommissions = filteredReservations.filter(res => res.commissionPaid);

    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Comisiones</h1>
        </div>

        <Card className="overflow-hidden">
          <div className="p-4 border-b">
            <h2 className="text-lg font-medium">Reservaciones por Comisionistas</h2>
            <p className="text-sm text-gray-500">Listado de reservaciones creadas por comisionistas.</p>
            <Separator className="my-4" />
          </div>

          {/* Filtros */}
          <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <Label htmlFor="commissioner-filter">Comisionista</Label>
              <Select
                value={selectedCommissioner}
                onValueChange={setSelectedCommissioner}
              >
                <SelectTrigger id="commissioner-filter">
                  <SelectValue placeholder="Seleccionar comisionista" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem key="all" value="all">Todos los comisionistas</SelectItem>
                  {commissioners.map((commissioner) => (
                    <SelectItem key={commissioner.id} value={commissioner.id.toString()}>
                      {commissioner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="date-filter">Fecha</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                    id="date-filter"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'PPP', { locale: es }) : <span>Seleccionar fecha</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                  />
                  {date && (
                    <div className="p-2 border-t">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full" 
                        onClick={() => setDate(undefined)}
                      >
                        Limpiar
                      </Button>
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>
            
            <div className="flex items-end">
              <Button 
                variant="default" 
                className="w-full" 
                onClick={handlePayCommissions}
                disabled={selectedReservations.length === 0 || commissionTab === "pagadas"}
              >
                Pagar Comisiones
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Cargando reservaciones...</span>
            </div>
          ) : error ? (
            <Alert variant="destructive" className="m-4">
              <AlertCircle className="h-4 w-4 mr-2" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error instanceof Error ? error.message : 'Error al cargar las reservaciones'}
              </AlertDescription>
            </Alert>
          ) : filteredReservations && filteredReservations.length > 0 ? (
            <Tabs defaultValue="pendientes" className="w-full" onValueChange={setCommissionTab}>
              <div className="px-4 py-2 border-b">
                <TabsList className="grid w-[400px] grid-cols-2">
                  <TabsTrigger value="pendientes">Pendientes por pagar</TabsTrigger>
                  <TabsTrigger value="pagadas">Pagadas</TabsTrigger>
                </TabsList>
              </div>
              
              <TabsContent value="pendientes" className="w-full">
                {pendingCommissions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Seleccionar
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reservación</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comisionista</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ruta</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pasajeros</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comisión</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comisión Pagada</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {pendingCommissions.map((reservation) => (
                          <tr
                            key={reservation.id}
                            className="hover:bg-gray-50"
                          >
                            <td className="px-2 py-4 whitespace-nowrap text-center">
                              <Checkbox 
                                checked={selectedReservations.includes(reservation.id)}
                                onCheckedChange={(checked) => toggleReservationSelection(reservation.id, null)}
                                disabled={reservation.commissionPaid}
                              />
                            </td>
                            <td 
                              className="px-6 py-4 whitespace-nowrap cursor-pointer"
                              onClick={() => goToReservationDetails(reservation.id)}
                            >
                              <div className="text-sm font-medium text-gray-900">#{reservation.id}</div>
                            </td>
                            <td 
                              className="px-6 py-4 whitespace-nowrap cursor-pointer"
                              onClick={() => goToReservationDetails(reservation.id)}
                            >
                              <div className="text-sm font-medium text-gray-900">
                                {reservation.createdByUser?.firstName} {reservation.createdByUser?.lastName}
                              </div>
                              <div className="text-xs text-gray-500">{reservation.createdByUser?.email}</div>
                            </td>
                            <td 
                              className="px-6 py-4 whitespace-nowrap cursor-pointer"
                              onClick={() => goToReservationDetails(reservation.id)}
                            >
                              <div className="text-sm text-gray-900">{reservation.trip.route.name}</div>
                              <div className="text-xs text-gray-500">{reservation.trip.route.origin} → {reservation.trip.route.destination}</div>
                            </td>
                            <td 
                              className="px-6 py-4 whitespace-nowrap cursor-pointer"
                              onClick={() => goToReservationDetails(reservation.id)}
                            >
                              <div className="text-sm text-gray-900">{formatDate(reservation.trip.departureDate)}</div>
                              <div className="text-xs text-gray-500">{reservation.trip.departureTime}</div>
                            </td>
                            <td 
                              className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                              onClick={() => goToReservationDetails(reservation.id)}
                            >
                              {reservation.passengers.length}
                            </td>
                            <td 
                              className="px-6 py-4 whitespace-nowrap cursor-pointer"
                              onClick={() => goToReservationDetails(reservation.id)}
                            >
                              <div className="text-sm font-medium">{formatPrice(reservation.totalAmount)}</div>
                            </td>
                            <td 
                              className="px-6 py-4 whitespace-nowrap cursor-pointer"
                              onClick={() => goToReservationDetails(reservation.id)}
                            >
                              {reservation.createdByUser?.commissionPercentage ? (
                                <div className="text-sm font-medium text-primary">
                                  {formatPrice(reservation.totalAmount * (reservation.createdByUser.commissionPercentage / 100))}
                                  <span className="text-xs text-gray-500 ml-1">({reservation.createdByUser.commissionPercentage}%)</span>
                                </div>
                              ) : (
                                <div className="text-xs text-gray-500">No configurada</div>
                              )}
                            </td>
                            <td 
                              className="px-6 py-4 whitespace-nowrap cursor-pointer"
                              onClick={() => goToReservationDetails(reservation.id)}
                            >
                              <Badge 
                                variant={reservation.paymentStatus === 'pagado' ? "outline" : "secondary"}
                                className={reservation.paymentStatus === 'pagado' 
                                  ? "bg-green-100 text-green-800 border-green-200" 
                                  : "bg-amber-100 text-amber-800 border-amber-200"}
                              >
                                {reservation.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
                              </Badge>
                            </td>
                            <td 
                              className="px-6 py-4 whitespace-nowrap cursor-pointer"
                              onClick={() => goToReservationDetails(reservation.id)}
                            >
                              <Badge 
                                variant="outline"
                                className="bg-gray-100 text-gray-800 border-gray-200"
                              >
                                NO PAGADA
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center p-8 text-gray-500">
                    No hay comisiones pendientes por pagar.
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="pagadas" className="w-full">
                {paidCommissions.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-2 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Estado
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reservación</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comisionista</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ruta</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pasajeros</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comisión</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado Pago</th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Comisión Pagada</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {paidCommissions.map((reservation) => (
                          <tr
                            key={reservation.id}
                            className="hover:bg-gray-50"
                          >
                            <td className="px-2 py-4 whitespace-nowrap text-center">
                              <CheckCircle className="h-5 w-5 text-green-600 mx-auto" />
                            </td>
                            <td 
                              className="px-6 py-4 whitespace-nowrap cursor-pointer"
                              onClick={() => goToReservationDetails(reservation.id)}
                            >
                              <div className="text-sm font-medium text-gray-900">#{reservation.id}</div>
                            </td>
                            <td 
                              className="px-6 py-4 whitespace-nowrap cursor-pointer"
                              onClick={() => goToReservationDetails(reservation.id)}
                            >
                              <div className="text-sm font-medium text-gray-900">
                                {reservation.createdByUser?.firstName} {reservation.createdByUser?.lastName}
                              </div>
                              <div className="text-xs text-gray-500">{reservation.createdByUser?.email}</div>
                            </td>
                            <td 
                              className="px-6 py-4 whitespace-nowrap cursor-pointer"
                              onClick={() => goToReservationDetails(reservation.id)}
                            >
                              <div className="text-sm text-gray-900">{reservation.trip.route.name}</div>
                              <div className="text-xs text-gray-500">{reservation.trip.route.origin} → {reservation.trip.route.destination}</div>
                            </td>
                            <td 
                              className="px-6 py-4 whitespace-nowrap cursor-pointer"
                              onClick={() => goToReservationDetails(reservation.id)}
                            >
                              <div className="text-sm text-gray-900">{formatDate(reservation.trip.departureDate)}</div>
                              <div className="text-xs text-gray-500">{reservation.trip.departureTime}</div>
                            </td>
                            <td 
                              className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 cursor-pointer"
                              onClick={() => goToReservationDetails(reservation.id)}
                            >
                              {reservation.passengers.length}
                            </td>
                            <td 
                              className="px-6 py-4 whitespace-nowrap cursor-pointer"
                              onClick={() => goToReservationDetails(reservation.id)}
                            >
                              <div className="text-sm font-medium">{formatPrice(reservation.totalAmount)}</div>
                            </td>
                            <td 
                              className="px-6 py-4 whitespace-nowrap cursor-pointer"
                              onClick={() => goToReservationDetails(reservation.id)}
                            >
                              {reservation.createdByUser?.commissionPercentage ? (
                                <div className="text-sm font-medium text-primary">
                                  {formatPrice(reservation.totalAmount * (reservation.createdByUser.commissionPercentage / 100))}
                                  <span className="text-xs text-gray-500 ml-1">({reservation.createdByUser.commissionPercentage}%)</span>
                                </div>
                              ) : (
                                <div className="text-xs text-gray-500">No configurada</div>
                              )}
                            </td>
                            <td 
                              className="px-6 py-4 whitespace-nowrap cursor-pointer"
                              onClick={() => goToReservationDetails(reservation.id)}
                            >
                              <Badge 
                                variant={reservation.paymentStatus === 'pagado' ? "outline" : "secondary"}
                                className={reservation.paymentStatus === 'pagado' 
                                  ? "bg-green-100 text-green-800 border-green-200" 
                                  : "bg-amber-100 text-amber-800 border-amber-200"}
                              >
                                {reservation.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
                              </Badge>
                            </td>
                            <td 
                              className="px-6 py-4 whitespace-nowrap cursor-pointer"
                              onClick={() => goToReservationDetails(reservation.id)}
                            >
                              <Badge 
                                variant="outline"
                                className="bg-green-100 text-green-800 border-green-200"
                              >
                                PAGADA
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center p-8 text-gray-500">
                    No hay comisiones pagadas.
                  </div>
                )}
              </TabsContent>
            </Tabs>
          ) : (
            <div className="text-center p-8 text-gray-500">
              No hay reservaciones de comisionistas disponibles.
            </div>
          )}
        </Card>

        {/* Modal de pago de comisiones */}
        <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirmar Pago de Comisiones</DialogTitle>
              <DialogDescription>
                Por favor verifica la información antes de confirmar el pago.
              </DialogDescription>
            </DialogHeader>
            
            {paymentSummary && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <div className="font-semibold">Comisionista:</div>
                  <div>{paymentSummary.commissionerName}</div>
                </div>
                
                <div className="space-y-2">
                  <div className="font-semibold">Total de Ventas:</div>
                  <div className="text-lg">{formatPrice(paymentSummary.totalSales)}</div>
                </div>
                
                <div className="space-y-2">
                  <div className="font-semibold">Comisión a Pagar:</div>
                  <div className="text-lg font-bold text-primary">{formatPrice(paymentSummary.totalCommission)}</div>
                </div>
                
                <div className="text-sm text-gray-500 mt-2">
                  Al confirmar, {paymentSummary.reservationIds.length} reservacion(es) serán marcadas como pagadas.
                </div>
              </div>
            )}
            
            <DialogFooter className="flex items-center justify-between sm:justify-between">
              <Button type="button" variant="secondary" onClick={() => setShowPaymentDialog(false)}>
                Cancelar
              </Button>
              <Button 
                onClick={confirmPayment}
                disabled={payCommissionMutation.isPending}
                className="gap-2"
              >
                {payCommissionMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Confirmar Pago
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

  // Si el usuario no tiene acceso, mostrar mensaje de acceso denegado
  if (!canAccess("commissions")) {
    return (
      <div className="flex h-screen overflow-hidden">
        <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
        
        <div className="flex flex-col flex-1 w-0 overflow-hidden">
          <Topbar />
          
          <div className="flex-1 overflow-auto focus:outline-none">
            <main className="relative z-0 flex-1 overflow-y-auto py-6 px-4 sm:px-6 lg:px-8">
              <Alert variant="destructive" className="mb-6">
                <AlertCircle className="h-4 w-4 mr-2" />
                <AlertTitle>Acceso Denegado</AlertTitle>
                <AlertDescription>
                  No tienes permisos para acceder a esta sección. Contacta al administrador si crees que deberías tener acceso.
                </AlertDescription>
              </Alert>
            </main>
          </div>
        </div>
      </div>
    );
  }

  // Layout para usuarios con acceso
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeTab={activeTab} onTabChange={handleTabChange} />
      
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <Topbar />
        
        <div className="flex-1 overflow-auto focus:outline-none">
          <main className="relative z-0 flex-1 overflow-y-auto">
            <CommissionsContent />
          </main>
        </div>
      </div>
    </div>
  );
}