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
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
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
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                {/* Información del pasajero */}
                <div className="space-y-4">
                  <h3 className="font-medium text-lg">Información del pasajero</h3>
                  <div className="bg-gray-50 p-4 rounded-md space-y-3">
                    <div>
                      <div className="text-sm text-gray-500 flex items-center">
                        <User className="h-4 w-4 mr-1" /> NOMBRE
                      </div>
                      <div className="font-medium">
                        {reservation.passengers[0]?.firstName} {reservation.passengers[0]?.lastName}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-gray-500 flex items-center">
                        <Mail className="h-4 w-4 mr-1" /> EMAIL
                      </div>
                      <div>{reservation.email || '-'}</div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-gray-500 flex items-center">
                        <Phone className="h-4 w-4 mr-1" /> TELÉFONO
                      </div>
                      <div>{reservation.phone || '-'}</div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-gray-500 flex items-center">
                        <User className="h-4 w-4 mr-1" /> PASAJEROS
                      </div>
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-1" /> {reservation.passengers.length}
                      </div>
                    </div>
                  </div>
                  
                  {/* Detalles del viaje */}
                  <h3 className="font-medium text-lg mt-4">Detalles del viaje</h3>
                  <div className="bg-gray-50 p-4 rounded-md space-y-3">
                    <div>
                      <div className="text-sm text-gray-500">RUTA</div>
                      <div className="font-medium">
                        {reservation.trip.route?.name || `${reservation.trip.segmentOrigin} - ${reservation.trip.segmentDestination}`}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-gray-500 flex items-center">
                        <MapPin className="h-4 w-4 mr-1" /> ORIGEN
                      </div>
                      <div>
                        {reservation.trip.segmentOrigin || reservation.trip.route?.origin}{" "}
                        {reservation.trip.route?.originDetails && `- ${reservation.trip.route.originDetails}`}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-gray-500 flex items-center">
                        <MapPin className="h-4 w-4 mr-1" /> DESTINO
                      </div>
                      <div>
                        {reservation.trip.segmentDestination || reservation.trip.route?.destination}{" "}
                        {reservation.trip.route?.destinationDetails && `- ${reservation.trip.route.destinationDetails}`}
                      </div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-gray-500 flex items-center">
                        <Calendar className="h-4 w-4 mr-1" /> FECHA
                      </div>
                      <div>{formatDate(reservation.trip.departureDate)}</div>
                    </div>
                    
                    <div>
                      <div className="text-sm text-gray-500 flex items-center">
                        <Clock className="h-4 w-4 mr-1" /> HORA DE SALIDA
                      </div>
                      <div>{reservation.trip.departureTime}</div>
                    </div>
                  </div>
                </div>
                
                {/* Información de pago */}
                <div className="space-y-4">
                  <h3 className="font-medium text-lg">Información de pago</h3>
                  <div className="bg-gray-50 p-4 rounded-md space-y-3">
                    <div>
                      <div className="text-sm text-gray-500">ESTADO DE PAGO</div>
                      <Badge className={reservation.paymentStatus === 'pagado' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}>
                        {reservation.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
                      </Badge>
                    </div>
                    
                    <div>
                      <div className="text-sm text-gray-500">MONTO TOTAL</div>
                      <div className="text-lg font-bold">{formatPrice(reservation.totalAmount)}</div>
                    </div>
                    
                    {(reservation.advanceAmount && reservation.advanceAmount > 0) && (
                      <>
                        <div>
                          <div className="text-sm text-gray-500">ANTICIPO</div>
                          <div>{formatPrice(reservation.advanceAmount)}</div>
                        </div>
                        
                        <div>
                          <div className="text-sm text-gray-500">MÉTODO ANTICIPO</div>
                          <div>{reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</div>
                        </div>
                        
                        {reservation.advanceAmount < reservation.totalAmount && (
                          <>
                            <div>
                              <div className="text-sm text-gray-500">PENDIENTE DE PAGO</div>
                              <div>{formatPrice(reservation.totalAmount - (reservation.advanceAmount || 0))}</div>
                            </div>
                            
                            <div>
                              <div className="text-sm text-gray-500">MÉTODO PAGO FINAL</div>
                              <div>{reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</div>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  
                  {/* Código QR */}
                  <h3 className="font-medium text-lg mt-4">Código QR</h3>
                  <div className="bg-gray-50 p-4 rounded-md text-center">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${window.location.origin}/public/reservations/${reservation.id}`} 
                      alt="QR Code"
                      className="mx-auto my-4 w-48 h-48"
                    />
                    <p className="text-sm text-gray-500 mb-2">
                      Este código QR contiene los detalles de la reservación.
                    </p>
                    <p className="text-sm text-gray-500">
                      Escanea el código para ver o compartir el boleto completo.
                    </p>
                    
                    <a 
                      href={`/public/reservations/${reservation.id}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="mt-4 inline-block text-blue-600 hover:underline"
                    >
                      Ver boleto completo
                    </a>
                  </div>
                  
                  {/* Botones de acción */}
                  <div className="space-y-2 mt-4">
                    {reservation.paymentStatus !== 'pagado' && (
                      <Button 
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={markAsPaid}
                        disabled={isMarkingAsPaid}
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
                    
                    <Button
                      variant="secondary"
                      className="w-full"
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
              
              <DialogFooter>
                <Button className="w-full sm:w-auto" onClick={handleClose}>Cerrar</Button>
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