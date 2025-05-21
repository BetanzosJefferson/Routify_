import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, User, Mail, Phone, MapPin, Calendar, Clock, CheckCircle, X, ArrowRightLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatPrice, generateReservationId } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { hasRequiredRole } from "@/lib/role-based-permissions";
import { formatTripTime, extractDayIndicator } from "@/lib/trip-utils";
import TicketCheckedModal from "@/components/reservations/ticket-checked-modal";

interface ReservationDetailsModalProps {
  reservationId: number | null;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ReservationDetailsModal({ 
  reservationId, 
  isOpen, 
  onOpenChange 
}: ReservationDetailsModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isMarkingAsPaid, setIsMarkingAsPaid] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [ticketCheckResult, setTicketCheckResult] = useState<{
    isFirstScan: boolean;
    reservation?: any;
  } | null>(null);

  // Cargar los detalles de la reservación usando el endpoint público
  const { data: reservation, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/public/reservations", reservationId],
    queryFn: async () => {
      if (!reservationId) return null;
      const response = await fetch(`/api/public/reservations/${reservationId}`);
      if (!response.ok) {
        throw new Error("Error al cargar los detalles de la reservación");
      }
      return response.json();
    },
    enabled: !!reservationId && isOpen,
  });

  // Verificar ticket
  const handleCheckTicket = async () => {
    if (!reservationId || !user) {
      toast({
        title: "Autenticación requerida",
        description: "Para verificar un ticket necesita iniciar sesión con una cuenta autorizada.",
        variant: "destructive",
      });
      return;
    }
    
    // Verificar si la reservación está cancelada
    if (reservation?.status === 'canceled') {
      toast({
        title: "Reservación cancelada",
        description: "Las reservaciones canceladas no pueden ser verificadas.",
        variant: "destructive",
      });
      return;
    }
    
    setIsChecking(true);
    try {
      const response = await apiRequest("POST", `/api/reservations/${reservationId}/check`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al verificar el ticket");
      }
      
      const data = await response.json();
      setTicketCheckResult({
        isFirstScan: data.isFirstScan,
        reservation: data.reservation
      });
      setIsTicketModalOpen(true);
      
      // Refrescar los datos
      refetch();
      
      toast({
        title: data.isFirstScan ? "Ticket Verificado" : "Ticket Re-escaneado",
        description: data.isFirstScan 
          ? "El ticket ha sido marcado como verificado correctamente." 
          : "Este ticket ya había sido verificado anteriormente.",
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error al verificar ticket",
        description: error instanceof Error 
          ? error.message 
          : "No se pudo verificar el ticket. Verifica que estés autenticado con los permisos correctos.",
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };

  // Marcar como pagado
  const markAsPaid = async () => {
    if (!reservationId) return;
    
    // Verificar si la reservación está cancelada
    if (reservation?.status === 'canceled') {
      toast({
        title: "Reservación cancelada",
        description: "Las reservaciones canceladas no pueden ser marcadas como pagadas.",
        variant: "destructive",
      });
      return;
    }
    
    setIsMarkingAsPaid(true);
    try {
      const response = await apiRequest(
        "PUT", 
        `/api/reservations/${reservationId}`, 
        { paymentStatus: "pagado" }
      );
      
      if (!response.ok) {
        toast({
          title: "Autenticación requerida",
          description: "Para marcar como pagado necesita iniciar sesión con una cuenta autorizada.",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Pago actualizado",
        description: "La reservación ha sido marcada como pagada.",
        variant: "default",
      });
      
      // Recargar los datos
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Ha ocurrido un error",
        variant: "destructive",
      });
    } finally {
      setIsMarkingAsPaid(false);
    }
  };

  // Cancelar reservación
  const cancelReservation = async () => {
    if (!reservationId) return;
    
    setIsCanceling(true);
    try {
      const response = await apiRequest(
        "POST", 
        `/api/reservations/${reservationId}/cancel`, 
        {}
      );
      
      if (!response.ok) {
        toast({
          title: "Error al cancelar reservación",
          description: "Para cancelar una reservación necesita iniciar sesión con una cuenta autorizada.",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Reservación cancelada",
        description: "La reservación ha sido cancelada correctamente y los asientos han sido liberados.",
        variant: "default",
      });
      
      // Recargar los datos
      await refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Ha ocurrido un error al cancelar la reservación",
        variant: "destructive",
      });
    } finally {
      setIsCanceling(false);
      
      // Invalidar todas las consultas de reservaciones para actualizar la lista
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-center text-gray-500">Cargando detalles...</p>
            </div>
          ) : error || !reservation ? (
            <div className="flex flex-col items-center justify-center py-8">
              <X className="h-8 w-8 text-red-500 mb-4" />
              <p className="text-center text-gray-500">Error al cargar los detalles</p>
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>
                  Detalles de la Reservación #{generateReservationId(reservation.id)}
                  {reservation.status === 'canceled' && (
                    <span className="ml-2 text-sm text-red-600 font-normal">(CANCELADA)</span>
                  )}
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Información completa de la reservación
                </p>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mt-3 sm:mt-4">
                <div className="space-y-3 sm:space-y-4">
                  {/* Indicador de transferencia si aplica */}
                  {reservation.notes && reservation.notes.includes("Transferido desde") && (
                    <div className="bg-blue-50 p-3 sm:p-4 rounded-md border border-blue-100">
                      <div className="flex items-center gap-2">
                        <ArrowRightLeft className="h-4 w-4 text-blue-700" />
                        <h3 className="font-medium text-sm sm:text-base text-blue-700">Transferencia recibida</h3>
                      </div>
                      <p className="text-sm text-blue-700 mt-2">
                        {reservation.notes}
                      </p>
                    </div>
                  )}
                  
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-md">
                    <h3 className="font-medium text-sm sm:text-base border-b pb-2 mb-3 sm:mb-4">Información del pasajero</h3>
                    <div className="space-y-3 sm:space-y-4">
                      <div>
                        <div className="text-sm text-gray-500 font-medium">NOMBRE</div>
                        <div>
                          {reservation.passengers[0]?.firstName} {reservation.passengers[0]?.lastName}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-sm text-gray-500 font-medium">EMAIL</div>
                        <div>{reservation.email || '-'}</div>
                      </div>
                      
                      <div>
                        <div className="text-sm text-gray-500 font-medium">TELÉFONO</div>
                        <div>{reservation.phone || '-'}</div>
                      </div>
                      
                      <div>
                        <div className="text-sm text-gray-500 font-medium">PASAJEROS</div>
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-1" /> {reservation.passengers.length}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Detalles del viaje */}
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-md">
                    <h3 className="font-medium text-sm sm:text-base border-b pb-2 mb-3 sm:mb-4">Detalles del viaje</h3>
                    <div className="space-y-3 sm:space-y-4">
                      <div>
                        <div className="text-sm text-gray-500 font-medium">RUTA</div>
                        <div>
                          {reservation.trip.route?.name || `${reservation.trip.segmentOrigin} - ${reservation.trip.segmentDestination}`}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-sm text-gray-500 font-medium">ORIGEN</div>
                        <div>
                          {reservation.trip.segmentOrigin || reservation.trip.route?.origin}{" "}
                          {reservation.trip.route?.originDetails && `- ${reservation.trip.route.originDetails}`}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-sm text-gray-500 font-medium">DESTINO</div>
                        <div>
                          {reservation.trip.segmentDestination || reservation.trip.route?.destination}{" "}
                          {reservation.trip.route?.destinationDetails && `- ${reservation.trip.route.destinationDetails}`}
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-sm text-gray-500 font-medium">FECHA</div>
                        <div>{formatDate(reservation.trip.departureDate)}</div>
                      </div>
                      
                      <div>
                        <div className="text-sm text-gray-500 font-medium">HORA DE SALIDA</div>
                        <div>{formatTripTime(reservation.trip.departureTime, true, 'pretty')}</div>
                      </div>
                      
                      {reservation.trip.arrivalTime && (
                        <div>
                          <div className="text-sm text-gray-500 font-medium">HORA DE LLEGADA</div>
                          <div>{formatTripTime(reservation.trip.arrivalTime, true, 'pretty')}</div>
                        </div>
                      )}
                      
                      {/* Mensaje descriptivo para viajes que cruzan la medianoche */}
                      {(extractDayIndicator(reservation.trip.departureTime) > 0 || extractDayIndicator(reservation.trip.arrivalTime) > 0) && (
                        <div className="mt-2">
                          <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded-md flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <circle cx="12" cy="12" r="10"></circle>
                              <line x1="12" y1="8" x2="12" y2="12"></line>
                              <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                            {formatTripTime(reservation.trip.departureTime, true, 'descriptive', reservation.trip.departureDate)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Información de pago */}
                <div className="space-y-3 sm:space-y-4">
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-md">
                    <h3 className="font-medium text-sm sm:text-base border-b pb-2 mb-3 sm:mb-4">Información de pago</h3>
                    <div className="space-y-2 sm:space-y-3">
                      {/* Estado de reservación eliminado como solicitado */}
                      
                      <div className="grid grid-cols-2 items-center">
                        <div className="text-sm text-gray-500 font-medium">ESTADO DE PAGO</div>
                        <div className="text-right">
                          <Badge 
                            className={reservation.paymentStatus === 'pagado' 
                              ? 'bg-green-100 text-green-800 border-green-200' 
                              : 'bg-yellow-100 text-yellow-800 border-yellow-200'}
                          >
                            {reservation.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
                          </Badge>
                        </div>
                      </div>
                      
                      {(reservation.advanceAmount && reservation.advanceAmount > 0) && (
                        <>
                          <div className="grid grid-cols-2 items-center">
                            <div className="text-sm text-gray-500 font-medium">ANTICIPÓ</div>
                            <div className="text-right font-medium">{formatPrice(reservation.advanceAmount)} ({reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})</div>
                          </div>
                          
                          {reservation.advanceAmount < reservation.totalAmount && (
                            <div className="grid grid-cols-2 items-center">
                              <div className="text-sm text-gray-500 font-medium">RESTA</div>
                              <div className="text-right font-medium">{formatPrice(reservation.totalAmount - (reservation.advanceAmount || 0))} ({reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})</div>
                            </div>
                          )}
                        </>
                      )}
                      
                      {(!reservation.advanceAmount || reservation.advanceAmount <= 0) && (
                        <div className="grid grid-cols-2 items-center">
                          <div className="text-sm text-gray-500 font-medium">MÉTODO DE PAGO</div>
                          <div className="text-right">{reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</div>
                        </div>
                      )}
                      
                      {/* Información de descuento si hay cupón aplicado */}
                      {reservation.couponCode && reservation.discountAmount > 0 && (
                        <>
                          <div className="grid grid-cols-2 items-center mt-2 pt-2 border-t border-gray-200">
                            <div className="text-sm text-gray-500 font-medium">CUPÓN APLICADO</div>
                            <div className="text-right">
                              <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200">
                                {reservation.couponCode}
                              </Badge>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 items-center">
                            <div className="text-sm text-gray-500 font-medium">PRECIO ORIGINAL</div>
                            <div className="text-right font-medium text-gray-500 line-through">
                              {formatPrice(reservation.originalAmount || (reservation.totalAmount + reservation.discountAmount))}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 items-center">
                            <div className="text-sm text-gray-500 font-medium">DESCUENTO</div>
                            <div className="text-right font-medium text-green-600">
                              -{formatPrice(reservation.discountAmount)}
                            </div>
                          </div>
                        </>
                      )}
                      
                      <div className="grid grid-cols-2 items-center border-t border-gray-200 pt-2 mt-2">
                        <div className="text-sm text-gray-500 font-medium">TOTAL</div>
                        <div className="text-right font-medium">{formatPrice(reservation.totalAmount)}</div>
                      </div>
                      
                      {user && reservation.paymentStatus !== 'pagado' && reservation.status === 'confirmed' && (
                        <Button 
                          onClick={markAsPaid}
                          disabled={isMarkingAsPaid}
                          variant="default"
                          className="w-full mt-3 bg-green-600 hover:bg-green-700 border-green-700 border-2"
                        >
                          {isMarkingAsPaid ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Procesando...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="mr-2 h-4 w-4" />
                              Marcar como pagado
                            </>
                          )}
                        </Button>
                      )}
                      
                      {user && reservation.status === 'canceled' && (
                        <div className="w-full mt-3 p-2 bg-gray-100 border border-gray-200 rounded text-center text-gray-500 text-sm">
                          Esta reservación está cancelada
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Código QR */}
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-md">
                    <h3 className="font-medium text-sm sm:text-base border-b pb-2 mb-3 sm:mb-4">Código QR</h3>
                    <div className="text-center">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${window.location.origin}/reservation-details?id=${reservation.id}`} 
                        alt="QR Code"
                        className="mx-auto my-2 sm:my-4 w-32 h-32 sm:w-40 sm:h-40 md:w-48 md:h-48"
                      />
                      <p className="text-xs sm:text-sm text-gray-500 mb-1 sm:mb-2">
                        Este código QR contiene los detalles de la reservación.
                      </p>
                      <p className="text-xs sm:text-sm text-gray-500">
                        Escanea para ver o compartir el boleto.
                      </p>
                      
                      <a 
                        href={`/reservation-details?id=${reservation.id}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="mt-2 sm:mt-4 inline-block text-xs sm:text-sm text-blue-600 hover:underline"
                      >
                        Ver boleto completo
                      </a>
                    </div>
                  </div>
                  
                  {/* Sección de Bitácora eliminada como solicitado */}
                </div>
              </div>
              
              <DialogFooter className="mt-2 sm:mt-4 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
                <Button className="w-full sm:w-auto text-sm" onClick={handleClose}>Cerrar</Button>
                
                {user && hasRequiredRole(user, ["checker", "driver", "owner", "admin"]) && reservation.status !== 'canceled' && (
                  <Button
                    className="w-full sm:w-auto text-sm bg-green-600 hover:bg-green-700"
                    onClick={handleCheckTicket}
                    disabled={isChecking}
                  >
                    {isChecking ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Verificar Ticket
                      </>
                    )}
                  </Button>
                )}
                
                {user && reservation.status !== 'canceled' && (
                  <Button 
                    className="w-full sm:w-auto text-sm bg-red-600 hover:bg-red-700"
                    onClick={cancelReservation}
                    disabled={isCanceling}
                  >
                    {isCanceling ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <X className="mr-2 h-4 w-4" />
                        Cancelar Reservación
                      </>
                    )}
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Modal de verificación de ticket */}
      {ticketCheckResult && (
        <TicketCheckedModal
          isOpen={isTicketModalOpen}
          onClose={() => setIsTicketModalOpen(false)}
          reservation={ticketCheckResult.reservation}
          isFirstScan={ticketCheckResult.isFirstScan}
        />
      )}
    </>
  );
}