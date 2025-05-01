import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatPrice, generateReservationId, normalizeToStartOfDay, isSameLocalDay } from "@/lib/utils";
import { 
  UserIcon, 
  SearchIcon, 
  Loader2Icon, 
  XIcon, 
  PhoneIcon, 
  MailIcon, 
  CalendarIcon, 
  ArchiveIcon,
  FilterIcon
} from "lucide-react";
import { useReservations } from "@/hooks/use-reservations";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Reservation, ReservationWithDetails } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ReservationList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null);
  const [editingReservation, setEditingReservation] = useState<ReservationWithDetails | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [notes, setNotes] = useState<string>("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // Por defecto mostramos las reservaciones actuales/futuras
  const [activeTab, setActiveTab] = useState("upcoming");
  
  // Estados adicionales para mejorar la UX
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showLoadingDelay, setShowLoadingDelay] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Utilizar el nuevo hook especializado para cargar reservaciones de forma independiente
  const { 
    data: reservations, 
    isLoading,
    error: reservationsError
  } = useReservations();

  // Actualizar estados de UI basados en el estado de carga
  useEffect(() => {
    if (isLoading) {
      const loadingTimeout = setTimeout(() => setShowLoadingDelay(true), 500);
      return () => clearTimeout(loadingTimeout);
    } else {
      setIsInitialLoad(false);
      setHasError(!!reservationsError);
    }
  }, [isLoading, reservationsError]);
  
  // Ahora usamos funciones inline para manejar las comparaciones de fechas
  
  // Separar reservaciones en actuales y archivadas usando nuestras funciones de utilidad
  const upcomingReservations = reservations?.filter(
    (reservation) => {
      // Usar normalizeToStartOfDay para obtener la fecha normalizada del viaje
      const tripDate = normalizeToStartOfDay(reservation.trip.departureDate);
      // Normalizar la fecha actual también para hacer una comparación correcta
      const today = normalizeToStartOfDay(new Date());
      return tripDate >= today;
    }
  ) || [];
  
  const archivedReservations = reservations?.filter(
    (reservation) => {
      // Usar normalizeToStartOfDay para obtener la fecha normalizada del viaje
      const tripDate = normalizeToStartOfDay(reservation.trip.departureDate);
      // Normalizar la fecha actual también para hacer una comparación correcta
      const today = normalizeToStartOfDay(new Date());
      return tripDate < today;
    }
  ) || [];
  
  // Obtener las reservaciones según la pestaña activa
  const activeReservations = activeTab === "upcoming" ? upcomingReservations : archivedReservations;
  
  // Filter reservations based on search term and date filter
  const filteredReservations = activeReservations.filter((reservation) => {
    // Aplicar filtro de búsqueda
    let matchesSearch = true;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const routeName = reservation.trip.route.name.toLowerCase();
      const passengerNames = reservation.passengers.map(
        p => `${p.firstName} ${p.lastName}`.toLowerCase()
      ).join(" ");
      const email = (reservation.email || '').toLowerCase();
      const phone = (reservation.phone || '').toLowerCase();
      
      matchesSearch = (
        routeName.includes(searchLower) ||
        passengerNames.includes(searchLower) ||
        email.includes(searchLower) ||
        phone.includes(searchLower)
      );
    }
    
    // Aplicar filtro de fecha usando nuestras utilidades de normalización
    let matchesDate = true;
    if (dateFilter) {
      // Usar isSameLocalDay para comparar las fechas
      const tripDate = normalizeToStartOfDay(reservation.trip.departureDate);
      const filterDate = normalizeToStartOfDay(dateFilter);
      matchesDate = isSameLocalDay(tripDate, filterDate);
    }
    
    return matchesSearch && matchesDate;
  });
  
  // Delete reservation mutation
  const deleteReservationMutation = useMutation({
    mutationFn: async (id: number) => {
      // Importante: No intentamos parsear JSON para una respuesta 204 (sin contenido)
      const response = await fetch(`/api/reservations/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        // Si hay un error, intentamos extraer el mensaje
        const errorData = response.status !== 204 ? await response.json() : { error: 'Unknown error' };
        throw new Error(errorData.error || 'Failed to cancel reservation');
      }
      
      // Retornamos un valor simple ya que la respuesta no tiene cuerpo
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Reservation cancelled",
        description: "The reservation has been successfully cancelled.",
      });
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      
      // Close confirmation dialog
      setConfirmingDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error cancelling reservation",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Estados adicionales para el formulario de edición
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [status, setStatus] = useState<string>("confirmed");

  // Edit reservation mutation
  const editReservationMutation = useMutation({
    mutationFn: async (data: { id: number, updates: Partial<Reservation> }) => {
      const response = await apiRequest(
        "PUT", 
        `/api/reservations/${data.id}`, 
        data.updates
      );
      if (!response.ok) {
        throw new Error("Failed to update reservation");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reservación actualizada",
        description: "La reservación ha sido actualizada exitosamente.",
      });
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      
      // Close edit modal
      setIsEditModalOpen(false);
      setEditingReservation(null);
    },
    onError: (error) => {
      toast({
        title: "Error al actualizar la reservación",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Edit handlers
  const openEditModal = (reservation: ReservationWithDetails) => {
    setEditingReservation(reservation);
    // Inicializar todos los campos del formulario con los valores actuales
    setPaymentMethod(reservation.paymentMethod || "efectivo");
    setNotes(reservation.notes || "");
    setEmail(reservation.email || "");
    setPhone(reservation.phone || "");
    setStatus(reservation.status || "confirmed");
    setIsEditModalOpen(true);
  };
  
  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingReservation(null);
  };
  
  const handleSaveEdit = () => {
    if (!editingReservation) return;
    
    editReservationMutation.mutate({
      id: editingReservation.id,
      updates: {
        paymentMethod,
        notes,
        email,
        phone,
        status
      }
    });
  };
  
  // Confirmation dialog handlers
  const openDeleteConfirm = (id: number) => {
    setConfirmingDelete(id);
  };
  
  const handleDeleteConfirm = () => {
    if (confirmingDelete !== null) {
      deleteReservationMutation.mutate(confirmingDelete);
    }
  };
  
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };
  
  return (
    <div className="py-6">
      <div className="flex items-center mb-4">
        <div className="rounded-full bg-primary bg-opacity-10 p-2 mr-3">
          <UserIcon className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-semibold text-gray-800">Reservations</h2>
      </div>
      
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <Label htmlFor="searchInput" className="mb-2 block text-sm font-medium">
                  Buscar por nombre, teléfono o correo
                </Label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <SearchIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <Input
                    id="searchInput"
                    className="pl-10"
                    placeholder="Nombre, teléfono o correo electrónico..."
                    value={searchTerm}
                    onChange={handleSearch}
                  />
                </div>
              </div>
              
              <div className="flex-1">
                <Label htmlFor="dateFilter" className="mb-2 block text-sm font-medium">
                  Filtrar por fecha
                </Label>
                <div className="relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <CalendarIcon className="h-5 w-5 text-gray-400" />
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
            </div>
            
            <div className="border-b border-gray-200 mb-3">
              <div className="text-lg font-semibold mb-2">Ver reservaciones:</div>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full bg-transparent border-b border-gray-100 p-0 mb-0">
                  <TabsTrigger 
                    value="upcoming" 
                    className="flex-1 items-center gap-1 px-0 py-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                  >
                    <CalendarIcon className="h-5 w-5 mr-2" />
                    <span className="font-medium">Actuales y Futuras</span>
                    <Badge className="ml-2 bg-primary text-white">{upcomingReservations.length}</Badge>
                  </TabsTrigger>
                  <TabsTrigger 
                    value="archived" 
                    className="flex-1 items-center gap-1 px-0 py-2 data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none"
                  >
                    <ArchiveIcon className="h-5 w-5 mr-2" />
                    <span className="font-medium">Archivadas</span>
                    <Badge className="ml-2 bg-muted text-muted-foreground">{archivedReservations.length}</Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-0 pt-4 px-4">
          <div className="flex items-center gap-2">
            {activeTab === "upcoming" ? (
              <>
                <CalendarIcon className="h-5 w-5 text-primary" />
                <CardTitle className="text-md">Reservaciones actuales y futuras</CardTitle>
              </>
            ) : (
              <>
                <ArchiveIcon className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-md">Reservaciones archivadas</CardTitle>
              </>
            )}
          </div>
          <CardDescription className="mt-1">
            {activeTab === "upcoming" 
              ? "Mostrando reservaciones a partir de hoy" 
              : "Mostrando reservaciones anteriores a hoy"}
          </CardDescription>
        </CardHeader>
        
        {/* Vista para Desktop: Tabla tradicional */}
        <div className="hidden md:block overflow-x-auto">
          {isLoading && showLoadingDelay ? (
            <div className="flex justify-center items-center p-8">
              <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Cargando reservaciones...</span>
            </div>
          ) : hasError && !isInitialLoad ? (
            <div className="text-center p-8 text-red-500">
              Error al cargar las reservaciones. Por favor intenta de nuevo.
            </div>
          ) : filteredReservations && filteredReservations.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reservation ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Passenger</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Route</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Seats</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pago</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creado por</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReservations.map((reservation) => (
                  <tr 
                    key={reservation.id} 
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => openEditModal(reservation)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      #{generateReservationId(reservation.id)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {reservation.passengers[0]?.firstName} {reservation.passengers[0]?.lastName}
                        {reservation.passengers.length > 1 && ` +${reservation.passengers.length - 1}`}
                      </div>
                      <div className="text-sm text-gray-500">{reservation.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{reservation.trip.route.name}</div>
                      <div className="text-sm text-gray-500">
                        {reservation.trip.segmentOrigin || reservation.trip.route.origin} → {reservation.trip.segmentDestination || reservation.trip.route.destination}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(reservation.trip.departureDate)}</div>
                      <div className="text-sm text-gray-500">{reservation.trip.departureTime}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {reservation.passengers.length}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">{formatPrice(reservation.totalAmount)}</div>
                        
                        {(!reservation.advanceAmount || reservation.advanceAmount <= 0) ? (
                          <div className="flex justify-between text-xs">
                            <span className="text-gray-500">Método de pago:</span>
                            <span>{reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</span>
                          </div>
                        ) : (
                          <>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Anticipo:</span>
                              <span className="font-medium">{formatPrice(reservation.advanceAmount)}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-gray-500">Método anticipo:</span>
                              <span>{reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</span>
                            </div>
                            {reservation.advanceAmount < reservation.totalAmount && (
                              <>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-500">Resta:</span>
                                  <span className="font-medium">{formatPrice(reservation.totalAmount - (reservation.advanceAmount || 0))}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-500">Método restante:</span>
                                  <span>{reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</span>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge 
                        variant={reservation.paymentStatus === 'pagado' ? "outline" : "secondary"}
                        className={reservation.paymentStatus === 'pagado' 
                          ? "bg-green-100 text-green-800 border-green-200" 
                          : "bg-amber-100 text-amber-800 border-amber-200"}
                      >
                        {reservation.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {reservation.createdByUser ? (
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {reservation.createdByUser.firstName} {reservation.createdByUser.lastName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {reservation.createdByUser.role}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">No disponible</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                        <Button 
                          variant="link" 
                          className="text-blue-600 hover:text-blue-800 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditModal(reservation);
                          }}
                        >
                          Editar
                        </Button>
                        <Button 
                          variant="link" 
                          className="text-red-600 hover:text-red-800 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteConfirm(reservation.id);
                          }}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center p-8 text-gray-500">
              {activeTab === "upcoming" 
                ? "No hay reservaciones actuales o futuras disponibles."
                : "No hay reservaciones archivadas disponibles."}
            </div>
          )}
        </div>
        
        {/* Vista para Móvil: Tarjetas */}
        <div className="md:hidden">
          {isLoading && showLoadingDelay ? (
            <div className="flex justify-center items-center p-8">
              <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Cargando reservaciones...</span>
            </div>
          ) : hasError && !isInitialLoad ? (
            <div className="text-center p-8 text-red-500">
              Error al cargar las reservaciones. Por favor intenta de nuevo.
            </div>
          ) : filteredReservations && filteredReservations.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {filteredReservations.map((reservation) => (
                <div 
                  key={reservation.id} 
                  className="p-4 cursor-pointer hover:bg-gray-50 active:bg-gray-100 transition-colors duration-150"
                  onClick={() => openEditModal(reservation)}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        #{generateReservationId(reservation.id)}
                      </div>
                      <Badge 
                        variant={reservation.paymentStatus === 'pagado' ? "outline" : "secondary"}
                        className={reservation.paymentStatus === 'pagado' 
                          ? "bg-green-100 text-green-800 border-green-200 mt-1" 
                          : "bg-amber-100 text-amber-800 border-amber-200 mt-1"}
                      >
                        {reservation.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
                      </Badge>
                    </div>
                    
                    <div className="flex space-x-2" onClick={(e) => e.stopPropagation()}>
                      <Button 
                        size="sm"
                        variant="link" 
                        className="text-blue-600 hover:text-blue-800 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditModal(reservation);
                        }}
                      >
                        Editar
                      </Button>
                      <Button 
                        size="sm"
                        variant="link" 
                        className="text-red-600 hover:text-red-800 p-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDeleteConfirm(reservation.id);
                        }}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <div className="col-span-2">
                      <div className="font-medium text-gray-900">
                        {reservation.passengers[0]?.firstName} {reservation.passengers[0]?.lastName}
                        {reservation.passengers.length > 1 && ` +${reservation.passengers.length - 1}`}
                      </div>
                      <div className="text-gray-500 truncate" title={reservation.email}>
                        {reservation.email}
                      </div>
                    </div>
                    
                    <div className="col-span-2 mt-1">
                      <div className="font-medium">{reservation.trip.route.name}</div>
                      <div className="text-gray-500 text-xs">
                        {reservation.trip.segmentOrigin || reservation.trip.route.origin} → {reservation.trip.segmentDestination || reservation.trip.route.destination}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-gray-500">Fecha</div>
                      <div>{formatDate(reservation.trip.departureDate)}</div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-gray-500">Hora</div>
                      <div>{reservation.trip.departureTime}</div>
                    </div>
                    
                    <div>
                      <div className="text-xs text-gray-500">Pasajeros</div>
                      <div>{reservation.passengers.length}</div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-xs text-gray-500">Total</div>
                      <div className="font-medium">{formatPrice(reservation.totalAmount)}</div>
                    </div>
                    
                    {/* Información del creador para móvil */}
                    {reservation.createdByUser && (
                      <div className="col-span-2 mt-2">
                        <div className="text-xs text-gray-500">Creado por:</div>
                        <div className="text-sm">
                          {reservation.createdByUser.firstName} {reservation.createdByUser.lastName}
                          <span className="text-xs text-gray-500 ml-1">({reservation.createdByUser.role})</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Información de pago para móvil */}
                    <div className="col-span-2 mt-2 bg-gray-50 p-2 rounded-md border border-gray-100 text-xs">
                      <div className="grid grid-cols-2 gap-2">
                        {(!reservation.advanceAmount || reservation.advanceAmount <= 0) ? (
                          <>
                            <div>
                              <div className="text-gray-500">Método de pago</div>
                              <div className="font-medium">{reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</div>
                            </div>
                            <div>
                              <div className="text-gray-500">Estado</div>
                              <div className="font-medium">{reservation.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}</div>
                            </div>
                          </>
                        ) : (
                          <>
                            <div>
                              <div className="text-gray-500">Anticipo</div>
                              <div className="font-medium">{formatPrice(reservation.advanceAmount)}</div>
                            </div>
                            <div>
                              <div className="text-gray-500">Método anticipo</div>
                              <div>{reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</div>
                            </div>
                            
                            {reservation.advanceAmount < reservation.totalAmount && (
                              <>
                                <div>
                                  <div className="text-gray-500">Pendiente</div>
                                  <div className="font-medium">{formatPrice(reservation.totalAmount - (reservation.advanceAmount || 0))}</div>
                                </div>
                                <div>
                                  <div className="text-gray-500">Método pago final</div>
                                  <div>{reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</div>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 text-gray-500">
              {activeTab === "upcoming" 
                ? "No hay reservaciones actuales o futuras disponibles."
                : "No hay reservaciones archivadas disponibles."}
            </div>
          )}
        </div>
        
        {/* Pagination (placeholder, would be implemented with actual data) */}
        <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
          <div className="flex justify-between items-center">
            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-gray-700">
                  Showing <span className="font-medium">1</span> to <span className="font-medium">{filteredReservations?.length || 0}</span> of <span className="font-medium">{filteredReservations?.length || 0}</span> results
                </p>
              </div>
              {/* Pagination controls would go here if needed */}
            </div>
          </div>
        </div>
      </Card>
      
      {/* Confirmation Dialog */}
      <AlertDialog open={confirmingDelete !== null} onOpenChange={() => setConfirmingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Reservación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro que deseas cancelar esta reservación? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteConfirm}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Edit Reservation Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Reservación</DialogTitle>
            <DialogDescription>
              Actualiza los detalles de esta reservación.
            </DialogDescription>
          </DialogHeader>
          
          {editingReservation && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="reservation-id" className="text-gray-500 text-xs">CÓDIGO DE RESERVACIÓN</Label>
                  <div id="reservation-id" className="text-sm font-medium">#{generateReservationId(editingReservation?.id || 0)}</div>
                </div>
                
                <div>
                  <Label htmlFor="created-by" className="text-gray-500 text-xs">CREADA POR</Label>
                  <div id="created-by" className="text-sm">
                    {editingReservation.createdByUser ? (
                      <div className="flex items-center gap-1 text-sm">
                        <UserIcon className="h-3.5 w-3.5 text-primary/70" />
                        <span>{editingReservation.createdByUser.firstName} {editingReservation.createdByUser.lastName}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No disponible</span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Información de contacto */}
              <div className="space-y-3 mt-2">
                <h3 className="text-sm font-medium border-b pb-1">Información de contacto</h3>
                
                <div className="grid grid-cols-1 gap-2">
                  <Label htmlFor="passenger-name" className="text-gray-500 text-xs">PASAJEROS</Label>
                  <div id="passenger-name" className="text-sm">
                    {editingReservation.passengers[0]?.firstName} {editingReservation.passengers[0]?.lastName}
                    {editingReservation.passengers.length > 1 && ` +${editingReservation.passengers.length - 1}`}
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-2">
                  <Label htmlFor="email" className="text-gray-500 text-xs">EMAIL</Label>
                  <div className="relative">
                    <MailIcon className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-8"
                      placeholder="ejemplo@correo.com"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 gap-2">
                  <Label htmlFor="phone" className="text-gray-500 text-xs">TELÉFONO</Label>
                  <div className="relative">
                    <PhoneIcon className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-8"
                      placeholder="(999) 123-4567"
                    />
                  </div>
                </div>
              </div>
              
              {/* Información del viaje */}
              <div className="space-y-3 mt-2">
                <h3 className="text-sm font-medium border-b pb-1">Información del viaje</h3>
                
                <div className="grid grid-cols-1 gap-2">
                  <Label htmlFor="route-info" className="text-gray-500 text-xs">RUTA</Label>
                  <div id="route-info" className="text-sm">
                    {editingReservation.trip.route.name}
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">Origen:</span> {editingReservation.trip.segmentOrigin || editingReservation.trip.route.origin}
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">Destino:</span> {editingReservation.trip.segmentDestination || editingReservation.trip.route.destination}
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">Fecha:</span> {formatDate(editingReservation.trip.departureDate)}
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">Hora de salida:</span> {editingReservation.trip.departureTime}
                  </div>
                </div>
              </div>
              
              {/* Información de pago */}
              <div className="space-y-3 mt-2">
                <h3 className="text-sm font-medium border-b pb-1">Información de pago</h3>
                
                <div className="grid grid-cols-1 gap-2">
                  <Label htmlFor="payment-method" className="text-gray-500 text-xs">MÉTODO DE PAGO</Label>
                  <Select
                    value={paymentMethod}
                    onValueChange={setPaymentMethod}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar método de pago" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="efectivo">Efectivo</SelectItem>
                      <SelectItem value="transferencia">Transferencia bancaria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-1 gap-2">
                  <Label htmlFor="status" className="text-gray-500 text-xs">ESTADO</Label>
                  <Select
                    value={status}
                    onValueChange={setStatus}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="confirmed">Confirmado</SelectItem>
                      <SelectItem value="pending">Pendiente</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Notas adicionales */}
              <div className="grid grid-cols-1 gap-2 mt-2">
                <Label htmlFor="notes" className="text-gray-500 text-xs">NOTAS ADICIONALES</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instrucciones especiales o detalles adicionales"
                  className="min-h-[80px]"
                />
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={closeEditModal}>Cancelar</Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={editReservationMutation.isPending}
            >
              {editReservationMutation.isPending ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
