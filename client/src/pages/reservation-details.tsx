import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatDate, formatPrice, generateReservationId } from "@/lib/utils";
import { Loader2, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import TicketCheckedModal from "@/components/reservations/ticket-checked-modal";
import ReservationCanceledModal from "@/components/reservations/reservation-canceled-modal";

export default function ReservationDetails({ params }: { params?: { id?: string } }) {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [reservationId, setReservationId] = useState<number | null>(null);
  const [isMarkingAsPaid, setIsMarkingAsPaid] = useState(false);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [isCanceledModalOpen, setIsCanceledModalOpen] = useState(false);
  const [ticketCheckResult, setTicketCheckResult] = useState<{
    isFirstScan: boolean;
    reservation?: any;
  } | null>(null);

  // Extraer el ID de la reservación de los parámetros de ruta
  useEffect(() => {
    // Primero intentamos obtener el ID de los parámetros de ruta
    if (params?.id) {
      setReservationId(parseInt(params.id, 10));
    } else {
      // Si no está en los parámetros de ruta, intentamos usar los parámetros de consulta
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get("id");
      if (id) {
        setReservationId(parseInt(id, 10));
      }
    }
  }, [params]);

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
    enabled: !!reservationId,
  });

  // Auto verificación del ticket cuando se carga por primera vez
  const checkTicketMutation = useMutation({
    mutationFn: async () => {
      if (!reservationId || !user) return null;
      
      // Primero verificamos si la reservación está cancelada o ya ha sido escaneada
      const reservationResponse = await fetch(`/api/public/reservations/${reservationId}`);
      if (!reservationResponse.ok) return null;
      const reservationData = await reservationResponse.json();
      
      if (reservationData.status === 'canceled') {
        return { isCanceled: true, reservation: reservationData };
      }
      
      // Verificar si el ticket ya ha sido escaneado
      if (reservationData.checkedBy !== null && reservationData.checkedBy !== undefined) {
        return { 
          isAlreadyChecked: true, 
          reservation: reservationData,
          success: false,
          message: 'Este ticket ya ha sido verificado y no puede verificarse nuevamente'
        };
      }
      
      const response = await apiRequest("POST", `/api/reservations/${reservationId}/check`);
      if (!response.ok) {
        const errorData = await response.json();
        // Si el error es porque el ticket ya fue verificado, manejamos de forma especial
        if (errorData.isAlreadyChecked) {
          return { 
            isAlreadyChecked: true, 
            reservation: errorData.reservation,
            success: false,
            message: errorData.message
          };
        }
        return null;
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (!data) return;
      
      // Si la reservación está cancelada, mostramos el modal de cancelación
      if (data.isCanceled) {
        setIsCanceledModalOpen(true);
        return;
      }
      
      // Si el ticket ya está verificado, no mostramos el modal de éxito
      if (data.isAlreadyChecked) {
        toast({
          title: "Ticket Ya Verificado",
          description: "Este ticket ya ha sido verificado anteriormente y no puede escanearse nuevamente.",
          variant: "default",
        });
        return;
      }
      
      setTicketCheckResult({
        isFirstScan: data.isFirstScan,
        reservation: data.reservation
      });
      
      setIsTicketModalOpen(true);
      toast({
        title: "Ticket Verificado",
        description: "El ticket ha sido marcado como verificado correctamente.",
        variant: "default",
      });
      
      refetch();
    },
    onError: (error) => {
      toast({
        title: "Error al verificar ticket",
        description: error instanceof Error ? error.message : "No se pudo verificar el ticket",
        variant: "destructive",
      });
    }
  });

  // Función para marcar como pagado
  const markAsPaid = async () => {
    if (!reservationId || !user) return;
    
    // Verificar si la reservación está cancelada
    if (reservation.status === 'canceled') {
      toast({
        title: "No se puede procesar",
        description: "Las reservaciones canceladas no pueden ser marcadas como pagadas.",
        variant: "destructive",
      });
      return;
    }
    
    setIsMarkingAsPaid(true);
    try {
      let response = await apiRequest(
        "PUT", 
        `/api/reservations/${reservationId}`, 
        { 
          paymentStatus: "pagado",
          paidBy: user.id // Guardamos el ID del usuario que marca como pagado
        }
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

  // Intentar verificar automáticamente al cargar la página si el usuario está autenticado
  useEffect(() => {
    if (user && reservation && !reservation.checkedBy) {
      checkTicketMutation.mutate();
    }
  }, [user, reservation]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-center text-gray-700">Cargando detalles de la reservación...</p>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <XCircle className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-xl font-bold text-center mb-2">Reservación no encontrada</h1>
        <p className="text-gray-600 text-center mb-6">
          No se encontró la reservación solicitada o ha ocurrido un error.
        </p>
        <Button onClick={() => setLocation("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al inicio
        </Button>
      </div>
    );
  }

  // Obtener iniciales de la empresa para el avatar
  const getCompanyInitials = () => {
    const companyName = reservation.trip?.companyName || "TR";
    return companyName.substring(0, 2).toUpperCase();
  };

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center mb-6">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setLocation("/")}
          className="rounded-full"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="ml-2">Volver</span>
        </Button>
      </div>
      
      <Card className="p-4 sm:p-6 mb-4 border-0 shadow-md">
        {/* Logo/Avatar de la empresa */}
        <div className="flex flex-col items-center mb-6">
          <Avatar className="h-20 w-20 mb-4 border-2 border-gray-200">
            <AvatarImage src={reservation.trip?.companyLogo} alt={reservation.trip?.companyName || "Empresa"} />
            <AvatarFallback className="bg-primary text-white text-xl">
              {getCompanyInitials()}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Reservación #{generateReservationId(reservation.id)}
          </h1>
          <div className="text-xl font-medium text-gray-800">
            {reservation.passengers[0]?.firstName} {reservation.passengers[0]?.lastName}
            {reservation.passengers.length > 1 && ` +${reservation.passengers.length - 1}`}
          </div>
        </div>

        {/* Estado del pago y transferencia */}
        <div className="text-center mb-6 flex flex-col items-center gap-2">
          <Badge 
            className={`text-lg px-6 py-1.5 rounded-full ${
              reservation.paymentStatus === 'pagado' 
                ? 'bg-green-100 text-green-800 border-green-300' 
                : 'bg-amber-100 text-amber-800 border-amber-300'
            }`}
          >
            {reservation.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
          </Badge>
          
          {/* Indicador de transferencia si corresponde */}
          {reservation.notes && reservation.notes.includes("Transferido desde") && (
            <Badge 
              variant="outline" 
              className="bg-blue-50 text-blue-700 border-blue-200 px-3"
            >
              TRANSFERENCIA RECIBIDA
            </Badge>
          )}
        </div>

        {/* Información del pasajero */}
        <div className="mb-6">
          <h2 className="text-base font-medium mb-3 border-b pb-2">Información del Pasajero</h2>
          <div className="bg-gray-50 p-4 rounded-md">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500 font-medium">CONTACTO</div>
                <div className="break-words">{reservation.email || '-'}</div>
                <div>{reservation.phone || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 font-medium">PASAJEROS</div>
                <div>{reservation.passengers.length}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Detalles del viaje */}
        <div className="mb-6">
          <h2 className="text-base font-medium mb-3 border-b pb-2">Detalles del Viaje</h2>
          <div className="bg-gray-50 p-4 rounded-md">            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
              <div>
                <div className="text-sm text-gray-500 font-medium">ORIGEN</div>
                <div>{reservation.trip.segmentOrigin || reservation.trip.route?.origin}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 font-medium">DESTINO</div>
                <div>{reservation.trip.segmentDestination || reservation.trip.route?.destination}</div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500 font-medium">FECHA</div>
                <div>{formatDate(reservation.trip.departureDate)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 font-medium">HORA</div>
                <div>{reservation.trip.departureTime}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Información de pago */}
        <div className="mb-6">
          <h2 className="text-base font-medium mb-3 border-b pb-2">Información de Pago</h2>
          <div className="bg-gray-50 p-4 rounded-md">
            {/* Visualización para reservaciones canceladas */}
            {reservation.status === 'canceled' ? (
              <>
                {reservation.paymentStatus === 'pagado' ? (
                  <>
                    {/* Visualización para reservaciones canceladas pero pagadas */}
                    <div className="grid grid-cols-2 items-center mb-3">
                      <div className="text-sm text-gray-500 font-medium">TOTAL PAGADO</div>
                      <div className="text-right font-medium">{formatPrice(reservation.totalAmount)}</div>
                    </div>
                    
                    <div className="grid grid-cols-2 items-center mb-3">
                      <div className="text-sm text-gray-500 font-medium">MÉTODO DE PAGO</div>
                      <div className="text-right">{reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Visualización para reservaciones canceladas sin pagar */}
                    <div className="grid grid-cols-2 items-center mb-3">
                      <div className="text-sm text-gray-500 font-medium">PRECIO ORIGINAL</div>
                      <div className="text-right font-medium line-through text-gray-500">{formatPrice(reservation.totalAmount)}</div>
                    </div>
                    
                    <div className="grid grid-cols-2 items-center mb-3">
                      <div className="text-sm text-gray-500 font-medium">INGRESO REAL</div>
                      <div className="text-right font-medium">{formatPrice(reservation.advanceAmount || 0)}</div>
                    </div>
                  </>
                )}
                
                {/* Para ambos casos de reservación cancelada, mostrar información de anticipo si existe */}
                {(reservation.advanceAmount && reservation.advanceAmount > 0) && (
                  <>
                    <div className="grid grid-cols-2 items-center mb-3">
                      <div className="text-sm text-gray-500 font-medium">ANTICIPO RETENIDO</div>
                      <div className="text-right font-medium">{formatPrice(reservation.advanceAmount)}</div>
                    </div>
                    
                    <div className="grid grid-cols-2 items-center mb-3">
                      <div className="text-sm text-gray-500 font-medium">MÉTODO ANTICIPO</div>
                      <div className="text-right">{reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</div>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                {/* NUEVO FORMATO MEJORADO PARA INFORMACIÓN DE PAGO */}
                {(() => {
                  const hasAdvance = reservation.advanceAmount && reservation.advanceAmount > 0;
                  const isPaid = reservation.paymentStatus === 'pagado';
                  const remainingAmount = reservation.totalAmount - (reservation.advanceAmount || 0);
                  
                  if (hasAdvance && isPaid) {
                    // Escenario 3: Hay anticipo Y ya está pagado completamente
                    return (
                      <>
                        <div className="grid grid-cols-2 items-center mb-3">
                          <div className="text-sm text-gray-500 font-medium">ANTICIPO</div>
                          <div className="text-right font-medium">{formatPrice(reservation.advanceAmount)} ({reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})</div>
                        </div>
                        
                        <div className="grid grid-cols-2 items-center mb-3">
                          <div className="text-sm text-gray-500 font-medium">PAGÓ</div>
                          <div className="text-right font-medium">{formatPrice(remainingAmount)} ({reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})</div>
                        </div>
                        
                        <div className="grid grid-cols-2 items-center font-semibold">
                          <div className="text-sm text-gray-700 font-medium">TOTAL</div>
                          <div className="text-right">{formatPrice(reservation.totalAmount)}</div>
                        </div>
                      </>
                    );
                  } else if (hasAdvance && !isPaid) {
                    // Escenario 1: Hay anticipo PERO el restante no está pagado aún
                    return (
                      <>
                        <div className="grid grid-cols-2 items-center mb-3">
                          <div className="text-sm text-gray-500 font-medium">ANTICIPO</div>
                          <div className="text-right font-medium">{formatPrice(reservation.advanceAmount)} ({reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})</div>
                        </div>
                        
                        <div className="grid grid-cols-2 items-center mb-3">
                          <div className="text-sm text-gray-500 font-medium">RESTA</div>
                          <div className="text-right font-medium">{formatPrice(remainingAmount)} ({reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})</div>
                        </div>
                        
                        <div className="grid grid-cols-2 items-center font-semibold">
                          <div className="text-sm text-gray-700 font-medium">TOTAL</div>
                          <div className="text-right">{formatPrice(reservation.totalAmount)}</div>
                        </div>
                      </>
                    );
                  } else {
                    // Escenario 2: NO existe anticipo
                    return (
                      <>
                        <div className="grid grid-cols-2 items-center mb-3">
                          <div className="text-sm text-gray-500 font-medium">RESTA</div>
                          <div className="text-right font-medium">{formatPrice(reservation.totalAmount)} ({reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})</div>
                        </div>
                        
                        <div className="grid grid-cols-2 items-center font-semibold">
                          <div className="text-sm text-gray-700 font-medium">TOTAL</div>
                          <div className="text-right">{formatPrice(reservation.totalAmount)}</div>
                        </div>
                      </>
                    );
                  }
                })()}
              </>
            )}
            
            {/* Botón para marcar como pagado */}
            {reservation.paymentStatus !== 'pagado' && user && reservation.status !== 'canceled' && (
              <Button 
                onClick={markAsPaid} 
                disabled={isMarkingAsPaid}
                className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white"
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
            
            {/* Mensaje si está cancelada */}
            {reservation.status === 'canceled' && (
              <div className="w-full mt-4 p-3 bg-red-50 border border-red-200 rounded text-center text-red-600 text-sm">
                Esta reservación está cancelada y no puede ser procesada.
              </div>
            )}
          </div>
        </div>
        
        {/* Notas */}
        {reservation.notes && (
          <div className="mb-6">
            <h2 className="text-base font-medium mb-3 border-b pb-2">Notas</h2>
            <div className="bg-gray-50 p-4 rounded-md">
              <p>{reservation.notes}</p>
            </div>
          </div>
        )}
        
        {/* Información de verificación (si ya se verificó) */}
        {reservation.checkedBy && (
          <div className="text-center text-sm text-green-600 bg-green-50 p-3 rounded-md flex items-center justify-center mb-4">
            <CheckCircle className="w-5 h-5 mr-2" />
            {reservation.checkCount > 1 
              ? `Ticket verificado ${reservation.checkCount} veces`
              : 'Ticket verificado correctamente'}
          </div>
        )}
      </Card>
      
      {/* Modal de confirmación de ticket escaneado */}
      {ticketCheckResult && (
        <TicketCheckedModal
          isOpen={isTicketModalOpen}
          onClose={() => setIsTicketModalOpen(false)}
          reservation={ticketCheckResult.reservation}
          isFirstScan={ticketCheckResult.isFirstScan}
        />
      )}
      
      {/* Modal de reservación cancelada */}
      {reservation && (
        <ReservationCanceledModal
          isOpen={isCanceledModalOpen}
          onClose={() => setIsCanceledModalOpen(false)}
          reservation={reservation}
        />
      )}
    </div>
  );
}