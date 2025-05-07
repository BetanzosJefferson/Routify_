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
import { Loader2, User, Mail, Phone, MapPin, Calendar, Clock, CheckCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatPrice, generateReservationId } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
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
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [ticketCheckResult, setTicketCheckResult] = useState<{
    isFirstScan: boolean;
    reservation?: any;
    checkedByUser?: {
      id: number;
      firstName: string;
      lastName: string;
    } | null;
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
        reservation: data.reservation,
        checkedByUser: data.checkedByUser
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
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Información completa de la reservación
                </p>
              </DialogHeader>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mt-3 sm:mt-4">
                <div className="space-y-3 sm:space-y-4">
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
                        <div>{reservation.trip.departureTime}</div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Información de pago */}
                <div className="space-y-3 sm:space-y-4">
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-md">
                    <h3 className="font-medium text-sm sm:text-base border-b pb-2 mb-3 sm:mb-4">Información de pago</h3>
                    <div className="space-y-2 sm:space-y-3">
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
                      
                      <div className="grid grid-cols-2 items-center">
                        <div className="text-sm text-gray-500 font-medium">MONTO TOTAL</div>
                        <div className="text-right font-medium">{formatPrice(reservation.totalAmount)}</div>
                      </div>
                      
                      {(reservation.advanceAmount && reservation.advanceAmount > 0) && (
                        <>
                          <div className="grid grid-cols-2 items-center">
                            <div className="text-sm text-gray-500 font-medium">ANTICIPO</div>
                            <div className="text-right font-medium">{formatPrice(reservation.advanceAmount)}</div>
                          </div>
                          
                          <div className="grid grid-cols-2 items-center">
                            <div className="text-sm text-gray-500 font-medium">MÉTODO ANTICIPO</div>
                            <div className="text-right">{reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</div>
                          </div>
                          
                          {reservation.advanceAmount < reservation.totalAmount && (
                            <>
                              <div className="grid grid-cols-2 items-center">
                                <div className="text-sm text-gray-500 font-medium">PENDIENTE DE PAGO</div>
                                <div className="text-right font-medium">{formatPrice(reservation.totalAmount - (reservation.advanceAmount || 0))}</div>
                              </div>
                              
                              <div className="grid grid-cols-2 items-center">
                                <div className="text-sm text-gray-500 font-medium">MÉTODO PAGO FINAL</div>
                                <div className="text-right">{reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</div>
                              </div>
                            </>
                          )}
                        </>
                      )}
                      
                      {(!reservation.advanceAmount || reservation.advanceAmount <= 0) && (
                        <div className="grid grid-cols-2 items-center">
                          <div className="text-sm text-gray-500 font-medium">MÉTODO DE PAGO</div>
                          <div className="text-right">{reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</div>
                        </div>
                      )}
                      
                      {user && reservation.paymentStatus !== 'pagado' && (
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
                  
                  {/* Verificación de ticket */}
                  <div className="bg-gray-50 p-3 sm:p-4 rounded-md">
                    <h3 className="font-medium text-sm sm:text-base border-b pb-2 mb-3 sm:mb-4">Verificación de ticket</h3>
                    <Button
                      variant="secondary"
                      className="w-full text-sm"
                      onClick={handleCheckTicket}
                      disabled={isChecking}
                    >
                      {isChecking ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verificando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Verificar ticket
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
              
              <DialogFooter className="mt-2 sm:mt-4">
                <Button className="w-full sm:w-auto text-sm" onClick={handleClose}>Cerrar</Button>
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
          checkedByUser={ticketCheckResult.checkedByUser}
        />
      )}
    </>
  );
}