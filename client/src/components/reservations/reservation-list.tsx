import { useState, useEffect, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatPrice, generateReservationId } from "@/lib/utils";
import { UserIcon, SearchIcon, Loader2Icon, XIcon, PhoneIcon, MailIcon, QrCodeIcon, PrinterIcon, TicketIcon, CheckIcon } from "lucide-react";
import { useReservations } from "@/hooks/use-reservations";
import { useLocation } from "wouter";
import QRCode from "qrcode";

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

export function ReservationList() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null);
  const [editingReservation, setEditingReservation] = useState<ReservationWithDetails | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [notes, setNotes] = useState<string>("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState<number | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>("");
  const ticketRef = useRef<HTMLDivElement>(null);
  
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
  
  // Generar código QR para la reservación actual
  useEffect(() => {
    if (detailModalOpen && !qrCodeUrl) {
      const reservationUrl = `${window.location.origin}/reservations/${detailModalOpen}`;
      QRCode.toDataURL(reservationUrl)
        .then(url => {
          setQrCodeUrl(url);
        })
        .catch(err => {
          console.error("Error generando QR:", err);
        });
    }
    
    if (!detailModalOpen) {
      // Limpiar URL del QR al cerrar el modal
      setQrCodeUrl("");
    }
  }, [detailModalOpen, qrCodeUrl]);
  
  // Filter reservations based on search term (mejorado para incluir teléfono y correo)
  const filteredReservations = reservations?.filter((reservation) => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    const routeName = reservation.trip.route.name.toLowerCase();
    const passengerNames = reservation.passengers.map(
      p => `${p.firstName} ${p.lastName}`.toLowerCase()
    ).join(" ");
    const email = reservation.email.toLowerCase();
    const phone = reservation.phone.toLowerCase();
    
    return (
      routeName.includes(searchLower) ||
      passengerNames.includes(searchLower) ||
      email.includes(searchLower) ||
      phone.includes(searchLower) ||
      formatDate(reservation.trip.departureDate).toLowerCase().includes(searchLower)
    );
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
  
  // Mutation para marcar reservación como pagada
  const markAsPaidMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('POST', `/api/reservations/${id}/mark-paid`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'No se pudo marcar como pagado');
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reservación marcada como pagada",
        description: "El estado de pago ha sido actualizado correctamente.",
      });
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      
      // Close dialog (opcional - también podríamos dejar abierto el modal)
      // setDetailModalOpen(null);
    },
    onError: (error) => {
      toast({
        title: "Error al marcar como pagado",
        description: error.message || "No se pudo actualizar el estado de pago.",
        variant: "destructive",
      });
    },
  });

  const handleMarkAsPaid = (id: number) => {
    markAsPaidMutation.mutate(id);
  };

  // Handlers para el modal de detalles y QR
  const openDetailModal = (reservation: ReservationWithDetails) => {
    // Generar código QR para la reservación
    const reservationUrl = `${window.location.origin}/reservations/${reservation.id}`;
    QRCode.toDataURL(reservationUrl)
      .then((url: string) => {
        setQrCodeUrl(url);
        setDetailModalOpen(reservation.id);
      })
      .catch((err: Error) => {
        console.error("Error generando QR:", err);
        setDetailModalOpen(reservation.id);
      });
  };
  
  const closeDetailModal = () => {
    setDetailModalOpen(null);
    setQrCodeUrl("");
  };
  
  const goToDetailPage = (id: number) => {
    navigate(`/reservations/${id}`);
  };
  
  const handleViewCompleteTicket = (id: number) => {
    goToDetailPage(id);
  };
  
  const handlePrintTicket = () => {
    if (!ticketRef.current) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: "Error",
        description: "No se pudo abrir la ventana de impresión. Desactive el bloqueador de ventanas emergentes.",
        variant: "destructive",
      });
      return;
    }
    
    printWindow.document.write(`
      <html>
        <head>
          <title>Boleto de Viaje</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
            .ticket { max-width: 800px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; }
            .header { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 20px; }
            .title { font-size: 24px; font-weight: bold; color: #444; }
            .subtitle { font-size: 14px; color: #666; }
            .qr { text-align: center; margin: 20px 0; }
            .info-row { display: flex; margin-bottom: 5px; }
            .label { font-weight: bold; width: 140px; color: #555; }
            .value { flex: 1; }
            .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #999; }
            @media print {
              body { padding: 0; }
              .ticket { border: none; }
            }
          </style>
        </head>
        <body>
          ${ticketRef.current.innerHTML}
          <script>
            setTimeout(() => { window.print(); window.close(); }, 500);
          </script>
        </body>
      </html>
    `);
    
    printWindow.document.close();
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
          <div className="space-y-4">
            <div className="relative rounded-md shadow-sm max-w-lg">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <SearchIcon className="h-5 w-5 text-gray-400" />
              </div>
              <Input
                className="pl-10"
                placeholder="Buscar por nombre, teléfono, correo, ruta o fecha..."
                value={searchTerm}
                onChange={handleSearch}
              />
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <span className="font-medium">Buscar por:</span>
              </p>
              <ul className="list-disc list-inside ml-1 grid grid-cols-1 md:grid-cols-3 gap-x-4">
                <li>Nombre de pasajero</li>
                <li>Número de teléfono</li>
                <li>Correo electrónico</li>
                <li>Nombre de ruta</li>
                <li>Fecha de salida</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredReservations.map((reservation) => (
                  <tr 
                    key={reservation.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setDetailModalOpen(reservation.id)}
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
                          Edit
                        </Button>
                        <Button 
                          variant="link" 
                          className="text-red-600 hover:text-red-800 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDeleteConfirm(reservation.id);
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center p-8 text-gray-500">
              No reservations found.
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
                  className="p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => setDetailModalOpen(reservation.id)}
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
                        Edit
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
                        Cancel
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
              No reservations found.
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
            <AlertDialogTitle>Cancel Reservation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel this reservation? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={handleDeleteConfirm}
            >
              Confirm
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
              <div className="grid grid-cols-1 gap-2">
                <Label htmlFor="reservation-id" className="text-gray-500 text-xs">CÓDIGO DE RESERVACIÓN</Label>
                <div id="reservation-id" className="text-sm font-medium">#{generateReservationId(editingReservation?.id || 0)}</div>
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
      
      {/* Modal de detalles y QR */}
      {detailModalOpen !== null && reservations && (
        <Dialog open={detailModalOpen !== null} onOpenChange={closeDetailModal}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="absolute right-4 top-4">
              <button 
                className="rounded-full w-6 h-6 inline-flex items-center justify-center border border-gray-200 text-gray-400 hover:text-gray-500"
                onClick={closeDetailModal}
              >
                <XIcon className="h-3 w-3" />
              </button>
            </div>
            <div className="flex items-center mb-1 pt-2">
              <TicketIcon className="h-5 w-5 mr-2" />
              <h2 className="font-medium text-lg">Detalles de la Reservación #{detailModalOpen && generateReservationId(detailModalOpen)}</h2>
            </div>
            <p className="text-sm text-gray-500 mb-4">Información completa de la reservación</p>
            
            {(() => {
              const reservation = reservations.find(r => r.id === detailModalOpen);
              if (!reservation) return null;
              
              // Lógica para determinar si está pagado
              const isPaid = reservation.paymentStatus === 'pagado';
              
              return (
                <div ref={ticketRef}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Columna 1: Información del pasajero y viaje */}
                    <div>
                      <div className="mb-6 bg-gray-50 bg-opacity-50 rounded-md p-4">
                        <h3 className="text-sm font-medium text-gray-500 uppercase mb-3">Información del pasajero</h3>
                        <div className="space-y-3">
                          <div>
                            <div className="text-xs text-gray-500 uppercase">NOMBRE</div>
                            <div className="font-medium">{reservation.passengers[0]?.firstName} {reservation.passengers[0]?.lastName}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 uppercase">EMAIL</div>
                            <div className="font-medium">{reservation.email}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 uppercase">TELÉFONO</div>
                            <div className="font-medium">{reservation.phone}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 uppercase">PASAJEROS</div>
                            <div className="flex items-center">
                              <UserIcon className="h-4 w-4 text-gray-400 mr-1" />
                              <span className="font-medium">{reservation.passengers.length}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-gray-50 bg-opacity-50 rounded-md p-4">
                        <h3 className="text-sm font-medium text-gray-500 uppercase mb-3">Detalles del viaje</h3>
                        <div className="space-y-3">
                          <div>
                            <div className="text-xs text-gray-500 uppercase">RUTA</div>
                            <div className="font-medium">{reservation.trip.route.name}</div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 uppercase">ORIGEN</div>
                            <div className="font-medium flex items-start">
                              <div className="flex-shrink-0 mt-1 mr-2">
                                <div className="h-2.5 w-2.5 rounded-full border-2 border-gray-300"></div>
                              </div>
                              <span>{reservation.trip.segmentOrigin || reservation.trip.route.origin}</span>
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 uppercase">DESTINO</div>
                            <div className="font-medium flex items-start">
                              <div className="flex-shrink-0 mt-1 mr-2">
                                <div className="h-2.5 w-2.5 rounded-full bg-blue-500"></div>
                              </div>
                              <span>{reservation.trip.segmentDestination || reservation.trip.route.destination}</span>
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 uppercase">FECHA</div>
                            <div className="font-medium flex items-center">
                              <span className="flex-shrink-0 mr-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </span>
                              {formatDate(reservation.trip.departureDate)}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 uppercase">HORA DE SALIDA</div>
                            <div className="font-medium flex items-center">
                              <span className="flex-shrink-0 mr-2">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                              </span>
                              {reservation.trip.departureTime}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Columna 2: Información de pago y QR */}
                    <div>
                      <div className="mb-6">
                        <h3 className="text-sm font-medium text-gray-500 uppercase mb-3">Información de pago</h3>
                        <div className="rounded-md border border-gray-200">
                          <div className="bg-gray-50 px-4 py-2 flex justify-between items-center">
                            <div className="text-xs text-gray-500 uppercase">ESTADO DE PAGO</div>
                            <Badge 
                              variant={isPaid ? "outline" : "secondary"}
                              className={isPaid
                                ? "bg-green-100 text-green-800 border-green-200" 
                                : "bg-amber-100 text-amber-800 border-amber-200 whitespace-nowrap"}
                            >
                              {isPaid ? 'PAGADO' : 'PENDIENTE'}
                            </Badge>
                          </div>
                          
                          <div className="p-4 space-y-2">
                            <div className="flex justify-between">
                              <div className="text-xs text-gray-500 uppercase">MONTO TOTAL</div>
                              <div className="font-semibold">${reservation.totalAmount.toFixed(0)}</div>
                            </div>
                            
                            {reservation.advanceAmount && reservation.advanceAmount > 0 && (
                              <>
                                <div className="flex justify-between">
                                  <div className="text-xs text-gray-500 uppercase">ANTICIPO</div>
                                  <div className="font-medium">${reservation.advanceAmount.toFixed(0)}</div>
                                </div>
                                
                                <div className="flex justify-between">
                                  <div className="text-xs text-gray-500 uppercase">MÉTODO ANTICIPO</div>
                                  <div>{reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</div>
                                </div>
                                
                                {reservation.advanceAmount < reservation.totalAmount && (
                                  <>
                                    <div className="flex justify-between">
                                      <div className="text-xs text-gray-500 uppercase">PENDIENTE DE PAGO</div>
                                      <div className="font-semibold">${(reservation.totalAmount - (reservation.advanceAmount || 0)).toFixed(0)}</div>
                                    </div>
                                    
                                    <div className="flex justify-between">
                                      <div className="text-xs text-gray-500 uppercase">MÉTODO PAGO FINAL</div>
                                      <div>{reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</div>
                                    </div>
                                  </>
                                )}
                              </>
                            )}
                            
                            {(!reservation.advanceAmount || reservation.advanceAmount <= 0) && (
                              <div className="flex justify-between">
                                <div className="text-xs text-gray-500 uppercase">MÉTODO PAGO</div>
                                <div>{reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</div>
                              </div>
                            )}
                            
                            {!isPaid && (
                              <Button 
                                className="w-full mt-3 bg-green-600 hover:bg-green-700 text-white"
                                onClick={() => handleMarkAsPaid(reservation.id)}
                              >
                                <CheckIcon className="h-4 w-4 mr-2" /> Marcar como pagado
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 uppercase mb-3">Código QR</h3>
                        <div className="rounded-md border border-gray-200 p-4 flex flex-col items-center">
                          {qrCodeUrl ? (
                            <img 
                              src={qrCodeUrl} 
                              alt="Código QR de la reservación" 
                              className="w-44 h-44 mb-3"
                            />
                          ) : (
                            <div className="flex items-center justify-center w-44 h-44 bg-gray-50">
                              <Loader2Icon className="h-8 w-8 animate-spin text-gray-300" />
                            </div>
                          )}
                          <p className="text-xs text-gray-500 text-center mb-3">
                            Este código QR contiene los detalles de la reservación.<br />
                            Escanea el código para ver o compartir el boleto completo.
                          </p>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="w-full"
                            onClick={() => handleViewCompleteTicket(reservation.id)}
                          >
                            Ver boleto completo
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
            
            <div className="flex justify-center gap-2 mt-4">
              <Button
                variant="outline"
                className="flex-1 max-w-xs"
                onClick={handlePrintTicket}
              >
                <PrinterIcon className="w-4 h-4 mr-2" />
                Imprimir Boleto
              </Button>
              
              <Button
                variant="default"
                className="flex-1 max-w-xs bg-blue-500 hover:bg-blue-600 text-white"
                onClick={() => {
                  const reservation = reservations.find(r => r.id === detailModalOpen);
                  if (reservation) {
                    goToDetailPage(reservation.id);
                  }
                }}
              >
                <QrCodeIcon className="w-4 h-4 mr-2" />
                Ver Detalles Completos
              </Button>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              onClick={closeDetailModal}
            >
              Cerrar
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
